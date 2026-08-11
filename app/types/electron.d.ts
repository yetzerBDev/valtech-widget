export {};

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      getSize: () => Promise<[number, number]>;
      getVersion: () => Promise<string>;
    };
  }
}
