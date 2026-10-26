# Quiz wedi — Win with wedi

Quiz web (concours goodies) réservé aux membres du programme de récompenses wedi.
Fonctionne sur ordinateur, tablette et mobile. Charte graphique : CD wedi (wedi blue 100 % cyan, Noto Sans, barres, formes carrées).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Le quiz complet (HTML + CSS + JS dans un seul fichier, aucune compilation). |
| `apps-script.gs` | Serveur Google Apps Script : vérifie les membres, bloque les doubles participations, recalcule le score et enregistre les résultats dans Google Sheets. |

## Modes

- **Version test** (`CONFIG.ENDPOINT` vide) : codes membres de démonstration `WEDI-1001` à `WEDI-1005`, résultats stockés dans le navigateur. Espace organisateur : PIN `wedi2026`.
- **Production** : renseigner `CONFIG.ENDPOINT` avec l'URL de l'application Web Apps Script. Les membres et les résultats sont dans la feuille Google (onglets `Membres` et `Resultats`). Le PIN réel est défini dans Apps Script, jamais dans ce dépôt.

## Modifier

- Couleurs et typographie : bloc `:root` en haut du `<style>`.
- Concours, lot, questions : objets `CONFIG` et `QUESTIONS` en haut du `<script>`.
- Nouveau concours de la série : changer `CONCOURS_ID`, les questions, et la clé `REPONSES` dans `apps-script.gs`.

## Intégration sur winwithwedi.net

1. Copier `index.html` dans un dossier du site (ex. `/quiz/`), ou
2. pointer un sous-domaine (ex. `quiz.winwithwedi.net`) vers GitHub Pages avec un enregistrement CNAME, ou
3. l'afficher dans une page existante via une iframe.

Ne jamais commiter : liste de membres, résultats, PIN réel.
