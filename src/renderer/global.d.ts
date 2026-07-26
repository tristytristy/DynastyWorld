import type { DynastyApi } from '../shared/types';

declare global {
  interface Window {
    api: DynastyApi;
  }
  /** App version, injected from package.json at build time (webpack DefinePlugin). */
  const __APP_VERSION__: string;
  /** Dev-build timestamp (e.g. "dev build · Jul 26 02:41"); empty string on release builds. */
  const __BUILD_LABEL__: string;
}

export {};
