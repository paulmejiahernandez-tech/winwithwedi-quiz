/**
 * Quiz wedi — serveur Google Apps Script
 * --------------------------------------
 * Ce script relie le quiz (winwithwedi.net) à une feuille Google Sheets.
 * Il vérifie que le participant est membre, empêche une 2e participation,
 * recalcule le score côté serveur (anti-triche) et enregistre le résultat.
 *
 * Installation :
 * 1. Créez une feuille Google Sheets avec deux onglets :
 *    - "Membres"   colonnes : Code | Email | Prénom | Nom   (1 ligne par membre inscrit)
 *    - "Resultats" (laissé vide, les en-têtes sont créés automatiquement)
 * 2. Extensions > Apps Script, collez ce fichier, enregistrez.
 * 3. Modifiez ADMIN_PIN et, pour chaque concours, la clé de réponses REPONSES.
 * 4. Déployer > Nouveau déploiement > Type "Application Web"
 *    Exécuter en tant que : Moi · Accès : Tout le monde.
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

function check_(b) {
  const code = String(b.code || "").trim().toUpperCase();
  const email = String(b.email || "").trim().toLowerCase();
  const member = findMember_(code);
  if (!member) return { ok: false, reason: "unknown" };
  if (member.email && email && member.email !== email) return { ok: false, reason: "email" };
  if (hasPlayed_(b.concours, code)) return { ok: false, reason: "played" };
  return { ok: true, prenom: member.prenom };
}

function submit_(b) {
  const r = b.result || {};
  const code = String(r.code || "").trim().toUpperCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const c = check_({ code: code, email: r.email, concours: b.concours });
    if (!c.ok) return c;
    const key = REPONSES[b.concours] || [];
    const reponses = (r.reponses || []).map(function (a) {
      return { q: a.q, choix: a.choix, ok: key[a.q] === a.choix };
    });
    const score = reponses.filter(function (a) { return a.ok; }).length;
    sheet_("Resultats").appendRow([
      new Date(), b.concours, code, r.prenom, r.nom, String(r.email || "").toLowerCase(),
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

function findMember_(code) {
  const rows = sheet_("Membres").getDataRange().getValues().slice(1);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === code) {
      return { email: String(rows[i][1] || "").trim().toLowerCase(), prenom: rows[i][2], nom: rows[i][3] };
    }
  }
  return null;
}

function hasPlayed_(concours, code) {
  const rows = sheet_("Resultats").getDataRange().getValues().slice(1);
  return rows.some(function (row) { return row[1] === concours && String(row[2]).toUpperCase() === code; });
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
