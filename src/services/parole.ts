// LA PAROLE VIENT DU CONTE (CDC §6, « Le conteur et les trois voies de la
// parole », contrôle 9).
//
// Tout ce qui se dit dans un spectacle vient de l'œuvre : les répliques du
// conte, son discours rapporté rendu direct, et la narration que dit le
// conteur, mot pour mot. Seuls de courts raccords s'inventent.
//
// Ce fichier le VÉRIFIE, sans IA, au lieu de le demander au modèle phrase
// après phrase : une consigne de plus est une rustine qu'un petit modèle
// applique à la lettre ; une mesure ne se discute pas.
//
//   1. Le conteur ne dit que le conte. Chacune de ses phrases doit se
//      retrouver dans le texte de référence (le texte transposé), avec la même
//      recherche tolérante que les retouches de l'âge. Sinon, l'acte repart en
//      correction.
//   2. Peu de mots inventés. On mesure la part des mots dits absents du texte
//      de référence ; au-delà du seuil, un avertissement désigne les répliques
//      qui en portent le plus.

import { PAROLE } from '../config';
import { normaliser } from './mots';
import { trouverExtrait } from './retouches';
import type { Probleme } from './scene';
import type { Acte, ElementScript } from '../types';

const court = (t: string) => (t.length > 70 ? `${t.slice(0, 67)}…` : t);

/**
 * Guillemets et tirets de dialogue ne comptent pas : le conteur qui dit la
 * parole d'un personnage sans marionnette (« sa mère lui dit : Va voir… ») la
 * dit sans les guillemets du texte. Mesuré au relais : sans cela, une phrase
 * recopiée mot pour mot passait pour inventée.
 */
const sansGuillemets = (t: string) => t.replace(/[«»"“”—–]/g, ' ');

/** Les phrases d'un texte, sans leur ponctuation finale. */
function phrases(texte: string): string[] {
  return texte
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim().replace(/[\s.!?…;:,]+$/u, ''))
    .filter((p) => p.split(/\s+/).length >= PAROLE.motsMinPhrase);
}

/**
 * Vrai si la phrase se retrouve dans le texte de référence. Un pronom en tête
 * de phrase peut avoir été remplacé par le nom qu'il désigne, et le nom d'une
 * marionnette tient en plusieurs mots (« Il » devenu « Loup Gris ») : on
 * cherche aussi la phrase privée de ses quatre premiers mots au plus —
 * quatre et non trois, parce que le pronom peut suivre une conjonction
 * (« Et il » devenu « Et Pilou le Pingouin » : mesuré au relais, cas 3,
 * l'acte repartait en correction pour un remplacement pourtant permis).
 */
function dansLeConte(phrase: string, reference: string): boolean {
  const motsPhrase = sansGuillemets(phrase).trim().split(/\s+/);
  for (let tete = 0; tete <= 4; tete++) {
    const reste = motsPhrase.slice(tete);
    if (reste.length < PAROLE.motsMinPhrase - 1) break;
    if (trouverExtrait(reference, reste.join(' ')).length > 0) return true;
  }
  return false;
}

/** Les mots d'un texte qui comptent pour la mesure : trois lettres ou plus. */
function mots(texte: string): string[] {
  return normaliser(texte).split(/\s+/).filter((m) => m.length >= 3);
}

const DIT = new Set<ElementScript['type']>(['replique', 'adresse_public', 'conteur']);

/** La part des mots dits absents du texte de référence, et où ils sont. */
export function motsInventes(actes: Acte[], reference: string) {
  const vocabulaire = new Set(mots(reference));
  let total = 0;
  let inventes = 0;
  const parElement: { acte: number; position: number; texte: string; inventes: number }[] = [];
  for (const acte of actes) {
    acte.elements.forEach((e, i) => {
      if (!DIT.has(e.type) || !('texte' in e)) return;
      const liste = mots(e.texte);
      const absents = liste.filter((m) => !vocabulaire.has(m)).length;
      total += liste.length;
      inventes += absents;
      if (absents > 0) parElement.push({ acte: acte.numero, position: i + 1, texte: e.texte, inventes: absents });
    });
  }
  return { part: total ? inventes / total : 0, parElement };
}

/** Le contrôle 9 : la parole vient du conte. */
export function controlerParole(actes: Acte[], reference: string): Probleme[] {
  const problemes: Probleme[] = [];
  if (!reference.trim()) return problemes;

  // 1. Le conteur ne dit que le conte : un passage continu du texte, mot pour
  //    mot, une phrase entière ou la fin d'une phrase dont le début est montré.
  const texte = sansGuillemets(reference);
  for (const acte of actes) {
    acte.elements.forEach((e, i) => {
      if (e.type !== 'conteur') return;
      const horsTexte = phrases(e.texte).filter((p) => !dansLeConte(p, texte));
      if (horsTexte.length === 0) return;
      problemes.push({
        gravite: 'important',
        acteNumero: acte.numero,
        position: i + 1,
        message: `Le conteur dit une phrase qui n’est pas dans le conte : « ${court(horsTexte[0])} ». `
          + 'Le conteur ne dit que la narration du texte transposé, mot pour mot : un passage '
          + 'continu, jamais une phrase refaite. Ce qui n’y est pas se montre, ou ne se dit pas.',
      });
    });
  }

  // 2. Peu de mots inventés : un avertissement, jamais une correction.
  const { part, parElement } = motsInventes(actes, reference);
  if (part > PAROLE.seuilInvente) {
    const pires = [...parElement]
      .sort((a, b) => b.inventes - a.inventes)
      .slice(0, 3)
      .map((x) => `acte ${x.acte}, « ${court(x.texte)} »`)
      .join(' ; ');
    problemes.push({
      gravite: 'mineur',
      message: `${Math.round(part * 100)} % des mots dits ne viennent pas du conte (seuil `
        + `${Math.round(PAROLE.seuilInvente * 100)} %). Ceux qui en ajoutent le plus : ${pires}.`,
    });
  }
  return problemes;
}
