const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window:minimize"),
  getSize: () => ipcRenderer.invoke("window:get-size"),
  getVersion: () => ipcRenderer.invoke("app:get-version"),
});
