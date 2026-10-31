import type { ReactNode } from 'react';
import type { NetPost } from '../../../shared/netTypes';

/**
 * One post (or comment) card with its replies — the shared rendering for the
 * Feed and DynastyTube comment sections. Deliberately reads like a social
 * card: bold display name, muted handle, body, a like count.
 */

function Avatar({ handle, isUser }: { handle: string; isUser: boolean }) {
  // Deterministic hue from the handle so every account keeps its color.
  let hash = 0;
  for (let i = 0; i < handle.length; i++) hash = (hash * 31 + handle.charCodeAt(i)) | 0;
  const hue = ((hash % 360) + 360) % 360;
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{ backgroundColor: isUser ? '#b45309' : `hsl(${hue}deg 45% 40%)` }}
    >
      {handle.replace('@', '').slice(0, 2).toUpperCase()}
    </div>
  );
}

/**
 * Body text with M:SS timestamps rendered as seek links (DynastyTube watch
 * page). Only sensible clock values become links; everything else is text.
 */
function BodyWithTimestamps({ body, onTimestamp }: { body: string; onTimestamp: (seconds: number) => void }) {
  const parts = body.split(/(\b\d{1,2}:[0-5]\d\b)/g);
  return (
    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
      {parts.map((part, i) => {
        const m = /^(\d{1,2}):([0-5]\d)$/.exec(part);
        if (!m) return part;
        const seconds = Number(m[1]) * 60 + Number(m[2]);
        return (
          <button
            key={i}
            className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
            title="Jump to this moment"
            onClick={() => onTimestamp(seconds)}
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}

export function PostCard({
  post,
  compact = false,
  onReply,
  replyBox,
  onTimestamp,
}: {
  post: NetPost;
  compact?: boolean;
  /** When set, the card offers a Reply action (used by the Feed). */
  onReply?: (post: NetPost) => void;
  /** Rendered under the replies while this card's composer is open. */
  replyBox?: ReactNode;
  /** When set (DynastyTube), M:SS in bodies becomes a seek link. */
  onTimestamp?: (seconds: number) => void;
}) {
  const isUser = post.accountKind === 'user';
  return (
    <div
      className={`border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-white/5 ${
        isUser ? 'border-amber-300/70 dark:border-amber-500/40' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {!compact && <Avatar handle={post.handle} isUser={isUser} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">{post.displayName}</span>{' '}
            <span className="text-slate-400 dark:text-slate-500">
              {post.handle}
              {post.week > 0 ? ` · wk ${post.week}` : ''}
            </span>
          </p>
          {onTimestamp ? (
            <BodyWithTimestamps body={post.body} onTimestamp={onTimestamp} />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">{post.body}</p>
          )}
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            ♥ {post.likes.toLocaleString()}
            {onReply && (
              <>
                {' · '}
                <button
                  className="font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  onClick={() => onReply(post)}
                >
                  Reply
                </button>
              </>
            )}
          </p>
          {post.replies.length > 0 && (
            <div className="mt-3 space-y-2 border-l-2 border-slate-200/80 pl-3 dark:border-slate-700">
              {post.replies.map((reply) => (
                <PostCard key={reply.id} post={reply} compact onTimestamp={onTimestamp} />
              ))}
            </div>
          )}
          {replyBox}
        </div>
      </div>
    </div>
  );
}
