/* =========================================================
   VOLTYX LAUNCHER — discord-rpc.js
   Discord Rich Presence (activité en direct)
   ========================================================= */

const DiscordRPC = require("discord-rpc");

const CLIENT_ID = "1551994547716755477";

let rpc = null;
let isConnected = false;
let currentActivity = null;
let reconnectTimer = null;
let connecting = false; // ⚠️ verrou anti-spam
let lastActionTime = 0; // ⚠️ timestamp dernière action
const MIN_ACTION_DELAY = 500; // 500ms minimum entre 2 actions

// ============================================================
// ACTIVITÉS PRÉDÉFINIES
// ============================================================
const ACTIVITIES = {
  launcher: {
    details: "Dans le launcher",
    state: "Prêt à jouer",
    largeImageKey: "logo",
    largeImageText: "Voltyx Launcher",
    smallImageKey: "online",
    smallImageText: "En ligne",
    startTimestamp: Date.now(),
    instance: false
  },
  playing: {
    details: "Joue sur Lumalia",
    state: "Serveur Crystal",
    largeImageKey: "logo",
    largeImageText: "Voltyx Launcher",
    smallImageKey: "playing",
    smallImageText: "En jeu",
    startTimestamp: Date.now(),
    instance: false
  },
  installing: {
    details: "Installation en cours",
    state: "Téléchargement…",
    largeImageKey: "logo",
    largeImageText: "Voltyx Launcher",
    smallImageKey: "downloading",
    smallImageText: "Installation",
    startTimestamp: Date.now(),
    instance: false
  }
};

// ============================================================
// UTILITAIRES
// ============================================================
function canAct() {
  const now = Date.now();
  if (now - lastActionTime < MIN_ACTION_DELAY) {
    console.log("[Discord] Action ignorée (trop rapide)");
    return false;
  }
  lastActionTime = now;
  return true;
}

// ============================================================
// CONNEXION
// ============================================================
async function connect() {
  // ⚠️ Anti-spam : déjà connecté
  if (isConnected && rpc) {
    console.log("[Discord] Déjà connecté, on ignore");
    return;
  }

  // ⚠️ Anti-spam : connexion en cours
  if (connecting) {
    console.log("[Discord] Connexion déjà en cours, on ignore");
    return;
  }

  // ⚠️ Anti-spam : trop rapide
  if (!canAct()) {
    return;
  }

  connecting = true;

  try {
    // ⚠️ Détruit toute connexion existante avant
    if (rpc) {
      try { await rpc.destroy(); } catch (e) {}
      rpc = null;
    }

    isConnected = false;

    rpc = new DiscordRPC.Client({ transport: "ipc" });

    rpc.on("ready", function () {
      isConnected = true;
      connecting = false;
      console.log("[Discord] Rich Presence connecté");

      // Set l'activité par défaut
      setActivity("launcher");
    });

    rpc.on("disconnected", function () {
      isConnected = false;
      console.log("[Discord] Déconnecté");
      scheduleReconnect();
    });

    await rpc.login({ clientId: CLIENT_ID });

  } catch (err) {
    console.warn("[Discord] Connexion échouée :", err.message);
    isConnected = false;
    connecting = false;
    rpc = null;
    // ⚠️ Ne pas reconnecter auto si c'est un toggle manuel
  }
}

// ============================================================
// RECONNEXION AUTOMATIQUE
// ============================================================
function scheduleReconnect() {
  if (reconnectTimer) return;
  if (!isConnected && !connecting) return; // on ne reconnecte que si on était connecté

  reconnectTimer = setTimeout(function () {
    reconnectTimer = null;
    console.log("[Discord] Tentative de reconnexion…");
    connect();
  }, 15000);
}

// ============================================================
// SET ACTIVITÉ
// ============================================================
function setActivity(key, customData) {
  if (!rpc || !isConnected) return;

  var activity;
  if (typeof key === "object") {
    activity = key;
  } else {
    activity = Object.assign({}, ACTIVITIES[key] || ACTIVITIES.launcher);
  }

  if (customData) {
    Object.assign(activity, customData);
  }

  activity.startTimestamp = activity.startTimestamp || Date.now();

  try {
    rpc.setActivity(activity);
    currentActivity = activity;
    console.log("[Discord] Activité :", activity.details, "—", activity.state);
  } catch (err) {
    console.warn("[Discord] Impossible de set l'activité :", err.message);
  }
}

// ============================================================
// SUPPRESSION
// ============================================================
function clearActivity() {
  if (!rpc || !isConnected) return;

  try {
    rpc.clearActivity();
    currentActivity = null;
    console.log("[Discord] Activité effacée");
  } catch (err) {
    console.warn("[Discord] Impossible d'effacer :", err.message);
  }
}

// ============================================================
// DÉCONNEXION
// ============================================================
async function disconnect() {
  // ⚠️ Anti-spam : trop rapide
  if (!canAct()) {
    return;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // ⚠️ Annule une éventuelle connexion en cours
  if (connecting) {
    console.log("[Discord] Attente de la fin de connexion…");
    let waited = 0;
    while (connecting && waited < 3000) {
      await new Promise(r => setTimeout(r, 100));
      waited += 100;
    }
  }

  if (rpc) {
    try {
      await rpc.destroy();
    } catch (err) {
      console.warn("[Discord] Erreur destroy :", err.message);
    }
    rpc = null;
  }

  isConnected = false;
  connecting = false;
  currentActivity = null;
  console.log("[Discord] Déconnecté");
}

// ============================================================
// ÉTAT
// ============================================================
function isReady() {
  return isConnected;
}

// ============================================================
// API
// ============================================================
module.exports = {
  connect: connect,
  disconnect: disconnect,
  setActivity: setActivity,
  clearActivity: clearActivity,
  isReady: isReady
};