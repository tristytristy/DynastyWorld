import { createContext, Fragment, useCallback, useContext, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { NetFeedView, NetInboxView, NetPost } from '../../../shared/netTypes';
import { PageMasthead } from '../../components/common/PageMasthead';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';

/**
 * TheSideline.net — the message board, rendered the way its culture demands
 * (user direction, 2026-08-22, with real r/CFB game threads as reference):
 * reddit-shaped, not forum-shaped. Vote counts, "Posted by" metadata, team
 * flairs as chips, nested comment chains with indent rails, and quote lines
 * (">") styled as quotes. Game threads are OP'd by the score bot with a
 * box-score body; the life is in the comments.
 *
 * 2026-09-28: any comment can be replied to (the board answers under YOUR
 * comment, immediately), chains nest to reddit depth, [tube:ID] citations
 * link to DynastyTube, and Load more comments / Load more threads generate
 * on demand like the Tube's More comments button.
 */

/** "corn_husked_2011 [Nebraska]" -> name + flair chip text. */
function splitFlair(displayName: string): { name: string; flair: string | null } {
  const m = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(displayName);
  return m ? { name: m[1], flair: m[2] } : { name: displayName, flair: null };
}

function formatVotes(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function countComments(t: NetPost): number {
  return t.replies.reduce((sum, r) => sum + 1 + countComments(r), 0);
}

function FlairChip({ flair, bot }: { flair: string | null; bot: boolean }) {
  if (!flair) return null;
  return (
    <span
      className={`ml-1.5 inline-block rounded-sm px-1.5 py-px text-[10px] font-semibold leading-4 ${
        bot
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
      }`}
    >
      {flair}
    </span>
  );
}

/** Everything a comment anywhere in the tree needs — carried by context so the recursion stays small. */
interface BoardEnvValue {
  base: string;
  tubeTitles: Map<number, string>;
  userFlair: string;
  onVote: (postId: number, delta: 1 | -1) => void;
  revealed: Set<number>;
  onReveal: (postId: number) => void;
  /** Null when the user has no Net account yet — Reply is hidden. */
  userHandle: string | null;
  replyTarget: number | null;
  setReplyTarget: (postId: number | null) => void;
  commentDraft: string;
  setCommentDraft: (text: string) => void;
  submitCommentReply: (parentId: number) => void;
  busy: boolean;
}

const BoardEnv = createContext<BoardEnvValue | null>(null);

/** One line of text with [tube:ID] citations turned into DynastyTube links. */
function InlineText({ text }: { text: string }) {
  const env = useContext(BoardEnv);
  const parts = text.split(/\[tube:(\d+)\]/g);
  if (parts.length === 1 || !env) return <>{text.replace(/\s?\[tube:\d+\]/g, '')}</>;
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const mediaId = Number(part);
        return (
          <Link
            key={i}
            to={`${env.base}/net/tube?media=${mediaId}`}
            className="mx-0.5 inline-flex items-baseline gap-1 whitespace-nowrap text-xs font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
            title="Watch on DynastyTube"
          >
            ▶ {env.tubeTitles.get(mediaId) ?? 'clip'}
          </Link>
        );
      })}
    </>
  );
}

/** Body text with ">" quote lines, "- " bullets, and Tube citations styled reddit-style. */
function CommentBody({ body }: { body: string }) {
  const lines = body.split('\n');
  return (
    <div className="mt-0.5 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
      {lines.map((line, i) => {
        if (line.startsWith('>')) {
          return (
            <p key={i} className="my-0.5 border-l-2 border-slate-300 pl-2 text-slate-500 dark:border-slate-600 dark:text-slate-400">
              <InlineText text={line.replace(/^>\s?/, '')} />
            </p>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <p key={i} className="my-0.5 pl-4">
              <span className="mr-1.5 text-slate-400">•</span>
              <InlineText text={line.slice(2)} />
            </p>
          );
        }
        return line.trim() === '' ? (
          <div key={i} className="h-2" />
        ) : (
          <p key={i} className="my-0.5">
            <InlineText text={line} />
          </p>
        );
      })}
    </div>
  );
}

function CommentHeader({
  post,
  userFlair,
  onVote,
}: {
  post: NetPost;
  userFlair: string;
  onVote: (postId: number, delta: 1 | -1) => void;
}) {
  const isUser = post.accountKind === 'user';
  const { name, flair } = isUser ? { name: post.displayName, flair: userFlair || null } : splitFlair(post.displayName);
  const bot = flair === 'Bot';
  return (
    <p className="flex flex-wrap items-center text-xs">
      <span className={`font-bold ${isUser ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>{name}</span>
      <FlairChip flair={flair} bot={bot} />
      <span className={`ml-2 ${post.likes < 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
        {formatVotes(post.likes)} point{Math.abs(post.likes) === 1 ? '' : 's'}
      </span>
      {/* your votes count — each tap really moves the number */}
      <span className="ml-1.5 inline-flex overflow-hidden rounded-full">
        <button
          className="px-1 text-slate-400 hover:text-orange-600 dark:text-slate-500 dark:hover:text-orange-400"
          title="Upvote"
          onClick={() => onVote(post.id, 1)}
        >
          ▲
        </button>
        <button
          className="px-1 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
          title="Downvote"
          onClick={() => onVote(post.id, -1)}
        >
          ▼
        </button>
      </span>
    </p>
  );
}

/** Reddit hides what the hivemind buried — half the texture is the click to look anyway. */
const COLLAPSE_BELOW = 0;
/** Past this depth, chains keep going but stop indenting — a narrow app window stays readable. */
const MAX_INDENT = 5;

type CommentSort = 'best' | 'new' | 'controversial';

function sortComments(replies: NetPost[], sort: CommentSort): NetPost[] {
  const sorted = [...replies];
  if (sort === 'best') sorted.sort((a, b) => b.likes - a.likes);
  else if (sort === 'new') sorted.sort((a, b) => b.id - a.id);
  // controversial: the buried and barely-tolerated first, crowd favorites last.
  else sorted.sort((a, b) => a.likes - b.likes);
  return sorted;
}

function Comment({ post, depth }: { post: NetPost; depth: number }) {
  const env = useContext(BoardEnv);
  if (!env) return null;
  const hidden = post.likes < COLLAPSE_BELOW && post.accountKind !== 'user' && !env.revealed.has(post.id);
  if (hidden) {
    return (
      <div className={depth === 0 ? 'pt-3' : 'pt-2'}>
        <button
          className="text-xs italic text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          onClick={() => env.onReveal(post.id)}
        >
          [+] comment score below threshold — click to show
        </button>
      </div>
    );
  }
  const composing = env.replyTarget === post.id;
  return (
    <div className={depth === 0 ? 'pt-3' : 'pt-2'}>
      <CommentHeader post={post} userFlair={env.userFlair} onVote={env.onVote} />
      <CommentBody body={post.body} />
      {env.userHandle && (
        <button
          className="mt-0.5 text-xs font-semibold text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
          onClick={() => {
            env.setReplyTarget(composing ? null : post.id);
            env.setCommentDraft('');
          }}
        >
          {composing ? 'Cancel' : 'Reply'}
        </button>
      )}
      {composing && (
        <div className="mt-1.5 flex gap-2">
          <input
            autoFocus
            value={env.commentDraft}
            onChange={(e) => env.setCommentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && env.commentDraft.trim() && !env.busy) env.submitCommentReply(post.id);
              if (e.key === 'Escape') env.setReplyTarget(null);
            }}
            placeholder={`Reply as ${env.userHandle}…`}
            className="min-w-0 flex-1 border border-slate-300/80 bg-transparent px-2.5 py-1 text-sm dark:border-slate-600"
          />
          <button
            className="border border-slate-300/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-500 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300"
            disabled={env.busy || !env.commentDraft.trim()}
            onClick={() => env.submitCommentReply(post.id)}
          >
            {env.busy ? 'The board is typing…' : 'Reply'}
          </button>
        </div>
      )}
      {post.replies.length > 0 && (
        <div
          className={
            depth < MAX_INDENT
              ? 'ml-2 mt-1 space-y-1 border-l-2 border-slate-200 pl-3 dark:border-slate-700'
              : 'mt-1 space-y-1'
          }
        >
          {post.replies.map((r) => (
            <Comment key={r.id} post={r} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NetBoard() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId, seasons } = useSelectedSeason();
  const teamName = seasons.find((s) => s.id === selectedSeasonId)?.teamName ?? null;
  const [threads, setThreads] = useState<NetPost[]>([]);
  const [userAccount, setUserAccount] = useState<NetFeedView['userAccount']>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState<'week' | 'thread' | 'reply' | 'more' | 'threads' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [userFlair, setUserFlair] = useState('');
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [sort, setSort] = useState<CommentSort>('best');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [inbox, setInbox] = useState<NetInboxView | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  // What counted as unread when the panel opened — kept highlighted until close.
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const [replyTarget, setReplyTarget] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [tubeTitles, setTubeTitles] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!id) return;
    window.api.net.getBoardFlair(id).then(setUserFlair);
  }, [id]);

  // Titles for [tube:ID] citation links — the board only cites this season's uploads.
  useEffect(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.media.list(id, selectedSeasonId).then((items) =>
      setTubeTitles(new Map((items ?? []).map((m) => [m.id, m.tubeTitle || m.description || 'clip']))),
    );
  }, [id, selectedSeasonId]);

  useEffect(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.db
      .getLeagueTeams(id, selectedSeasonId)
      .then((teams) => setTeamNames((teams ?? []).map((t) => t.displayName).sort((a, b) => a.localeCompare(b))));
  }, [id, selectedSeasonId]);

  const reload = useCallback(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.net.getThreads(id, selectedSeasonId).then(setThreads);
    window.api.net.getFeed(id, selectedSeasonId).then((view) => setUserAccount(view.userAccount));
    window.api.net.getInbox(id).then(setInbox);
  }, [id, selectedSeasonId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!id || selectedSeasonId === undefined) return null;

  const vote = (postId: number, delta: 1 | -1) => {
    void window.api.net.votePost(id, postId, delta).then((likes) => {
      // Patch the number in place — a full reload would collapse the thread.
      setThreads((prev) => {
        const patch = (p: NetPost): NetPost =>
          p.id === postId ? { ...p, likes } : { ...p, replies: p.replies.map(patch) };
        return prev.map(patch);
      });
    });
  };

  const saveFlair = (flair: string) => {
    setUserFlair(flair);
    void window.api.net.setBoardFlair(id, flair).then(setUserFlair);
  };

  const unreadCount = inbox ? inbox.items.filter((i) => i.id > inbox.lastSeenId).length : 0;

  const toggleInbox = () => {
    if (!inboxOpen && inbox) {
      // Remember what was fresh for the highlight, then move the watermark.
      setFreshIds(new Set(inbox.items.filter((i) => i.id > inbox.lastSeenId).map((i) => i.id)));
      const newest = inbox.items[0]?.id ?? 0;
      if (newest > inbox.lastSeenId) {
        void window.api.net.markInboxSeen(id, newest);
        setInbox({ ...inbox, lastSeenId: newest });
      }
    }
    setInboxOpen((v) => !v);
  };

  const reactToBracket = async () => {
    setBusy('week');
    setNotice(null);
    try {
      const result = await window.api.net.generateSelection(id, selectedSeasonId);
      if (result.message) setNotice(result.message);
      reload();
    } catch (err) {
      setNotice(`Something broke: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const generateWeek = async (regenerate: boolean) => {
    setBusy('week');
    setNotice(null);
    try {
      const result = await window.api.net.generateBoardWeek(id, selectedSeasonId, regenerate);
      if (result.message) setNotice(result.message);
      reload();
    } catch (err) {
      setNotice(`Something broke: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const submitThread = async () => {
    if (!titleDraft.trim() || !bodyDraft.trim() || !userAccount) return;
    setBusy('thread');
    setNotice(null);
    try {
      const result = await window.api.net.createThread(id, selectedSeasonId, userAccount.id, titleDraft.trim(), bodyDraft.trim());
      setTitleDraft('');
      setBodyDraft('');
      setComposing(false);
      if (result.message) setNotice(result.message);
      reload();
    } finally {
      setBusy(null);
    }
  };

  /*
    One path for both composers: the thread-level box (parentId null) and the
    per-comment Reply box. Either way the board answers immediately, UNDER
    the user's comment. After a thread-level comment the sort flips to "new"
    so the fresh comment and its replies sit at the top instead of sinking
    to the bottom of "best" with zero points.
  */
  const submitReply = async (threadId: number, parentId: number | null = null) => {
    const text = (parentId === null ? replyDraft : commentDraft).trim();
    if (!text || !userAccount) return;
    setBusy('reply');
    setNotice(null);
    try {
      const result = await window.api.net.replyToThread(id, selectedSeasonId, userAccount.id, threadId, text, parentId);
      if (parentId === null) {
        setReplyDraft('');
        setSort('new');
      } else {
        setCommentDraft('');
        setReplyTarget(null);
      }
      if (result.message) setNotice(result.message);
      reload();
    } catch (err) {
      setNotice(`Something broke: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const loadMoreComments = async (threadId: number) => {
    setBusy('more');
    setNotice(null);
    try {
      const result = await window.api.net.generateMoreComments(id, selectedSeasonId, threadId);
      if (result.message) setNotice(result.message);
      else if (result.postsAdded > 0) setNotice(`${result.postsAdded} new comment${result.postsAdded === 1 ? '' : 's'} — sorted by new so you can find them.`);
      if (result.postsAdded > 0) setSort('new');
      reload();
    } catch (err) {
      setNotice(`Something broke: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const loadMoreThreads = async () => {
    setBusy('threads');
    setNotice(null);
    try {
      const result = await window.api.net.generateMoreThreads(id, selectedSeasonId);
      if (result.message) setNotice(result.message);
      reload();
    } catch (err) {
      setNotice(`Something broke: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  // The open thread's id, for the per-comment Reply box — replies go to that thread.
  const env: BoardEnvValue = {
    base: `/dynasty/${id}`,
    tubeTitles,
    userFlair,
    onVote: (postId, delta) => vote(postId, delta),
    revealed,
    onReveal: (pid) => setRevealed((prev) => new Set(prev).add(pid)),
    userHandle: userAccount?.handle ?? null,
    replyTarget,
    setReplyTarget,
    commentDraft,
    setCommentDraft,
    submitCommentReply: (parentId) => {
      if (openId !== null) void submitReply(openId, parentId);
    },
    busy: busy !== null,
  };

  const buttonClass =
    'border border-slate-300/80 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-500 hover:text-slate-950 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-white';

  return (
    <div className="space-y-5">
      <PageMasthead
        eyebrow="The Net"
        title="TheSideline.net"
        description="The national board. Game threads for every big game in the country, team flairs, rival fanbases in each other's replies. Start a thread or jump into the pile."
        mark={{ kind: 'logo', teamAssetName: teamName ?? '' }}
      />

      <SurfaceCard>
        <div className="flex flex-wrap items-center gap-2">
          <button className={buttonClass} disabled={busy !== null} onClick={() => void generateWeek(false)}>
            {busy === 'week' ? 'The board is typing…' : "Let the board react to this week"}
          </button>
          <button
            className={buttonClass}
            disabled={busy !== null}
            onClick={() => void generateWeek(true)}
            title="Wipe this week's bot threads and regenerate them (your threads and replies stay)"
          >
            Regenerate week
          </button>
          <button
            className={buttonClass}
            disabled={busy !== null}
            onClick={() => void reactToBracket()}
            title="Fire between entering the postseason and the first round kicking off: the Feed and Board react to the bracket reveal — snubs, seeding outrage, paths to the title"
          >
            🏈 Bracket reveal
          </button>
          <button
            className={buttonClass}
            disabled={busy !== null}
            onClick={() => void loadMoreThreads()}
            title="The board starts 2-3 fresh discussion threads that fit where the season is — never repeating what's already up"
          >
            {busy === 'threads' ? 'Starting threads…' : '+ Load more threads'}
          </button>
          <button
            className={`relative ${buttonClass}`}
            onClick={toggleInbox}
            title="Replies to your threads and comments"
          >
            ✉ Inbox
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 px-1.5 py-px text-[10px] font-bold leading-4 text-white">
                {unreadCount}
              </span>
            )}
          </button>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            Your flair
            <select
              value={userFlair}
              onChange={(e) => saveFlair(e.target.value)}
              className="border border-slate-300/80 bg-transparent px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
              title="Wear a team's colors on the board, or stay flairless old-guard — the regulars will treat you accordingly"
            >
              <option value="">flairless</option>
              {teamNames.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button
            className={buttonClass}
            disabled={!userAccount}
            onClick={() => setComposing((v) => !v)}
          >
            {composing ? 'Cancel' : '+ New thread'}
          </button>
        </div>
        {inboxOpen && (
          <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Replies to you
            </p>
            {(inbox?.items.length ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Nothing yet — post a thread or drop a comment, and check back after the next week generates.
              </p>
            ) : (
              <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/60">
                {inbox!.items.slice(0, 15).map((item) => {
                  const { name, flair } = splitFlair(item.displayName);
                  const fresh = freshIds.has(item.id);
                  const tid = item.threadId;
                  const row = (
                    <>
                      <p className="flex flex-wrap items-center text-xs">
                        {fresh && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />}
                        <span className="font-bold text-slate-700 dark:text-slate-300">{name}</span>
                        <FlairChip flair={flair} bot={flair === 'Bot'} />
                        <span className="ml-2 text-slate-400 dark:text-slate-500">
                          replied {item.threadTitle ? `in "${item.threadTitle}"` : item.mediaId !== null ? 'on DynastyTube' : 'on the Feed'} · wk {item.week}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs italic text-slate-400 dark:text-slate-500">
                        you: {item.inReplyTo}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-800 dark:text-slate-200">{item.body}</p>
                    </>
                  );
                  return tid !== null ? (
                    <button
                      key={item.id}
                      className="block w-full py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                      onClick={() => {
                        setOpenId(tid);
                        setInboxOpen(false);
                        window.setTimeout(() => {
                          document.getElementById(`board-thread-${tid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 80);
                      }}
                    >
                      {row}
                    </button>
                  ) : (
                    <div key={item.id} className="py-2">
                      {row}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {composing && (
          <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3 dark:border-slate-800">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder='Thread title ("Unpopular opinion: ...", "Am I crazy or ...")'
              className="w-full border border-slate-300/80 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600"
            />
            <textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              rows={3}
              placeholder="Say your piece."
              className="w-full resize-y border border-slate-300/80 bg-transparent px-3 py-2 text-sm dark:border-slate-600"
            />
            <div className="flex justify-end">
              <button
                className={buttonClass}
                disabled={busy !== null || !titleDraft.trim() || !bodyDraft.trim()}
                onClick={submitThread}
              >
                {busy === 'thread' ? 'Posting…' : 'Post thread'}
              </button>
            </div>
          </div>
        )}
        {notice && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{notice}</p>}
        {!userAccount && (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Generate a week of chatter on the Feed first — it sets up your account for the whole Net.
          </p>
        )}
      </SurfaceCard>

      {threads.length === 0 && (
        <SurfaceCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The board is empty — which has never once happened in the history of message boards. Fix it above.
          </p>
        </SurfaceCard>
      )}

      <div className="space-y-2">
        {threads.map((t) => {
          const open = openId === t.id;
          const isUser = t.accountKind === 'user';
          const { name: opName, flair: opFlair } = isUser
            ? { name: t.displayName, flair: userFlair || null }
            : splitFlair(t.displayName);
          const commentCount = countComments(t);
          return (
            <SurfaceCard key={t.id} id={`board-thread-${t.id}`}>
              <div className="flex items-start gap-3">
                {/* vote column, reddit-style — and the votes are yours to cast */}
                <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
                  <button
                    className="text-sm leading-none text-slate-400 hover:text-orange-600 dark:text-slate-500 dark:hover:text-orange-400"
                    title="Upvote"
                    onClick={() => vote(t.id, 1)}
                  >
                    ▲
                  </button>
                  <span className={`my-0.5 text-xs font-bold ${t.likes < 0 ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>{formatVotes(t.likes)}</span>
                  <button
                    className="text-sm leading-none text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                    title="Downvote"
                    onClick={() => vote(t.id, -1)}
                  >
                    ▼
                  </button>
                </div>
                <button
                  className="block min-w-0 flex-1 text-left"
                  onClick={() => {
                    setOpenId(open ? null : t.id);
                    setReplyDraft('');
                    setReplyTarget(null);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold leading-snug text-slate-950 dark:text-white">{t.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-baseline text-xs text-slate-400 dark:text-slate-500">
                      Posted by&nbsp;
                      <span className={isUser ? 'font-semibold text-amber-700 dark:text-amber-400' : 'font-semibold text-slate-500 dark:text-slate-400'}>
                        {opName}
                      </span>
                      <FlairChip flair={opFlair} bot={opFlair === 'Bot'} />
                      <span className="ml-2">· wk {t.week} · {commentCount} comment{commentCount === 1 ? '' : 's'}</span>
                    </p>
                  </div>
                </button>
              </div>
              {open && (
                <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                  {t.body.trim() !== '' && (
                    <div className="mb-2 border-b border-dashed border-slate-200/80 pb-3 dark:border-slate-800">
                      <CommentBody body={t.body} />
                    </div>
                  )}
                  {/* composer on top, reddit-style — your comment lands right under it */}
                  {userAccount && (
                    <div className="mb-2 flex gap-2">
                      <input
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && replyDraft.trim() && busy === null) void submitReply(t.id);
                        }}
                        placeholder={`Comment as ${userAccount.handle}…`}
                        className="min-w-0 flex-1 border border-slate-300/80 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600"
                      />
                      <button
                        className={buttonClass}
                        disabled={busy !== null || !replyDraft.trim()}
                        onClick={() => void submitReply(t.id)}
                      >
                        {busy === 'reply' && replyTarget === null ? 'The board is typing…' : 'Comment'}
                      </button>
                    </div>
                  )}
                  {t.replies.length > 1 && (
                    <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      sorted by:
                      {(['best', 'new', 'controversial'] as const).map((s) => (
                        <button
                          key={s}
                          className={`px-1 font-semibold ${sort === s ? 'text-slate-800 underline dark:text-slate-200' : 'hover:text-slate-600 dark:hover:text-slate-300'}`}
                          onClick={() => setSort(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </p>
                  )}
                  <BoardEnv.Provider value={env}>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {sortComments(t.replies, sort).map((r) => (
                        <Comment key={r.id} post={r} depth={0} />
                      ))}
                    </div>
                  </BoardEnv.Provider>
                  <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                    <button
                      className={buttonClass}
                      disabled={busy !== null}
                      onClick={() => void loadMoreComments(t.id)}
                      title="Late arrivals read the whole thread and add new takes, rebuttals, and replies to existing comments"
                    >
                      {busy === 'more' ? 'More people are typing…' : 'Load more comments'}
                    </button>
                    {notice && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{notice}</p>}
                  </div>
                </div>
              )}
            </SurfaceCard>
          );
        })}
      </div>

      {threads.length > 0 && (
        <div className="flex justify-center">
          <button className={buttonClass} disabled={busy !== null} onClick={() => void loadMoreThreads()}>
            {busy === 'threads' ? 'Starting threads…' : 'Load more threads'}
          </button>
        </div>
      )}
    </div>
  );
}
