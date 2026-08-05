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

export function Markdown({ source }: { source: string }) {
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
