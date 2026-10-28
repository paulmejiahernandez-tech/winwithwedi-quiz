/**
 * Quiz wedi — serveur Google Apps Script
 * --------------------------------------
 * Ce script relie le quiz (winwithwedi.net) à une feuille Google Sheets.
 * Concours ouvert : n'importe quelle adresse e-mail peut participer, une seule fois par concours.
 * Le script bloque une 2e participation avec la même adresse, recalcule le score
 * côté serveur (anti-triche) et enregistre le résultat dans l'onglet "Resultats".
 *
 * Installation :
 * 1. Feuille Google Sheets avec un onglet "Resultats" (créé automatiquement s'il manque).
 * 2. Extensions > Apps Script : remplacez TOUT le contenu de l'éditeur par ce fichier, enregistrez.
 * 3. Modifiez ADMIN_PIN ICI, dans l'éditeur Apps Script (jamais dans le dépôt GitHub, qui est public),
 *    et, pour chaque concours, la clé de réponses REPONSES.
 * 4. Déployer > Nouveau déploiement > Type "Application Web"
 *    Exécuter en tant que : Moi · Accès : Tout le monde.
 *    (Après chaque modification : Gérer les déploiements > crayon > Version : Nouvelle version.)
 * 5. Copiez l'URL obtenue dans CONFIG.ENDPOINT du fichier index.html.
 */

const ADMIN_PIN = "changez-moi";

// Index de la bonne réponse (0 = A, 1 = B, 2 = C) pour chaque question, par concours.
const REPONSES = {
  "aubade-2026-01": [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1]
};

const HEADERS = ["Date", "Concours", "Code", "Prénom", "Nom", "Email", "Score", "Total", "Durée (s)", "Réponses"];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case "check":  return json(check_(body));
      case "submit": return json(submit_(body));
      case "list":   return json(list_(body));
      default:       return json({ ok: false, reason: "action" });
    }
  } catch (err) {
    return json({ ok: false, reason: "error", message: String(err) });
  }
}

function normEmail_(v) {
  return String(v || "").trim().toLowerCase();
}

function check_(b) {
  const email = normEmail_(b.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, reason: "email" };
  if (hasPlayed_(b.concours, email)) return { ok: false, reason: "played" };
  return { ok: true };
}

function submit_(b) {
  const r = b.result || {};
  const email = normEmail_(r.email);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const c = check_({ email: email, concours: b.concours });
    if (!c.ok) return c;
    const key = REPONSES[b.concours] || [];
    const reponses = (r.reponses || []).map(function (a) {
      return { q: a.q, choix: a.choix, ok: key[a.q] === a.choix };
    });
    const score = reponses.filter(function (a) { return a.ok; }).length;
    sheet_("Resultats").appendRow([
      new Date(), b.concours, "", "", "", email,
      score, key.length, Number(r.dureeSec) || 0, JSON.stringify(reponses)
    ]);
    return { ok: true, score: score };
  } finally {
    lock.releaseLock();
  }
}

function list_(b) {
  if (b.pin !== ADMIN_PIN) return { ok: false, reason: "pin" };
  const rows = sheet_("Resultats").getDataRange().getValues().slice(1);
  const results = rows
    .filter(function (row) { return row[1] === b.concours; })
    .map(function (row) {
      return {
        date: new Date(row[0]).toISOString(), concours: row[1], code: row[2], prenom: row[3], nom: row[4],
        email: row[5], score: row[6], total: row[7], dureeSec: row[8], reponses: JSON.parse(row[9] || "[]")
      };
    });
  return { ok: true, results: results };
}

function hasPlayed_(concours, email) {
  const rows = sheet_("Resultats").getDataRange().getValues().slice(1);
  return rows.some(function (row) { return row[1] === concours && normEmail_(row[5]) === email; });
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (name === "Resultats" && sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
