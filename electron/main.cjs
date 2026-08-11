const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const WIDGET_WIDTH = 360;
const WIDGET_HEIGHT = 600;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 360;
const ALWAYS_ON_TOP = false;

let mainWindow = null;

function boundsFile() {
  return path.join(app.getPath("userData"), "window-bounds.json");
}

function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(boundsFile(), "utf8"));
  } catch {
    return null;
  }
}

function saveBounds(bounds) {
  fs.writeFileSync(boundsFile(), JSON.stringify(bounds));
}

function createWindow() {
  const saved = loadBounds();

  mainWindow = new BrowserWindow({
    width: saved?.width ?? WIDGET_WIDTH,
    height: saved?.height ?? WIDGET_HEIGHT,
    x: saved?.x,
    y: saved?.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    resizable: true,
    closable: false,
    alwaysOnTop: ALWAYS_ON_TOP,
    show: false,
    backgroundColor: "#fafafa",
    title: "Widget Avalúo",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  const outIndex = path.join(__dirname, "..", "out", "index.html");
  if (fs.existsSync(outIndex)) {
    mainWindow.loadFile(outIndex);
  } else {
    mainWindow.loadURL(process.env.ELECTRON_START_URL || "http://localhost:3000");
  }

  mainWindow.on("close", (event) => {
    event.preventDefault();
    mainWindow.minimize();
  });

  mainWindow.on("resize", () => saveBounds(mainWindow.getBounds()));
  mainWindow.on("move", () => saveBounds(mainWindow.getBounds()));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("com.widget.avaluo");

    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
    });

    ipcMain.on("window:minimize", () => mainWindow?.minimize());
    ipcMain.handle("window:get-size", () => mainWindow?.getSize());

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
