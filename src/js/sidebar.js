/* =========================================================
   VOLTYX LAUNCHER — sidebar.js
   Navigation + affichage de l'utilisateur connecté
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  // Tous les éléments avec [data-nav] ouvrent une nouvelle page
  document.querySelectorAll("[data-nav]").forEach(function (item) {
    item.addEventListener("click", function () {
      var page = item.dataset.nav;
      if (page && window.voltyx && window.voltyx.nav) {
        window.voltyx.nav.goto(page);
      } else {
        window.location.href = page;
      }
    });
  });

  // ============================================================
  // AFFICHAGE DE L'UTILISATEUR DANS LA SIDEBAR
  // ============================================================
  initSidebarUser();
});

/**
 * Affiche l'initiale du pseudo Lumalia dans l'avatar de la sidebar
 */
function initSidebarUser() {
  var userBtn = document.getElementById("sidebar-user");
  if (!userBtn) return;

  // ⚠️ On garde le bouton cliquable pour aller vers settings
  var userNavTarget = userBtn.dataset.nav || "settings.html?tab=accounts";

  function getInitial(name) {
    if (!name || typeof name !== "string") return "?";
    return name.charAt(0).toUpperCase();
  }

  async function refreshUserUI() {
    try {
      var session = await window.voltyx.auth.lumaliaSession();

      if (session && session.uid && session.username) {
        // Connecté : cercle avec initiale
        var initial = getInitial(session.username);

        userBtn.innerHTML =
          '<div class="sidebar__user-avatar">' + initial + '</div>' +
          '<span class="sidebar__user-status"></span>';

        userBtn.title = session.username;
        userBtn.classList.add("sidebar__user--connected");

      } else {
        // Non connecté : image par défaut
        userBtn.innerHTML =
          '<img src="../../assets/images/skins/default_skin.png" alt="">' +
          '<span class="sidebar__user-status"></span>';

        userBtn.title = "Non connecté";
        userBtn.classList.remove("sidebar__user--connected");
      }

      // ⚠️ IMPORTANT : on rattache le clic vers la page paramètres
      // (car on vient de remplacer innerHTML)
      userBtn.onclick = function () {
        if (window.voltyx && window.voltyx.nav) {
          window.voltyx.nav.goto(userNavTarget);
        }
      };

    } catch (err) {
      console.error("[Sidebar] Erreur user :", err);
    }
  }

  // Écoute les changements de session
  if (window.voltyx && window.voltyx.auth) {
    window.voltyx.auth.onLumaliaUpdated(function () {
      refreshUserUI();
    });
  }

  // Premier rendu
  refreshUserUI();
}