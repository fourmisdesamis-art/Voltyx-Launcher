/* =========================================================
   VOLTYX LAUNCHER — update-manager.js
   Gestion des mises à jour automatiques via electron-updater
   ========================================================= */

const { autoUpdater } = require("electron-updater");
const { app, BrowserWindow } = require("electron");
const path = require("path");

// === Configuration ===
autoUpdater.autoDownload = false;          // On demande confirmation avant de télécharger
autoUpdater.autoInstallOnAppQuit = true;   // Installer au prochain quit si l'utilisateur ferme
autoUpdater.allowPrerelease = false;        // Ignorer les pre-releases
autoUpdater.allowDowngrade = false;         // Pas de downgrade

// === État interne ===
let updateWindow = null;       // Fenêtre popup de mise à jour
let updateInfo = null;         // Infos de la MAJ dispo
let mainWindowRef = null;      // Référence vers la fenêtre principale

/**
 * Crée (ou focus) la popup de mise à jour
 */
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
    // Envoie les infos de la MAJ dès que la fenêtre est prête
    if (updateInfo) {
      updateWindow.webContents.send("updater:updateAvailable", updateInfo);
    }
  });

  updateWindow.on("closed", () => {
    updateWindow = null;
  });
}

/**
 * Envoie un événement à toutes les fenêtres ouvertes
 */
function broadcast(channel, data) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

/**
 * Configure les listeners de l'autoUpdater
 */
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

/**
 * Lance la vérification des mises à jour
 * @param {BrowserWindow} mainWindow - référence vers la fenêtre principale
 * @param {boolean} silent - si true, ne log pas d'erreur si pas de MAJ (au démarrage)
 */
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

/**
 * Télécharge la mise à jour disponible
 */
async function downloadUpdate() {
  try {
    console.log("[Updater] Démarrage du téléchargement…");
    await autoUpdater.downloadUpdate();
  } catch (err) {
    console.error("[Updater] Erreur downloadUpdate :", err);
    broadcast("updater:error", { message: err.message || String(err) });
  }
}

/**
 * Quitte et installe la mise à jour
 */
function installUpdate() {
  console.log("[Updater] Installation et redémarrage…");
  // setImmediate pour laisser l'IPC répondre avant de quitter
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
}

/**
 * Ferme la popup de mise à jour
 */
function closeUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.close();
  }
}

/**
 * Initialise le module (à appeler au démarrage de l'app)
 */
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