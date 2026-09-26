/* =========================================================
   VOLTYX LAUNCHER — theme.js
   Applique le thème (dark/light) dès le chargement de la page
   À charger dans le <head> de TOUTES les pages
   ========================================================= */

(function () {
  // Applique le thème immédiatement (avant le rendu) pour éviter le flash
  function applyTheme(theme) {
    if (theme !== "dark" && theme !== "light") theme = "dark";
    document.documentElement.setAttribute("data-theme", theme);
  }

  // Lecture synchrone au tout début (dark par défaut)
  applyTheme("dark");

  // Dès que le DOM est prêt, on demande le vrai thème au main process
  document.addEventListener("DOMContentLoaded", async function () {
    try {
      if (window.voltyx && window.voltyx.theme) {
        const theme = await window.voltyx.theme.get();
        applyTheme(theme);

        // Écoute les changements de thème venant d'autres fenêtres
        window.voltyx.theme.onChanged(function (newTheme) {
          applyTheme(newTheme);
        });
      }
    } catch (err) {
      console.error("[Theme] Erreur :", err);
    }
  });
})();