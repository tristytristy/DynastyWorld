import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { NetFeedView, NetPost } from '../../../shared/netTypes';
import { PageMasthead } from '../../components/common/PageMasthead';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';

/**
 * TheSideline.net — the message board, rendered the way its culture demands
 * (user direction, 2026-08-22, with real r/CFB game threads as reference):
 * reddit-shaped, not forum-shaped. Vote counts, "Posted by" metadata, team
 * flairs as chips, one level of comment nesting with an indent rail, and
 * quote lines (">") styled as quotes. Game threads are OP'd by the score bot
 * with a box-score body; the life is in the comments.
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
  return t.replies.reduce((sum, r) => sum + 1 + r.replies.length, 0);
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

/** Body text with ">" quote lines and "- " stat bullets styled reddit-style. */
function CommentBody({ body }: { body: string }) {
  const lines = body.split('\n');
  return (
    <div className="mt-0.5 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
      {lines.map((line, i) => {
        if (line.startsWith('>')) {
          return (
            <p key={i} className="my-0.5 border-l-2 border-slate-300 pl-2 text-slate-500 dark:border-slate-600 dark:text-slate-400">
              {line.replace(/^>\s?/, '')}
            </p>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <p key={i} className="my-0.5 pl-4">
              <span className="mr-1.5 text-slate-400">•</span>
              {line.slice(2)}
            </p>
          );
        }
        return line.trim() === '' ? <div key={i} className="h-2" /> : <p key={i} className="my-0.5">{line}</p>;
      })}
    </div>
  );
}

function CommentHeader({ post }: { post: NetPost }) {
  const { name, flair } = splitFlair(post.displayName);
  const isUser = post.accountKind === 'user';
  const bot = flair === 'Bot';
  return (
    <p className="flex flex-wrap items-baseline text-xs">
      <span className={`font-bold ${isUser ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>{name}</span>
      <FlairChip flair={flair} bot={bot} />
      <span className={`ml-2 ${post.likes < 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
        {formatVotes(post.likes)} point{Math.abs(post.likes) === 1 ? '' : 's'}
      </span>
    </p>
  );
}

function Comment({ post }: { post: NetPost }) {
  return (
    <div className="pt-3">
      <CommentHeader post={post} />
      <CommentBody body={post.body} />
      {post.replies.length > 0 && (
        <div className="ml-2 mt-1 space-y-1 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
          {post.replies.map((r) => (
            <div key={r.id} className="pt-2">
              <CommentHeader post={r} />
              <CommentBody body={r.body} />
            </div>
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
  const [busy, setBusy] = useState<'week' | 'thread' | 'reply' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');

  const reload = useCallback(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.net.getThreads(id, selectedSeasonId).then(setThreads);
    window.api.net.getFeed(id, selectedSeasonId).then((view) => setUserAccount(view.userAccount));
  }, [id, selectedSeasonId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!id || selectedSeasonId === undefined) return null;

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

  const submitReply = async (threadId: number) => {
    if (!replyDraft.trim() || !userAccount) return;
    setBusy('reply');
    setNotice(null);
    try {
      const result = await window.api.net.replyToThread(id, selectedSeasonId, userAccount.id, threadId, replyDraft.trim());
      setReplyDraft('');
      if (result.message) setNotice(result.message);
      reload();
    } finally {
      setBusy(null);
    }
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
            className={`${buttonClass} ml-auto`}
            disabled={!userAccount}
            onClick={() => setComposing((v) => !v)}
          >
            {composing ? 'Cancel' : '+ New thread'}
          </button>
        </div>
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
          const { name: opName, flair: opFlair } = splitFlair(t.displayName);
          const isUser = t.accountKind === 'user';
          const commentCount = countComments(t);
          return (
            <SurfaceCard key={t.id}>
              <button className="block w-full text-left" onClick={() => { setOpenId(open ? null : t.id); setReplyDraft(''); }}>
                <div className="flex items-start gap-3">
                  {/* vote column, reddit-style */}
                  <div className="flex w-10 shrink-0 flex-col items-center pt-0.5 text-slate-400 dark:text-slate-500">
                    <span aria-hidden className="text-sm leading-none">▲</span>
                    <span className="mt-0.5 text-xs font-bold text-slate-600 dark:text-slate-300">{formatVotes(t.likes)}</span>
                  </div>
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
                </div>
              </button>
              {open && (
                <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                  {t.body.trim() !== '' && (
                    <div className="mb-2 border-b border-dashed border-slate-200/80 pb-3 dark:border-slate-800">
                      <CommentBody body={t.body} />
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {t.replies.map((r) => (
                      <Comment key={r.id} post={r} />
                    ))}
                  </div>
                  {userAccount && (
                    <div className="mt-3 flex gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-800">
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
                        {busy === 'reply' ? '…' : 'Comment'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </SurfaceCard>
          );
        })}
      </div>
    </div>
  );
}
