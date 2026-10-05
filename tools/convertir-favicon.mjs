// Fabrique un PNG de secours à partir de assets/favicon.webp.
//
// Pourquoi : Safari ne gère pas les favicons WebP de façon fiable, et le
// CDC §3 le cite parmi les navigateurs cibles. Les deux fichiers sont déclarés
// dans index.html ; chaque navigateur prend celui qu'il sait lire.
//
// À relancer seulement si le favicon change :
//   node tools/convertir-favicon.mjs
//
// Le décodage se fait dans le navigateur de test déjà installé pour Playwright :
// aucune dépendance supplémentaire, et aucun appel extérieur.

import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const SOURCE = 'assets/favicon.webp';
const CIBLE = 'assets/favicon.png';
/** 180 px couvre à la fois l'onglet et l'icône d'écran d'accueil sur iOS. */
const COTE = 180;

const octets = await readFile(SOURCE);
const navigateur = await chromium.launch();
const page = await navigateur.newPage();

const donnees = await page.evaluate(
  async ({ base64, cote }) => {
    const blob = await (await fetch(`data:image/webp;base64,${base64}`)).blob();
    const image = await createImageBitmap(blob);

    const toile = document.createElement('canvas');
    toile.width = cote;
    toile.height = cote;
    const c = toile.getContext('2d');
    if (!c) throw new Error('Contexte de dessin indisponible.');
    c.imageSmoothingEnabled = false; // c'est du pixel art : pas de lissage
    c.drawImage(image, 0, 0, cote, cote);

    return toile.toDataURL('image/png').split(',')[1];
  },
  { base64: octets.toString('base64'), cote: COTE },
);

await navigateur.close();
await writeFile(CIBLE, Buffer.from(donnees, 'base64'));
console.log(`${CIBLE} écrit : ${COTE} × ${COTE} px.`);
