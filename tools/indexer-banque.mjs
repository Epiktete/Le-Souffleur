// Construit banque/index.json à partir de banque/spectacles/*.json.
//
// L'index porte la SIGNATURE de chaque spectacle : de quoi l'apparier à une
// demande — durée, âge, nombre de marionnettistes, interaction, et pour chaque
// rôle son espèce, sa famille et ses traits — sans ouvrir le fichier, qui pèse
// une vingtaine de kilo-octets. C'est lui, et lui seul, qui est chargé au
// démarrage de l'application.
//
// Usage : node tools/indexer-banque.mjs
// À relancer après tout versement. Un test vérifie que l'index est à jour.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DOSSIER = 'banque/spectacles';
mkdirSync(DOSSIER, { recursive: true });

const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.json')).sort();

/** Sans accents, sans casse : reproduit `normaliser` de src/services/banque.ts. */
const normaliser = (texte) => texte
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Le texte joué d'un modèle : pitch, voix, tableaux, actes — jamais la bible.
 * Reproduit `lignesModele` de src/services/banque.ts ; un test vérifie que
 * l'index et `signatureDe` disent la même chose.
 */
function texteJoue(m) {
  const lignes = [m.pitch];
  for (const r of m.roles) if (r.voix) lignes.push(r.voix);
  for (const t of m.tableaux) lignes.push(t.titre, t.description, ...t.accessoires);
  for (const a of m.actes) {
    lignes.push(a.titre, a.resume);
    for (const e of a.elements) {
      if (typeof e.texte === 'string') lignes.push(e.texte);
      if (typeof e.ton === 'string') lignes.push(e.ton);
    }
  }
  return lignes.filter((l) => typeof l === 'string' && l.trim() !== '').join('\n');
}

/** Le mot d'espèce, en mot entier et au pluriel près, est-il dans le texte ? */
const especeCitee = (texte, espece) =>
  new RegExp(`(?<![a-z])${echapper(normaliser(espece))}s?(?![a-z])`).test(normaliser(texte));

const index = {};
for (const f of fichiers) {
  const m = JSON.parse(readFileSync(join(DOSSIER, f), 'utf8'));
  const texte = texteJoue(m);
  index[m.id] = {
    conteId: m.conteId,
    titre: m.titre,
    dureeMinutes: m.parametres.dureeMinutes,
    ageAuditoire: m.parametres.ageAuditoire,
    nbMarionnettistes: m.parametres.nbMarionnettistes,
    interactionPublic: m.parametres.interactionPublic,
    dureeEstimeeSecondes: m.dureeEstimeeSecondes,
    roles: m.roles.map(({ cle, espece, famille, traits }) => ({
      cle,
      espece,
      famille,
      traits,
      ...(espece !== null && especeCitee(texte, espece) ? { especeCitee: true } : {}),
    })),
  };
}

// Une ligne par spectacle : un `git diff` doit rester lisible quand le fonds
// grandit. Même parti pris que tools/indexer-contes.mjs.
writeFileSync('banque/index.json', `${JSON.stringify(index, null, 0).replace(/\},"/g, '},\n"')}\n`);

console.log(`${fichiers.length} spectacle(s) indexé(s) dans banque/index.json.`);
