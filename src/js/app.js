/* =========================================================
   VOLTYX LAUNCHER — app.js
   Logique de la page d'accueil
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  console.log("[Voltyx] Launcher démarré");

  var playBtn = document.getElementById("play-btn");
  var playBtnLabel = document.getElementById("play-btn-label");
  var statusEl = document.getElementById("launcher-status");

  var progressContainer = document.getElementById("progress-container");
  var progressLabel = document.getElementById("progress-label");
  var progressFill = document.getElementById("progress-fill");
  var progressPercent = document.getElementById("progress-percent");
  var progressFile = document.getElementById("progress-file");
  var progressDetails = document.getElementById("progress-details");

  // ============================================================
  // AFFICHAGE DE LA PROGRESSION
  // ============================================================
  function showProgress(label, percent, detail) {
    progressContainer.style.display = "block";
    progressLabel.textContent = label;
    progressFill.style.width = percent + "%";
    progressPercent.textContent = Math.round(percent) + "%";

    if (detail && detail.fileName) {
      progressFile.textContent = detail.fileName;
      progressDetails.textContent = detail.speed + " · reste " + detail.remaining;
    } else {
      progressFile.textContent = "";
      progressDetails.textContent = "";
    }
  }

  function hideProgress() {
    progressContainer.style.display = "none";
    progressFile.textContent = "";
    progressDetails.textContent = "";
  }

  // Écoute les événements de progression du main process
  window.voltyx.install.onProgress(function (data) {
    if (data.progress !== undefined) {
      showProgress(data.label || "En cours…", data.progress, data.detail);
    }
  });

  // ============================================================
  // VÉRIFICATION DE L'ÉTAT AU DÉMARRAGE
  // ============================================================
  async function checkStatus() {
    try {
      var status = await window.voltyx.install.status();
      if (status.forge) {
        statusEl.textContent = "Forge 1.16.5 prêt";
      } else if (status.vanilla) {
        statusEl.textContent = "Minecraft prêt · Forge à installer";
      } else {
        statusEl.textContent = "Prêt à installer";
      }
    } catch (err) {
      console.error("[App] Erreur status :", err);
    }
  }
  checkStatus();

  // ============================================================
  // BOUTON JOUER
  // ============================================================
  var isRunning = false;

  playBtn.addEventListener("click", async function () {
    if (isRunning) return;
    isRunning = true;

    playBtn.disabled = true;
    playBtnLabel.textContent = "Lancement…";
    statusEl.textContent = "Préparation…";
    hideProgress();

    try {
      // ÉTAPE 1 : Vérifier l'installation
      var status = await window.voltyx.install.status();

      if (!status.vanilla || !status.forge) {
        statusEl.textContent = "Installation en cours…";
        showProgress("Préparation…", 0);

        await window.voltyx.install.minecraft();
        await window.voltyx.install.mods();

        showProgress("Installation terminée !", 100);
        statusEl.textContent = "Installation terminée";
      } else {
        showProgress("Vérification des mods…", 0);
        await window.voltyx.install.mods();
        hideProgress();
      }

      // ÉTAPE 2 : Lancer le jeu
      statusEl.textContent = "Démarrage du jeu…";
      playBtnLabel.textContent = "En jeu…";

      // Récupère le pseudo Lumalia (ou fallback "Player")
      var accounts = await window.voltyx.accounts.get();
      var username = "Player";
      if (accounts && accounts.lumalia && accounts.lumalia.username) {
        username = accounts.lumalia.username;
      }

      // Lance le jeu (utilise Microsoft si connecté, sinon offline)
      var result = await window.voltyx.game.launch(username);

      if (!result.success) {
        throw new Error(result.error || "Échec du lancement");
      }

      statusEl.textContent = "Jeu en cours d'exécution";
      window.voltyx.window.minimize();

    } catch (err) {
      console.error("[App] Erreur :", err);
      statusEl.textContent = "Erreur : " + err.message;
      playBtnLabel.textContent = "Réessayer";
      playBtn.disabled = false;
      isRunning = false;
    }
  });

  // ============================================================
  // QUAND LE JEU SE FERME
  // ============================================================
  window.voltyx.game.onClosed(function (data) {
    console.log("[App] Jeu fermé avec code :", data.code);
    statusEl.textContent = "Prêt à relancer";
    playBtnLabel.textContent = "Jouer";
    playBtn.disabled = false;
    isRunning = false;
    checkStatus();
  });

});