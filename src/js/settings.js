/* =========================================================
   VOLTYX LAUNCHER — settings.js
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {

  // ============================================================
  // NAVIGATION ONGLETS
  // ============================================================
  var navItems = document.querySelectorAll(".settings-nav__item");
  var panels = document.querySelectorAll(".settings-panel");

  navItems.forEach(function (item) {
    item.addEventListener("click", function () {
      var tab = item.dataset.tab;
      navItems.forEach(function (i) { i.classList.toggle("active", i === item); });
      panels.forEach(function (p) { p.classList.toggle("active", p.dataset.panel === tab); });
    });
  });

  // ============================================================
  // CONFIG
  // ============================================================
  var config = await window.voltyx.config.get();

  // Slider RAM
  var ramSlider = document.getElementById("ram-slider");
  var ramValue = document.getElementById("ram-value");
  if (ramSlider && ramValue) {
    ramSlider.value = config.ram || 4096;
    ramValue.textContent = config.ram || 4096;
    var ramTimeout = null;
    ramSlider.addEventListener("input", function () {
      ramValue.textContent = ramSlider.value;
      clearTimeout(ramTimeout);
      ramTimeout = setTimeout(async function () {
        await window.voltyx.config.update({ ram: parseInt(ramSlider.value, 10) });
      }, 300);
    });
  }

  // Chemin d'installation
  var installPathEl = document.getElementById("install-path");
  if (installPathEl) installPathEl.textContent = config.installPath || "Non défini";

  // Chemin Java
  var javaPathEl = document.getElementById("java-path");
  if (javaPathEl) {
    if (config.javaPath === "auto" || !config.javaPath) javaPathEl.textContent = "Détection automatique";
    else javaPathEl.textContent = config.javaPath;
  }

  // ============================================================
  // BOUTON RÉPARER
  // ============================================================
  var repairBtn = document.getElementById("btn-repair");
  var repairStatus = document.getElementById("repair-status");

  if (repairBtn) {
    repairBtn.addEventListener("click", async function () {
      if (repairBtn.disabled) return;

      repairBtn.disabled = true;
      repairBtn.textContent = "Vérification en cours…";
      if (repairStatus) {
        repairStatus.textContent = "Analyse des fichiers…";
        repairStatus.style.color = "var(--text-soft)";
      }

      try {
        var result = await window.voltyx.install.repair();

        if (result.success) {
          if (repairStatus) {
            repairStatus.textContent = "✅ " + result.message;
            repairStatus.style.color = "var(--success)";
          }
        } else {
          if (repairStatus) {
            repairStatus.textContent = "⚠️ " + result.message;
            repairStatus.style.color = "var(--danger)";
          }

          if (result.report && result.report.failed && result.report.failed.length > 0) {
            console.warn("[Repair] Fichiers en échec :", result.report.failed);
          }
        }

      } catch (err) {
        console.error("[Settings] Erreur repair :", err);
        if (repairStatus) {
          repairStatus.textContent = "❌ Erreur : " + err.message;
          repairStatus.style.color = "var(--danger)";
        }
      } finally {
        repairBtn.disabled = false;
        repairBtn.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Vérifier maintenant';
      }
    });

    // Vérification rapide au chargement de la page
    (async function quickCheck() {
      try {
        var check = await window.voltyx.install.quickCheck();
        if (!repairStatus) return;

        if (check.vanilla && check.forge && check.natives >= 5) {
          repairStatus.textContent = "Installation saine (" + check.natives + " DLLs)";
          repairStatus.style.color = "var(--success)";
        } else {
          var missing = [];
          if (!check.vanilla) missing.push("Minecraft");
          if (!check.forge) missing.push("Forge");
          if (check.natives < 5) missing.push("Natives");

          repairStatus.textContent = "⚠️ Manquant : " + missing.join(", ");
          repairStatus.style.color = "var(--danger)";
        }
      } catch (err) {
        console.warn("[Settings] Quick check échoué :", err);
      }
    })();
  }

  // ============================================================
  // TOGGLE DISCORD RICH PRESENCE
  // ============================================================
  var discordToggle = document.getElementById("discord-rpc-toggle");
  var discordStatus = document.getElementById("discord-status");
  var discordBusy = false;

  async function refreshDiscordStatus() {
    if (!discordStatus) return;
    var status = await window.voltyx.discord.isReady();
    discordStatus.textContent = status.connected ? "Connecté" : "Non connecté";
    discordStatus.style.color = status.connected ? "var(--success)" : "var(--text-muted)";
  }

  if (discordToggle) {
    discordToggle.checked = config.discordRPC !== false;

    discordToggle.addEventListener("change", async function () {
      if (discordBusy) {
        discordToggle.checked = !discordToggle.checked;
        return;
      }

      discordBusy = true;
      discordToggle.disabled = true;
      discordStatus.textContent = "Changement…";

      var enabled = discordToggle.checked;

      try {
        await window.voltyx.config.update({ discordRPC: enabled });

        if (enabled) {
          await window.voltyx.discord.connect();
        } else {
          await window.voltyx.discord.disconnect();
        }

        await new Promise(r => setTimeout(r, 800));
        await refreshDiscordStatus();

      } catch (err) {
        console.error("[Settings] Discord toggle :", err);
        discordStatus.textContent = "Erreur";
        discordStatus.style.color = "var(--danger)";
      } finally {
        discordBusy = false;
        discordToggle.disabled = false;
      }
    });

    refreshDiscordStatus();
  }

  // ============================================================
  // AFFICHAGE DES COMPTES
  // ============================================================
  async function refreshAccounts() {
    try {
      var accounts = await window.voltyx.accounts.get();

      var msCard = document.getElementById("account-microsoft");
      var msBtn = document.getElementById("btn-add-microsoft");

      if (accounts.microsoft) {
        msCard.classList.add("account-card--connected");
        msBtn.textContent = "Déconnecter";
        msBtn.classList.add("account-card__btn--connected");
        msCard.querySelector("p").textContent = accounts.microsoft.username || "Connecté";
      } else {
        msCard.classList.remove("account-card--connected");
        msBtn.textContent = "Ajouter";
        msBtn.classList.remove("account-card__btn--connected");
        msCard.querySelector("p").textContent = "Connectez votre compte Microsoft pour jouer à Lumalia";
      }

      var lumaliaCard = document.getElementById("account-lumalia");
      var lumaliaBtn = document.getElementById("btn-add-lumalia");

      if (accounts.lumalia) {
        lumaliaCard.classList.add("account-card--connected");
        lumaliaBtn.textContent = "Déconnecter";
        lumaliaBtn.classList.add("account-card__btn--connected");
        lumaliaCard.querySelector("p").textContent = accounts.lumalia.username || accounts.lumalia.email;
      } else {
        lumaliaCard.classList.remove("account-card--connected");
        lumaliaBtn.textContent = "Ajouter";
        lumaliaBtn.classList.remove("account-card__btn--connected");
        lumaliaCard.querySelector("p").textContent = "Connectez votre compte Lumalia au launcher";
      }
    } catch (err) {
      console.error("[Settings] Comptes :", err);
    }
  }

  refreshAccounts();

  window.voltyx.auth.onLumaliaUpdated(function () { refreshAccounts(); });
  window.voltyx.auth.onMicrosoftUpdated(function () { refreshAccounts(); });

  // ============================================================
  // BOUTON MICROSOFT
  // ============================================================
  document.getElementById("btn-add-microsoft").addEventListener("click", async function () {
    var accounts = await window.voltyx.accounts.get();

    if (accounts.microsoft) {
      if (confirm("Déconnecter le compte Microsoft ?")) {
        await window.voltyx.auth.microsoftLogout();
        refreshAccounts();
      }
    } else {
      var btn = this;
      btn.disabled = true;
      btn.textContent = "Connexion…";

      var result = await window.voltyx.auth.microsoftLogin();

      if (result.success) {
        alert("✅ Connecté en tant que " + result.username);
      } else {
        alert("❌ " + (result.message || "Échec connexion Microsoft"));
      }

      btn.disabled = false;
      refreshAccounts();
    }
  });

  // ============================================================
  // BOUTON LUMALIA
  // ============================================================
  document.getElementById("btn-add-lumalia").addEventListener("click", async function () {
    var accounts = await window.voltyx.accounts.get();

    if (accounts.lumalia) {
      if (confirm("Déconnecter le compte Lumalia ?")) {
        await window.voltyx.auth.lumaliaLogout();
        refreshAccounts();
      }
    } else {
      window.voltyx.auth.openLumaliaLogin();
    }
  });

  // ============================================================
  // ONGLET ACTIF VIA URL (?tab=accounts)
  // ============================================================
  var params = new URLSearchParams(window.location.search);
  var tabFromUrl = params.get("tab");
  if (tabFromUrl) {
    var targetBtn = document.querySelector('.settings-nav__item[data-tab="' + tabFromUrl + '"]');
    if (targetBtn) targetBtn.click();
  }

  // ============================================================
  // NAVIGATION (data-nav)
  // ============================================================
  document.querySelectorAll("[data-nav]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      window.voltyx.nav.goto(btn.dataset.nav);
    });
  });

});