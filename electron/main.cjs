const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "text/xml",
};

function serveStatic(rootDir) {
  return http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(
        new URL(req.url, "http://127.0.0.1").pathname
      );
      if (pathname === "/") pathname = "/index.html";
      const filePath = path.normalize(path.join(rootDir, pathname));
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const data = await fs.promises.readFile(filePath);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
}

const WIDGET_WIDTH = 360;
const WIDGET_HEIGHT = 600;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 360;
const ALWAYS_ON_TOP = false;
const OAUTH_REDIRECT_HOST = "valtech-beta.vercel.app";
const PROTOCOL = "widgetavaluo";

function handleProtocolUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== `${PROTOCOL}:`) return;
    const accessToken = u.searchParams.get("at");
    const refreshToken = u.searchParams.get("rt");
    if (accessToken && refreshToken) {
      mainWindow?.webContents.send("auth:set-session", {
        accessToken,
        refreshToken,
      });
    }
  } catch {
    /* URL invalida, ignorar */
  }
}

function protocolUrlFromArgs(argv) {
  const url = (argv ?? []).find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`));
  return url;
}

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

  mainWindow.once("ready-to-show", () => {
    const url = protocolUrlFromArgs(process.argv);
    if (url) handleProtocolUrl(url);
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    let grabbed = false;
    const authWin = new BrowserWindow({
      width: 480,
      height: 640,
      parent: mainWindow,
      modal: false,
      autoHideMenuBar: true,
      backgroundColor: "#ffffff",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    authWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    authWin.webContents.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
    authWin.once("ready-to-show", () => authWin.show());
    authWin.on("closed", () => {
      if (!grabbed) mainWindow?.webContents.send("auth:cancelled");
    });
    const grabCode = (navUrl) => {
      try {
        const u = new URL(navUrl);
        const code = u.searchParams.get("code");
        if (code && u.hostname === OAUTH_REDIRECT_HOST) {
          grabbed = true;
          mainWindow?.webContents.send("auth:oauth-code", code);
          authWin.destroy();
        }
      } catch {
        /* URL invalida, ignorar */
      }
    };
    authWin.webContents.on("will-redirect", (event, navUrl) => grabCode(navUrl));
    authWin.webContents.on("did-navigate", (_event, navUrl) => grabCode(navUrl));
    authWin.loadURL(url);
    return { action: "deny" };
  });

  const outIndex = path.join(__dirname, "..", "out", "index.html");
  if (fs.existsSync(outIndex)) {
    const server = serveStatic(path.join(__dirname, "..", "out"));
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      mainWindow.loadURL(`http://127.0.0.1:${port}/`);
    });
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
  app.on("second-instance", (_event, commandLine) => {
    const url = protocolUrlFromArgs(commandLine);
    if (url) handleProtocolUrl(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("com.widget.avaluo");

    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
          path.resolve(process.argv[1]),
        ]);
      }
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }

    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
    });

    ipcMain.on("window:minimize", () => mainWindow?.minimize());
    ipcMain.handle("window:get-size", () => mainWindow?.getSize());
    ipcMain.handle("app:get-version", () => app.getVersion());

    createWindow();

    try {
      const { startSync } = require("./sync-watch.cjs");
      const supabaseConfig = require("./supabase-config.cjs");
      if (supabaseConfig?.supabaseUrl && supabaseConfig?.anonKey) {
        const configPath = path.join(app.getPath("userData"), "config.json");
        let config = {};
        try {
          config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        } catch {
          /* sin config aun */
        }
        const excelPath =
          config.excelPath ||
          path.join(os.homedir(), "Desktop", "widget-avaluo", "EXCEL_MAESTRO.xlsx");
        startSync({
          ...supabaseConfig,
          excelPath,
          onLog: (msg) => console.log(msg),
        });
      }
    } catch (err) {
      console.error("[sync]", err?.message ?? err);
    }

    if (app.isPackaged) {
      const { autoUpdater } = require("electron-updater");
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = false;

      let updateDownloaded = false;

      const send = (channel, payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(channel, payload);
        }
      };

      autoUpdater.on("update-available", (info) => {
        send("update:available", { version: info?.version ?? "" });
      });
      autoUpdater.on("download-progress", (progress) => {
        send("update:progress", { percent: progress?.percent ?? 0 });
      });
      autoUpdater.on("update-downloaded", (info) => {
        updateDownloaded = true;
        send("update:downloaded", { version: info?.version ?? "" });
      });
      autoUpdater.on("error", (error) => {
        send("update:error", { message: error?.message ?? String(error) });
      });

      ipcMain.on("update:quit-and-install", () => {
        autoUpdater.quitAndInstall();
      });

      const checkForUpdates = () => {
        if (updateDownloaded) return;
        autoUpdater.checkForUpdates().catch((error) => {
          console.error("[autoUpdater]", error?.message ?? error);
        });
      };

      checkForUpdates();
      setInterval(checkForUpdates, 30 * 60 * 1000);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
