import type { DynastyApi } from '../shared/types';

declare global {
  interface Window {
    api: DynastyApi;
  }
}

export {};
