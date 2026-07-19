import { contextBridge, ipcRenderer } from 'electron';

export interface SplashProgressPayload {
  percent: number;
  status: string;
}

contextBridge.exposeInMainWorld('splashApi', {
  onProgress: (callback: (payload: SplashProgressPayload) => void) => {
    ipcRenderer.on('splash:progress', (_event, payload: SplashProgressPayload) => callback(payload));
  },
});
