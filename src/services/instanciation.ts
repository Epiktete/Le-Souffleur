// L'INSTANCIATION : d'un modèle du fonds à un spectacle de la famille.
//
// La voie nominale est SANS IA : `peupler` (services/banque.ts) remplace les
// variables par les noms des marionnettes, élisions comprises, et reconstruit
// le dossier. C'est fini là quand rien ne diverge.
//
// LA RETOUCHE D'ACCORDS (CDC §7, « La création ») : un spectacle du fonds a
// été accordé pour ses marionnettes d'origine. Quand le genre grammatical ou
// l'espèce citée dans le texte changent, UN SEUL appel à un petit modèle rend
// une liste de remplacements, vérifiés un à un — un « avant » introuvable fait
// refuser toute la retouche, jamais un texte à moitié accordé. Sans clé, la
// création reste possible, avec l'avertissement.

import { z } from 'zod';
import { BANQUE } from '../config';
import type { Marionnette, Spectacle } from '../types';
import { tba } from '../textes';
import { promptRetoucheAccords } from '../prompts';
import { appelerModele, ErreurIa, type Acces } from './connecteurIa';
import { extraireJson } from './jsonLlm';
import { chargerModele, peupler, type SpectacleModele } from './banque';
import { especeMarionnette } from './choixContes';
import { genreMarionnette, type AttributionBanque, type Genre } from './appariement';

/** Erreur d'instanciation, déjà traduite pour l'utilisateur. */
export class ErreurInstanciation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurInstanciation';
  }
}

/* ------------------------------------------------------------------ */
/* Le texte joué, ligne par ligne                                      */
/* ------------------------------------------------------------------ */

/** Une ligne du texte joué, adressable pour la retouche. */
export interface LigneJouee {
  id: string;
  lire(): string;
  ecrire(texte: string): void;
}

/**
 * Toutes les chaînes que le parent lira ou dira, chacune avec un identifiant
 * (« L1 », « L2 »…) : le pitch, les voix, les tableaux, les actes. La bible
 * n'y est pas : elle n'est jamais jouée ni affichée, elle garde les accords
 * d'origine.
 */
export function lignesJouees(s: Spectacle): LigneJouee[] {
  const lignes: LigneJouee[] = [];
  let n = 0;
  const ajouter = (lire: () => string, ecrire: (t: string) => void) => {
    if (lire().trim() === '') return;
    n += 1;
    lignes.push({ id: `L${n}`, lire, ecrire });
  };

  ajouter(() => s.pitch, (t) => { s.pitch = t; });
  for (const m of s.distribution) {
    if (m.voix !== undefined) ajouter(() => m.voix!, (t) => { m.voix = t; });
  }
  for (const tb of s.tableaux) {
    ajouter(() => tb.titre, (t) => { tb.titre = t; });
    ajouter(() => tb.description, (t) => { tb.description = t; });
    tb.accessoires.forEach((_a, i) => {
      ajouter(() => tb.accessoires[i], (t) => { tb.accessoires[i] = t; });
    });
  }
  for (const a of s.actes) {
    ajouter(() => a.titre, (t) => { a.titre = t; });
    ajouter(() => a.resume, (t) => { a.resume = t; });
    for (const e of a.elements) {
      if ('texte' in e) ajouter(() => e.texte, (t) => { e.texte = t; });
      if ('ton' in e && e.ton !== undefined) ajouter(() => e.ton!, (t) => { e.ton = t; });
    }
  }
  return lignes;
}

/* ------------------------------------------------------------------ */
/* Les divergences                                                     */
/* ------------------------------------------------------------------ */

/** Sans accents, sans casse : pour chercher un mot d'espèce, jamais l'écrire. */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Le mot, en mot entier et au pluriel près, est-il quelque part dans le texte ? */
function motCite(texte: string, mot: string): boolean {
  const motif = new RegExp(`(?<![a-z])${normaliser(mot)}s?(?![a-z])`);
  return motif.test(normaliser(texte));
}

/**
 * Ce qui diverge entre les marionnettes d'aujourd'hui et les rôles d'origine,
 * décrit en français pour le prompt. Vide : aucune retouche à faire.
 *
 * Les marionnettes sont dans l'ordre des rôles. Le genre d'origine absent
 * (vieux modèle) vaut divergence par prudence dès qu'on connaît le genre de la
 * marionnette ; un genre de marionnette inconnu et non choisi à l'écran laisse
 * les accords d'origine pour ce rôle.
 */
export function divergences(
  modele: SpectacleModele,
  marionnettes: Marionnette[],
  texteJoue: string,
  genresChoisis: Partial<Record<string, Genre>> = {},
): string[] {
  const libelleGenre: Record<Genre, string> = { masculin: 'masculin (il)', feminin: 'féminin (elle)' };
  const descriptions: string[] = [];

  modele.roles.forEach((role, k) => {
    const m = marionnettes[k];
    const phrases: string[] = [];

    const genreCible = genreMarionnette(m) ?? genresChoisis[role.cle] ?? null;
    const genreOrigine = role.genre ?? null;
    if (genreCible !== null && genreCible !== genreOrigine) {
      phrases.push(genreOrigine
        ? `« ${m.nom}` + ` » remplace un personnage ${genreOrigine} : ${m.nom} est ${libelleGenre[genreCible]}, accorde tout ce qui s'y rapporte`
        : `« ${m.nom} » est ${libelleGenre[genreCible]} : vérifie et accorde tout ce qui s'y rapporte`);
    }

    const especeCible = especeMarionnette(m)?.libelle ?? null;
    if (role.espece && especeCible !== null
      && normaliser(especeCible) !== normaliser(role.espece)
      && motCite(texteJoue, role.espece)) {
      phrases.push(`« ${m.nom} » n'est plus « ${role.espece} » mais « ${especeCible} » : corrige les mentions de l'ancienne espèce`);
    } else if (role.espece && especeCible === null && motCite(texteJoue, role.espece)) {
      phrases.push(`« ${m.nom} » n'est plus « ${role.espece} » : là où l'espèce est nommée, désigne le personnage par son nom`);
    }

    if (phrases.length > 0) descriptions.push(`${phrases.join(' ; ')}.`);
  });

  return descriptions;
}

/* ------------------------------------------------------------------ */
/* L'application vérifiée                                              */
/* ------------------------------------------------------------------ */

const SchemaRetouche = z.object({
  remplacements: z.array(z.object({
    id: z.string(),
    avant: z.string().min(1),
    apres: z.string(),
  })),
});

export type Remplacement = z.infer<typeof SchemaRetouche>['remplacements'][number];

/**
 * Applique les remplacements, TOUT OU RIEN : chaque « avant » est d'abord
 * vérifié dans sa ligne ; un seul introuvable et rien n'est écrit. C'est ce
 * qui garantit qu'on ne livre jamais un texte à moitié accordé.
 */
export function appliquerRemplacements(
  lignes: LigneJouee[],
  remplacements: Remplacement[],
): boolean {
  const parId = new Map(lignes.map((l) => [l.id, l]));
  for (const r of remplacements) {
    const ligne = parId.get(r.id);
    if (!ligne || !ligne.lire().includes(r.avant)) return false;
  }
  for (const r of remplacements) {
    const ligne = parId.get(r.id)!;
    ligne.ecrire(ligne.lire().split(r.avant).join(r.apres));
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* L'instanciation                                                     */
/* ------------------------------------------------------------------ */

/** Ce qu'il est advenu des accords du spectacle créé. */
export type EtatRetouche =
  /** Rien ne divergeait : le remplacement des noms a suffi. */
  | 'aucune'
  /** La retouche a été faite et appliquée. */
  | 'faite'
  /** Des accords divergent, mais sans clé IA : accords d'origine. */
  | 'sansCle'
  /** La retouche a été refusée (réponse inapplicable, ou erreur d'appel). */
  | 'refusee';

export interface ResultatInstanciation {
  spectacle: Spectacle;
  retouche: EtatRetouche;
  /** La cause d'un refus, pour l'écran de repli. */
  detail?: string;
}

export interface OptionsInstanciation {
  /** L'accès au fournisseur, ou null : la création se fait alors sans retouche. */
  acces?: Acces | null;
  /** Les genres choisis à l'écran (« il / elle ») pour les marionnettes muettes. */
  genresChoisis?: Partial<Record<string, Genre>>;
}

/**
 * Crée un spectacle depuis un modèle du fonds et une distribution.
 *
 * La distribution est DANS L'ORDRE DES RÔLES (r1, r2…), telle que l'écran de
 * distribution la rend : c'est l'ordre que `peupler` exige. Le spectacle rendu
 * avec `retouche: 'refusee'` ou `'sansCle'` garde les accords d'origine —
 * à l'appelant de demander au parent s'il le veut quand même.
 */
export async function instancier(
  modeleId: string,
  distribution: AttributionBanque[],
  marionnetheque: Marionnette[],
  options: OptionsInstanciation = {},
): Promise<ResultatInstanciation> {
  const modele = await chargerModele(modeleId);
  if (!modele) throw new ErreurInstanciation(tba.creation.introuvable);

  const marionnettes = distribution.map((d) =>
    marionnetheque.find((m) => m.id === d.marionnetteId));
  if (marionnettes.some((m) => m === undefined)) {
    // Une marionnette supprimée entre la distribution et le clic : rare, mais
    // `peupler` planterait plus bas avec un message de développeur.
    throw new ErreurInstanciation(tba.creation.echec);
  }
  const troupe = marionnettes as Marionnette[];

  const spectacle = peupler(modele, troupe);
  const lignes = lignesJouees(spectacle);
  const texteJoue = lignes.map((l) => l.lire()).join('\n');

  const changements = divergences(modele, troupe, texteJoue, options.genresChoisis);
  if (changements.length === 0) return { spectacle, retouche: 'aucune' };
  if (!options.acces) return { spectacle, retouche: 'sansCle' };

  // Chez OpenRouter, un petit modèle économe fait l'affaire ; ailleurs, on ne
  // connaît que le modèle configuré. La clé ne sort jamais de l'accès reçu.
  const acces: Acces = options.acces.fournisseurId === 'openrouter'
    ? { ...options.acces, modele: BANQUE.modeleRetouche }
    : options.acces;

  try {
    const prompts = promptRetoucheAccords(changements, lignes.map((l) => ({ id: l.id, texte: l.lire() })));
    const reponse = await appelerModele(
      acces,
      [{ role: 'system', content: prompts.system }, { role: 'user', content: prompts.user }],
      { temperature: 0, maxTokens: BANQUE.budgetRetouche },
    );

    const extrait = extraireJson(reponse.texte);
    if (!extrait.ok) return { spectacle, retouche: 'refusee', detail: extrait.erreur };
    const lu = SchemaRetouche.safeParse(extrait.valeur);
    if (!lu.success) return { spectacle, retouche: 'refusee', detail: tba.creation.reponseInattendue };

    if (!appliquerRemplacements(lignes, lu.data.remplacements)) {
      return { spectacle, retouche: 'refusee', detail: tba.creation.remplacementIntrouvable };
    }
    return { spectacle, retouche: 'faite' };
  } catch (e) {
    // Un appel qui échoue (réseau, clé, délai) ne perd pas le spectacle :
    // le parent choisira entre les accords d'origine et renoncer.
    const detail = e instanceof ErreurIa ? e.message : tba.creation.echec;
    return { spectacle, retouche: 'refusee', detail };
  }
}
