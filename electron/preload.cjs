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
});
