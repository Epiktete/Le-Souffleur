// Fabrique le document de relecture des fiches de retouches selon l'âge :
// pour chaque conte, ce qui change à chaque âge, passage par passage (avant,
// après), plutôt que le texte entier de chaque version, qu'on ne relirait pas.
//
// Usage :
//   node tools/relecture-retouches.mjs            toutes les fiches
//   node tools/relecture-retouches.mjs <id> …     seulement ces contes
//
// Écrit banc/sorties/relecture-retouches.md (dossier hors du dépôt), à ouvrir
// dans VS Code avec l'aperçu Markdown (Ctrl+Maj+V).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { corpsDuTexte } from '../src/services/mots.ts';
import {
  appliquerRetouches,
  lireFicheRetouches,
  PLAFONDS_LANGUE,
  versionsDistinctes,
} from '../src/services/retouches.ts';

const DOSSIER = 'wiki/retouches';
const SORTIE = 'banc/sorties/relecture-retouches.md';

const demandes = process.argv.slice(2);
const ids = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((id) => demandes.length === 0 || demandes.includes(id))
  .sort();

const pourcent = (n, total) => `${Math.round((100 * n) / Math.max(1, total))} %`;
const tranche = (ages) => (ages.length > 1 ? `${ages[0]} à ${ages[ages.length - 1]} ans` : `${ages[0]} ans`);
/** Une cellule de tableau Markdown : ni barre verticale ni retour à la ligne. */
const cellule = (t) => t.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

const sections = [];
const sommaire = [];

for (const id of ids) {
  const fiche = lireFicheRetouches(readFileSync(`${DOSSIER}/${id}.json`, 'utf8'));
  if (!fiche) {
    sections.push(`## ${id}\n\nFiche illisible : lancez \`node tools/verifier-retouches.mjs\`.\n`);
    continue;
  }
  const texte = corpsDuTexte(readFileSync(`wiki/fr/${id}.md`, 'utf8'));
  const ficheConte = existsSync(`wiki/fiches/${id}.md`) ? readFileSync(`wiki/fiches/${id}.md`, 'utf8') : '';
  const titre = ficheConte.match(/^titre: (.*)$/m)?.[1] ?? id;
  const age = ficheConte.match(/^age: (.*)$/m)?.[1] ?? '?';
  const aJouer = ficheConte.match(/\*\*À jouer\.\*\* (.*)/)?.[1];

  const lignes = [`## ${titre}`, '', `\`${id}\` — fiche pour ${age.replace(/\[(\d+), (\d+)\]/, '$1 à $2 ans')}.`, ''];
  sommaire.push(`- [${titre}](#${titre.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')})`);

  // Les versions distinctes et ce que le parent lit.
  lignes.push('**Les versions**', '');
  for (const { ages, resultat } of versionsDistinctes(texte, fiche)) {
    const annonces = resultat.ok ? resultat.annonces.join(' ') : `⚠ ${resultat.erreurs.join(' ; ')}`;
    lignes.push(`- **${tranche(ages)}** : ${annonces || 'le fond du conte tel qu’il est écrit.'}`);
  }
  const parts = [3, 6, 9].map((a) => {
    const r = appliquerRetouches(texte, fiche, a);
    return r.ok ? `${a} ans : langue ${pourcent(r.touches.langue, r.touches.total)}, fond ${pourcent(r.touches.fond, r.touches.total)}` : `${a} ans : —`;
  });
  lignes.push('', `Part du texte changée — ${parts.join(' · ')} (conte de ${texte.split(/\s+/).length} mots).`, '');

  // Le fond, moment par moment.
  lignes.push('### Le fond', '');
  if (fiche.moments.length === 0) lignes.push('Rien ne change : le conte se joue tel qu’il est écrit, à tout âge.', '');
  for (const moment of fiche.moments) {
    const haut = Math.max(...moment.niveaux.map((n) => n.jusqua));
    lignes.push(`**${moment.id}** — type \`${moment.type}\`${moment.pourquoi ? ` (passe outre la grille : ${moment.pourquoi})` : ''}`, '');
    for (const niveau of moment.niveaux) {
      lignes.push(`- **Jusqu'à ${niveau.jusqua} ans**${niveau.annonce ? ` — ${niveau.annonce}` : ''}`);
      for (const r of niveau.retouches) {
        lignes.push('', `  > **avant** : ${r.avant}`, '  >', `  > **après** : ${r.apres || '*(retiré)*'}`);
      }
      lignes.push('');
    }
    if (haut < 10) lignes.push(`- **À partir de ${haut + 1} ans** : comme le conte.`, '');
  }

  // La langue, par tranche.
  lignes.push('### La langue', '');
  if (fiche.langue.length === 0) {
    lignes.push('Aucune retouche.', '');
  } else {
    const rang = (r) => (r.jusqua === undefined ? 11 : r.jusqua);
    const triees = [...fiche.langue].sort((a, b) => rang(b) - rang(a));
    lignes.push('| Jusqu’à | Nature | Avant | Après |', '| --- | --- | --- | --- |');
    for (const r of triees) {
      const quand = r.jusqua === undefined ? 'toujours' : `${r.jusqua} ans`;
      const partout = r.partout ? ' *(partout)*' : '';
      lignes.push(`| ${quand} | ${r.nature} | ${cellule(r.avant)}${partout} | ${cellule(r.apres) || '*(retiré)*'} |`);
    }
    lignes.push('');
    const parNature = {};
    for (const r of fiche.langue) parNature[r.nature] = (parNature[r.nature] ?? 0) + 1;
    const decompte = Object.keys(PLAFONDS_LANGUE).filter((n) => parNature[n]).map((n) => `${n} ${parNature[n]}`);
    lignes.push(`Décompte : ${decompte.join(', ')}.`, '');
  }

  if (aJouer) lignes.push('### À jouer', '', aJouer, '');
  sections.push(lignes.join('\n'));
}

const entete = [
  '# Relecture des retouches selon l’âge',
  '',
  'Pour chaque conte : les versions et ce que le parent lit sur la carte, puis chaque',
  'passage du fond qui change (avant, après), puis les retouches de langue par tranche',
  'd’âge. Guide : `wiki/ADAPTATION.md`. Le texte entier d’une version :',
  '`node tools/verifier-retouches.mjs --rendre <id>`.',
  '',
  ...sommaire,
  '',
].join('\n');

mkdirSync('banc/sorties', { recursive: true });
writeFileSync(SORTIE, `${entete}\n${sections.join('\n---\n\n')}`);
console.log(`${ids.length} conte(s) → ${SORTIE}`);
