/* =========================================================
   VOLTYX LAUNCHER — accounts.js
   Stockage des comptes (Microsoft + Lumalia)
   ========================================================= */

const fs = require("fs");
const { PATHS } = require("./paths");

/** Charge les comptes depuis accounts.json */
function load() {
  try {
    if (!fs.existsSync(PATHS.accounts)) {
      return { microsoft: null, lumalia: null };
    }
    const data = fs.readFileSync(PATHS.accounts, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("[Accounts] Erreur de lecture :", err);
    return { microsoft: null, lumalia: null };
  }
}

/** Sauvegarde les comptes dans accounts.json */
function save(accounts) {
  try {
    fs.writeFileSync(PATHS.accounts, JSON.stringify(accounts, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[Accounts] Erreur d'écriture :", err);
    return false;
  }
}

/** Ajoute ou met à jour un compte */
function setAccount(type, data) {
  const accounts = load();
  accounts[type] = data;
  save(accounts);
  return accounts;
}

/** Supprime un compte */
function removeAccount(type) {
  const accounts = load();
  accounts[type] = null;
  save(accounts);
  return accounts;
}

/** Renvoie les comptes actuels */
function getAccounts() {
  return load();
}

module.exports = {
  load: load,
  save: save,
  setAccount: setAccount,
  removeAccount: removeAccount,
  getAccounts: getAccounts
};