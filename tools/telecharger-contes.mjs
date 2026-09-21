// Récupère les textes originaux du répertoire dans wiki/raw/.
//
//   node tools/telecharger-contes.mjs            télécharge ce qui manque
//   node tools/telecharger-contes.mjs --tout     retélécharge tout
//   node tools/telecharger-contes.mjs de-        seulement les id qui commencent par « de- »
//
// La liste des contes et de leurs sources est dans tools/sources-contes.mjs.
// Chaque fichier produit commence par un en-tête qui dit d'où vient le texte
// et pourquoi il est libre de droits.
//
// Un délai sépare deux requêtes et un User-Agent identifie le projet, comme
// le demandent Wikimédia et le Projet Gutenberg. Aucun appel à un modèle.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { CONTES } from './sources-contes.mjs';

const DOSSIER = 'wiki/raw';
const UA = 'LeSouffleur/0.2 (projet personnel ; corpus de contes du domaine public)';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const tout = args.includes('--tout');
const filtre = args.find((a) => !a.startsWith('--'));

/** Un fetch patient : Wikisource refuse les rafales, on attend et on recommence. */
async function recuperer(url, { binaire = false } = {}) {
  for (let essai = 0; essai < 6; essai++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) {
      if (binaire) return Buffer.from(await r.arrayBuffer());
      const t = await r.text();
      if (!t.startsWith('You are making too many requests')) return t;
    }
    await attendre(3000 * (essai + 1));
  }
  throw new Error(`échec répété sur ${url}`);
}

/** HTML de Wikisource ou d'Aozora vers du texte brut lisible. */
function versTexte(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<span class="pagenum[\s\S]*?<\/span>/gi, '')
    .replace(/<table[\s\S]*?<\/table>/gi, '')
    .replace(/<div[^>]*class="[^"]*(?:ws-noexport|noprint|mw-references)[^"]*"[\s\S]*?<\/div>/gi, '')
    .replace(/<ol class="references[\s\S]*?<\/ol>/gi, '')
    // Aozora : on garde le mot, pas sa lecture en petits caractères.
    .replace(/<rp>[\s\S]*?<\/rp>/gi, '')
    .replace(/<rt>[\s\S]*?<\/rt>/gi, '')
    .replace(/<\/(p|div|h\d|li|dd|dt)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/﻿/g, '')
    .split('\n').map((l) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function depuisWikisource({ wiki, page }) {
  const url = `https://${wiki}.wikisource.org/w/api.php?${new URLSearchParams({
    action: 'parse', page, prop: 'text', redirects: '1', format: 'json', formatversion: '2',
  })}`;
  const j = JSON.parse(await recuperer(url));
  if (j.error) throw new Error(`page absente : ${page} (${j.error.info})`);
  return {
    texte: versTexte(j.parse.text),
    url: `https://${wiki}.wikisource.org/wiki/${encodeURIComponent(j.parse.title.replace(/ /g, '_'))}`,
  };
}

const livres = new Map();
async function depuisGutenberg({ livre, debut, fin }) {
  if (!livres.has(livre)) {
    livres.set(livre, await recuperer(`https://www.gutenberg.org/cache/epub/${livre}/pg${livre}.txt`));
  }
  const lignes = livres.get(livre).replace(/\r/g, '').split('\n');
  // Un titre est une ligne qui ne contient QUE ce titre : la table des
  // matières le cite aussi, mais entouré d'autre chose ou en retrait.
  const i = lignes.findIndex((l, n) => l.trim() === debut && n > 0 && lignes[n - 1].trim() === '');
  const departs = lignes.map((l, n) => (l.trim() === debut ? n : -1)).filter((n) => n >= 0);
  const depart = departs.length > 1 ? departs[departs.length - 1] : i;
  if (depart < 0) throw new Error(`début introuvable : ${debut}`);
  const arrivee = lignes.findIndex((l, n) => n > depart && l.trim().startsWith(fin));
  if (arrivee < 0) throw new Error(`fin introuvable : ${fin}`);
  return {
    texte: lignes.slice(depart, arrivee).join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    url: `https://www.gutenberg.org/ebooks/${livre}`,
  };
}

async function depuisAozora({ carte }) {
  const fiche = await recuperer(carte);
  const lien = fiche.match(/href="(\.\/files\/[^"]+\.html)"/);
  if (!lien) throw new Error(`pas de version HTML sur ${carte}`);
  const url = new URL(lien[1], carte).href;
  const brut = await recuperer(url, { binaire: true });
  const html = new TextDecoder('shift_jis').decode(brut);
  const corps = html.match(/<div class="main_text">([\s\S]*?)<div class="bibliographical_information">/);
  return { texte: versTexte(corps ? corps[1] : html), url: carte };
}

/** Ne garde que le passage entre deux repères, bornes comprises. */
function extraire(texte, [debut, fin]) {
  const a = texte.indexOf(debut);
  if (a < 0) throw new Error(`repère de début introuvable : ${debut}`);
  const b = texte.indexOf(fin, a);
  if (b < 0) throw new Error(`repère de fin introuvable : ${fin}`);
  return texte.slice(a, b + fin.length);
}

function entete(c, url) {
  const champs = {
    id: c.id,
    titre: c.titre,
    titre_original: c.titreOriginal ?? c.titre,
    culture: c.culture,
    continent: c.continent,
    langue: c.langue,
    genre: c.genre ?? 'conte',
    collecteur: c.collecteur,
    droits: c.droits,
    source: url,
  };
  const yaml = Object.entries(champs)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');
  return `---\n${yaml}\n---\n\n`;
}

const existe = (f) => access(f).then(() => true, () => false);

await mkdir(DOSSIER, { recursive: true });
const echecs = [];
let faits = 0;

for (const c of CONTES) {
  if (filtre && !c.id.startsWith(filtre)) continue;
  const fichier = `${DOSSIER}/${c.id}.md`;
  if (!tout && await existe(fichier)) continue;
  try {
    const s = c.source;
    let r;
    if (s.type === 'ws') r = await depuisWikisource(s);
    else if (s.type === 'gutenberg') r = await depuisGutenberg(s);
    else if (s.type === 'aozora') r = await depuisAozora(s);
    else throw new Error(`type de source inconnu : ${s.type}`);
    // Les éditions chinoises intercalent des commentaires anciens entre 〈 〉.
    const brut = c.langue === 'zh' ? r.texte.replace(/〈[^〉]*〉/g, '') : r.texte;
    const texte = c.extrait ? extraire(brut, c.extrait) : brut;
    await writeFile(fichier, entete(c, r.url) + texte + '\n');
    faits++;
    console.log(`ok   ${c.id} (${texte.length} caractères)`);
  } catch (e) {
    echecs.push(c.id);
    console.log(`ÉCHEC ${c.id} : ${e.message}`);
  }
  await attendre(1200);
}

console.log(`\n${faits} textes écrits, ${echecs.length} échecs${echecs.length ? ' : ' + echecs.join(', ') : ''}.`);
