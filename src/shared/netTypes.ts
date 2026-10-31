/**
 * DynastyNet — the save's own internet. Shared shapes between the main
 * process (generation + storage) and the renderer (Feed/Tube/Paper/Pods).
 */

export type NetAccountKind = 'bot' | 'user' | 'paper' | 'podcast' | 'board';
export type NetPostKind =
  | 'post'
  | 'reply'
  | 'comment'
  | 'article'
  | 'podcast'
  | 'throwback'
  | 'top10'
  | 'thread'
  | 'historian';

export interface NetAccount {
  id: number;
  handle: string;
  displayName: string;
  kind: NetAccountKind;
  persona: string;
}

export interface NetPost {
  id: number;
  seasonId: number;
  accountId: number;
  handle: string;
  displayName: string;
  accountKind: NetAccountKind;
  kind: NetPostKind;
  parentId: number | null;
  mediaId: number | null;
  title: string;
  body: string;
  likes: number;
  week: number;
  createdAt: string;
  /** Populated on feed reads: direct replies, oldest first. */
  replies: NetPost[];
}

export interface NetFeedView {
  posts: NetPost[];
  /** Weeks that already have generated chatter, ascending. */
  generatedWeeks: number[];
  /** The account the user posts as. */
  userAccount: NetAccount | null;
}

export interface NetGenerateResult {
  ok: boolean;
  /** 'claude' when written by the live model, 'offline' for the template engine. */
  engine: 'claude' | 'offline';
  /** Human-readable failure (bad key, network) — generation fell back or aborted. */
  message?: string;
  postsAdded: number;
}

export interface Top10Topic {
  key: string;
  label: string;
  group: string;
  angle: string;
}

/** Runtime + frame clock positions of a captured clip — lets comment
 *  generation cite real, seekable timestamps ("0:47 he's GONE"). */
export interface NetClipInfo {
  durationSeconds?: number;
  /** Seconds into the clip of each attached frame, in frame order. */
  frameTimes?: number[];
}

/** One reply to something the human member posted — the Board inbox row. */
export interface NetInboxItem {
  id: number;
  handle: string;
  displayName: string;
  body: string;
  likes: number;
  week: number;
  createdAt: string;
  /** What the user wrote that this replies to (truncated). */
  inReplyTo: string;
  threadId: number | null;
  threadTitle: string | null;
  mediaId: number | null;
}

export interface NetInboxView {
  items: NetInboxItem[];
  /** Items with id above this are unread. */
  lastSeenId: number;
}

export interface NetCaptionResult {
  ok: boolean;
  message?: string;
  /** The drafted DynastyTube title — filled into the form, never auto-saved. */
  title?: string;
  description?: string;
}

export interface NetIdentityResult {
  ok: boolean;
  message?: string;
  account?: NetAccount;
}

export interface NetSettings {
  /** Anthropic API key; empty = offline template engine only. */
  apiKey: string;
  /** Present so the UI can show which engine will run without exposing the key. */
  hasKey: boolean;
}
