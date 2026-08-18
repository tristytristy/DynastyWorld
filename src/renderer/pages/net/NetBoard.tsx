import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { NetFeedView, NetPost } from '../../../shared/netTypes';
import { PageMasthead } from '../../components/common/PageMasthead';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';

/**
 * TheSideline.net — the message board. A different internet than the Feed:
 * threads, essays, quotes, decade-old usernames, zero likes. The regulars
 * react to the week; the user posts threads and replies like any other
 * member and the board piles in.
 */
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
        description="The national board. Game threads for every big game in the country, team flairs, rival fanbases in each other's replies — and the flairless old guard keeping order. Start a thread or jump into the pile."
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
              placeholder='Thread title ("OFFICIAL: ...", "Unpopular opinion: ...")'
              className="w-full border border-slate-300/80 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600"
            />
            <textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              rows={3}
              placeholder="Say your piece. No character limit here — this is a real board."
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
          return (
            <SurfaceCard key={t.id}>
              <button className="block w-full text-left" onClick={() => { setOpenId(open ? null : t.id); setReplyDraft(''); }}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-bold text-slate-950 dark:text-white">{t.title}</p>
                  <p className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                    {t.replies.length} {t.replies.length === 1 ? 'reply' : 'replies'}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  started by <span className={isUser ? 'font-semibold text-amber-700 dark:text-amber-400' : 'font-semibold'}>{t.displayName}</span>
                  {t.week > 0 ? ` · wk ${t.week}` : ''}
                </p>
              </button>
              {open && (
                <div className="mt-3 space-y-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.displayName} <span className="font-normal opacity-60">(OP)</span></p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">{t.body}</p>
                  </div>
                  {t.replies.map((r) => (
                    <div key={r.id} className="border-t border-dashed border-slate-200/80 pt-2 dark:border-slate-800">
                      <p className={`text-xs font-bold ${r.accountKind === 'user' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {r.displayName}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">{r.body}</p>
                    </div>
                  ))}
                  {userAccount && (
                    <div className="flex gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                      <input
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && replyDraft.trim() && busy === null) void submitReply(t.id);
                        }}
                        placeholder={`Reply as ${userAccount.handle}…`}
                        className="min-w-0 flex-1 border border-slate-300/80 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600"
                      />
                      <button
                        className={buttonClass}
                        disabled={busy !== null || !replyDraft.trim()}
                        onClick={() => void submitReply(t.id)}
                      >
                        {busy === 'reply' ? '…' : 'Reply'}
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
