import type { DynastyApi } from '../shared/types';

declare global {
  interface Window {
    api: DynastyApi;
  }
  /** App version, injected from package.json at build time (webpack DefinePlugin). */
  const __APP_VERSION__: string;
}

export {};
