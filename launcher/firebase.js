/* =========================================================
   VOLTYX LAUNCHER — firebase.js
   Lecture des news depuis Firestore (collection "news")
   ========================================================= */

const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  limit
} = require("firebase/firestore");

// ⚠️ Mêmes identifiants que le site Lumalia
const firebaseConfig = {
  apiKey: "AIzaSyBSCqSsBTXk9Q8sBX88NgrdDHUAHT0Cq6I",
  authDomain: "lumalia.firebaseapp.com",
  projectId: "lumalia",
  storageBucket: "lumalia.firebasestorage.app",
  messagingSenderId: "189011821397",
  appId: "1:189011821397:web:03c8609d35d488dce2a5dc"
};

let app = null;
let db = null;
let initialized = false;

function init() {
  if (initialized) return;
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    initialized = true;
    console.log("[Firebase] Initialisé");
  } catch (err) {
    console.error("[Firebase] Erreur d'initialisation :", err);
    throw err;
  }
}

/**
 * Récupère les news publiées
 */
async function getNews(limitCount = 20) {
  if (!initialized) init();

  try {
    const newsRef = collection(db, "news");
    const q = query(
      newsRef,
      where("published", "==", true),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const news = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      news.push({
        id: docSnap.id,
        title: data.title || "Sans titre",
        excerpt: data.excerpt || "",
        cover: data.cover || "",
        content: data.content || "",
        author: data.authorName || "Anonyme",
        published: data.published === true,
        createdAt: data.createdAt?.toMillis() || 0
      });
    });

    // Tri par date décroissante côté JS (plus fiable qu'orderBy)
    news.sort((a, b) => b.createdAt - a.createdAt);

    console.log(`[Firebase] ${news.length} news récupérées`);
    return news;

  } catch (err) {
    console.error("[Firebase] Erreur getNews :", err);
    throw err;
  }
}

/**
 * Récupère une news par son ID
 */
async function getNewsById(id) {
  if (!initialized) init();

  try {
    const ref = doc(db, "news", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      id: snap.id,
      title: data.title || "Sans titre",
      excerpt: data.excerpt || "",
      cover: data.cover || "",
      content: data.content || "",
      author: data.authorName || "Anonyme",
      published: data.published === true,
      createdAt: data.createdAt?.toMillis() || 0
    };
  } catch (err) {
    console.error("[Firebase] Erreur getNewsById :", err);
    return null;
  }
}

module.exports = {
  init,
  getNews,
  getNewsById
};