/* =========================================================
   VOLTYX LAUNCHER — lwjgl-override.js
   Remplace LWJGL 3.2.2 par 3.3.1 pour corriger les bugs CPU
   ========================================================= */

const path = require("path");
const fs = require("fs");
const dl = require("./downloader");

// Version LWJGL corrigée
const LWJGL_VERSION = "3.3.1";
const LWJGL_BASE_URL = "https://repo1.maven.org/maven2/org/lwjgl";

// Liste des modules LWJGL nécessaires pour Minecraft 1.16.5
const LWJGL_MODULES = [
  "lwjgl",
  "lwjgl-glfw",
  "lwjgl-jemalloc",
  "lwjgl-openal",
  "lwjgl-opengl",
  "lwjgl-stb",
  "lwjgl-tinyfd"
];

/**
 * Télécharge LWJGL 3.3.1 (jars + natives)
 */
async function downloadLWJGL(mcPath, onProgress) {
  const librariesDir = path.join(mcPath, "libraries");

  console.log("[LWJGL] Téléchargement de LWJGL " + LWJGL_VERSION + "…");

  let done = 0;
  const total = LWJGL_MODULES.length * 2; // jar + natives

  for (const module of LWJGL_MODULES) {
    // 1. Jar principal
    const jarUrl = LWJGL_BASE_URL + "/" + module + "/" + LWJGL_VERSION +
      "/" + module + "-" + LWJGL_VERSION + ".jar";
    const jarPath = path.join(
      librariesDir,
      "org", "lwjgl", module, LWJGL_VERSION,
      module + "-" + LWJGL_VERSION + ".jar"
    );

    if (!fs.existsSync(jarPath)) {
      try {
        await dl.download(jarUrl, jarPath);
        console.log("[LWJGL] Téléchargé : " + module + "-" + LWJGL_VERSION + ".jar");
      } catch (err) {
        console.warn("[LWJGL] Échec " + module + " :", err.message);
      }
    }
    done++;

    // 2. Natives Windows
    const nativesUrl = LWJGL_BASE_URL + "/" + module + "/" + LWJGL_VERSION +
      "/" + module + "-" + LWJGL_VERSION + "-natives-windows.jar";
    const nativesPath = path.join(
      librariesDir,
      "org", "lwjgl", module, LWJGL_VERSION,
      module + "-" + LWJGL_VERSION + "-natives-windows.jar"
    );

    if (!fs.existsSync(nativesPath)) {
      try {
        await dl.download(nativesUrl, nativesPath);
        console.log("[LWJGL] Téléchargé : " + module + "-" + LWJGL_VERSION + "-natives-windows.jar");
      } catch (err) {
        console.warn("[LWJGL] Échec natives " + module + " :", err.message);
      }
    }
    done++;

    if (onProgress) {
      onProgress(Math.round((done / total) * 100));
    }
  }

  console.log("[LWJGL] Téléchargement terminé");
}

/**
 * Renvoie les chemins des jars LWJGL 3.3.1 téléchargés
 */
function getLWJGLClasspathEntries(mcPath) {
  const librariesDir = path.join(mcPath, "libraries");
  const entries = [];

  for (const module of LWJGL_MODULES) {
    const jarPath = path.join(
      librariesDir,
      "org", "lwjgl", module, LWJGL_VERSION,
      module + "-" + LWJGL_VERSION + ".jar"
    );

    if (fs.existsSync(jarPath)) {
      entries.push(jarPath);
    }
  }

  return entries;
}

/**
 * Extrait les natives LWJGL 3.3.1 dans le dossier natives
 */
function extractLWJGLNatives(mcPath, nativesDir) {
  const AdmZip = require("adm-zip");
  const librariesDir = path.join(mcPath, "libraries");

  let count = 0;

  for (const module of LWJGL_MODULES) {
    const nativesJar = path.join(
      librariesDir,
      "org", "lwjgl", module, LWJGL_VERSION,
      module + "-" + LWJGL_VERSION + "-natives-windows.jar"
    );

    if (!fs.existsSync(nativesJar)) continue;

    try {
      const zip = new AdmZip(nativesJar);
      const entries = zip.getEntries();

      entries.forEach(function (entry) {
        if (entry.isDirectory) return;
        if (entry.entryName.startsWith("META-INF")) return;

        const fileName = path.basename(entry.entryName);
        if (!fileName.endsWith(".dll")) return;

        const destPath = path.join(nativesDir, fileName);
        fs.writeFileSync(destPath, entry.getData());
        count++;
      });
    } catch (err) {
      console.warn("[LWJGL] Erreur extraction " + module + " :", err.message);
    }
  }

  console.log("[LWJGL] " + count + " natives 3.3.1 extraites");
  return count;
}

module.exports = {
  LWJGL_VERSION: LWJGL_VERSION,
  LWJGL_MODULES: LWJGL_MODULES,
  downloadLWJGL: downloadLWJGL,
  getLWJGLClasspathEntries: getLWJGLClasspathEntries,
  extractLWJGLNatives: extractLWJGLNatives
};