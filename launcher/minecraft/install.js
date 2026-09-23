/* =========================================================
   VOLTYX LAUNCHER — install.js
   Installation de Minecraft 1.16.5 + Forge 36.2.34 + LWJGL 3.3.1
   ========================================================= */

const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const dl = require("./downloader");
const manifest = require("./manifest");
const lwjgl = require("./lwjgl-override");

// ============================================================
// CONSTANTES MOJANG
// ============================================================
const MOJANG_MANIFEST = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const FORGE_MAVEN = "https://maven.minecraftforge.net";

// ============================================================
// UTILITAIRES
// ============================================================
function sendProgress(win, data) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("install:progress", data);
  }
}

function getMcRoot() {
  const ROOT = path.join(os.homedir(), "AppData", "Roaming", ".VoltyxLauncher");
  const INSTANCE = path.join(ROOT, "instances", manifest.serverSlug);
  return path.join(INSTANCE, ".minecraft");
}

function isForgeInstalled(mcPath) {
  const versionDir = path.join(mcPath, "versions", manifest.forgeVersion);
  const jsonPath = path.join(versionDir, manifest.forgeVersion + ".json");
  const jarPath = path.join(
    mcPath,
    "libraries",
    "net", "minecraftforge", "forge",
    manifest.forgeVersion,
    "forge-" + manifest.forgeVersion + "-client.jar"
  );
  return fs.existsSync(jsonPath) && fs.existsSync(jarPath);
}

function isVanillaInstalled(mcPath) {
  const versionDir = path.join(mcPath, "versions", manifest.minecraftVersion);
  const jsonPath = path.join(versionDir, manifest.minecraftVersion + ".json");
  const clientPath = path.join(versionDir, manifest.minecraftVersion + ".jar");
  return fs.existsSync(jsonPath) && fs.existsSync(clientPath);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

/**
 * Détecte Java 8 (obligatoire pour Forge installer ET pour lancer MC 1.16.5)
 */
function findJava8() {
  const knownPaths = [
    "C:\\jdk8\\bin\\java.exe",
    "C:\\jdk8\\jre\\bin\\java.exe",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-8.0.422.5-hotspot\\bin\\java.exe",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-8.0.412.4-hotspot\\bin\\java.exe",
    "C:\\Program Files\\Java\\jre1.8.0_431\\bin\\java.exe"
  ];

  for (const p of knownPaths) {
    if (fs.existsSync(p)) {
      console.log("[Java] Trouvé Java 8 :", p);
      return p;
    }
  }

  if (fs.existsSync("C:\\jdk8")) {
    const subDirs = fs.readdirSync("C:\\jdk8");
    for (const dir of subDirs) {
      const candidates = [
        path.join("C:\\jdk8", dir, "bin", "java.exe"),
        path.join("C:\\jdk8", dir, "jre", "bin", "java.exe")
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          console.log("[Java] Trouvé Java 8 :", c);
          return c;
        }
      }
    }
  }

  const adoptiumDir = "C:\\Program Files\\Eclipse Adoptium";
  if (fs.existsSync(adoptiumDir)) {
    const dirs = fs.readdirSync(adoptiumDir);
    const jdk8 = dirs.find(function (d) { return d.startsWith("jdk-8"); });
    if (jdk8) {
      const exe = path.join(adoptiumDir, jdk8, "bin", "java.exe");
      if (fs.existsSync(exe)) return exe;
    }
  }

  console.warn("[Java] ⚠️ Java 8 introuvable, utilisation du java du PATH");
  return "java";
}

// ============================================================
// ÉTAPE 1 : Manifest
// ============================================================
async function fetchVersionManifest() {
  console.log("[Install] Récupération du manifest Mojang…");

  const manifestData = await dl.downloadJSON(MOJANG_MANIFEST);
  const versionEntry = manifestData.versions.find(function (v) {
    return v.id === manifest.minecraftVersion;
  });

  if (!versionEntry) {
    throw new Error("Version " + manifest.minecraftVersion + " introuvable dans le manifest Mojang");
  }

  console.log("[Install] Version trouvée :", versionEntry.id);

  const versionJson = await dl.downloadJSON(versionEntry.url);
  return versionJson;
}

// ============================================================
// ÉTAPE 2 : Libraries + Natives
// ============================================================
async function downloadLibraries(win, versionJson, mcPath) {
  const libraries = versionJson.libraries || [];
  const total = libraries.length;
  let done = 0;

  const librariesDir = path.join(mcPath, "libraries");

  for (let i = 0; i < total; i++) {
    const lib = libraries[i];

    if (!lib.downloads) continue;

    // 1. Télécharge l'artifact principal
    if (lib.downloads.artifact) {
      const art = lib.downloads.artifact;
      const destPath = path.join(librariesDir, art.path);

      const valid = await dl.isFileValid(destPath, art.sha1);
      if (!valid) {
        try {
          await dl.download(art.url, destPath, { name: lib.name });
        } catch (err) {
          console.warn("[Install] Échec library " + lib.name + " :", err.message);
        }
      }
    }

    // 2. Télécharge aussi les natives (classifiers) pour Windows
    if (lib.downloads.classifiers) {
      const classifier = lib.downloads.classifiers["natives-windows"];
      if (classifier) {
        const destPath = path.join(librariesDir, classifier.path);

        const valid = await dl.isFileValid(destPath, classifier.sha1);
        if (!valid) {
          try {
            await dl.download(classifier.url, destPath, { name: lib.name + " (natives)" });
          } catch (err) {
            console.warn("[Install] Échec native " + lib.name + " :", err.message);
          }
        }
      }
    }

    done++;

    if (i % 20 === 0 || i === total - 1) {
      sendProgress(win, {
        step: "libraries",
        label: "Libraries (" + done + "/" + total + ")",
        progress: 40 + Math.round((done / total) * 15)
      });
    }
  }

  console.log("[Install] Libraries téléchargées :", done + "/" + total);
}

// ============================================================
// ÉTAPE 2b : LWJGL 3.3.1
// ============================================================
async function downloadLWJGL(win, mcPath) {
  console.log("[Install] Téléchargement de LWJGL 3.3.1 (correctif CPU)…");

  sendProgress(win, {
    step: "lwjgl",
    label: "Téléchargement de LWJGL 3.3.1 (correctif)…",
    progress: 56
  });

  try {
    await lwjgl.downloadLWJGL(mcPath, function (percent) {
      sendProgress(win, {
        step: "lwjgl",
        label: "Téléchargement de LWJGL 3.3.1… (" + percent + "%)",
        progress: 56 + Math.round((percent / 100) * 5)
      });
    });
    console.log("[Install] LWJGL 3.3.1 téléchargé");
  } catch (err) {
    console.warn("[Install] Échec LWJGL 3.3.1 :", err.message);
  }
}

// ============================================================
// ÉTAPE 3 : Assets (structure minimale)
// ============================================================
async function downloadAssets(win, versionJson, mcPath) {
  console.log("[Install] Préparation des assets…");

  const assetsDir = path.join(mcPath, "assets");
  const indexesDir = path.join(assetsDir, "indexes");
  const objectsDir = path.join(assetsDir, "objects");

  ensureDir(assetsDir);
  ensureDir(indexesDir);
  ensureDir(objectsDir);

  if (versionJson.assetIndex && versionJson.assetIndex.url) {
    const indexId = versionJson.assetIndex.id;
    const indexDest = path.join(indexesDir, indexId + ".json");

    if (!fs.existsSync(indexDest)) {
      sendProgress(win, {
        step: "assets",
        label: "Téléchargement de l'index des assets…",
        progress: 62
      });

      try {
        await dl.download(versionJson.assetIndex.url, indexDest, { name: "assets index" });
        console.log("[Install] Index des assets téléchargé :", indexId);
      } catch (err) {
        console.warn("[Install] Échec index assets :", err.message);
      }
    }
  }

  sendProgress(win, {
    step: "assets",
    label: "Assets prêts",
    progress: 65
  });
}

// ============================================================
// ÉTAPE 4 : Forge
// ============================================================
async function installForge(win, mcPath) {
  const forgeVersion = manifest.forgeVersion;
  const forgeDir = path.join(mcPath, "forge-temp");
  ensureDir(forgeDir);

  // Crée un launcher_profiles.json vide (requis par Forge installer)
  const launcherProfilesPath = path.join(mcPath, "launcher_profiles.json");
  if (!fs.existsSync(launcherProfilesPath)) {
    const emptyProfiles = {
      profiles: {},
      settings: {
        enableSnapshots: false,
        enableAdvanced: false,
        keepLauncherOpen: false,
        showGameLog: false,
        locale: "fr_FR",
        profileSorting: "ByLastPlayed"
      },
      version: 3
    };
    fs.writeFileSync(launcherProfilesPath, JSON.stringify(emptyProfiles, null, 2), "utf8");
    console.log("[Install] launcher_profiles.json créé");
  }

  const installerUrl = FORGE_MAVEN + "/net/minecraftforge/forge/" + forgeVersion +
    "/forge-" + forgeVersion + "-installer.jar";
  const installerPath = path.join(forgeDir, "forge-installer.jar");

  if (!fs.existsSync(installerPath)) {
    sendProgress(win, {
      step: "forge",
      label: "Téléchargement de Forge " + forgeVersion + "…",
      progress: 70
    });

    console.log("[Install] Téléchargement Forge :", installerUrl);
    await dl.download(installerUrl, installerPath, { name: "Forge installer" });
  }

  sendProgress(win, {
    step: "forge",
    label: "Installation de Forge (peut prendre 2-3 min)…",
    progress: 75
  });

  const javaExe = findJava8();
  console.log("[Install] Java utilisé pour Forge :", javaExe);

  if (!fs.existsSync(javaExe) && javaExe !== "java") {
    throw new Error("Java 8 introuvable à l'emplacement : " + javaExe);
  }

  return new Promise(function (resolve, reject) {
    console.log("[Install] Exécution de Forge installer…");

    const args = [
      "-jar", installerPath,
      "--installClient",
      mcPath
    ];

    const child = spawn(javaExe, args, {
      cwd: forgeDir,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", function (d) {
      stdout += d.toString();
      console.log("[Forge]", d.toString().trim());
    });

    child.stderr.on("data", function (d) {
      stderr += d.toString();
      console.log("[Forge ERR]", d.toString().trim());
    });

    child.on("close", function (code) {
      console.log("[Install] Forge installer terminé avec code", code);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error("Forge installer a échoué (code " + code + ")\n" + stderr));
      }
    });

    child.on("error", reject);
  });
}

// ============================================================
// FONCTION PRINCIPALE
// ============================================================
async function installAll(win) {
  const mcPath = getMcRoot();
  console.log("[Install] Dossier cible :", mcPath);

  ensureDir(mcPath);

  // ⚠️ Connecte le downloader au renderer pour la progression détaillée
  dl.setProgressCallback(function (data) {
    sendProgress(win, {
      step: "download",
      label: data.fileName + " — " + data.downloadedText + " / " + data.totalText,
      progress: data.percent,
      detail: {
        fileName: data.fileName,
        speed: data.speedText,
        remaining: data.remainingText,
        downloaded: data.downloadedText,
        total: data.totalText
      }
    });
  });

  try {
    // 1. Manifest
    sendProgress(win, {
      step: "manifest",
      label: "Récupération du manifest Minecraft…",
      progress: 5
    });

    const versionJson = await fetchVersionManifest();

    sendProgress(win, {
      step: "manifest",
      label: "Manifest récupéré",
      progress: 10
    });

    // 2. Sauvegarde du JSON de version
    const versionDir = path.join(mcPath, "versions", manifest.minecraftVersion);
    ensureDir(versionDir);

    const versionJsonPath = path.join(versionDir, manifest.minecraftVersion + ".json");
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2));

    // 3. Client.jar
    const clientPath = path.join(versionDir, manifest.minecraftVersion + ".jar");

    if (!fs.existsSync(clientPath)) {
      sendProgress(win, {
        step: "client",
        label: "Téléchargement du client Minecraft…",
        progress: 15
      });

      await dl.download(versionJson.downloads.client.url, clientPath, { name: "Minecraft client" });

      sendProgress(win, {
        step: "client",
        label: "Client téléchargé",
        progress: 40
      });
    } else {
      console.log("[Install] Client déjà téléchargé");
    }

    // 4. Libraries + natives
    await downloadLibraries(win, versionJson, mcPath);

    // 4b. LWJGL 3.3.1 (correctif CPU)
    await downloadLWJGL(win, mcPath);

    // 5. Assets
    await downloadAssets(win, versionJson, mcPath);

    // 6. Forge
    if (!isForgeInstalled(mcPath)) {
      await installForge(win, mcPath);
    } else {
      console.log("[Install] Forge déjà installé");
    }

    sendProgress(win, {
      step: "done",
      label: "Installation terminée !",
      progress: 100
    });

    return {
      success: true,
      mcPath: mcPath,
      version: manifest.forgeVersion
    };

  } catch (err) {
    console.error("[Install] Erreur :", err);
    sendProgress(win, {
      step: "error",
      label: "Erreur : " + err.message,
      progress: 0
    });
    throw err;
  }
}

module.exports = {
  installAll: installAll,
  isForgeInstalled: isForgeInstalled,
  isVanillaInstalled: isVanillaInstalled,
  findJava8: findJava8
};