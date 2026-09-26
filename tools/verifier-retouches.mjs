// Vérifie les fiches de retouches selon l'âge (wiki/retouches/, guide :
// wiki/ADAPTATION.md), avec le code même de l'application
// (src/services/retouches.ts).
//
// Usage :
//   node tools/verifier-retouches.mjs               toutes les fiches
//   node tools/verifier-retouches.mjs --rendre <id> et, pour ce conte, le texte
//                                                   de chaque version distincte,
//                                                   remplacements entre ⟦ ⟧
//
// Pour chaque fiche, il contrôle :
//   - la forme (vocabulaire, âges, niveaux croissants) ;
//   - qu'elle s'applique à chaque âge de 3 à 10 ans sans extrait introuvable,
//     ambigu ou à cheval ;
//   - la grille : aucun niveau pour une menace, des coups ou une ruse, et aucun
//     niveau au-dessus de l'âge limite du type, sauf raison écrite (`pourquoi`) ;
//   - pour la langue, l'âge plafond de chaque nature : un mot disparu vaut
//     toujours, un mot rare jusqu'à 6 ans au plus, une tournure parlée 4 ans ;
//   - qu'aucun moment ni aucune retouche ne reste lettre morte : le conte est
//     proposé au plus bas à max(3, âge minimum de la fiche − 3) ;
//   - que la fiche du conte a passé sa section « À adapter » en « À jouer ».
// Puis il affiche la part du texte retouchée à 3, 6 et 9 ans, langue et fond
// séparés : un chiffre très au-dessus des autres contes veut presque toujours
// dire qu'on en fait trop. Au-dessus des plafonds provisoires de la langue, il
// le signale d'un « ⚠ », sans compter d'erreur.
//
// Se termine en erreur s'il reste un problème.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { corpsDuTexte } from '../src/services/mots.ts';
import {
  AGE_MAX,
  AGE_MIN,
  appliquerRetouches,
  PLAFONDS,
  PLAFONDS_LANGUE,
  PLAFONDS_PROVISOIRES_LANGUE,
  validerFicheRetouches,
  versionsDistinctes,
} from '../src/services/retouches.ts';

const DOSSIER = 'wiki/retouches';
/** Marge maximale du choix des contes sous l'âge minimum d'une fiche (choixContes.ts). */
const MARGE_ELARGIE = 3;

const args = process.argv.slice(2);
const aRendre = args[0] === '--rendre' ? args[1] : null;
if (args[0] === '--rendre' && !aRendre) {
  console.log('Usage : node tools/verifier-retouches.mjs --rendre <id>');
  process.exit(1);
}

let problemes = 0;
const signaler = (id, message) => {
  problemes++;
  console.log(`${id} : ${message}`);
};
const pourcent = (n, total) => `${Math.round((100 * n) / Math.max(1, total))} %`;

const fichiers = existsSync(DOSSIER)
  ? readdirSync(DOSSIER).filter((f) => f.endsWith('.json')).sort()
  : [];
if (aRendre && !fichiers.includes(`${aRendre}.json`)) {
  console.log(`Pas de fiche de retouches pour « ${aRendre} » dans ${DOSSIER}/.`);
  process.exit(1);
}

const parts = [];

for (const fichier of fichiers) {
  const id = fichier.replace(/\.json$/, '');
  if (aRendre && id !== aRendre) continue;

  let donnees;
  try {
    donnees = JSON.parse(readFileSync(`${DOSSIER}/${fichier}`, 'utf8'));
  } catch (e) {
    signaler(id, `JSON illisible : ${e.message}`);
    continue;
  }
  const lu = validerFicheRetouches(donnees);
  if (!lu.ok) {
    for (const e of lu.erreurs) signaler(id, e);
    continue;
  }
  const fiche = lu.fiche;
  if (fiche.id !== id) signaler(id, `identifiant « ${fiche.id} » différent du nom de fichier`);

  const cheminTexte = `wiki/fr/${id}.md`;
  const cheminFiche = `wiki/fiches/${id}.md`;
  if (!existsSync(cheminTexte) || !existsSync(cheminFiche)) {
    signaler(id, 'aucun conte de ce nom dans wiki/fr/ et wiki/fiches/');
    continue;
  }
  const texte = corpsDuTexte(readFileSync(cheminTexte, 'utf8'));
  const ficheConte = readFileSync(cheminFiche, 'utf8');
  const ageMin = Number(ficheConte.match(/^age: \[(\d+), \d+\]$/m)?.[1] ?? AGE_MIN);
  const plancher = Math.max(AGE_MIN, ageMin - MARGE_ELARGIE);

  if (!ficheConte.includes('**À jouer.**')) {
    signaler(id, 'la fiche du conte garde sa section « À adapter » : la passer en « À jouer »');
  }

  // La grille, et les retouches qui ne s'appliqueraient jamais.
  for (const moment of fiche.moments) {
    const plafond = PLAFONDS[moment.type];
    const haut = Math.max(...moment.niveaux.map((n) => n.jusqua));
    const hors = plafond === null
      ? `un moment « ${moment.type} » ne se retouche pas`
      : haut > plafond
        ? `niveau jusqu'à ${haut} ans, au-dessus de l'âge limite du type « ${moment.type} » (${plafond})`
        : null;
    if (hors && !moment.pourquoi) signaler(id, `moment « ${moment.id} » : ${hors} ; sinon, écrire la raison dans « pourquoi »`);
    else if (hors) console.log(`${id} : moment « ${moment.id} » passe outre la grille (${hors}) : ${moment.pourquoi}`);
    if (haut < plancher) {
      signaler(id, `moment « ${moment.id} » : jamais appliqué, le conte n'est pas proposé sous ${plancher} ans`);
    }
  }
  fiche.langue.forEach((r) => {
    const plafond = PLAFONDS_LANGUE[r.nature];
    if (plafond === 'toujours' && r.jusqua !== undefined) {
      signaler(id, `langue : « ${r.avant} » est un « ${r.nature} », qui vaut toujours : retirer « jusqua » ou choisir une autre nature`);
    }
    if (plafond !== 'toujours' && (r.jusqua === undefined || r.jusqua > plafond)) {
      signaler(id, `langue : « ${r.avant} » est un « ${r.nature} », qui vaut jusqu'à ${plafond} ans au plus`);
    }
    if (r.jusqua !== undefined && r.jusqua < plancher) {
      signaler(id, `langue : « ${r.avant} » n'est jamais appliqué, le conte n'est pas proposé sous ${plancher} ans`);
    }
  });

  // Chaque âge du studio.
  const vus = new Set();
  for (let age = AGE_MIN; age <= AGE_MAX; age++) {
    const r = appliquerRetouches(texte, fiche, age);
    const messages = r.ok ? r.avertissements : [...r.erreurs, ...r.avertissements];
    for (const m of messages) {
      if (vus.has(m)) continue;
      vus.add(m);
      signaler(id, `à ${age} ans, ${m}`);
    }
  }

  // La part retouchée, à trois âges.
  const mesures = [3, 6, 9].map((age) => {
    const r = appliquerRetouches(texte, fiche, age);
    if (!r.ok) return `${age} ans : —`;
    const alerte = r.touches.langue / Math.max(1, r.touches.total) > PLAFONDS_PROVISOIRES_LANGUE[age] ? ' ⚠' : '';
    return `${age} ans : langue ${pourcent(r.touches.langue, r.touches.total)}${alerte}, fond ${pourcent(r.touches.fond, r.touches.total)}`;
  });
  parts.push(`${id.padEnd(40)} ${mesures.join(' | ')}`);

  if (aRendre) {
    for (const { ages, resultat } of versionsDistinctes(texte, fiche, { marquer: true })) {
      const titre = ages.length > 1 ? `${ages[0]} à ${ages[ages.length - 1]} ans` : `${ages[0]} ans`;
      console.log(`\n=== ${titre} ===\n`);
      if (!resultat.ok) {
        console.log(`(la fiche ne s'applique pas : ${resultat.erreurs.join(' ; ')})`);
        continue;
      }
      console.log(`Profil : ${resultat.profil.join(', ') || '(aucune retouche selon l’âge)'}`);
      console.log(`Annonces : ${resultat.annonces.join(' ') || '(aucune)'}\n`);
      console.log(resultat.texte);
    }
    console.log('');
  }
}

console.log(`\nPart du texte retouchée (${parts.length} fiche(s)) :`);
for (const ligne of parts) console.log(`  ${ligne}`);
console.log(problemes ? `\n${problemes} problème(s).` : '\nFiches de retouches conformes.');
process.exitCode = problemes ? 1 : 0;
