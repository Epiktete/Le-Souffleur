// Vérifie les fiches de la contothèque (wiki/fiches/) : champs présents,
// vocabulaire des traits, des fonctions et des catégories, comptes de
// personnages et de figurants, sections du corps.
//
// Usage : node tools/verifier-fiches.mjs
// Affiche chaque problème, puis un décompte des traits, genres, catégories et
// nombres de personnages. Se termine en erreur s'il reste un problème.

import { readdirSync, readFileSync } from 'node:fs';

const DOSSIER = 'wiki/fiches';

const TRAITS = new Set([
  'gentil', 'méchant', 'coquin', 'rusé', 'peureux', 'courageux', 'gourmand', 'grognon',
  'rêveur', 'bavard', 'maladroit', 'savant', 'farceur', 'timide', 'vantard', 'naïf',
  'paresseux', 'sage', 'avare', 'orgueilleux', 'curieux', 'têtu', 'travailleur',
  'généreux', 'jaloux', 'menteur', 'fort', 'minuscule',
]);
const FONCTIONS = new Set([
  'héros', 'trompeur', 'dupe', 'adversaire', 'aide', 'juge', 'meneur', 'compagnon',
  'victime', 'donneur',
]);
const CATEGORIES = new Set(['animal', 'humain', 'merveilleux', 'objet']);
const CHAMPS = [
  'titre', 'culture', 'source', 'genre', 'age', 'personnages', 'figurants', 'lieux',
  'ressorts', 'structure',
];
const SECTIONS = ['**Essence.**', '**Trame.**', '**À adapter.**'];

let problemes = 0;
const decompte = { traits: {}, genres: {}, categories: {}, personnages: {} };
const compter = (table, cle) => { table[cle] = (table[cle] ?? 0) + 1; };

/** Signale un problème si la condition est fausse. */
function verifier(condition, fiche, message) {
  if (condition) return;
  problemes++;
  console.log(`${fiche} : ${message}`);
}

/** Valeur d'une clé dans un rôle écrit en ligne : {nom: …, traits: […], …}. */
function valeurDuRole(role, cle) {
  const i = role.indexOf(`${cle}: `);
  if (i < 0) return undefined;
  const reste = role.slice(i + cle.length + 2);
  return reste.startsWith('[') ? reste.slice(0, reste.indexOf(']') + 1) : reste.split(',')[0].trim();
}

for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith('.md'))) {
  const texte = readFileSync(`${DOSSIER}/${fichier}`, 'utf8').replace(/\r\n/g, '\n');
  const m = texte.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) {
    verifier(false, fichier, 'en-tête absent');
    continue;
  }
  const [, entete, corps] = m;
  const champ = (cle) => entete.match(new RegExp(`^${cle}: (.*)$`, 'm'))?.[1];

  verifier(champ('id') === fichier.replace(/\.md$/, ''), fichier, 'identifiant différent du nom de fichier');
  for (const cle of CHAMPS) verifier(champ(cle) !== undefined, fichier, `champ « ${cle} » absent`);
  verifier(/^\[\d+, \d+\]$/.test(champ('age') ?? ''), fichier, 'âge mal écrit (attendu : [3, 8])');

  let principaux = 0;
  let figurants = 0;
  for (const [, role] of entete.matchAll(/^ {2}- \{(.*)\}$/gm)) {
    const traits = role.match(/traits: \[([^\]]*)\]/)?.[1];
    verifier(traits !== undefined, fichier, `traits absents : ${role}`);
    for (const trait of (traits ?? '').split(', ').filter(Boolean)) {
      verifier(TRAITS.has(trait), fichier, `trait inconnu : ${trait}`);
      compter(decompte.traits, trait);
    }
    verifier(FONCTIONS.has(valeurDuRole(role, 'fonction')), fichier, `fonction inconnue : ${valeurDuRole(role, 'fonction')}`);
    verifier(CATEGORIES.has(valeurDuRole(role, 'categorie')), fichier, `catégorie inconnue : ${valeurDuRole(role, 'categorie')}`);
    verifier(valeurDuRole(role, 'nom') && valeurDuRole(role, 'espece'), fichier, `nom ou espèce absent : ${role}`);
    compter(decompte.categories, valeurDuRole(role, 'categorie'));
    if (/figurant: true/.test(role)) figurants++;
    else principaux++;
  }

  verifier(Number(champ('personnages')) === principaux, fichier,
    `personnages : ${champ('personnages')} annoncés, ${principaux} rôles principaux`);
  verifier(Number(champ('figurants')) === figurants, fichier,
    `figurants : ${champ('figurants')} annoncés, ${figurants} rôles de figurant`);
  for (const section of SECTIONS) verifier(corps.includes(section), fichier, `section ${section} absente`);

  compter(decompte.genres, champ('genre'));
  compter(decompte.personnages, principaux);
}

console.log(problemes ? `${problemes} problème(s).` : 'Fiches conformes.');
console.log(JSON.stringify(decompte));
process.exitCode = problemes ? 1 : 0;
