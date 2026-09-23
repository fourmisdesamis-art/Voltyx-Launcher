/* =========================================================
   VOLTYX LAUNCHER — downloader.js
   Téléchargeur HTTP avec progression détaillée
   ========================================================= */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const crypto = require("crypto");

// Callback global pour la progression
let progressCallback = null;

function setProgressCallback(cb) {
  progressCallback = cb;
}

function emitProgress(data) {
  if (progressCallback) {
    progressCallback(data);
  }
}

/**
 * Formate une taille en octets
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " Go";
}

/**
 * Télécharge avec progression détaillée
 */
function download(url, dest, options) {
  options = options || {};

  return new Promise(function (resolve, reject) {
    const follow = function (u, depth) {
      if (depth > 5) return reject(new Error("Trop de redirections"));

      const lib = u.startsWith("https") ? https : http;

      lib.get(u, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, depth + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error("HTTP " + res.statusCode + " pour " + u));
          return;
        }

        const total = parseInt(res.headers["content-length"] || "0", 10);
        const fileName = options.name || path.basename(u);
        let downloaded = 0;
        let lastEmit = Date.now();
        const startTime = Date.now();

        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const file = fs.createWriteStream(dest);

        res.on("data", function (chunk) {
          downloaded += chunk.length;

          // Émet la progression max 10x par seconde
          const now = Date.now();
          if (now - lastEmit > 100) {
            lastEmit = now;

            const elapsed = (now - startTime) / 1000;
            const speed = elapsed > 0 ? downloaded / elapsed : 0;
            const remaining = speed > 0 && total > 0
              ? (total - downloaded) / speed
              : 0;

            emitProgress({
              fileName: fileName,
              downloaded: downloaded,
              total: total,
              downloadedText: formatSize(downloaded),
              totalText: total > 0 ? formatSize(total) : "?",
              speed: speed,
              speedText: formatSize(speed) + "/s",
              percent: total > 0 ? (downloaded / total) * 100 : 0,
              remaining: remaining,
              remainingText: remaining > 0 ? Math.ceil(remaining) + "s" : "…"
            });
          }
        });

        res.pipe(file);

        file.on("finish", function () {
          file.close(function () {
            emitProgress({
              fileName: fileName,
              downloaded: downloaded,
              total: total,
              downloadedText: formatSize(downloaded),
              totalText: formatSize(downloaded),
              speed: 0,
              speedText: "0 o/s",
              percent: 100,
              remaining: 0,
              remainingText: "0s"
            });
            resolve();
          });
        });

        file.on("error", function (err) {
          fs.unlink(dest, function () { reject(err); });
        });

      }).on("error", reject);
    };

    follow(url, 0);
  });
}

/**
 * Télécharge un JSON
 */
function downloadJSON(url) {
  return new Promise(function (resolve, reject) {
    const follow = function (u, depth) {
      if (depth > 5) return reject(new Error("Trop de redirections"));

      const lib = u.startsWith("https") ? https : http;

      lib.get(u, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, depth + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error("HTTP " + res.statusCode + " pour " + u));
          return;
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", function (d) { body += d; });
        res.on("end", function () {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(e); }
        });

      }).on("error", reject);
    };

    follow(url, 0);
  });
}

/**
 * Calcule le SHA1 d'un fichier
 */
function sha1File(filePath) {
  return new Promise(function (resolve, reject) {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.on("data", function (data) { hash.update(data); });
    stream.on("end", function () { resolve(hash.digest("hex")); });
    stream.on("error", reject);
  });
}

/**
 * Vérifie si un fichier existe et a le bon SHA1
 */
async function isFileValid(filePath, expectedSha1) {
  if (!fs.existsSync(filePath)) return false;
  if (!expectedSha1) return true;

  try {
    const actual = await sha1File(filePath);
    return actual.toLowerCase() === expectedSha1.toLowerCase();
  } catch (err) {
    return false;
  }
}

module.exports = {
  download: download,
  downloadJSON: downloadJSON,
  sha1File: sha1File,
  isFileValid: isFileValid,
  setProgressCallback: setProgressCallback,
  formatSize: formatSize
};