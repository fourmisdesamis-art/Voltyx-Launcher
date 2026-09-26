/* =========================================================
   VOLTYX LAUNCHER — config.js
   Gestion de la config.json (RAM, Java, thème, etc.)
   ========================================================= */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { PATHS } = require("./paths");

const DEFAULT_CONFIG = {
  ram: 4096,
  javaPath: "auto",
  javaVersion: "auto",
  installPath: PATHS.root,
  language: "fr",

  // ⚠️ Thème (dark / light)
  theme: "dark",

  closeLauncherOnGameStart: false,
  minimizeLauncherOnGameStart: true,
  lastUsedAccount: null,
  firstLaunch: true,
  lastLaunch: null,
  launchCount: 0,

  onboardingDone: false,
  discordRPC: true,

  versions: {
    forge: "1.16.5-36.2.34",
    minecraft: "1.16.5"
  }
};

function load() {
  try {
    if (!fs.existsSync(PATHS.config)) {
      console.log("[Config] Première ouverture, création de la config par défaut");
      save(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }
    const data = fs.readFileSync(PATHS.config, "utf8");
    const parsed = JSON.parse(data);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    console.error("[Config] Erreur de lecture :", err);
    return { ...DEFAULT_CONFIG };
  }
}

function save(config) {
  try {
    fs.writeFileSync(PATHS.config, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[Config] Erreur d'écriture :", err);
    return false;
  }
}

function update(patch) {
  const config = load();
  const updated = { ...config, ...patch };
  save(updated);
  return updated;
}

function get(key) {
  const config = load();
  return config[key];
}

function reset() {
  save(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

module.exports = {
  load: load,
  save: save,
  update: update,
  get: get,
  reset: reset,
  DEFAULT_CONFIG: DEFAULT_CONFIG
};