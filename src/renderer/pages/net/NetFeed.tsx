import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { NetFeedView, NetSettings } from '../../../shared/netTypes';
import { PageMasthead } from '../../components/common/PageMasthead';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { PostCard } from './NetPost';

/**
 * The Feed — the save's social network. Bots react to the week's real
 * results; the user posts as themselves and the cast replies. Live posts are
 * written by Claude when an API key is configured (Settings, below the
 * composer); the offline template engine covers everything else, so the Feed
 * always works.
 */
export function NetFeed() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId, seasons } = useSelectedSeason();
  const teamName = seasons.find((s) => s.id === selectedSeasonId)?.teamName ?? null;
  const [view, setView] = useState<NetFeedView | null>(null);
  const [settings, setSettings] = useState<NetSettings | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'generate' | 'post' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');

  const reload = useCallback(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.net.getFeed(id, selectedSeasonId).then(setView);
  }, [id, selectedSeasonId]);

  useEffect(() => {
    reload();
    window.api.net.getSettings().then(setSettings);
  }, [reload]);

  if (!id || selectedSeasonId === undefined) return null;

  const generate = async (regenerate: boolean) => {
    setBusy('generate');
    setNotice(null);
    try {
      const result = await window.api.net.generateWeek(id, selectedSeasonId, regenerate);
      setNotice(
        result.ok
          ? result.postsAdded > 0
            ? `${result.postsAdded} new posts (${result.engine === 'claude' ? 'written live by Claude' : 'offline engine'}).${result.message ? ` ${result.message}` : ''}`
            : result.message ?? 'Nothing new to react to.'
          : result.message ?? 'Generation failed.',
      );
      reload();
    } finally {
      setBusy(null);
    }
  };

  const submitPost = async () => {
    if (!draft.trim() || !view?.userAccount) return;
    setBusy('post');
    setNotice(null);
    try {
      const result = await window.api.net.postAsUser(id, selectedSeasonId, view.userAccount.id, draft.trim());
      setDraft('');
      if (result.message) setNotice(result.message);
      reload();
    } finally {
      setBusy(null);
    }
  };

  const saveKey = async () => {
    const next = await window.api.net.setApiKey(keyDraft.trim());
    setSettings(next);
    setKeyDraft('');
    setShowSettings(false);
  };

  const buttonClass =
    'border border-slate-300/80 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-500 hover:text-slate-950 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-white';

  return (
    <div className="space-y-5">
      <PageMasthead
        eyebrow="The Net"
        title="Feed"
        description="The nation reacts to your dynasty — every score, poll and meltdown is real. Post something and the regulars will have opinions."
        mark={{ kind: 'logo', teamAssetName: teamName ?? '' }}
      />

      <SurfaceCard>
        <div className="flex flex-wrap items-center gap-2">
          <button className={buttonClass} disabled={busy !== null} onClick={() => generate(false)}>
            {busy === 'generate' ? 'The internet is typing…' : "Generate this week's chatter"}
          </button>
          <button className={buttonClass} disabled={busy !== null} onClick={() => generate(true)}>
            Regenerate week
          </button>
          <button className={`${buttonClass} ml-auto`} onClick={() => setShowSettings((v) => !v)}>
            {settings?.hasKey ? 'Engine: Claude (live)' : 'Engine: offline'} — settings
          </button>
        </div>
        {showSettings && (
          <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Paste an Anthropic API key to have Claude write the Net live from your save. Stored on this machine only.
              Leave empty and the built-in offline engine writes everything instead — no account needed.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder={settings?.hasKey ? 'Key saved — paste a new one to replace it' : 'sk-ant-…'}
                className="min-w-0 flex-1 border border-slate-300/80 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600"
              />
              <button className={buttonClass} onClick={saveKey}>
                Save
              </button>
            </div>
          </div>
        )}
        {notice && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{notice}</p>}
      </SurfaceCard>

      <SurfaceCard>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Post as {view?.userAccount?.displayName ?? 'a fan'}{' '}
          <span className="font-normal text-slate-400 dark:text-slate-500">
            {view?.userAccount ? view.userAccount.handle + ' — just another fan on the Net' : ''}
          </span>
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Talk your talk. The replies are coming either way."
          className="mt-2 w-full resize-y border border-slate-300/80 bg-transparent px-3 py-2 text-sm dark:border-slate-600"
        />
        <div className="mt-2 flex justify-end">
          <button className={buttonClass} disabled={busy !== null || !draft.trim() || !view?.userAccount} onClick={submitPost}>
            {busy === 'post' ? 'Posting…' : 'Post'}
          </button>
        </div>
        {!view?.userAccount && (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Generate a week of chatter first — it sets up your account and the cast.
          </p>
        )}
      </SurfaceCard>

      {view && view.posts.length === 0 && (
        <SurfaceCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The Net is quiet. Hit &quot;Generate this week&apos;s chatter&quot; after a sync and the nation starts talking.
          </p>
        </SurfaceCard>
      )}

      <div className="space-y-3">
        {view?.posts.map((post) => <PostCard key={post.id} post={post} />)}
      </div>
    </div>
  );
}
