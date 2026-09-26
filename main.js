/* =========================================================
   VOLTYX LAUNCHER — main.js
   Process principal Electron
   ========================================================= */

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const paths = require("./launcher/paths");
const accounts = require("./launcher/accounts");
const config = require("./launcher/config");
const installer = require("./launcher/minecraft/install");
const modsInstaller = require("./launcher/minecraft/mods");
const launcher = require("./launcher/minecraft/launcher");
const microsoftAuth = require("./launcher/auth/microsoft");
const lumaliaAuth = require("./launcher/auth/lumalia");
const discordRPC = require("./launcher/discord-rpc");
const updater = require("./launcher/update-manager");
const firebase = require("./launcher/firebase");

const isDev = process.argv.includes("--dev");

let mainWindow = null;
let loginWindow = null;

// ============================================================
// ICÔNE
// ============================================================
function getAppIconPath() {
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "logo.ico"));
    candidates.push(path.join(process.resourcesPath, "images", "logo.ico"));
  } else {
    candidates.push(path.join(__dirname, "assets", "images", "logo.ico"));
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// ============================================================
// FENÊTRE PRINCIPALE
// ============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 640,
    frame: false,
    backgroundColor: "#000000",
    show: false,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const cfg = config.load();
  const startPage = cfg.onboardingDone ? "index.html" : "welcome.html";
  mainWindow.loadFile(path.join(__dirname, "src", "pages", startPage));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ============================================================
// FENÊTRE DE CONNEXION LUMALIA
// ============================================================
function openLumaliaLogin() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 420,
    height: 600,
    resizable: false,
    frame: false,
    backgroundColor: "#000000",
    parent: mainWindow,
    modal: false,
    show: false,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  loginWindow.loadFile(path.join(__dirname, "src", "pages", "login-lumalia.html"));

  loginWindow.once("ready-to-show", () => loginWindow.show());
  loginWindow.on("closed", () => { loginWindow = null; });
}

// ============================================================
// IPC : Contrôles de fenêtre
// ============================================================
ipcMain.on("window:minimize", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.minimize();
});

ipcMain.on("window:maximize", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.on("window:close", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.close();
});

// ============================================================
// IPC : Navigation
// ============================================================
ipcMain.on("nav:goto", (e, page) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  const parts = page.split("?");
  const filePath = path.join(__dirname, "src", "pages", parts[0]);
  if (parts[1]) win.loadFile(filePath, { search: "?" + parts[1] });
  else win.loadFile(filePath);
});

// ============================================================
// IPC : Comptes
// ============================================================
ipcMain.handle("accounts:get", () => accounts.getAccounts());
ipcMain.handle("accounts:set", (e, type, data) => accounts.setAccount(type, data));
ipcMain.handle("accounts:remove", (e, type) => accounts.removeAccount(type));

// ============================================================
// IPC : Configuration
// ============================================================
ipcMain.handle("config:get", () => config.load());
ipcMain.handle("config:update", (e, patch) => config.update(patch));
ipcMain.handle("config:reset", () => config.reset());
ipcMain.handle("config:getKey", (e, key) => config.get(key));

// ============================================================
// IPC : Thème
// ============================================================
ipcMain.handle("theme:get", () => {
  const cfg = config.load();
  return cfg.theme || "dark";
});

ipcMain.handle("theme:set", (e, theme) => {
  if (theme !== "dark" && theme !== "light") {
    return { success: false, error: "Thème invalide" };
  }
  config.update({ theme });

  const bg = theme === "dark" ? "#000000" : "#ffffff";
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.setBackgroundColor(bg);
      win.webContents.send("theme:changed", theme);
    }
  });

  return { success: true, theme };
});

// ============================================================
// IPC : Onboarding
// ============================================================
ipcMain.handle("onboarding:isDone", () => {
  const cfg = config.load();
  return { done: cfg.onboardingDone === true };
});

ipcMain.handle("onboarding:complete", () => {
  config.update({ onboardingDone: true });
  return { success: true };
});

// ============================================================
// IPC : Réparation
// ============================================================
ipcMain.handle("install:repair", async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const repair = require("./launcher/minecraft/repair");

  discordRPC.setActivity("installing");

  try {
    const result = await repair.repairAll(win);
    return result;
  } catch (err) {
    console.error("[Main] Erreur repair :", err);
    return { success: false, message: err.message };
  } finally {
    discordRPC.setActivity("launcher");
  }
});

// ============================================================
// IPC : Installation
// ============================================================
ipcMain.handle("install:minecraft", async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  discordRPC.setActivity("installing");
  try {
    const result = await installer.installAll(win);
    return result;
  } finally {
    discordRPC.setActivity("launcher");
  }
});

ipcMain.handle("install:mods", async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  return await modsInstaller.installMods(win);
});

ipcMain.handle("install:status", async () => {
  const manifest = require("./launcher/minecraft/manifest");
  const mcPath = paths.getMinecraftPath(manifest.serverSlug);
  return {
    vanilla: installer.isVanillaInstalled(mcPath),
    forge: installer.isForgeInstalled(mcPath)
  };
});

// ============================================================
// IPC : Lancement du jeu
// ============================================================
ipcMain.handle("game:launch", async (e, username) => {
  const win = BrowserWindow.fromWebContents(e.sender);

  discordRPC.setActivity("playing");

  try {
    const result = await launcher.launchGame(win, username);
    return { success: true, ...result };
  } catch (err) {
    console.error("[Main] Erreur lancement :", err);
    discordRPC.setActivity("launcher");
    return { success: false, error: err.message };
  }
});

// ============================================================
// IPC : Vérification rapide de l'installation
// ============================================================
ipcMain.handle("install:quickCheck", async () => {
  try {
    const manifest = require("./launcher/minecraft/manifest");
    const mcPath = paths.getMinecraftPath(manifest.serverSlug);
    const nativesDir = path.join(mcPath, "natives", manifest.minecraftVersion);

    let nativesCount = 0;
    if (fs.existsSync(nativesDir)) {
      nativesCount = fs.readdirSync(nativesDir).filter(f => f.endsWith(".dll")).length;
    }

    return {
      vanilla: installer.isVanillaInstalled(mcPath),
      forge: installer.isForgeInstalled(mcPath),
      natives: nativesCount
    };
  } catch (err) {
    console.error("[Main] Erreur quickCheck :", err);
    return {
      vanilla: false,
      forge: false,
      natives: 0,
      error: err.message
    };
  }
});

// ============================================================
// IPC : Auth Lumalia
// ============================================================
ipcMain.on("auth:openLumaliaLogin", () => openLumaliaLogin());

ipcMain.handle("auth:lumaliaLogin", async (e, email, password) => {
  const result = await lumaliaAuth.loginLumalia(email, password);

  if (result.success) {
    accounts.setAccount("lumalia", {
      uid: result.uid,
      email: result.email,
      username: result.username,
      loggedAt: Date.now()
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth:lumaliaUpdated", result);
    }

    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.close();
    }
  }

  return result;
});

ipcMain.handle("auth:lumaliaLogout", () => {
  const result = lumaliaAuth.logoutLumalia();
  accounts.removeAccount("lumalia");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("auth:lumaliaUpdated", null);
  }
  return result;
});

ipcMain.handle("auth:lumaliaSession", () => {
  return lumaliaAuth.getSession();
});

// ============================================================
// IPC : Auth Microsoft
// ============================================================
ipcMain.handle("auth:microsoftLogin", async () => {
  const result = await microsoftAuth.loginMicrosoft();

  if (result.success) {
    accounts.setAccount("microsoft", {
      username: result.username,
      uuid: result.uuid,
      name: result.name,
      loggedAt: Date.now()
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth:microsoftUpdated", result);
    }
  }

  return result;
});

ipcMain.handle("auth:microsoftLogout", async () => {
  const result = await microsoftAuth.logoutMicrosoft();
  accounts.removeAccount("microsoft");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("auth:microsoftUpdated", null);
  }
  return result;
});

ipcMain.handle("auth:microsoftSession", async () => {
  const ms = await microsoftAuth.getCurrentMicrosoft();
  return ms ? { success: true, connected: true, ...ms } : { success: true, connected: false };
});

// ============================================================
// IPC : Discord Rich Presence
// ============================================================
ipcMain.handle("discord:setActivity", (e, activityKey, data) => {
  discordRPC.setActivity(activityKey, data);
  return { success: true };
});

ipcMain.handle("discord:clearActivity", () => {
  discordRPC.clearActivity();
  return { success: true };
});

ipcMain.handle("discord:connect", () => {
  discordRPC.connect();
  return { success: true };
});

ipcMain.handle("discord:disconnect", async () => {
  await discordRPC.disconnect();
  return { success: true };
});

ipcMain.handle("discord:isReady", () => {
  return { connected: discordRPC.isReady() };
});

// ============================================================
// IPC : News (Firebase Firestore)
// ============================================================
ipcMain.handle("news:list", async () => {
  try {
    const news = await firebase.getNews(20);
    return { success: true, news };
  } catch (err) {
    console.error("[Main] Erreur news:list :", err);
    return { success: false, error: err.message, news: [] };
  }
});

ipcMain.handle("news:get", async (e, id) => {
  try {
    const news = await firebase.getNewsById(id);
    return { success: true, news };
  } catch (err) {
    console.error("[Main] Erreur news:get :", err);
    return { success: false, error: err.message, news: null };
  }
});

ipcMain.on("news:openExternal", (e, url) => {
  if (typeof url === "string" && url.startsWith("https://")) {
    shell.openExternal(url);
  }
});

// ============================================================
// IPC : Auto-Updater
// ============================================================
ipcMain.handle("updater:check", async () => {
  await updater.checkForUpdates(mainWindow, false);
  return { success: true };
});

ipcMain.handle("updater:download", async () => {
  await updater.downloadUpdate();
  return { success: true };
});

ipcMain.on("updater:install", () => {
  updater.installUpdate();
});

ipcMain.on("updater:closeWindow", () => {
  updater.closeUpdateWindow();
});

ipcMain.handle("updater:getVersion", () => {
  return { version: app.getVersion() };
});

// ============================================================
// CYCLE DE VIE
// ============================================================
app.whenReady().then(async () => {
  paths.ensureDirs();

  await lumaliaAuth.restoreSession();

  const cfg = config.load();

  if (cfg.discordRPC !== false) {
    discordRPC.connect();
  } else {
    console.log("[Discord] Désactivé dans les paramètres");
  }

  // Init Firebase (ne bloque pas si ça plante)
  try {
    firebase.init();
  } catch (err) {
    console.error("[Main] Erreur init Firebase :", err);
  }

  updater.init();

  createWindow();

  setTimeout(() => {
    if (!isDev) {
      updater.checkForUpdates(mainWindow, true);
    } else {
      console.log("[Updater] Mode dev — check désactivé");
    }
  }, 3000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  try { await discordRPC.disconnect(); } catch (e) {}
});