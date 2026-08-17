import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from './settings';

/**
 * The live engine: Claude writes the Net's content. One thin wrapper so
 * every generator (feed, replies, comments, paper, pod) shares the same
 * model, streaming, and JSON-extraction behavior.
 *
 * Model: claude-opus-5 with adaptive thinking — the writing is creative but
 * must stay strictly factual to the week's data, which benefits from letting
 * the model think when the slate is complicated.
 */

const MODEL = 'claude-opus-5';

export function hasLiveEngine(): boolean {
  return getApiKey().length > 0;
}

export class NetClaudeError extends Error {}

/**
 * Runs one generation call and returns the parsed JSON payload the prompt
 * asked for. Throws NetClaudeError on any failure (bad key, network, refusal,
 * unparseable output) — callers fall back to the offline engine.
 */
export async function generateJson<T>(
  system: string,
  user: string,
  maxTokens = 4000,
  /** data: URLs of stills — lets the model actually SEE a clip's frames. */
  images: string[] = [],
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new NetClaudeError('No API key configured.');
  const client = new Anthropic({ apiKey });
  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  for (const dataUrl of images.slice(0, 4)) {
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) continue;
    imageBlocks.push({
      type: 'image',
      source: { type: 'base64', media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/webp', data: match[2] },
    });
  }
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system,
      messages: [
        {
          role: 'user',
          content: imageBlocks.length ? [...imageBlocks, { type: 'text', text: user }] : user,
        },
      ],
    });
    const message = await stream.finalMessage();
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    // The prompts ask for bare JSON; tolerate a model that wraps it anyway.
    const match = text.match(/[[{][\s\S]*[\]}]/);
    if (!match) throw new NetClaudeError('Model output contained no JSON.');
    return JSON.parse(match[0]) as T;
  } catch (err) {
    if (err instanceof NetClaudeError) throw err;
    throw new NetClaudeError(err instanceof Error ? err.message : 'Claude request failed.');
  }
}
