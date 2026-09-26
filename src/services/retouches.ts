// LES RETOUCHES SELON L'ÂGE (CDC §6, « Les retouches selon l'âge »).
//
// L'âge du public règle le fond (peur, violence, mort) et la langue (le français
// ancien) d'un conte. Ce n'est PAS le modèle de génération qui en décide : un
// petit modèle à qui l'on dit « adapte pour 6 ans » force un style « pour
// enfant » et adoucit à chaque étape. La décision est prise une fois, hors
// ligne, dans une fiche par conte (wiki/retouches/<id>.json, guide :
// wiki/ADAPTATION.md), et ce fichier l'applique au texte, sans IA.
//
// Une fiche a deux listes :
//   - la LANGUE : un extrait du texte et ce qui le remplace, valable jusqu'à un
//     âge (ou toujours) ;
//   - les MOMENTS de fond : un passage du conte qui change selon l'âge. Chaque
//     moment a des NIVEAUX (« jusqu'à 4 ans », « jusqu'à 8 ans ») ; le niveau se
//     choisit pour le moment entier, pour que la mère-grand cachée dans
//     l'armoire au début en ressorte bien à la fin.
//
// Ce fichier est lu tel quel par Node (tools/verifier-retouches.mjs) : il
// n'importe rien d'autre que zod, et n'utilise que du TypeScript que Node sait
// lire sans compilation.

import { z } from 'zod';

/* ================================================================== */
/* Le vocabulaire des fiches                                           */
/* ================================================================== */

/** Ce qu'une retouche de langue corrige (wiki/ADAPTATION.md, « La langue »). */
export const NATURES_LANGUE = [
  'mot-disparu', 'faux-ami', 'tournure', 'pronom', 'relative', 'mot-cle',
] as const;

/** Les types de moments de fond, un par ligne de la grille. */
export const TYPES_MOMENT = [
  'menace', 'coups', 'ruse', 'alcool', 'devoration-delivree', 'mort-gentil',
  'punition', 'abandon', 'cruaute', 'sexualite', 'mal-vieilli',
] as const;

export type TypeMoment = (typeof TYPES_MOMENT)[number];

/**
 * L'âge limite le plus haut qu'un niveau peut avoir, selon le type du moment :
 * un garde-fou contre l'excès de prudence. `null` : ce type ne se retouche pas
 * du tout (une menace, des coups burlesques, une ruse sont le conte). Passer
 * outre demande d'écrire la raison dans le champ `pourquoi` du moment.
 */
export const PLAFONDS: Record<TypeMoment, number | null> = {
  menace: null,
  coups: null,
  ruse: null,
  alcool: 4,
  'devoration-delivree': 6,
  'mort-gentil': 8,
  punition: 6,
  abandon: 4,
  cruaute: 10,
  sexualite: 10,
  'mal-vieilli': 10,
};

/** Les âges du studio. */
export const AGE_MIN = 3;
export const AGE_MAX = 10;

/* ================================================================== */
/* Le format d'une fiche                                               */
/* ================================================================== */

const schemaAge = z.number().int().min(AGE_MIN).max(AGE_MAX);

/** Un extrait du texte et ce qui le remplace (vide : l'extrait est retiré). */
const schemaRemplacement = z.object({
  avant: z.string().min(1),
  apres: z.string(),
});

const schemaRetoucheLangue = schemaRemplacement.extend({
  nature: z.enum(NATURES_LANGUE),
  /** Absent : la retouche vaut toujours (jusqu'à 10 ans). */
  jusqua: schemaAge.optional(),
  /** Chaque occurrence, en mot entier ; sans lui, l'extrait doit être unique. */
  partout: z.boolean().optional(),
});

const schemaNiveau = z.object({
  jusqua: schemaAge,
  /** Ce que le parent lit sur la carte du conte : ce qui change dans l'histoire. */
  annonce: z.string().min(1).optional(),
  retouches: z.array(schemaRemplacement).min(1),
});

const schemaMoment = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'minuscules, chiffres et tirets'),
  type: z.enum(TYPES_MOMENT),
  /** Obligatoire seulement pour passer outre la grille (PLAFONDS). */
  pourquoi: z.string().min(1).optional(),
  niveaux: z.array(schemaNiveau).min(1).refine(
    (n) => n.every((niveau, i) => i === 0 || niveau.jusqua > n[i - 1].jusqua),
    'les niveaux vont du plus bas au plus haut, sans deux fois le même âge',
  ),
});

export const schemaFicheRetouches = z.object({
  id: z.string().min(1),
  langue: z.array(schemaRetoucheLangue).default([]),
  moments: z.array(schemaMoment).default([]),
});

export type FicheRetouches = z.infer<typeof schemaFicheRetouches>;
export type Moment = FicheRetouches['moments'][number];
export type RetoucheLangue = FicheRetouches['langue'][number];

/** Valide une fiche déjà lue en JSON, avec des messages lisibles. */
export function validerFicheRetouches(
  donnees: unknown,
): { ok: true; fiche: FicheRetouches } | { ok: false; erreurs: string[] } {
  const r = schemaFicheRetouches.safeParse(donnees);
  if (r.success) return { ok: true, fiche: r.data };
  return {
    ok: false,
    erreurs: r.error.issues.map((i) => `${i.path.join('.') || 'fiche'} : ${i.message}`),
  };
}

/**
 * Lit une fiche depuis son texte JSON. Une fiche illisible vaut null : le conte
 * garde alors l'ancien comportement plutôt que de casser la génération. Le
 * vérificateur, lui, dit pourquoi.
 */
export function lireFicheRetouches(brut: string): FicheRetouches | null {
  try {
    const r = validerFicheRetouches(JSON.parse(brut));
    return r.ok ? r.fiche : null;
  } catch {
    return null;
  }
}

/* ================================================================== */
/* Retrouver un extrait dans le texte                                  */
/* ================================================================== */

const echapper = (c: string) => c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const PONCTUATION_HAUTE = /[?!:;»]/;

/**
 * L'expression qui retrouve un extrait sans tenir compte de la typographie :
 * les textes du wiki mélangent l'apostrophe droite et la courbe, coupent parfois
 * leurs lignes, et mettent ou non une espace avant « ? ». Un extrait recopié à
 * la main ne peut pas respecter tout cela. Il est cherché en mot entier, et sa
 * première lettre sans tenir compte de la majuscule.
 */
function motifTolerant(extrait: string): string {
  const s = extrait.normalize('NFC').trim();
  let motif = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\s/.test(c)) {
      const precedent = s[i - 1];
      while (i + 1 < s.length && /\s/.test(s[i + 1])) i++;
      const suivant = s[i + 1];
      const avantPonctuation = suivant !== undefined && PONCTUATION_HAUTE.test(suivant);
      motif += avantPonctuation || precedent === '«' ? '\\s*' : '\\s+';
    } else if (/['’ʼ]/.test(c)) {
      motif += "['’ʼ]";
    } else if (c === '…') {
      motif += '(?:…|\\.\\.\\.)';
    } else if (c === '.' && s.startsWith('...', i)) {
      motif += '(?:…|\\.\\.\\.)';
      i += 2;
    } else if (/[—–]/.test(c)) {
      motif += '[—–]';
    } else if (/["“”]/.test(c)) {
      motif += '["“”]';
    } else if (c === '«') {
      motif += '«\\s*';
    } else if (PONCTUATION_HAUTE.test(c) && !(i > 0 && /\s/.test(s[i - 1]))) {
      motif += `\\s*${echapper(c)}`;
    } else if (i === 0 && c.toLowerCase() !== c.toUpperCase()) {
      motif += `[${c.toLowerCase()}${c.toUpperCase()}]`;
    } else {
      motif += echapper(c);
    }
  }
  const lettre = /[\p{L}\p{N}]/u;
  const debut = lettre.test(s[0]) ? '(?<![\\p{L}\\p{N}])' : '';
  const fin = lettre.test(s[s.length - 1]) ? '(?![\\p{L}\\p{N}])' : '';
  return debut + motif + fin;
}

/** Les positions de chaque occurrence d'un extrait : [début, fin[. */
export function trouverExtrait(texte: string, extrait: string): [number, number][] {
  const re = new RegExp(motifTolerant(extrait), 'gu');
  return [...texte.matchAll(re)].map((m) => [m.index, m.index + m[0].length]);
}

/* ================================================================== */
/* Appliquer une fiche à un âge                                        */
/* ================================================================== */

/** Un morceau du texte à remplacer. */
interface Zone {
  debut: number;
  fin: number;
  apres: string;
  sorte: 'langue' | 'fond';
}

export interface TexteRetouche {
  ok: true;
  /** Le texte du conte pour cet âge. */
  texte: string;
  /** Ce qui change dans l'histoire, pour la carte du conte, dans l'ordre de la fiche. */
  annonces: string[];
  /**
   * Ce qui a été retenu, trié : « moment@niveau » et « langue#rang » pour les
   * retouches de langue qui dépendent de l'âge. Deux âges de même profil
   * donnent exactement le même texte.
   */
  profil: string[];
  /** Mots changés (voir motsChanges), par sorte, et longueur du texte d'origine. */
  touches: { langue: number; fond: number; total: number };
  /** Retouches de langue écartées (introuvables, ambiguës, à cheval). */
  avertissements: string[];
}

export type ResultatRetouches =
  | TexteRetouche
  | { ok: false; erreurs: string[]; avertissements: string[] };

/**
 * Le niveau d'un moment pour cet âge : celui qui a la plus petite limite
 * restant supérieure ou égale à l'âge. Aucun : le conte reste tel qu'il est
 * écrit.
 */
export function niveauPour(moment: Moment, age: number) {
  return [...moment.niveaux].sort((a, b) => a.jusqua - b.jusqua).find((n) => age <= n.jusqua);
}

const compter = (t: string) => t.split(/\s+/).filter(Boolean).length;
const mots = (t: string) => t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Combien de mots une retouche change vraiment : « sa mère en était folle »
 * devenu « sa mère l'aimait à la folie » ne change pas cinq mots mais trois.
 * On compte, des mots retirés et des mots ajoutés, le plus grand nombre.
 */
export function motsChanges(avant: string, apres: string): number {
  const reste = new Map<string, number>();
  for (const m of mots(avant)) reste.set(m, (reste.get(m) ?? 0) + 1);
  let ajoutes = 0;
  for (const m of mots(apres)) {
    const n = reste.get(m) ?? 0;
    if (n > 0) reste.set(m, n - 1);
    else ajoutes++;
  }
  const retires = [...reste.values()].reduce((s, n) => s + n, 0);
  return Math.max(retires, ajoutes);
}
const court = (t: string) => (t.length > 60 ? `${t.slice(0, 57)}…` : t);
const chevauche = (a: Zone, b: Zone) => a.debut < b.fin && b.debut < a.fin;
const contient = (a: Zone, b: Zone) => a.debut <= b.debut && b.fin <= a.fin;

/**
 * Applique à un texte les retouches d'une fiche pour un âge.
 *
 * Le FOND ne supporte aucun à-peu-près : si l'un de ses extraits est
 * introuvable ou ambigu, rien n'est appliqué (ok: false), car un texte à moitié
 * adouci — la mère-grand cachée qui ressort pourtant du ventre du loup — est
 * pire que l'ancien comportement. La LANGUE, elle, écarte seulement la retouche
 * fautive, avec un avertissement.
 *
 * `marquer` entoure chaque remplacement de ⟦ ⟧, pour la relecture.
 */
export function appliquerRetouches(
  texteBrut: string,
  fiche: FicheRetouches,
  age: number,
  options: { marquer?: boolean } = {},
): ResultatRetouches {
  const texte = texteBrut.normalize('NFC');
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const annonces: string[] = [];
  const profil: string[] = [];

  // 1. Le fond : un niveau par moment, chacun de ses extraits trouvé une fois.
  const fond: Zone[] = [];
  for (const moment of fiche.moments) {
    const niveau = niveauPour(moment, age);
    if (!niveau) continue;
    profil.push(`${moment.id}@${niveau.jusqua}`);
    if (niveau.annonce) annonces.push(niveau.annonce);
    for (const r of niveau.retouches) {
      const occurrences = trouverExtrait(texte, r.avant);
      if (occurrences.length !== 1) {
        const etat = occurrences.length ? `trouvé ${occurrences.length} fois` : 'introuvable';
        erreurs.push(`moment « ${moment.id} », jusqu'à ${niveau.jusqua} ans : extrait ${etat} : « ${court(r.avant)} »`);
        continue;
      }
      const [debut, fin] = occurrences[0];
      fond.push({ debut, fin, apres: r.apres, sorte: 'fond' });
    }
  }
  fond.sort((a, b) => a.debut - b.debut);
  for (let i = 1; i < fond.length; i++) {
    if (chevauche(fond[i - 1], fond[i])) {
      erreurs.push(`deux retouches de fond se chevauchent : « ${court(texte.slice(fond[i].debut, fond[i].fin))} »`);
    }
  }
  if (erreurs.length) return { ok: false, erreurs, avertissements };

  // 2. La langue : ce qui vaut à cet âge, hors des passages de fond déjà
  //    retouchés (leur nouveau texte est écrit en français d'aujourd'hui).
  const langue: Zone[] = [];
  fiche.langue.forEach((r, rang) => {
    if (r.jusqua !== undefined && age > r.jusqua) return;
    if (r.jusqua !== undefined) profil.push(`langue#${rang}`);
    const occurrences = trouverExtrait(texte, r.avant);
    if (occurrences.length === 0) {
      avertissements.push(`langue : extrait introuvable : « ${court(r.avant)} »`);
      return;
    }
    if (occurrences.length > 1 && !r.partout) {
      avertissements.push(`langue : extrait trouvé ${occurrences.length} fois, sans « partout » : « ${court(r.avant)} »`);
      return;
    }
    for (const [debut, fin] of occurrences) langue.push({ debut, fin, apres: r.apres, sorte: 'langue' });
  });

  const retenues: Zone[] = [...fond];
  // Les plus longues d'abord : « seyait » partout cède devant une tournure plus
  // longue qui le contient déjà.
  for (const z of langue.sort((a, b) => b.fin - b.debut - (a.fin - a.debut))) {
    const gene = retenues.find((autre) => chevauche(autre, z));
    if (!gene) {
      retenues.push(z);
    } else if (!contient(gene, z)) {
      avertissements.push(`langue : extrait à cheval sur une autre retouche : « ${court(texte.slice(z.debut, z.fin))} »`);
    }
  }

  // 3. Le texte reconstruit, morceau par morceau.
  retenues.sort((a, b) => a.debut - b.debut);
  const touches = { langue: 0, fond: 0, total: compter(texte) };
  let resultat = '';
  let curseur = 0;
  for (const z of retenues) {
    const original = texte.slice(z.debut, z.fin);
    touches[z.sorte] += motsChanges(original, z.apres);
    let apres = z.apres;
    // Une retouche trouvée en début de phrase garde sa majuscule.
    if (/^\p{Lu}/u.test(original) && /^\p{Ll}/u.test(apres)) apres = apres[0].toUpperCase() + apres.slice(1);
    resultat += texte.slice(curseur, z.debut);
    // Un extrait retiré sans rien à la place laisserait deux espaces côte à
    // côte, ou une espace devant une virgule.
    if (apres === '' && resultat.endsWith(' ') && /[\s,.;:!?]/.test(texte[z.fin] ?? '\n')) {
      resultat = resultat.slice(0, -1);
    }
    resultat += options.marquer ? `⟦${apres}⟧` : apres;
    curseur = z.fin;
  }
  resultat += texte.slice(curseur);

  return {
    ok: true,
    texte: resultat,
    annonces,
    profil: profil.sort(),
    touches,
    avertissements,
  };
}

/**
 * Les versions distinctes d'un conte, de 3 à 10 ans : deux âges de même profil
 * donnent le même texte. Sert à la relecture (--rendre) et aux tests.
 */
export function versionsDistinctes(
  texte: string,
  fiche: FicheRetouches,
  options: { marquer?: boolean } = {},
): { ages: number[]; resultat: ResultatRetouches }[] {
  const versions: { ages: number[]; cle: string; resultat: ResultatRetouches }[] = [];
  for (let age = AGE_MIN; age <= AGE_MAX; age++) {
    const resultat = appliquerRetouches(texte, fiche, age, options);
    const cle = resultat.ok ? resultat.profil.join('|') : `erreur@${age}`;
    const deja = versions.find((v) => v.cle === cle);
    if (deja) deja.ages.push(age);
    else versions.push({ ages: [age], cle, resultat });
  }
  return versions.map(({ ages, resultat }) => ({ ages, resultat }));
}
