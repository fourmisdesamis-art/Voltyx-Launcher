/* =========================================================
   VOLTYX LAUNCHER — mods.js
   Installation des mods (copie depuis le dossier du launcher)
   ========================================================= */

const fs = require("fs");
const path = require("path");

const { getMinecraftPath } = require("../paths");
const manifest = require("./manifest");

function sendProgress(win, data) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("install:progress", data);
  }
}

/**
 * Dossier source des mods (embarqués dans le launcher)
 */
function getSourceModsPath() {
  return path.join(__dirname, "mods");
}

/**
 * Copie un fichier avec création du dossier parent
 */
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

/**
 * Compare 2 fichiers par leur taille
 */
function isSameFile(src, dest) {
  try {
    if (!fs.existsSync(src) || !fs.existsSync(dest)) return false;
    const srcStat = fs.statSync(src);
    const destStat = fs.statSync(dest);
    return srcStat.size === destStat.size;
  } catch (err) {
    return false;
  }
}

/**
 * Installe les mods embarqués dans le launcher
 */
async function installMods(win) {
  const mcPath = getMinecraftPath(manifest.serverSlug);
  const modsDir = path.join(mcPath, "mods");
  const sourceModsDir = getSourceModsPath();

  console.log("[Mods] Source :", sourceModsDir);
  console.log("[Mods] Cible :", modsDir);

  // Crée le dossier destination
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }

  // Vérifie que le dossier source existe
  if (!fs.existsSync(sourceModsDir)) {
    console.error("[Mods] Dossier source introuvable :", sourceModsDir);
    return {
      success: false,
      installed: 0,
      total: manifest.mods.length,
      error: "Dossier source introuvable"
    };
  }

  const total = manifest.mods.length;
  let installed = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const mod = manifest.mods[i];
    const srcPath = path.join(sourceModsDir, mod.filename);
    const destPath = path.join(modsDir, mod.filename);

    sendProgress(win, {
      step: "mods",
      label: "Vérification de " + mod.name + " (" + (i + 1) + "/" + total + ")…",
      progress: Math.round((i / total) * 100)
    });

    try {
      // Vérifie si la source existe
      if (!fs.existsSync(srcPath)) {
        console.warn("[Mods] Source introuvable pour " + mod.name + " :", srcPath);
        sendProgress(win, {
          step: "mods-warning",
          label: "Mod introuvable : " + mod.name,
          progress: Math.round((i / total) * 100)
        });
        continue;
      }

      // Vérifie si le mod est déjà installé et identique
      if (isSameFile(srcPath, destPath)) {
        console.log("[Mods] Déjà installé :", mod.name);
        skipped++;
        installed++;
        continue;
      }

      // Copie
      copyFile(srcPath, destPath);
      console.log("[Mods] Installé :", mod.name);
      installed++;

    } catch (err) {
      console.error("[Mods] Erreur sur " + mod.name + " :", err.message);
      sendProgress(win, {
        step: "mods-error",
        label: "Erreur sur " + mod.name + " : " + err.message,
        progress: Math.round((i / total) * 100)
      });
    }
  }

  sendProgress(win, {
    step: "mods",
    label: installed + "/" + total + " mods installés",
    progress: 100
  });

  return {
    success: installed === total,
    installed: installed,
    skipped: skipped,
    total: total
  };
}

module.exports = {
  installMods: installMods
};