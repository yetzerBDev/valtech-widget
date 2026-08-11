export {};

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      getSize: () => Promise<[number, number]>;
      getVersion: () => Promise<string>;
      onOAuthCode: (callback: (code: string) => void) => () => void;
      onOAuthCancelled: (callback: () => void) => () => void;
      onSetSession: (
        callback: (payload: { accessToken: string; refreshToken: string }) => void
      ) => () => void;
      onUpdateAvailable: (callback: (payload: { version: string }) => void) => () => void;
      onUpdateProgress: (callback: (payload: { percent: number }) => void) => () => void;
      onUpdateDownloaded: (callback: (payload: { version: string }) => void) => () => void;
      onUpdateError: (callback: (payload: { message: string }) => void) => () => void;
      quitAndInstall: () => void;
    };
  }
}
