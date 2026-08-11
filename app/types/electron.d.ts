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
    };
  }
}
