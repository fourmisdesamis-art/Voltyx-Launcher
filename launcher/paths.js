/* =========================================================
   VOLTYX LAUNCHER — paths.js
   Chemins vers les dossiers runtime (AppData)
   ========================================================= */

const path = require("path");
const os = require("os");
const fs = require("fs");

// Dossier racine : %APPDATA%/.VoltyxLauncher/
const ROOT_DIR = path.join(os.homedir(), "AppData", "Roaming", ".VoltyxLauncher");

const PATHS = {
  root: ROOT_DIR,
  config: path.join(ROOT_DIR, "config.json"),
  accounts: path.join(ROOT_DIR, "accounts.json"),
  instances: path.join(ROOT_DIR, "instances"),
  java: path.join(ROOT_DIR, "java"),
  assets: path.join(ROOT_DIR, "assets"),
  libraries: path.join(ROOT_DIR, "libraries"),
  versions: path.join(ROOT_DIR, "versions"),
  logs: path.join(ROOT_DIR, "logs"),
  cache: path.join(ROOT_DIR, "cache"),
  mods: path.join(ROOT_DIR, "mods")
};

/** Crée tous les dossiers nécessaires au premier lancement */
function ensureDirs() {
  Object.values(PATHS).forEach(function (p) {
    // Ignore les fichiers (config.json, accounts.json)
    if (p.endsWith(".json")) return;

    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
      console.log("[Paths] Dossier créé :", p);
    }
  });
}

/** Renvoie le chemin du dossier d'une instance */
function getInstancePath(slug) {
  return path.join(PATHS.instances, slug);
}

/** Renvoie le chemin du .minecraft d'une instance */
function getMinecraftPath(slug) {
  return path.join(getInstancePath(slug), ".minecraft");
}

module.exports = {
  PATHS: PATHS,
  ROOT_DIR: ROOT_DIR,
  ensureDirs: ensureDirs,
  getInstancePath: getInstancePath,
  getMinecraftPath: getMinecraftPath
};