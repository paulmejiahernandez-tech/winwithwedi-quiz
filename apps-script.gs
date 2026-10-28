/**
 * Quiz wedi — serveur Google Apps Script
 * --------------------------------------
 * Ce script relie le quiz (winwithwedi.net) à une feuille Google Sheets.
 * Le participant s'identifie uniquement avec son adresse e-mail :
 * le script vérifie qu'elle figure dans la liste des membres, empêche une
 * 2e participation, recalcule le score côté serveur (anti-triche) et
 * enregistre le résultat avec le nom et le code du membre.
 *
 * Installation :
 * 1. Feuille Google Sheets avec deux onglets :
 *    - "Membres"   colonnes : Code | Email | Prénom | Nom   (1 ligne par membre inscrit ; Email obligatoire)
 *    - "Resultats" (laissé vide, les en-têtes sont créés automatiquement)
 * 2. Extensions > Apps Script : remplacez TOUT le contenu de l'éditeur par ce fichier, enregistrez.
 * 3. Modifiez ADMIN_PIN et, pour chaque concours, la clé de réponses REPONSES.
 * 4. Déployer > Nouveau déploiement > Type "Application Web"
 *    Exécuter en tant que : Moi · Accès : Tout le monde.
 *    (Après chaque modification : Gérer les déploiements > crayon > Version : Nouvelle version.)
 * 5. Copiez l'URL obtenue dans CONFIG.ENDPOINT du fichier index.html.
 */

const ADMIN_PIN = "wedi2026";

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
  if (!email) return { ok: false, reason: "unknown" };
  const member = findMember_(email);
  if (!member) return { ok: false, reason: "unknown" };
  if (hasPlayed_(b.concours, email)) return { ok: false, reason: "played" };
  return { ok: true, prenom: member.prenom, nom: member.nom, code: member.code };
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
      new Date(), b.concours, c.code, c.prenom, c.nom, email,
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

function findMember_(email) {
  const rows = sheet_("Membres").getDataRange().getValues().slice(1);
  for (var i = 0; i < rows.length; i++) {
    if (normEmail_(rows[i][1]) === email) {
      return { code: String(rows[i][0] || "").trim(), prenom: String(rows[i][2] || "").trim(), nom: String(rows[i][3] || "").trim() };
    }
  }
  return null;
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
