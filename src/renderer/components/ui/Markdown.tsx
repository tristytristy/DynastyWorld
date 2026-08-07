import type { ReactNode } from 'react';

/**
 * A small Markdown renderer for the release notes GitHub hands us.
 *
 * Deliberately NOT a library, and deliberately NOT dangerouslySetInnerHTML:
 * this text arrives over the network and is rendered inside a privileged
 * Electron renderer, so it is parsed into React ELEMENTS and never into HTML.
 * Anything unrecognised — including raw <script> or <img onerror=...> — comes
 * out as literal text, because React escapes it. That property is the whole
 * point of hand-rolling this, so keep it: no innerHTML, ever.
 *
 * Supports what a release note actually uses: headings, bold, italic, inline
 * code, fenced code, links, bullet and numbered lists, blockquotes, tables and
 * rules. Emoji need no handling — they're just text.
 */

/** Only these schemes are clickable; anything else renders as plain text. */
function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

/**
 * Inline formatting. Ordered so code spans win over everything (their contents
 * must stay literal), then links, then emphasis.
 */
const INLINE = /(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*|_[^_]+_)/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;

  while (rest.length > 0) {
    const match = INLINE.exec(rest);
    if (!match || match.index === undefined) {
      out.push(rest);
      break;
    }
    if (match.index > 0) out.push(rest.slice(0, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith('`')) {
      out.push(
        <code key={key} className="rounded-none bg-slate-200/70 px-1 py-0.5 font-mono text-[0.95em] text-slate-700 dark:bg-white/10 dark:text-slate-200">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('[')) {
      const split = token.indexOf('](');
      const label = token.slice(1, split);
      const href = safeHref(token.slice(split + 2, -1));
      out.push(
        href ? (
          <a
            key={key}
            href={href}
            onClick={(e) => {
              // Never navigate the app itself — hand the URL to the OS browser.
              e.preventDefault();
              window.api.update.openLink(href);
            }}
            className="text-[var(--team-accent-text)] underline underline-offset-2"
          >
            {label}
          </a>
        ) : (
          <span key={key}>{label}</span>
        ),
      );
    } else if (token.startsWith('**')) {
      out.push(
        <strong key={key} className="font-semibold text-slate-800 dark:text-slate-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    rest = rest.slice(match.index + token.length);
  }
  return out;
}

const isTableDivider = (line: string) => /^\s*\|?[\s:-]*-[\s|:-]*\|?\s*$/.test(line) && line.includes('-');
const splitRow = (line: string) =>
  line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());


/*
  GITHUB SOMETIMES HANDS US HTML, NOT MARKDOWN.

  electron-updater's GitHub provider reads the releases ATOM FEED, and that
  feed carries release notes already rendered to HTML. Fed to the Markdown
  parser below they came out as literal text — users saw `<h1>DynastyOS
  4.3.5</h1> <p>A maintenance release.` on the update card.

  So HTML is parsed too, and parsed the same way for the same reason: into
  React ELEMENTS, never innerHTML. DOMParser builds an INERT document — scripts
  do not run, `<img onerror>` never fires, external references are not fetched —
  and then only an allowlist of tags is converted. Anything else contributes its
  text and nothing more, so an unknown or hostile tag degrades to the words
  inside it rather than to markup.

  Keep that property. The whole reason this file exists instead of a library is
  that release notes arrive over the network into a privileged renderer.
*/

function looksLikeHtml(source: string): boolean {
  // A markdown note can mention a tag in prose; a rendered one OPENS with markup.
  return /<(p|h[1-6]|ul|ol|li|blockquote|pre|div|br)\b[^>]*>/i.test(source);
}

function htmlNodeToReact(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  const kids = Array.from(el.childNodes).map((child, i) => htmlNodeToReact(child, `${key}-${i}`));

  switch (tag) {
    case 'BR':
      return <br key={key} />;
    case 'HR':
      return <hr key={key} className="my-3 border-slate-200 dark:border-white/10" />;
    case 'H1':
    case 'H2':
      return <p key={key} className="mt-3 font-semibold text-slate-950 first:mt-0 dark:text-white">{kids}</p>;
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return <p key={key} className="mt-3 font-semibold text-slate-800 first:mt-0 dark:text-slate-100">{kids}</p>;
    case 'STRONG':
    case 'B':
      return <strong key={key} className="font-semibold text-slate-900 dark:text-white">{kids}</strong>;
    case 'EM':
    case 'I':
      return <em key={key}>{kids}</em>;
    case 'CODE':
      return <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] dark:bg-white/10">{kids}</code>;
    case 'PRE':
      return <pre key={key} className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-white/10">{kids}</pre>;
    case 'UL':
      return <ul key={key} className="mt-2 list-disc space-y-1 pl-5">{kids}</ul>;
    case 'OL':
      return <ol key={key} className="mt-2 list-decimal space-y-1 pl-5">{kids}</ol>;
    case 'LI':
      return <li key={key}>{kids}</li>;
    case 'BLOCKQUOTE':
      return (
        <blockquote key={key} className="mt-2 border-l-2 border-slate-300 pl-3 italic text-slate-500 dark:border-white/20 dark:text-slate-400">
          {kids}
        </blockquote>
      );
    case 'A': {
      // Same scheme allowlist as the markdown path — javascript: never renders as a link.
      const href = safeHref(el.getAttribute('href') ?? '');
      return href ? (
        <a key={key} href={href} target="_blank" rel="noreferrer" className="text-[var(--team-primary)] underline">
          {kids}
        </a>
      ) : (
        <span key={key}>{kids}</span>
      );
    }
    case 'P':
      return <p key={key} className="mt-2 first:mt-0">{kids}</p>;
    /*
      Dropped ENTIRELY, contents and all. These are the two tags whose text is
      code rather than prose: the default branch below keeps an unknown tag's
      words, which is right for a <span> and wrong for a <script> — the parse is
      inert so nothing would run, but the source would be printed on the update
      card as if it were part of the notes.
    */
    case 'SCRIPT':
    case 'STYLE':
    case 'IFRAME':
    case 'OBJECT':
      return null;
    default:
      // Unknown tag: keep the words, drop the element.
      return <span key={key}>{kids}</span>;
  }
}

function HtmlNotes({ source }: { source: string }) {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const nodes = Array.from(doc.body.childNodes).map((n, i) => htmlNodeToReact(n, `h${i}`));
  return <>{nodes}</>;
}

export function Markdown({ source }: { source: string }) {
  // Rendered HTML from the releases feed takes the HTML path; hand-written
  // markdown takes the parser below. See looksLikeHtml.
  if (looksLikeHtml(source)) return <HtmlNotes source={source} />;

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto border border-slate-200/70 bg-slate-100/70 p-2 font-mono text-[11px] leading-5 text-slate-600 dark:border-white/10 dark:bg-black/40 dark:text-slate-300"
        >
          {body.join('\n')}
        </pre>,
      );
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      blocks.push(<hr key={key++} className="border-slate-200/70 dark:border-white/10" />);
      i++;
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const size = level <= 1 ? 'text-sm' : level === 2 ? 'text-[13px]' : 'text-xs';
      blocks.push(
        <p key={key++} className={`${size} font-semibold text-slate-800 dark:text-slate-100`}>
          {renderInline(heading[2], `h${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    // Table: a header row followed by a |---|---| divider
    if (line.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i++]));
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {head.map((cell, c) => (
                  <th key={c} className="border-b border-slate-200/70 py-1 pr-3 font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
                    {renderInline(cell, `th${key}-${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border-b border-slate-200/40 py-1 pr-3 align-top dark:border-white/5">
                      {renderInline(cell, `td${key}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-slate-300 pl-3 text-slate-600 dark:border-white/20 dark:text-slate-300">
          {renderInline(body.join(' '), `bq${key}`)}
        </blockquote>,
      );
      continue;
    }

    // Lists
    const bullet = /^\s*[-*+]\s+(.*)$/;
    const numbered = /^\s*\d+[.)]\s+(.*)$/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = !bullet.test(line);
      const pattern = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(pattern.exec(lines[i])![1]);
        i++;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={key++} className={`ml-4 space-y-0.5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((item, n) => (
            <li key={n}>{renderInline(item, `li${key}-${n}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — consume until a blank line or the start of another block.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*(```|>|#{1,6}\s)/.test(lines[i]) &&
      !bullet.test(lines[i]) &&
      !numbered.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push(<p key={key++}>{renderInline(para.join(' '), `p${key}`)}</p>);
  }

  return <div className="space-y-2">{blocks}</div>;
}
