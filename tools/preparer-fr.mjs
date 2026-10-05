// Prépare wiki/fr/ pour les contes dont l'original est déjà en français.
//
//   node tools/preparer-fr.mjs
//
// Ce n'est pas une traduction : on retire ce qui n'appartient pas au conte
// (bandeau d'édition, liens de navigation de Wikisource, appels de notes), et
// on recolle les lignes que la mise en page du livre avait coupées au milieu
// d'une phrase. Les versions françaises des autres langues sont écrites à la
// main et ce script n'y touche pas.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';

const RAW = 'wiki/raw';
const FR = 'wiki/fr';

/** Lit l'en-tête YAML écrit par telecharger-contes.mjs (une valeur JSON par ligne). */
export function lireEntete(texte) {
  const m = texte.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { champs: {}, corps: texte };
  const champs = {};
  for (const ligne of m[1].split('\n')) {
    const i = ligne.indexOf(': ');
    if (i > 0) champs[ligne.slice(0, i)] = JSON.parse(ligne.slice(i + 2));
  }
  return { champs, corps: texte.slice(m[0].length) };
}

/** Les lettres seules, en capitales et sans accents, pour comparer deux titres. */
const lettres = (s) => s.normalize('NFD').replace(/[^\p{L}]/gu, '').toUpperCase();

/**
 * Le titre du conte en capitales marque son début : tout ce qui précède est
 * l'édition (bandeau, partie du recueil, peuple). À défaut, le premier titre
 * en capitales venu.
 */
function sansBandeau(corps, titre) {
  const lignes = corps.split('\n');
  const cible = lettres(titre);
  const exact = lignes.findIndex((l) => lettres(l) === cible && l === l.toUpperCase());
  if (exact >= 0) return lignes.slice(exact).join('\n');
  const debut = lignes.findIndex((l) => {
    const lettres = l.replace(/[^\p{L}]/gu, '');
    return lettres.length >= 4 && lettres === lettres.toUpperCase()
      && !/^(LES CONTES DE PERRAULT|CONTE|PIÈCE EN UN ACTE)$/.test(l.trim());
  });
  return (debut >= 0 ? lignes.slice(debut) : lignes).join('\n');
}

function mettreEnForme(corps, genre, titre) {
  const blocs = sansBandeau(corps, titre)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b && !/[►◄]/.test(b) && !/^↑/.test(b) && !/^\d+$/.test(b));
  // Dans un bloc de prose, un saut de ligne est une coupure de mise en page.
  const recolles = blocs.map((b) => b.replace(/-\n(?=\p{Ll})/gu, '').replace(/\n/g, ' '));
  // Une fable est en vers : Wikisource met chaque vers dans son propre bloc.
  return genre === 'fable' ? recolles.join('\n') : recolles.join('\n\n');
}

await mkdir(FR, { recursive: true });
let n = 0;
for (const f of (await readdir(RAW)).filter((x) => x.endsWith('.md'))) {
  const { champs, corps } = lireEntete(await readFile(`${RAW}/${f}`, 'utf8'));
  if (champs.langue !== 'fr') continue;
  const entete = `# ${champs.titre}\n\n*${champs.culture} — ${champs.collecteur}. Texte original en français.*\n\n`;
  await writeFile(`${FR}/${f}`, entete + mettreEnForme(corps, champs.genre, champs.titre) + '\n');
  n++;
}
console.log(`${n} versions françaises préparées.`);
