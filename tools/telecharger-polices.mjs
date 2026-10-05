// Télécharge une fois pour toutes les polices Andika et IBM Plex Mono dans
// src/polices/, et génère src/polices.css qui les déclare en local.
//
// À relancer seulement pour mettre à jour les polices :
//   node tools/telecharger-polices.mjs
//
// L'application ne fait JAMAIS d'appel à un CDN à l'exécution (CDC §3 et §12) :
// ce script tourne au moment du développement, pas chez l'utilisateur.

import { writeFile } from 'node:fs/promises';

const REQUETE = 'https://fonts.googleapis.com/css2'
  + '?family=Andika:ital,wght@0,400;0,700;1,400;1,700'
  + '&family=IBM+Plex+Mono:wght@400;700&display=swap';

// Un navigateur récent est annoncé, sinon Google renvoie du woff (plus lourd).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

// « latin » couvre tout le français, œ compris ; « latin-ext » sert de filet
// pour les mots et noms empruntés, et ne se télécharge qu'en cas de besoin.
const SOUS_ENSEMBLES = ['latin', 'latin-ext'];

const css = await (await fetch(REQUETE, { headers: { 'User-Agent': UA } })).text();
const blocs = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*(@font-face \{[^}]*\})/g)];
if (blocs.length === 0) throw new Error('Aucune fonte trouvée : le format de la réponse a changé.');

const sortie = [];
for (const [, sousEnsemble, bloc] of blocs) {
  if (!SOUS_ENSEMBLES.includes(sousEnsemble)) continue;
  const famille = /font-family: '([^']+)'/.exec(bloc)[1];
  const style = /font-style: (\w+)/.exec(bloc)[1];
  const poids = /font-weight: (\d+)/.exec(bloc)[1];
  const url = /url\((https:[^)]+)\)/.exec(bloc)[1];
  const unicode = /unicode-range: ([^;]+);/.exec(bloc)[1];

  const nom = `${famille.toLowerCase().replace(/\s+/g, '-')}-${poids}-${style}-${sousEnsemble}.woff2`;
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Échec du téléchargement de ${nom} : HTTP ${reponse.status}`);
  const octets = Buffer.from(await reponse.arrayBuffer());
  await writeFile(`src/polices/${nom}`, octets);
  console.log(`${nom.padEnd(42)} ${String(octets.length).padStart(7)} octets`);

  sortie.push(`/* ${famille} ${poids} ${style} — ${sousEnsemble} */
@font-face {
  font-family: '${famille}';
  font-style: ${style};
  font-weight: ${poids};
  font-display: swap;
  src: url('./polices/${nom}') format('woff2');
  unicode-range: ${unicode};
}`);
}

const entete = `/* Polices auto-hébergées, licence OFL (SIL Open Font License 1.1).
   Andika : SIL International. IBM Plex Mono : IBM.
   Sous-ensembles latin et latin-ext uniquement : suffisent au français.
   Aucun appel à un CDN à l'exécution (CDC §3 et §12).
   Fichier généré par tools/telecharger-polices.mjs — ne pas modifier à la main. */\n\n`;

await writeFile('src/polices.css', entete + sortie.join('\n\n') + '\n');
console.log(`\n${sortie.length} fontes écrites dans src/polices.css`);
