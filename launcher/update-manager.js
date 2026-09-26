/* =========================================================
   VOLTYX LAUNCHER — update-manager.js
   ========================================================= */

const { autoUpdater } = require("electron-updater");
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;

let updateWindow = null;
let updateInfo = null;
let mainWindowRef = null;

function getIconPath() {
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "logo.ico"));
    candidates.push(path.join(process.resourcesPath, "images", "logo.ico"));
  } else {
    candidates.push(path.join(__dirname, "..", "assets", "images", "logo.ico"));
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function openUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.focus();
    return;
  }

  updateWindow = new BrowserWindow({
    width: 480,
    height: 420,
    resizable: false,
    frame: false,
    backgroundColor: "#0b0d12",
    parent: mainWindowRef || undefined,
    modal: false,
    show: false,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  updateWindow.loadFile(path.join(__dirname, "..", "src", "pages", "update.html"));

  updateWindow.once("ready-to-show", () => {
    updateWindow.show();
    if (updateInfo) {
      updateWindow.webContents.send("updater:updateAvailable", updateInfo);
    }
  });

  updateWindow.on("closed", () => {
    updateWindow = null;
  });
}

function broadcast(channel, data) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

function setupListeners() {
  autoUpdater.on("checking-for-update", () => {
    console.log("[Updater] Vérification des mises à jour…");
    broadcast("updater:checking");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[Updater] Mise à jour disponible :", info.version);
    updateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes || "",
      currentVersion: app.getVersion()
    };
    broadcast("updater:updateAvailable", updateInfo);
    openUpdateWindow();
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("[Updater] Aucune mise à jour. Version actuelle :", info.version);
    broadcast("updater:updateNotAvailable", info);
  });

  autoUpdater.on("download-progress", (progress) => {
    const data = {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    };
    console.log(`[Updater] Téléchargement : ${data.percent}%`);
    broadcast("updater:downloadProgress", data);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[Updater] Mise à jour téléchargée :", info.version);
    broadcast("updater:updateDownloaded", info);
  });

  autoUpdater.on("error", (err) => {
    console.error("[Updater] Erreur :", err);
    broadcast("updater:error", { message: err.message || String(err) });
  });
}

async function checkForUpdates(mainWindow, silent = false) {
  mainWindowRef = mainWindow;
  try {
    console.log("[Updater] checkForUpdates() — silent :", silent);
    await autoUpdater.checkForUpdates();
  } catch (err) {
    if (!silent) {
      console.error("[Updater] Erreur checkForUpdates :", err);
      broadcast("updater:error", { message: err.message || String(err) });
    }
  }
}

async function downloadUpdate() {
  try {
    console.log("[Updater] Démarrage du téléchargement…");
    await autoUpdater.downloadUpdate();
  } catch (err) {
    console.error("[Updater] Erreur downloadUpdate :", err);
    broadcast("updater:error", { message: err.message || String(err) });
  }
}

function installUpdate() {
  console.log("[Updater] Installation et redémarrage…");
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
}

function closeUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.close();
  }
}

function init() {
  setupListeners();
  console.log("[Updater] Module initialisé");
}

module.exports = {
  init,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  closeUpdateWindow,
  openUpdateWindow
};