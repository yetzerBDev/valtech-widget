const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window:minimize"),
  getSize: () => ipcRenderer.invoke("window:get-size"),
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  onOAuthCode: (callback) => {
    const listener = (_event, code) => callback(code);
    ipcRenderer.on("auth:oauth-code", listener);
    return () => ipcRenderer.removeListener("auth:oauth-code", listener);
  },
  onOAuthCancelled: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("auth:cancelled", listener);
    return () => ipcRenderer.removeListener("auth:cancelled", listener);
  },
  onSetSession: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("auth:set-session", listener);
    return () => ipcRenderer.removeListener("auth:set-session", listener);
  },
  getPendingSession: () => ipcRenderer.invoke("auth:get-pending-session"),
  onUpdateAvailable: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:available", listener);
    return () => ipcRenderer.removeListener("update:available", listener);
  },
  onUpdateProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:progress", listener);
    return () => ipcRenderer.removeListener("update:progress", listener);
  },
  onUpdateDownloaded: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:downloaded", listener);
    return () => ipcRenderer.removeListener("update:downloaded", listener);
  },
  onUpdateError: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:error", listener);
    return () => ipcRenderer.removeListener("update:error", listener);
  },
  quitAndInstall: () => ipcRenderer.send("update:quit-and-install"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (payload) => ipcRenderer.invoke("config:set", payload),
  pickExcel: () => ipcRenderer.invoke("dialog:pick-excel"),
  onSyncStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("sync:status", listener);
    return () => ipcRenderer.removeListener("sync:status", listener);
  },
});
