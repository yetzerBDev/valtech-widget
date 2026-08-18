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
      getPendingSession: () => Promise<{
        accessToken: string;
        refreshToken: string;
      } | null>;
      onUpdateAvailable: (callback: (payload: { version: string }) => void) => () => void;
      onUpdateProgress: (callback: (payload: { percent: number }) => void) => () => void;
      onUpdateDownloaded: (callback: (payload: { version: string }) => void) => () => void;
      onUpdateError: (callback: (payload: { message: string }) => void) => () => void;
      quitAndInstall: () => void;
      getConfig: () => Promise<{ excelPath?: string }>;
      setConfig: (payload: { excelPath?: string }) => Promise<{ excelPath?: string }>;
      pickExcel: () => Promise<string | null>;
      parseExcel: (
        filePath: string
      ) => Promise<{ records?: Record<string, unknown>[]; count?: number; error?: string }>;
      onSyncStatus: (callback: (payload: { message: string }) => void) => () => void;
      setNotifyUser: (payload: { cargo: string; nombre: string } | null) => void;
    };
  }
}
