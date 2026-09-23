/* =========================================================
   VOLTYX LAUNCHER — lumalia.js
   Authentification Lumalia (Firebase fetch direct)
   ========================================================= */

const storage = require("../secure-storage");

const FIREBASE_API_KEY = "AIzaSyBSCqSsBTXk9Q8sBX88NgrdDHUAHT0Cq6I";
const FIREBASE_PROJECT_ID = "lumalia";

const SESSION_FILE = "lumalia-session.dat";

let currentSession = null;

/**
 * Sauvegarde la session
 */
function saveSession(session) {
  currentSession = session;
  storage.writeSecure(SESSION_FILE, {
    uid: session.uid,
    email: session.email,
    username: session.username,
    refreshToken: session.refreshToken
  });
}

/**
 * Supprime la session
 */
function clearSession() {
  currentSession = null;
  storage.deleteSecure(SESSION_FILE);
}

/**
 * Connexion avec email + password
 */
async function loginLumalia(email, password) {
  try {
    const cleanEmail = String(email || "").trim();

    if (!cleanEmail || !password) {
      return {
        success: false,
        message: "Veuillez remplir tous les champs."
      };
    }

    console.log("[Lumalia] Connexion :", cleanEmail);

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password: password,
          returnSecureToken: true
        })
      }
    );

    const data = await res.json();

    if (!res.ok || !data.localId) {
      const code = data?.error?.message;

      let message = "Connexion refusée.";

      if (code === "INVALID_LOGIN_CREDENTIALS") message = "Email ou mot de passe incorrect.";
      else if (code === "EMAIL_NOT_FOUND") message = "Aucun compte ne correspond à cet email.";
      else if (code === "INVALID_PASSWORD") message = "Mot de passe incorrect.";
      else if (code === "USER_DISABLED") message = "Ce compte est désactivé.";
      else if (code === "TOO_MANY_ATTEMPTS_TRY_LATER") message = "Trop de tentatives. Réessayez plus tard.";
      else if (code) message = `Erreur Firebase : ${code}`;

      return { success: false, message: message };
    }

    // Récupère le profil Firestore
    const userRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/Utilisateurs/${data.localId}`,
      {
        method: "GET",
        headers: { "Authorization": `Bearer ${data.idToken}` }
      }
    );

    const userData = await userRes.json();

    if (!userRes.ok || !userData.fields) {
      return {
        success: false,
        message: "Profil Lumalia introuvable dans Firestore."
      };
    }

    const username =
      userData.fields?.username?.stringValue ||
      cleanEmail.split("@")[0];

    const session = {
      uid: data.localId,
      email: cleanEmail,
      username: username,
      idToken: data.idToken,
      refreshToken: data.refreshToken
    };

    saveSession(session);

    console.log("[Lumalia] Connecté :", username);

    return {
      success: true,
      uid: session.uid,
      username: session.username,
      email: session.email
    };

  } catch (err) {
    console.error("[Lumalia] Erreur login :", err);
    return {
      success: false,
      message: "Impossible de contacter Lumalia. Vérifiez votre connexion."
    };
  }
}

/**
 * Restaure la session sauvegardée (refresh token → new id token)
 */
async function restoreSession() {
  try {
    const saved = storage.readSecure(SESSION_FILE);

    if (!saved || !saved.refreshToken) {
      return false;
    }

    console.log("[Lumalia] Restauration de la session…");

    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: saved.refreshToken
        }).toString()
      }
    );

    const data = await res.json();

    const uid = data.local_id || data.user_id;

    if (!res.ok || !data.id_token || !uid) {
      console.warn("[Lumalia] Refresh token invalide, session supprimée");
      clearSession();
      return false;
    }

    // Recharge le profil Firestore pour récupérer le pseudo à jour
    const userRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/Utilisateurs/${uid}`,
      {
        method: "GET",
        headers: { "Authorization": `Bearer ${data.id_token}` }
      }
    );

    const userData = await userRes.json();

    const username =
      userData?.fields?.username?.stringValue ||
      saved.username ||
      saved.email.split("@")[0];

    currentSession = {
      uid: uid,
      email: saved.email,
      username: username,
      idToken: data.id_token,
      refreshToken: data.refresh_token || saved.refreshToken
    };

    saveSession(currentSession);

    console.log("[Lumalia] Session restaurée :", username);

    return true;

  } catch (err) {
    console.error("[Lumalia] Erreur restauration :", err);
    return false;
  }
}

/**
 * Session courante (ou null)
 */
function getSession() {
  if (!currentSession) {
    const saved = storage.readSecure(SESSION_FILE);
    if (!saved) return null;
    currentSession = saved;
  }

  return {
    uid: currentSession.uid,
    email: currentSession.email,
    username: currentSession.username
  };
}

/**
 * Déconnexion
 */
function logoutLumalia() {
  clearSession();
  console.log("[Lumalia] Déconnecté");
  return { success: true };
}

module.exports = {
  loginLumalia: loginLumalia,
  restoreSession: restoreSession,
  getSession: getSession,
  logoutLumalia: logoutLumalia
};