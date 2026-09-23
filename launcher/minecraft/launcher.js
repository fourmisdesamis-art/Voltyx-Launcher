/* =========================================================
   VOLTYX LAUNCHER — launcher.js
   Lancement de Minecraft 1.16.5 + Forge 36.2.34 + LWJGL 3.3.1
   ========================================================= */

const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const crypto = require("crypto");
const AdmZip = require("adm-zip");

const manifest = require("./manifest");
const lwjgl = require("./lwjgl-override");
const microsoftAuth = require("../auth/microsoft");

function getMcRoot() {
  const ROOT = path.join(os.homedir(), "AppData", "Roaming", ".VoltyxLauncher");
  const INSTANCE = path.join(ROOT, "instances", manifest.serverSlug);
  return path.join(INSTANCE, ".minecraft");
}

function generateOfflineUUID(username) {
  const hash = crypto.createHash("md5").update("OfflinePlayer:" + username).digest();
  const hex = hash.toString("hex");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20, 32);
}

function loadConfig() {
  try {
    const configPath = path.join(os.homedir(), "AppData", "Roaming", ".VoltyxLauncher", "config.json");
    if (!fs.existsSync(configPath)) return { ram: 4096 };
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    return { ram: 4096 };
  }
}

function findForgeVersion(mcPath) {
  const versionsDir = path.join(mcPath, "versions");
  if (!fs.existsSync(versionsDir)) {
    throw new Error("Dossier versions introuvable.");
  }
  const dirs = fs.readdirSync(versionsDir);
  const forgeDir = dirs.find(function (d) {
    return d.toLowerCase().indexOf("forge") !== -1;
  });
  if (!forgeDir) throw new Error("Aucune version Forge trouvée.");
  return forgeDir;
}

function loadVersionJson(mcPath) {
  const forgeDirName = findForgeVersion(mcPath);
  const versionDir = path.join(mcPath, "versions", forgeDirName);
  const jsonPath = path.join(versionDir, forgeDirName + ".json");
  if (!fs.existsSync(jsonPath)) throw new Error("Fichier JSON introuvable : " + jsonPath);
  const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  json._forgeDirName = forgeDirName;
  return json;
}

function extractNatives(forgeJson, vanillaJson, mcPath) {
  const librariesDir = path.join(mcPath, "libraries");
  const nativesDir = path.join(mcPath, "natives", manifest.minecraftVersion);

  if (fs.existsSync(nativesDir)) fs.rmSync(nativesDir, { recursive: true, force: true });
  fs.mkdirSync(nativesDir, { recursive: true });

  console.log("[Launch] Extraction des natives LWJGL " + lwjgl.LWJGL_VERSION + "…");
  const lwjglCount = lwjgl.extractLWJGLNatives(mcPath, nativesDir);
  console.log("[Launch] " + lwjglCount + " natives LWJGL extraites");

  const extracted = new Set();

  const BLACKLIST = [
    "lwjgl.dll", "lwjgl32.dll", "jemalloc.dll", "jemalloc32.dll",
    "OpenAL.dll", "OpenAL32.dll", "lwjgl_opengl.dll", "lwjgl_opengl32.dll",
    "glfw.dll", "glfw32.dll", "lwjgl_tinyfd.dll", "lwjgl_tinyfd32.dll",
    "lwjgl_stb.dll", "lwjgl_stb32.dll", "SAPIWrapper_x86.dll", "SAPIWrapper_x64.dll",
    "jt400.dll", "jinput-dx8.dll", "jinput-raw.dll", "jinput-wintab.dll",
    "lwjgl64.dll", "OpenAL64.dll"
  ];

  function processLibraries(libs) {
    if (!libs) return;
    libs.forEach(function (lib) {
      if (!lib.downloads || !lib.downloads.classifiers) return;
      const classifier = lib.downloads.classifiers["natives-windows"];
      if (!classifier) return;
      const jarPath = path.join(librariesDir, classifier.path);
      if (!fs.existsSync(jarPath)) return;

      try {
        const zip = new AdmZip(jarPath);
        zip.getEntries().forEach(function (entry) {
          if (entry.isDirectory) return;
          if (entry.entryName.startsWith("META-INF")) return;
          const fileName = path.basename(entry.entryName);
          if (!fileName.toLowerCase().endsWith(".dll")) return;
          if (BLACKLIST.indexOf(fileName) !== -1) return;
          if (extracted.has(fileName)) return;
          fs.writeFileSync(path.join(nativesDir, fileName), entry.getData());
          extracted.add(fileName);
        });
      } catch (err) {
        console.warn("[Launch] Impossible d'extraire :", jarPath, err.message);
      }
    });
  }

  processLibraries(forgeJson.libraries);
  processLibraries(vanillaJson ? vanillaJson.libraries : []);

  const allDlls = fs.readdirSync(nativesDir).filter(function (f) { return f.endsWith(".dll"); });
  console.log("[Launch] " + allDlls.length + " natives au total");

  return nativesDir;
}

function buildClasspath(forgeJson, vanillaJson, mcPath) {
  const librariesDir = path.join(mcPath, "libraries");
  const separator = process.platform === "win32" ? ";" : ":";
  const parts = [];
  const added = new Set();

  // LWJGL 3.3.1 prioritaire
  const lwjglEntries = lwjgl.getLWJGLClasspathEntries(mcPath);
  lwjglEntries.forEach(function (p) {
    if (!added.has(p)) { added.add(p); parts.push(p); }
  });
  console.log("[Launch] LWJGL " + lwjgl.LWJGL_VERSION + " : " + lwjglEntries.length + " jars");

  if (forgeJson && forgeJson.libraries) {
    forgeJson.libraries.forEach(function (lib) {
      if (!lib.downloads || !lib.downloads.artifact) return;
      if (lib.name && lib.name.indexOf("org.lwjgl") === 0) return;
      const libPath = path.join(librariesDir, lib.downloads.artifact.path);
      if (fs.existsSync(libPath) && !added.has(libPath)) {
        added.add(libPath); parts.push(libPath);
      }
    });
  }

  if (vanillaJson && vanillaJson.libraries) {
    vanillaJson.libraries.forEach(function (lib) {
      if (!lib.downloads || !lib.downloads.artifact) return;
      if (lib.name && lib.name.indexOf("org.lwjgl") === 0) return;
      const libPath = path.join(librariesDir, lib.downloads.artifact.path);
      if (fs.existsSync(libPath) && !added.has(libPath)) {
        added.add(libPath); parts.push(libPath);
      }
    });
  }

  const forgeClientJar = path.join(
    librariesDir, "net", "minecraftforge", "forge",
    manifest.forgeVersion,
    "forge-" + manifest.forgeVersion + "-client.jar"
  );
  if (fs.existsSync(forgeClientJar) && !added.has(forgeClientJar)) {
    added.add(forgeClientJar); parts.push(forgeClientJar);
  }

  const vanillaJar = path.join(mcPath, "versions", manifest.minecraftVersion, manifest.minecraftVersion + ".jar");
  if (fs.existsSync(vanillaJar) && !added.has(vanillaJar)) {
    added.add(vanillaJar); parts.push(vanillaJar);
  }

  console.log("[Launch] Classpath : " + parts.length + " entrées");
  return parts.join(separator);
}

function replaceArgs(args, vars) {
  return args
    .filter(function (arg) { return typeof arg === "string"; })
    .map(function (arg) {
      return arg.replace(/\$\{([^}]+)\}/g, function (match, key) {
        return vars[key] !== undefined ? vars[key] : match;
      });
    });
}

function filterJvmArgs(args) {
  return args.filter(function (arg) {
    if (typeof arg !== "string") return false;
    if (arg.startsWith("-XX:+UseConcMarkSweepGC")) return false;
    if (arg.startsWith("-XX:+UseParNewGC")) return false;
    if (arg.startsWith("-XX:-UseAdaptiveSizePolicy")) return false;
    if (arg.startsWith("-XX:-OmitStackTraceInFastThrow")) return false;
    return true;
  });
}

function findJava8() {
  const knownPaths = [
    "C:\\jdk8\\bin\\java.exe",
    "C:\\jdk8\\jre\\bin\\java.exe",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-8.0.422.5-hotspot\\bin\\java.exe",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-8.0.412.4-hotspot\\bin\\java.exe",
    "C:\\Program Files\\Java\\jre1.8.0_431\\bin\\java.exe"
  ];
  for (const p of knownPaths) if (fs.existsSync(p)) return p;
  if (fs.existsSync("C:\\jdk8")) {
    const subDirs = fs.readdirSync("C:\\jdk8");
    for (const dir of subDirs) {
      const candidates = [
        path.join("C:\\jdk8", dir, "bin", "java.exe"),
        path.join("C:\\jdk8", dir, "jre", "bin", "java.exe")
      ];
      for (const c of candidates) if (fs.existsSync(c)) return c;
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
  console.warn("[Launch] ⚠️ Java 8 introuvable, utilisation du java du PATH");
  return "java";
}

/**
 * Essaie de récupérer un compte Microsoft connecté
 * Sinon, fallback offline avec le pseudo Lumalia
 */
async function resolveAccount(lumaliaUsername) {
    console.log("[Launch] Recherche d'un compte Microsoft…");

    let msAccount = null;
    try {
      msAccount = await microsoftAuth.getCurrentMicrosoft();
      console.log("[Launch] getCurrentMicrosoft() →", msAccount);
    } catch (err) {
      console.error("[Launch] ❌ getCurrentMicrosoft() a throw :", err);
    }

    if (msAccount) {
    console.log("[Launch] Compte Microsoft trouvé :", msAccount.username);

    const token = await microsoftAuth.getMinecraftToken();

    if (!token) {
      console.warn("[Launch] Token Microsoft introuvable, fallback offline");
    } else {
      // ============================================================
      // RÉCUPÉRATION DU TOKEN D'ACCÈS — plusieurs stratégies en cascade
      // ============================================================
      let accessToken = null;
      let authUuid = null;
      let strategy = "aucune";

      // STRATÉGIE 1 : mclc(true) — méthode officielle msmc pour les launchers
      try {
        const mclcUser = token.mclc(true);
        console.log("[Launch] mclc() retourné :", JSON.stringify(mclcUser, null, 2));
        if (mclcUser && mclcUser.accessToken && mclcUser.accessToken.length > 100) {
          accessToken = mclcUser.accessToken;
          authUuid = mclcUser.selectedProfile?.id;
          strategy = "mclc(true)";
        }
      } catch (err) {
        console.warn("[Launch] mclc(true) a échoué :", err.message);
      }

      // STRATÉGIE 2 : getToken(true) — JWT complet
      if (!accessToken || accessToken.length < 100) {
        try {
          const t = token.getToken(true);
          if (t && t.length > 100) {
            accessToken = t;
            strategy = "getToken(true)";
          }
        } catch (err) {
          console.warn("[Launch] getToken(true) a échoué :", err.message);
        }
      }

      // STRATÉGIE 3 : mcToken brut
      if (!accessToken || accessToken.length < 100) {
        if (token.mcToken && token.mcToken.length > 100) {
          accessToken = token.mcToken;
          strategy = "mcToken";
        }
      }

      // UUID de secours
      if (!authUuid) {
        authUuid = token.profile?.id || msAccount.uuid;
      }
      const cleanUuid = (authUuid || "").replace(/-/g, "");

      // ============================================================
      // DEBUG
      // ============================================================
      console.log("[Launch] ============ DEBUG ACCOUNT ============");
      console.log("[Launch] Stratégie utilisée:", strategy);
      console.log("[Launch] Token length     :", accessToken ? accessToken.length : 0);
      console.log("[Launch] Token début      :", accessToken ? accessToken.slice(0, 60) : "AUCUN");
      console.log("[Launch] Nombre de points :", accessToken ? (accessToken.match(/\./g) || []).length : 0);
      console.log("[Launch] UUID nettoyé     :", cleanUuid);
      console.log("[Launch] UUID longueur    :", cleanUuid.length);
      console.log("[Launch] XUID             :", token.xuid || "0");
      console.log("[Launch] ========================================");

      // ⚠️ SÉCURITÉ : si le token fait moins de 100 chars → fallback offline
      if (!accessToken || accessToken.length < 100) {
        console.error("[Launch] ❌ Token invalide (trop court), fallback offline");
      } else {
        return {
          type: "microsoft",
          username: token.profile?.name || msAccount.username,
          uuid: cleanUuid,
          accessToken: accessToken,
          userType: "msa",
          xuid: token.xuid || "0"
        };
      }
    }
  }

  console.log("[Launch] Aucun compte Microsoft valide, mode offline");

  const offlineName = lumaliaUsername || "Player" + Math.floor(Math.random() * 9999);
  const offlineUuid = generateOfflineUUID(offlineName);

  return {
    type: "offline",
    username: offlineName,
    uuid: offlineUuid,
    accessToken: "0",
    userType: "legacy",
    xuid: "0"
  };
}

async function launchGame(win, lumaliaUsername) {
  const mcPath = getMcRoot();
  const config = loadConfig();
  const ram = config.ram || 4096;

  console.log("[Launch] Démarrage de Minecraft...");
  console.log("[Launch] Dossier :", mcPath);
  console.log("[Launch] RAM :", ram, "Mo");

  const forgeJson = loadVersionJson(mcPath);
  console.log("[Launch] Version :", forgeJson.id);

  const vanillaJsonPath = path.join(mcPath, "versions", manifest.minecraftVersion, manifest.minecraftVersion + ".json");
  let vanillaJson = null;
  if (fs.existsSync(vanillaJsonPath)) {
    vanillaJson = JSON.parse(fs.readFileSync(vanillaJsonPath, "utf8"));
    console.log("[Launch] JSON vanilla chargé");
  }

  // ⚠️ Résolution du compte (Microsoft ou offline)
  const account = await resolveAccount(lumaliaUsername);
  console.log("[Launch] Compte utilisé :", account.username, "(" + account.type + ")");

  const gameDir = mcPath;
  const assetsDir = path.join(mcPath, "assets");
  const assetIndex = (forgeJson.assetIndex && forgeJson.assetIndex.id)
    || (vanillaJson && vanillaJson.assetIndex && vanillaJson.assetIndex.id)
    || "1.16";

  const nativesDir = extractNatives(forgeJson, vanillaJson, mcPath);

  const vars = {
    "auth_player_name": account.username,
    "auth_uuid": (account.uuid || "").replace(/-/g, ""),
    "auth_access_token": account.accessToken,
    "auth_session": "token:" + account.accessToken + ":" + account.uuid,
    "auth_xuid": account.xuid,
    "user_type": account.userType,
    "user_properties": "{}",
    "version_name": forgeJson.id,
    "version_type": forgeJson.type || "release",
    "game_directory": gameDir,
    "assets_root": assetsDir,
    "assets_index_name": assetIndex,
    "natives_directory": nativesDir,
    "launcher_name": "VoltyxLauncher",
    "launcher_version": "0.1.0",
    "classpath": buildClasspath(forgeJson, vanillaJson, mcPath),
    "classpath_separator": process.platform === "win32" ? ";" : ":",
    "library_directory": path.join(mcPath, "libraries"),
    "resolution_width": "1280",
    "resolution_height": "720"
  };

  const javaExe = findJava8();
  console.log("[Launch] Java utilisé :", javaExe);

  const jvmArgsBase = [
    "-Xmx" + ram + "M",
    "-Xms" + Math.min(ram, 1024) + "M",
    "-Djava.library.path=" + nativesDir,
    "-Dminecraft.launcher.brand=" + vars.launcher_name,
    "-Dminecraft.launcher.version=" + vars.launcher_version,
    "-Dfml.ignoreInvalidMinecraftCertificates=true",
    "-Dfml.ignorePatchDiscrepancies=true",
    "-Dlog4j2.formatMsgNoLookups=true",
    "-cp",
    vars.classpath
  ];

  let jvmArgsFromJson = [];
  if (forgeJson.arguments && forgeJson.arguments.jvm) {
    jvmArgsFromJson = filterJvmArgs(replaceArgs(forgeJson.arguments.jvm, vars));
  } else if (vanillaJson && vanillaJson.arguments && vanillaJson.arguments.jvm) {
    jvmArgsFromJson = filterJvmArgs(replaceArgs(vanillaJson.arguments.jvm, vars));
  }

  const jvmArgs = jvmArgsFromJson.concat(jvmArgsBase);
  const mainClass = forgeJson.mainClass || (vanillaJson && vanillaJson.mainClass) || "cpw.mods.modlauncher.Launcher";

  let gameArgs = [];

  if (forgeJson.arguments && forgeJson.arguments.game) {
    gameArgs = replaceArgs(forgeJson.arguments.game, vars);
  }

  if (vanillaJson && vanillaJson.arguments && vanillaJson.arguments.game) {
    const vanillaArgs = replaceArgs(vanillaJson.arguments.game, vars);
    const forgeSet = new Set(gameArgs);
    vanillaArgs.forEach(function (arg) {
      if (!arg.startsWith("--fml.") && !forgeSet.has(arg)) {
        const isDuplicate = gameArgs.some(function (existing) {
          if (existing.startsWith("--") && arg.startsWith("--")) {
            return existing.split(" ")[0] === arg.split(" ")[0];
          }
          return false;
        });
        if (!isDuplicate) gameArgs.push(arg);
      }
    });
  }

  const fullArgs = jvmArgs.concat([mainClass]).concat(gameArgs);

  console.log("[Launch] Main class :", mainClass);
  console.log("[Launch] Nombre d'arguments :", fullArgs.length);

  // 🔍 DEBUG : affiche les args d'auth effectivement passés à Minecraft
  const authArgIndexes = [];
  fullArgs.forEach(function (arg, i) {
    if (typeof arg === "string" && (
      arg === "--accessToken" || arg === "--uuid" || arg === "--username" ||
      arg === "--userType" || arg === "--xuid" || arg === "--userProperties"
    )) {
      authArgIndexes.push(i);
    }
  });
  console.log("[Launch] ============ DEBUG ARGS AUTH ============");
  authArgIndexes.forEach(function (idx) {
    const key = fullArgs[idx];
    const val = fullArgs[idx + 1];
    const display = (typeof val === "string" && val.length > 60)
      ? val.slice(0, 60) + "… (" + val.length + " chars)"
      : val;
    console.log("[Launch]   " + key + " = " + display);
  });
  console.log("[Launch] ==========================================");

  return new Promise(function (resolve, reject) {
    const child = spawn(javaExe, fullArgs, {
      cwd: mcPath,
      detached: false
    });

    child.stdout.on("data", function (d) {
      process.stdout.write("[MC] " + d.toString());
    });

    child.stderr.on("data", function (d) {
      process.stderr.write("[MC ERR] " + d.toString());
    });

    child.on("close", function (code) {
      console.log("[Launch] Minecraft fermé (code " + code + ")");
      if (win && !win.isDestroyed()) {
        win.webContents.send("game:closed", { code: code });
        win.show();
        win.focus();
      }
      resolve({ code: code });
    });

    child.on("error", function (err) {
      console.error("[Launch] Erreur :", err);
      reject(err);
    });

    if (win && !win.isDestroyed()) {
      win.webContents.send("game:started", { pid: child.pid });
    }
  });
}

module.exports = {
  launchGame: launchGame
};