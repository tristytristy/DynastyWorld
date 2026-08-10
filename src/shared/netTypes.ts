/**
 * DynastyNet — the save's own internet. Shared shapes between the main
 * process (generation + storage) and the renderer (Feed/Tube/Paper/Pods).
 */

export type NetAccountKind = 'bot' | 'user' | 'paper' | 'podcast';
export type NetPostKind = 'post' | 'reply' | 'comment' | 'article' | 'podcast';

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
