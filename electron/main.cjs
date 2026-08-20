const { app, BrowserWindow, ipcMain, dialog, Notification } = require("electron");
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

let pendingSession = null;

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
      const payload = { accessToken, refreshToken };
      pendingSession = payload;
      try {
        mainWindow?.webContents.send("auth:set-session", payload);
      } catch {
        /* el renderer aun no esta listo; se entrega via auth:get-pending-session */
      }
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
let isQuitting = false;

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
    const FIXED_PORT = 39123;
    const listen = (port) => {
      server.listen(port, "127.0.0.1", () => {
        const { port: actual } = server.address();
        mainWindow.loadURL(`http://127.0.0.1:${actual}/`);
      });
    };
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        server.removeAllListeners("error");
        listen(0);
      }
    });
    listen(FIXED_PORT);
  } else {
    mainWindow.loadURL(process.env.ELECTRON_START_URL || "http://localhost:3000");
  }

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
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
    ipcMain.handle("auth:get-pending-session", () => {
      const s = pendingSession;
      pendingSession = null;
      return s;
    });

    const configPath = path.join(app.getPath("userData"), "config.json");

    const readConfig = () => {
      try {
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
      } catch {
        return {};
      }
    };

    const writeConfig = (cfg) => {
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    };

    const defaultExcelPath = path.join(
      os.homedir(),
      "OneDrive",
      "Desktop",
      "Control 2026 VALTECH.xlsx"
    );

    let stopSync = null;
    let supabaseConfig = null;
    try {
      supabaseConfig = require("./supabase-config.cjs");
    } catch {
      /* sin claves configuradas */
    }

    const sendSyncStatus = (message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("sync:status", { message });
      }
    };

    let notifier = null;
    try {
      const { startNotifier } = require("./notify.cjs");
      notifier = startNotifier({
        supabaseConfig,
        userDataPath: app.getPath("userData"),
        onLog: (msg) => sendSyncStatus(msg),
      });
    } catch {
      /* notificaciones no criticas */
    }

    ipcMain.on("notify:set-user", (_event, payload) => {
      notifier?.setUser(payload ?? null);
      // Defecto 5: arrancar/detener sync segun el cargo del usuario
      if (payload?.cargo === "encargado") {
        const cfg = readConfig();
        if (cfg.excelPath) {
          startSyncWatcher(cfg.excelPath);
        }
      } else if (stopSync) {
        stopSync();
        stopSync = null;
      }
    });

    const startSyncWatcher = (excelPath) => {
      if (stopSync) {
        stopSync();
        stopSync = null;
      }
      if (!supabaseConfig?.supabaseUrl || !supabaseConfig?.anonKey) {
        sendSyncStatus("[sync] faltan las claves de Supabase");
        return;
      }
      try {
        const { startSync } = require("./sync-watch.cjs");
        stopSync = startSync({
          ...supabaseConfig,
          excelPath,
          onLog: (msg) => sendSyncStatus(msg),
        });
      } catch (err) {
        sendSyncStatus(`[sync] error: ${err?.message ?? err}`);
      }
    };

    ipcMain.handle("config:get", () => readConfig());
    ipcMain.handle("config:set", (_event, payload) => {
      const cfg = readConfig();
      const next = { ...cfg, ...(payload ?? {}) };
      if (typeof next.excelPath === "string") {
        if (next.excelPath.trim() !== "") {
          writeConfig(next);
        } else {
          delete next.excelPath;
          writeConfig(next);
        }
        startSyncWatcher(next.excelPath || undefined);
      }
      return next;
    });
    ipcMain.handle("dialog:pick-excel", async () => {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: "Selecciona el Excel maestro",
        filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
        properties: ["openFile"],
      });
      if (res.canceled || !res.filePaths[0]) return null;
      return res.filePaths[0];
    });

    ipcMain.handle("excel:parse", async (_event, filePath) => {
      if (!filePath || typeof filePath !== "string") {
        return { error: "Ruta de archivo no válida" };
      }
      try {
        const { parseWorkbook } = require("./sync-watch.cjs");
        const records = parseWorkbook(filePath);
        return { records, count: records.length };
      } catch (err) {
        return { error: err?.message ?? String(err) };
      }
    });

    createWindow();

    // Defecto 5: NO arrancar sync automaticamente. Solo arranca cuando
    // el renderer confirma que el usuario es encargado via notify:set-user.

    if (app.isPackaged) {
      const { autoUpdater } = require("electron-updater");
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      let updateDownloaded = false;
      let updateInstallTimer = null;

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
        // Respaldo: si el renderer no confirma la instalacion (p. ej. ventana
        // minimizada), se instala igual al cabo de 60s. La UI muestra su propio
        // countdown mas corto con opcion "Instalar ahora".
        if (updateInstallTimer) clearTimeout(updateInstallTimer);
        updateInstallTimer = setTimeout(() => {
          if (updateDownloaded) autoUpdater.quitAndInstall();
        }, 60 * 1000);
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
      setInterval(checkForUpdates, 15 * 60 * 1000);
    }

    app.on("activate", () => {
      if (!isQuitting && BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("window-all-closed", () => {
    if (isQuitting) return;
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
