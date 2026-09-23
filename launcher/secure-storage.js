/* =========================================================
   VOLTYX LAUNCHER — secure-storage.js
   Stockage sécurisé avec safeStorage d'Electron
   Compatible Node pur (fallback pour scripts de debug)
   ========================================================= */

const path = require("path");
const fs = require("fs");
const os = require("os");

// Détecte si on tourne dans Electron ou en Node pur
let electronApp = null;
let safeStorage = null;
try {
  const electron = require("electron");
  electronApp = electron.app;
  safeStorage = electron.safeStorage;
} catch (_) {
  // Node pur, pas d'Electron
}

/**
 * Chemin du dossier de stockage.
 * - Electron : app.getPath("userData")
 * - Node pur : %APPDATA%/.VoltyxLauncher (Windows) ou ~/.VoltyxLauncher
 */
function getStorageDir() {
  if (electronApp && typeof electronApp.getPath === "function") {
    return electronApp.getPath("userData");
  }
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(home, "AppData", "Roaming", ".VoltyxLauncher");
  }
  return path.join(home, ".VoltyxLauncher");
}

function getStoragePath(name) {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}

function isEncryptionAvailable() {
  return safeStorage && typeof safeStorage.isEncryptionAvailable === "function"
    ? safeStorage.isEncryptionAvailable()
    : false;
}

function writeSecure(name, data) {
  try {
    const filePath = getStoragePath(name);
    const json = JSON.stringify(data);
    let toWrite;

    if (isEncryptionAvailable()) {
      toWrite = safeStorage.encryptString(json);
    } else {
      console.warn("[SecureStorage] Chiffrement indisponible pour :", name);
      toWrite = Buffer.from(json, "utf8");
    }

    fs.writeFileSync(filePath, toWrite);
    return true;
  } catch (err) {
    console.error("[SecureStorage] Écriture échouée :", name, err);
    return false;
  }
}

function readSecure(name) {
  try {
    const filePath = getStoragePath(name);
    if (!fs.existsSync(filePath)) return null;

    const data = fs.readFileSync(filePath);
    let json;

    if (isEncryptionAvailable()) {
      try {
        json = safeStorage.decryptString(data);
      } catch (e) {
        console.warn("[SecureStorage] Déchiffrement échoué, tentative en clair");
        json = data.toString("utf8");
      }
    } else {
      json = data.toString("utf8");
    }

    return JSON.parse(json);
  } catch (err) {
    console.error("[SecureStorage] Lecture échouée :", name, err);
    return null;
  }
}

function deleteSecure(name) {
  try {
    const filePath = getStoragePath(name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    console.error("[SecureStorage] Suppression échouée :", name, err);
    return false;
  }
}

module.exports = {
  writeSecure,
  readSecure,
  deleteSecure
};