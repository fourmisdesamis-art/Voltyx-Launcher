/* =========================================================
   VOLTYX LAUNCHER — login-lumalia.js
   Connexion au compte Lumalia (placeholder pour l'instant)
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  var loginForm = document.getElementById("login-form");
  var totpForm = document.getElementById("totp-form");
  var loginStatus = document.getElementById("login-status");
  var totpStatus = document.getElementById("totp-status");

  /* ============================================================
     ÉTAPE 1 : Email + Mot de passe
     ============================================================ */
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;

    if (!email || !email.includes("@")) {
      loginStatus.textContent = "Adresse email invalide.";
      loginStatus.className = "login__status login__status--error";
      return;
    }
    if (password.length < 8) {
      loginStatus.textContent = "Mot de passe trop court (min 8 caractères).";
      loginStatus.className = "login__status login__status--error";
      return;
    }

    loginStatus.textContent = "Connexion…";
    loginStatus.className = "login__status";

    // ⚠️ PLACEHOLDER — Sera remplacé par Firebase au prochain bloc
    setTimeout(function () {
      // Simulation : on passe directement à la 2FA
      loginForm.style.display = "none";
      totpForm.style.display = "flex";
      totpStatus.textContent = "";
      document.getElementById("totp-code").focus();
    }, 800);
  });

  /* ============================================================
     ÉTAPE 2 : Vérification 2FA
     ============================================================ */
  totpForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var code = document.getElementById("totp-code").value.trim();

    if (!/^[0-9]{6}$/.test(code)) {
      totpStatus.textContent = "Code à 6 chiffres requis.";
      totpStatus.className = "login__status login__status--error";
      return;
    }

    totpStatus.textContent = "Vérification…";
    totpStatus.className = "login__status";

    // ⚠️ PLACEHOLDER — Sera remplacé par la vraie vérification TOTP
    setTimeout(function () {
      var email = document.getElementById("login-email").value.trim();

      // On simule un utilisateur connecté
      var fakeUser = {
        uid: "fake-uid-" + Date.now(),
        email: email,
        username: email.split("@")[0],
        twofaEnabled: true
      };

      // Envoie au main process
      window.voltyx.auth.lumaliaSuccess(fakeUser);
    }, 800);
  });

});