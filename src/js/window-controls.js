/* =========================================================
   VOLTYX LAUNCHER — window-controls.js
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  var minimizeBtn = document.querySelector('[data-win="minimize"]');
  var maximizeBtn = document.querySelector('[data-win="maximize"]');
  var closeBtn = document.querySelector('[data-win="close"]');

  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", function () {
      window.voltyx.window.minimize();
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener("click", function () {
      window.voltyx.window.maximize();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      window.voltyx.window.close();
    });
  }
});