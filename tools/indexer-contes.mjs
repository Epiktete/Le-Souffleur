// Construit wiki/index.json : pour chaque conte, sa longueur en mots et ses
// mots-clés, tirés de son texte français intégral.
//
// Pourquoi un index plutôt que les textes : l'application charge les fiches dès
// l'ouverture, mais les textes intégraux (un mégaoctet et demi) seulement au
// moment d'écrire. Or deux critères du choix des contes ont besoin du texte :
//
//   - la LONGUEUR, pour savoir s'il faudra étirer ou couper le conte ;
//   - les MOTS du conte, pour le rapprocher de l'ébauche du parent : la fiche
//     seule, cent cinquante mots, ne dit pas qu'il y a une rivière, un figuier
//     ou une nuit d'orage.
//
// On garde pour chaque conte ses mots les plus caractéristiques (fréquents dans
// ce conte, rares dans les autres). L'index pèse quelques dizaines de
// kilo-octets.
//
// Usage : node tools/indexer-contes.mjs
// À relancer après tout ajout ou toute retouche d'un texte de wiki/fr/.
// Un test vérifie que l'index est à jour.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { corpsDuTexte, compterMots, motsSignifiants } from '../src/services/mots.ts';

const DOSSIER = 'wiki/fr';
const MOTS_CLES = 60;

const textes = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((f) => {
    const corps = corpsDuTexte(readFileSync(join(DOSSIER, f), 'utf8'));
    return { id: f.replace(/\.md$/, ''), corps, mots: motsSignifiants(corps) };
  });

// Dans combien de contes chaque mot apparaît-il ?
const presence = new Map();
for (const t of textes) {
  for (const m of new Set(t.mots)) presence.set(m, (presence.get(m) ?? 0) + 1);
}

const index = {};
for (const t of textes) {
  const frequence = new Map();
  for (const m of t.mots) frequence.set(m, (frequence.get(m) ?? 0) + 1);
  const cles = [...frequence.entries()]
    .map(([m, n]) => [m, n * Math.log(textes.length / presence.get(m))])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MOTS_CLES)
    .map(([m]) => m)
    .sort();
  index[t.id] = { mots: compterMots(t.corps), cles };
}

writeFileSync('wiki/index.json', `${JSON.stringify(index, null, 0).replace(/\},"/g, '},\n"')}\n`);
console.log(`${textes.length} contes indexés dans wiki/index.json.`);
