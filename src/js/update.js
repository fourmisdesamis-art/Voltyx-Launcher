/* =========================================================
   VOLTYX LAUNCHER — update.js
   Script de la popup de mise à jour
   ========================================================= */

const $ = (id) => document.getElementById(id);

// === Éléments ===
const states = {
  available: $("state-available"),
  downloading: $("state-downloading"),
  ready: $("state-ready"),
  error: $("state-error")
};

const els = {
  currentVersion: $("current-version"),
  newVersion: $("new-version"),
  progressFill: $("progress-fill"),
  progressPercent: $("progress-percent"),
  progressDetails: $("progress-details"),
  errorMessage: $("error-message")
};

const buttons = {
  download: $("btn-download"),
  later: $("btn-later"),
  install: $("btn-install"),
  later2: $("btn-later-2"),
  closeError: $("btn-close-error"),
  close: $("btn-close")
};

// === Helpers ===
function showState(name) {
  Object.values(states).forEach((el) => el.classList.add("hidden"));
  if (states[name]) states[name].classList.remove("hidden");
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// === Boutons ===
buttons.download.addEventListener("click", async () => {
  showState("downloading");
  await window.voltyx.updater.download();
});

buttons.install.addEventListener("click", () => {
  window.voltyx.updater.install();
});

buttons.later.addEventListener("click", () => {
  window.voltyx.updater.closeWindow();
});

buttons.later2.addEventListener("click", () => {
  window.voltyx.updater.closeWindow();
});

buttons.closeError.addEventListener("click", () => {
  window.voltyx.updater.closeWindow();
});

buttons.close.addEventListener("click", () => {
  window.voltyx.updater.closeWindow();
});

// === Événements updater ===
window.voltyx.updater.onUpdateAvailable((info) => {
  console.log("[Update UI] updateAvailable :", info);
  els.currentVersion.textContent = "v" + (info.currentVersion || "?");
  els.newVersion.textContent = "v" + info.version;
});

window.voltyx.updater.onDownloadProgress((progress) => {
  console.log("[Update UI] progress :", progress);
  els.progressFill.style.width = progress.percent + "%";
  els.progressPercent.textContent = progress.percent + "%";
  els.progressDetails.textContent =
    `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`;
});

window.voltyx.updater.onUpdateDownloaded(() => {
  console.log("[Update UI] downloaded");
  showState("ready");
});

window.voltyx.updater.onError((err) => {
  console.error("[Update UI] error :", err);
  els.errorMessage.textContent = err.message || "Une erreur est survenue.";
  showState("error");
});

// === Init : récupère la version actuelle ===
(async () => {
  try {
    const { version } = await window.voltyx.updater.getVersion();
    els.currentVersion.textContent = "v" + version;
  } catch (e) {
    console.error("Impossible de récupérer la version :", e);
  }
})();