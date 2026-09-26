/* =========================================================
   VOLTYX LAUNCHER — news.js
   Charge et affiche les actualités Lumalia (Firestore)
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
  const listEl = document.getElementById("news-list");
  if (!listEl) return;

  function formatDate(ms) {
    if (!ms) return "—";
    const d = new Date(ms);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  try {
    const result = await window.voltyx.news.list();

    if (!result.success) {
      throw new Error(result.error || "Erreur inconnue");
    }

    const news = result.news || [];

    if (news.length === 0) {
      listEl.innerHTML = `
        <div class="news-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
            <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/>
          </svg>
          <p>Aucune actualité pour le moment.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = news.map(function (n) {
      const initial = (n.author || "?").charAt(0).toUpperCase();
      const dateStr = formatDate(n.createdAt);
      const url = `https://www.lumania.fr/actualites?n=${encodeURIComponent(n.id)}`;

      const coverHtml = n.cover
        ? `<img src="${escapeHtml(n.cover)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'news-card__cover-placeholder',textContent:'${escapeHtml((n.title || '?').charAt(0))}'}))">`
        : `<div class="news-card__cover-placeholder">${escapeHtml((n.title || "?").charAt(0))}</div>`;

      return `
        <div class="news-card" data-news-url="${escapeHtml(url)}">
          <div class="news-card__cover">${coverHtml}</div>
          <div class="news-card__body">
            <div class="news-card__meta">📅 ${dateStr}</div>
            <h3 class="news-card__title">${escapeHtml(n.title)}</h3>
            ${n.excerpt ? `<p class="news-card__excerpt">${escapeHtml(n.excerpt)}</p>` : ""}
            <div class="news-card__footer">
              <div class="news-card__author">
                <div class="news-card__author-avatar">${escapeHtml(initial)}</div>
                <span>${escapeHtml(n.author)}</span>
              </div>
              <span class="news-card__arrow">Lire →</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Clic sur une carte → ouvre la news dans le navigateur
    listEl.querySelectorAll(".news-card").forEach(function (card) {
      card.addEventListener("click", function () {
        const url = card.dataset.newsUrl;
        if (url) window.voltyx.news.openExternal(url);
      });
    });

  } catch (err) {
    console.error("[News] Erreur :", err);
    listEl.innerHTML = `
      <div class="news-empty">
        <p>Impossible de charger les actualités.</p>
        <p style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(err.message || "")}</p>
      </div>
    `;
  }
});