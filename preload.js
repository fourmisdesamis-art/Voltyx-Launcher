/* =========================================================
   VOLTYX LAUNCHER — preload.js
   ========================================================= */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("voltyx", {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close")
  },

  nav: {
    goto: (page) => ipcRenderer.send("nav:goto", page)
  },

  accounts: {
    get: () => ipcRenderer.invoke("accounts:get"),
    set: (type, data) => ipcRenderer.invoke("accounts:set", type, data),
    remove: (type) => ipcRenderer.invoke("accounts:remove", type)
  },

  config: {
    get: () => ipcRenderer.invoke("config:get"),
    update: (patch) => ipcRenderer.invoke("config:update", patch),
    reset: () => ipcRenderer.invoke("config:reset"),
    getKey: (key) => ipcRenderer.invoke("config:getKey", key)
  },

  theme: {
    get: () => ipcRenderer.invoke("theme:get"),
    set: (theme) => ipcRenderer.invoke("theme:set", theme),
    onChanged: (cb) => ipcRenderer.on("theme:changed", (e, theme) => cb(theme))
  },

  onboarding: {
    isDone: () => ipcRenderer.invoke("onboarding:isDone"),
    complete: () => ipcRenderer.invoke("onboarding:complete")
  },

  install: {
    minecraft: () => ipcRenderer.invoke("install:minecraft"),
    mods: () => ipcRenderer.invoke("install:mods"),
    status: () => ipcRenderer.invoke("install:status"),
    repair: () => ipcRenderer.invoke("install:repair"),
    quickCheck: () => ipcRenderer.invoke("install:quickCheck"),
    onProgress: (cb) => ipcRenderer.on("install:progress", (e, d) => cb(d))
  },

  game: {
    launch: (username) => ipcRenderer.invoke("game:launch", username),
    onStarted: (cb) => ipcRenderer.on("game:started", (e, d) => cb(d)),
    onClosed: (cb) => ipcRenderer.on("game:closed", (e, d) => cb(d))
  },

  auth: {
    openLumaliaLogin: () => ipcRenderer.send("auth:openLumaliaLogin"),
    lumaliaLogin: (email, password) => ipcRenderer.invoke("auth:lumaliaLogin", email, password),
    lumaliaLogout: () => ipcRenderer.invoke("auth:lumaliaLogout"),
    lumaliaSession: () => ipcRenderer.invoke("auth:lumaliaSession"),
    onLumaliaUpdated: (cb) => ipcRenderer.on("auth:lumaliaUpdated", (e, d) => cb(d)),

    microsoftLogin: () => ipcRenderer.invoke("auth:microsoftLogin"),
    microsoftLogout: () => ipcRenderer.invoke("auth:microsoftLogout"),
    microsoftSession: () => ipcRenderer.invoke("auth:microsoftSession"),
    onMicrosoftUpdated: (cb) => ipcRenderer.on("auth:microsoftUpdated", (e, d) => cb(d))
  },

  discord: {
    setActivity: (key, data) => ipcRenderer.invoke("discord:setActivity", key, data),
    clearActivity: () => ipcRenderer.invoke("discord:clearActivity"),
    connect: () => ipcRenderer.invoke("discord:connect"),
    disconnect: () => ipcRenderer.invoke("discord:disconnect"),
    isReady: () => ipcRenderer.invoke("discord:isReady")
  },

  updater: {
    check: () => ipcRenderer.invoke("updater:check"),
    download: () => ipcRenderer.invoke("updater:download"),
    install: () => ipcRenderer.send("updater:install"),
    closeWindow: () => ipcRenderer.send("updater:closeWindow"),
    getVersion: () => ipcRenderer.invoke("updater:getVersion"),

    onChecking: (cb) => ipcRenderer.on("updater:checking", () => cb()),
    onUpdateAvailable: (cb) => ipcRenderer.on("updater:updateAvailable", (e, d) => cb(d)),
    onUpdateNotAvailable: (cb) => ipcRenderer.on("updater:updateNotAvailable", (e, d) => cb(d)),
    onDownloadProgress: (cb) => ipcRenderer.on("updater:downloadProgress", (e, d) => cb(d)),
    onUpdateDownloaded: (cb) => ipcRenderer.on("updater:updateDownloaded", (e, d) => cb(d)),
    onError: (cb) => ipcRenderer.on("updater:error", (e, d) => cb(d))
  },

  news: {
    list: () => ipcRenderer.invoke("news:list"),
    get: (id) => ipcRenderer.invoke("news:get", id),
    openExternal: (url) => ipcRenderer.send("news:openExternal", url)
  }
});