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

const index = {};
for (const f of fichiers) {
  const m = JSON.parse(readFileSync(join(DOSSIER, f), 'utf8'));
  index[m.id] = {
    conteId: m.conteId,
    titre: m.titre,
    dureeMinutes: m.parametres.dureeMinutes,
    ageAuditoire: m.parametres.ageAuditoire,
    nbMarionnettistes: m.parametres.nbMarionnettistes,
    interactionPublic: m.parametres.interactionPublic,
    dureeEstimeeSecondes: m.dureeEstimeeSecondes,
    roles: m.roles.map(({ cle, espece, famille, traits }) => ({ cle, espece, famille, traits })),
  };
}

// Une ligne par spectacle : un `git diff` doit rester lisible quand le fonds
// grandit. Même parti pris que tools/indexer-contes.mjs.
writeFileSync('banque/index.json', `${JSON.stringify(index, null, 0).replace(/\},"/g, '},\n"')}\n`);

console.log(`${fichiers.length} spectacle(s) indexé(s) dans banque/index.json.`);
