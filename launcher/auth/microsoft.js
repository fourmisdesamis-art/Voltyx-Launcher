/* =========================================================
   VOLTYX LAUNCHER — microsoft.js
   Auth Microsoft via msmc v5.0.5
   ========================================================= */

const { Auth } = require("msmc");
const storage = require("../secure-storage");

const TOKEN_FILE = "minecraft-token.dat";

let minecraftToken = null;   // objet Minecraft (token.profile, token.mcToken, ...)
let xboxManager = null;      // objet Xbox (pour refresh & save)

/**
 * Petite aide pour transformer n'importe quel throw en message lisible.
 */
function formatError(err) {
  if (!err) return "Erreur inconnue";
  if (typeof err === "string") {
    try {
      const { lexicon } = require("msmc");
      if (typeof lexicon?.lst === "function" && err.startsWith("error.")) {
        return lexicon.lst(err);
      }
    } catch (_) {}
    return err;
  }
  if (err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch (_) {
    return String(err);
  }
}

/**
 * Récupère (ou restaure) un token Minecraft valide.
 */
async function getMinecraftToken() {
  console.log("[Microsoft] ============================================");
  console.log("[Microsoft] getMinecraftToken() appelé");
  console.log("[Microsoft] minecraftToken en mémoire ?", !!minecraftToken);
  console.log("[Microsoft] xboxManager en mémoire ?", !!xboxManager);

  // ========== 1. Token en mémoire ==========
  if (minecraftToken && xboxManager) {
    const stillValid =
      typeof minecraftToken.validate === "function"
        ? minecraftToken.validate()
        : true;

    console.log("[Microsoft] Token en mémoire valide ?", stillValid);

    if (stillValid) {
      console.log("[Microsoft] Token en mémoire toujours valide");
      return minecraftToken;
    }

    try {
      console.log("[Microsoft] Token expiré, refresh en cours…");
      await xboxManager.refresh();
      minecraftToken = await xboxManager.getMinecraft();
      console.log("[Microsoft] Token mémoire rafraîchi");
      return minecraftToken;
    } catch (err) {
      console.warn("[Microsoft] Refresh mémoire échoué :", formatError(err));
      minecraftToken = null;
      xboxManager = null;
    }
  }

  // ========== 2. Token sauvegardé sur disque ==========
  console.log("[Microsoft] Lecture du token sur disque…");
  let savedToken = null;
  try {
    savedToken = storage.readSecure(TOKEN_FILE);
  } catch (err) {
    console.error("[Microsoft] ❌ readSecure() a throw :", err);
    console.error("[Microsoft] Stack :", err.stack);
  }
  console.log("[Microsoft] savedToken trouvé ?", !!savedToken);

  if (savedToken) {
    try {
      console.log("[Microsoft] Restauration du token sauvegardé…");
      const authManager = new Auth("select_account");
      const xbox = await authManager.refresh(savedToken);
      console.log("[Microsoft] Xbox restauré");
      xboxManager = xbox;
      minecraftToken = await xbox.getMinecraft();
      console.log("[Microsoft] Token Minecraft restauré avec succès");
      return minecraftToken;
    } catch (err) {
      console.error("[Microsoft] ❌ refresh() a throw :", formatError(err));
      console.error("[Microsoft] Stack :", err.stack);
      minecraftToken = null;
      xboxManager = null;
      storage.deleteSecure(TOKEN_FILE);
    }
  }

  console.log("[Microsoft] Aucun token disponible");
  return null;
}

/**
 * Renvoie l'objet Xbox courant (ou null).
 */
async function getXbox() {
  await getMinecraftToken();
  return xboxManager;
}

/**
 * Lance la connexion Microsoft.
 */
async function loginMicrosoft() {
  try {
    console.log("[Microsoft] Ouverture de la connexion Microsoft…");

    const authManager = new Auth("select_account");
    const xbox = await authManager.launch("raw");
    if (!xbox) {
      return { success: false, message: "Connexion Microsoft annulée ou impossible." };
    }

    xboxManager = xbox;
    const token = await xbox.getMinecraft();
    if (!token) {
      return { success: false, message: "Impossible de récupérer le token Minecraft." };
    }

    minecraftToken = token;

    const profile = token.profile;
    if (!profile) {
      return { success: false, message: "Impossible de récupérer le profil Minecraft." };
    }

    const tokenToSave = xbox.save();
    storage.writeSecure(TOKEN_FILE, tokenToSave);

    console.log("[Microsoft] Connecté :", profile.name);

    return {
      success: true,
      username: profile.name,
      uuid: profile.id,
      name: profile.name
    };

  } catch (err) {
    console.error("[Microsoft] Erreur login :", err);
    return { success: false, message: formatError(err) };
  }
}

/**
 * Déconnexion Microsoft.
 */
async function logoutMicrosoft() {
  try {
    minecraftToken = null;
    xboxManager = null;
    storage.deleteSecure(TOKEN_FILE);
    console.log("[Microsoft] Déconnecté");
    return { success: true };
  } catch (err) {
    console.error("[Microsoft] Erreur logout :", err);
    return { success: false, message: formatError(err) };
  }
}

/**
 * Info du compte actuellement connecté (ou null).
 */
async function getCurrentMicrosoft() {
  console.log("[Microsoft] getCurrentMicrosoft() appelé");
  const token = await getMinecraftToken();
  console.log("[Microsoft] getCurrentMicrosoft → token ?", !!token);
  if (!token) return null;

  const profile = token.profile;
  if (!profile) {
    console.log("[Microsoft] getCurrentMicrosoft → profile ?", false);
    return null;
  }

  console.log("[Microsoft] getCurrentMicrosoft → profile.name :", profile.name);
  return {
    username: profile.name,
    uuid: profile.id,
    name: profile.name
  };
}

module.exports = {
  getMinecraftToken,
  getXbox,
  loginMicrosoft,
  logoutMicrosoft,
  getCurrentMicrosoft
};