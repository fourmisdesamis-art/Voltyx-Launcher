/* =========================================================
   VOLTYX LAUNCHER — repair.js
   Vérifie et répare les fichiers Minecraft, Forge et LWJGL
   ========================================================= */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const dl = require("./downloader");
const manifest = require("./manifest");
const lwjgl = require("./lwjgl-override");

function sendProgress(win, data) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("install:progress", data);
  }
}

function getMcRoot() {
  const ROOT = path.join(require("os").homedir(), "AppData", "Roaming", ".VoltyxLauncher");
  const INSTANCE = path.join(ROOT, "instances", manifest.serverSlug);
  return path.join(INSTANCE, ".minecraft");
}

/**
 * Calcule le SHA1 d'un fichier
 */
function sha1File(filePath) {
  return new Promise(function (resolve, reject) {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.on("data", function (data) { hash.update(data); });
    stream.on("end", function () { resolve(hash.digest("hex")); });
    stream.on("error", reject);
  });
}

/**
 * Vérifie si un fichier est OK (existe + SHA1 correct)
 */
async function checkFile(filePath, expectedSha1) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: "missing" };
  }

  if (!expectedSha1) {
    return { ok: true };
  }

  try {
    const actual = await sha1File(filePath);
    if (actual.toLowerCase() === expectedSha1.toLowerCase()) {
      return { ok: true };
    }
    return { ok: false, reason: "corrupt" };
  } catch (err) {
    return { ok: false, reason: "error" };
  }
}

/**
 * Charge le JSON vanilla
 */
function loadVanillaJson(mcPath) {
  const p = path.join(mcPath, "versions", manifest.minecraftVersion, manifest.minecraftVersion + ".json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { return null; }
}

/**
 * Charge le JSON Forge
 */
function loadForgeJson(mcPath) {
  const versionsDir = path.join(mcPath, "versions");
  if (!fs.existsSync(versionsDir)) return null;
  const forgeDir = fs.readdirSync(versionsDir).find(function (d) {
    return d.toLowerCase().indexOf("forge") !== -1;
  });
  if (!forgeDir) return null;

  const p = path.join(versionsDir, forgeDir, forgeDir + ".json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { return null; }
}

/**
 * Réparer TOUT (Minecraft + Forge + LWJGL + mods)
 */
async function repairAll(win) {
  const mcPath = getMcRoot();
  const librariesDir = path.join(mcPath, "libraries");
  const vanillaJson = loadVanillaJson(mcPath);
  const forgeJson = loadForgeJson(mcPath);

  if (!vanillaJson) {
    return {
      success: false,
      message: "Minecraft n'est pas installé. Lancez d'abord une installation."
    };
  }

  const report = {
    total: 0,
    ok: 0,
    missing: [],
    corrupt: [],
    repaired: 0,
    failed: [],
    needsFullInstall: false
  };

  // ============================================
  // 1. FICHIER CLIENT VANILLA
  // ============================================
  sendProgress(win, {
    step: "repair",
    label: "Vérification du client Minecraft…",
    progress: 5
  });

  const clientPath = path.join(mcPath, "versions", manifest.minecraftVersion, manifest.minecraftVersion + ".jar");
  const clientCheck = await checkFile(clientPath, vanillaJson.downloads?.client?.sha1);

  report.total++;

  if (!clientCheck.ok) {
    if (clientCheck.reason === "missing") report.missing.push("Minecraft client");
    else report.corrupt.push("Minecraft client");

    // Retélécharge
    try {
      sendProgress(win, {
        step: "repair",
        label: "Réparation du client Minecraft…",
        progress: 8
      });
      await dl.download(vanillaJson.downloads.client.url, clientPath, { name: "Minecraft client" });
      report.repaired++;
    } catch (err) {
      report.failed.push("Minecraft client : " + err.message);
    }
  } else {
    report.ok++;
  }

  // ============================================
  // 2. LIBRARIES VANILLA + FORGE
  // ============================================
  const allLibraries = [];
  if (vanillaJson.libraries) allLibraries.push(...vanillaJson.libraries);
  if (forgeJson && forgeJson.libraries) allLibraries.push(...forgeJson.libraries);

  // Déduplique par nom
  const seenLibs = new Set();
  const uniqueLibraries = [];
  allLibraries.forEach(function (lib) {
    if (!lib.name || seenLibs.has(lib.name)) return;
    seenLibs.add(lib.name);
    uniqueLibraries.push(lib);
  });

  let libIndex = 0;
  for (const lib of uniqueLibraries) {
    libIndex++;

    if (!lib.downloads || !lib.downloads.artifact) continue;
    const art = lib.downloads.artifact;
    const libPath = path.join(librariesDir, art.path);

    report.total++;
    const check = await checkFile(libPath, art.sha1);

    if (!check.ok) {
      if (check.reason === "missing") report.missing.push(lib.name);
      else report.corrupt.push(lib.name);

      // Retélécharge
      try {
        await dl.download(art.url, libPath, { name: lib.name });
        report.repaired++;
      } catch (err) {
        report.failed.push(lib.name + " : " + err.message);
      }
    } else {
      report.ok++;
    }

    // Progress toutes les 10 libs
    if (libIndex % 10 === 0) {
      sendProgress(win, {
        step: "repair",
        label: "Vérification des libraries (" + libIndex + "/" + uniqueLibraries.length + ")…",
        progress: 15 + Math.round((libIndex / uniqueLibraries.length) * 55)
      });
    }
  }

  // ============================================
  // 3. LWJGL 3.3.1
  // ============================================
  sendProgress(win, {
    step: "repair",
    label: "Vérification de LWJGL " + lwjgl.LWJGL_VERSION + "…",
    progress: 75
  });

  for (const moduleName of lwjgl.LWJGL_MODULES) {
    const jarPath = path.join(
      librariesDir, "org", "lwjgl", moduleName, lwjgl.LWJGL_VERSION,
      moduleName + "-" + lwjgl.LWJGL_VERSION + ".jar"
    );

    report.total++;

    if (!fs.existsSync(jarPath)) {
      report.missing.push("LWJGL " + moduleName);
      // Sera retéléchargé au prochain lancement via install
      report.needsFullInstall = true;
    } else {
      report.ok++;
    }
  }

  // ============================================
  // 4. FORGE CLIENT JAR
  // ============================================
  if (forgeJson) {
    const forgeClientJar = path.join(
      librariesDir, "net", "minecraftforge", "forge",
      manifest.forgeVersion,
      "forge-" + manifest.forgeVersion + "-client.jar"
    );

    report.total++;

    if (!fs.existsSync(forgeClientJar)) {
      report.missing.push("Forge client");
      report.needsFullInstall = true;
    } else {
      report.ok++;
    }
  }

  // ============================================
  // 5. NATIVES (DLLs)
  // ============================================
  const nativesDir = path.join(mcPath, "natives", manifest.minecraftVersion);

  if (!fs.existsSync(nativesDir) || fs.readdirSync(nativesDir).filter(f => f.endsWith(".dll")).length < 5) {
    report.missing.push("Natives (DLLs)");
    report.needsFullInstall = true;
  } else {
    report.ok++;
  }

  report.total++;

  // ============================================
  // 6. RÉSUMÉ
  // ============================================
  sendProgress(win, {
    step: "repair",
    label: "Réparation terminée",
    progress: 100
  });

  const success = report.failed.length === 0 && report.missing.length === 0;

  return {
    success: success,
    report: report,
    message: success
      ? (report.repaired > 0 ? report.repaired + " fichier(s) réparé(s)" : "Tous les fichiers sont OK")
      : report.failed.length > 0
        ? report.failed.length + " fichier(s) n'ont pas pu être réparés"
        : report.missing.length + " fichier(s) manquant(s)"
  };
}

module.exports = {
  repairAll: repairAll,
  checkFile: checkFile
};