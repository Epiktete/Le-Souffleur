// L'APPARIEMENT : quels spectacles du fonds sont jouables ici et maintenant ?
//
// Le mode Banque (CDC §7) ne pilote pas une écriture : il filtre. Ce module
// évalue chaque signature du fonds contre la troupe et les réglages du studio,
// et dit soit « jouable, et voici qui jouerait quoi », soit pourquoi pas —
// jamais un silence : l'interface compte et explique chaque écarté.
//
// La distribution réutilise le calcul du générateur (`meilleureDistribution`,
// couples interdits compris) à travers un PSEUDO-CONTE bâti depuis la
// signature : `choixContes.ts` n'est pas modifié.

import { BANQUE } from '../config';
import type { Marionnette } from '../types';
import type { Conte, RoleConte } from './repertoire';
import type { RoleSignature, SignatureModele } from './banque';
import {
  compatibiliteEspece,
  especeMarionnette,
  familleRole,
  INTERDIT,
  meilleureDistribution,
  tailleIncompatible,
  type Famille,
} from './choixContes';

/** Les réglages du studio qui servent de filtres (CDC §7). */
export interface ReglagesFiltre {
  dureeMinutes: number;
  ageAuditoire: number;
  nbMarionnettistes: 1 | 2;
}

/** Pourquoi un spectacle du fonds est écarté. */
export type Ecart =
  /** Déjà fait par cette famille : on ne le repropose pas (CDC §7). */
  | 'dejaJoue'
  /** Sa durée réelle dépasse la cible, tolérance comprise. */
  | 'duree'
  /** Son âge minimum conseillé dépasse l'âge réglé. */
  | 'age'
  /** Il demande deux marionnettistes, le réglage n'en donne qu'un. */
  | 'marionnettistes'
  /** Il a plus de rôles que de marionnettes disponibles. */
  | 'nombre'
  /** Aucune distribution sans couple interdit n'existe. */
  | 'distribution'
  /**
   * Un rôle à espèce IMPOSÉE (l'annotation a jugé que la remplacer
   * dénaturerait le conte) qu'aucune peluche de la troupe ne peut tenir.
   * Pour tous les autres rôles, la création met le texte à l'espèce de la
   * peluche : aucune barrière (décision du 2026-09-28).
   */
  | 'espece';

/** Qui tient un rôle du modèle : la clé du rôle, la marionnette dessus. */
export interface AttributionBanque {
  cle: string;
  marionnetteId: string;
}

/** Une signature évaluée : jouable avec sa distribution, ou écartée et dite. */
export interface ModeleEvalue {
  signature: SignatureModele;
  ecarts: Ecart[];
  /**
   * La meilleure distribution, DANS L'ORDRE DES RÔLES (r1, r2…) — l'ordre
   * qu'exige `peupler` — : la graine de l'écran de distribution. Null quand
   * le spectacle est écarté.
   */
  distribution: AttributionBanque[] | null;
}

/* ------------------------------------------------------------------ */
/* Le pseudo-conte                                                     */
/* ------------------------------------------------------------------ */

/**
 * La catégorie qu'aurait ce rôle dans une fiche de conte, retrouvée depuis sa
 * famille. Une famille inconnue devient « animal » : `familleRole` en fera un
 * rôle neutre (0,5 pour tout le monde), ce qui est le bon défaut quand on ne
 * sait rien.
 */
function categorieDe(famille: Famille | null): RoleConte['categorie'] {
  if (famille === 'enfant' || famille === 'adulte' || famille === 'vieux' || famille === 'noble') {
    return 'humain';
  }
  if (famille === 'feerique' || famille === 'monstre') return 'merveilleux';
  if (famille === 'objet') return 'objet';
  return 'animal';
}

function roleConteDe(r: RoleSignature): RoleConte {
  return {
    nom: r.espece ?? r.cle,
    espece: r.espece ?? '',
    categorie: categorieDe(r.famille),
    traits: [...r.traits],
    fonction: '',
    figurant: false,
  };
}

/**
 * Le pseudo-conte d'une signature : juste ce qu'il faut pour que
 * `meilleureDistribution` travaille. Tous ses rôles sont principaux — un
 * modèle du fonds n'a pas de figurant, chaque variable doit être tenue.
 */
export function conteDeSignature(s: SignatureModele): Conte {
  return {
    id: s.conteId,
    titre: s.titre,
    culture: '',
    source: '',
    genre: '',
    ageMin: s.ageAuditoire,
    ageMax: 10,
    personnages: s.roles.length,
    figurants: 0,
    roles: s.roles.map(roleConteDe),
    lieux: '',
    ressorts: '',
    structure: '',
    corps: '',
  };
}

/* ------------------------------------------------------------------ */
/* L'évaluation                                                        */
/* ------------------------------------------------------------------ */

export interface OptionsEvaluation {
  /**
   * Vrai quand la troupe est toute la Marionnethèque (scène vide) : les
   * marionnettes en trop restent au placard, comme au mode automatique.
   */
  facultatives: boolean;
  /** Les identifiants des modèles déjà instanciés par cette famille. */
  dejaJoues?: ReadonlySet<string>;
}

/**
 * Évalue une signature. Les écarts s'additionnent (un spectacle peut être à
 * la fois trop long et déjà joué) ; la distribution n'est calculée que si le
 * reste passe, elle est le dernier juge.
 */
export function evaluerModele(
  s: SignatureModele,
  troupe: Pick<Marionnette, 'id' | 'nom' | 'description' | 'traits'>[],
  reglages: ReglagesFiltre,
  options: OptionsEvaluation,
): ModeleEvalue {
  const ecarts: Ecart[] = [];

  if (options.dejaJoues?.has(s.id)) ecarts.push('dejaJoue');
  if (s.dureeEstimeeSecondes > reglages.dureeMinutes * 60 * (1 + BANQUE.toleranceDuree)) {
    ecarts.push('duree');
  }
  if (s.ageAuditoire > reglages.ageAuditoire) ecarts.push('age');
  if (s.nbMarionnettistes > reglages.nbMarionnettistes) ecarts.push('marionnettistes');
  if (s.roles.length > troupe.length) ecarts.push('nombre');

  if (ecarts.length > 0) return { signature: s, ecarts, distribution: null };

  // Une espèce IMPOSÉE exige une peluche de la même espèce (au genre près) :
  // si la troupe n'en a pas, inutile de chercher une distribution.
  const sansEspece = s.roles.some((r) =>
    r.especeImposee && !troupe.some((m) => memeEspece(especeMarionnette(m)?.mot, r.espece)));
  if (sansEspece) return { signature: s, ecarts: ['espece'], distribution: null };

  const conte = conteDeSignature(s);
  // Plus de marionnettes que de rôles : les marionnettes en trop restent au
  // placard, et le spectacle s'affiche quand même (décision du 2026-09-28).
  // Sans cela, une scène garnie de quatre peluches écartait tout spectacle à
  // trois rôles : aucune distribution n'existait où chacune joue.
  const attributions = meilleureDistribution(troupe, conte, {
    facultatives: options.facultatives || troupe.length > s.roles.length,
  });
  if (!attributions) return { signature: s, ecarts: ['distribution'], distribution: null };

  // De l'ordre des marionnettes à l'ordre des rôles. Les rôles du pseudo-conte
  // sont comparés par référence : deux rôles de même espèce (les deux sœurs
  // des Fées) restent distincts.
  const distribution = conte.roles.map((role, k): AttributionBanque | null => {
    const a = attributions.find((x) => x.role === role);
    return a ? { cle: s.roles[k].cle, marionnetteId: a.marionnetteId } : null;
  });
  if (distribution.some((d) => d === null)) {
    // Tous les rôles d'un modèle sont exigés : ne peut pas arriver, mais un
    // rôle sans marionnette ferait planter `peupler` — on écarte proprement.
    return { signature: s, ecarts: ['distribution'], distribution: null };
  }
  let retenue = distribution as AttributionBanque[];

  // Le calcul favorise déjà l'espèce exacte (elle vaut la meilleure note),
  // mais il ne connaît pas l'exigence dure : on répare par un échange quand
  // un rôle à espèce citée a reçu une autre peluche que celle qui convient.
  retenue = reparerEspecesCitees(retenue, s, troupe) ?? retenue;
  const mismatch = retenue.some((a, k) => {
    const m = troupe.find((x) => x.id === a.marionnetteId);
    return m !== undefined && problemeAttribution(m, s.roles[k]) !== null;
  });
  if (mismatch) return { signature: s, ecarts: ['espece'], distribution: null };

  return { signature: s, ecarts: [], distribution: retenue };
}

/**
 * Tente de rendre chaque rôle à espèce citée à une peluche de cette espèce,
 * par échanges. Rend null si rien n'était à réparer.
 */
function reparerEspecesCitees(
  distribution: AttributionBanque[],
  s: SignatureModele,
  troupe: Pick<Marionnette, 'id' | 'nom' | 'description' | 'traits'>[],
): AttributionBanque[] | null {
  const marionnette = (id: string) => troupe.find((m) => m.id === id);
  let reparee: AttributionBanque[] | null = null;

  s.roles.forEach((role, k) => {
    const courante = (reparee ?? distribution)[k];
    const m = marionnette(courante.marionnetteId);
    if (!role.especeImposee || !m || memeEspece(especeMarionnette(m)?.mot, role.espece)) return;

    const base = reparee ?? distribution.map((a) => ({ ...a }));
    // La bonne peluche joue-t-elle un autre rôle ? On échange. Sinon, elle
    // est au placard : on la fait entrer à la place de l'actuelle.
    const bonne = troupe.find((x) => memeEspece(especeMarionnette(x)?.mot, role.espece));
    if (!bonne) return;
    const j = base.findIndex((a) => a.marionnetteId === bonne.id);
    if (j >= 0) base[j] = { ...base[j], marionnetteId: courante.marionnetteId };
    base[k] = { ...base[k], marionnetteId: bonne.id };
    reparee = base;
  });

  return reparee;
}

/* ------------------------------------------------------------------ */
/* Le genre grammatical                                                */
/* ------------------------------------------------------------------ */

/** Le genre grammatical d'un personnage, pour les accords du texte. */
export type Genre = 'masculin' | 'feminin';

/** Sans accents, sans casse, en mots : pour chercher, jamais pour écrire. */
function motsDe(texte: string): string[] {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/**
 * Mots dont le genre est sûr, sous forme normalisée. La liste est courte et
 * fermée à dessein : mieux vaut répondre « je ne sais pas » (l'écran de
 * distribution demande alors « il ou elle ? ») que de deviner de travers.
 */
const MOTS_FEMININS = new Set([
  'ourse', 'chatte', 'louve', 'renarde', 'lapine', 'lionne', 'chienne', 'anesse', 'tigresse', 'ogresse', 'guenon',
  'souris', 'tortue', 'poule', 'chevre', 'vache', 'brebis', 'biche', 'jument',
  'grenouille', 'abeille', 'coccinelle', 'araignee', 'fourmi', 'libellule',
  'mouche', 'guepe', 'chouette', 'pie', 'cane', 'oie', 'hirondelle', 'mesange',
  'girafe', 'baleine', 'sirene', 'licorne',
  'fee', 'sorciere', 'princesse', 'reine', 'dame', 'femme', 'fille', 'fillette',
  'poupee', 'mamie', 'mere', 'tante', 'soeur', 'bergere', 'danseuse', 'ballerine',
]);

const MOTS_MASCULINS = new Set([
  'ours', 'chat', 'chaton', 'loup', 'renard', 'lapin', 'lion', 'chien', 'ane',
  'cheval', 'coq', 'canard', 'cochon', 'mouton', 'bouc', 'taureau', 'tigre',
  'elephant', 'singe', 'herisson', 'ecureuil', 'hibou', 'corbeau', 'aigle',
  'pingouin', 'crapaud', 'escargot', 'serpent', 'poisson',
  'dragon', 'ogre', 'geant', 'lutin', 'diable', 'diablotin', 'dieu', 'pantin',
  'roi', 'prince', 'garcon', 'homme', 'monsieur', 'papi', 'pere', 'oncle',
  'frere', 'soldat', 'chevalier', 'bucheron', 'pecheur', 'meunier', 'berger',
  'magicien', 'sorcier',
]);

/**
 * Le genre grammatical d'une marionnette, ou null quand rien ne le dit.
 *
 * Le genre DÉCLARÉ à la création l'emporte sur tout. À défaut, le nom
 * l'emporte sur la description, et un mot au genre sûr l'emporte sur
 * l'article : « Une grosse ourse » est féminin par « ourse » avant de l'être
 * par « une ». En dernier recours, le premier article de la description
 * tranche — les fiches commencent presque toutes par « Un … » ou « Une … ».
 */
export function genreMarionnette(
  m: Pick<Marionnette, 'nom' | 'description' | 'genre' | 'espece'>,
): Genre | null {
  if (m.genre) return m.genre;
  for (const texte of [m.espece ?? '', m.nom, m.description]) {
    for (const mot of motsDe(texte)) {
      if (MOTS_FEMININS.has(mot)) return 'feminin';
      if (MOTS_MASCULINS.has(mot)) return 'masculin';
    }
  }
  const article = motsDe(m.description).find((mot) => mot === 'un' || mot === 'une');
  if (article === 'un') return 'masculin';
  if (article === 'une') return 'feminin';
  return null;
}

/**
 * Les deux graphies d'une même espèce selon le genre : la bascule d'accords
 * de la création sait écrire « la louve » sur un rôle de loup, ces couples
 * passent donc la barrière de l'espèce citée.
 */
const JUMELLES: [string, string][] = [
  ['loup', 'louve'], ['ours', 'ourse'], ['chat', 'chatte'], ['renard', 'renarde'],
  ['lapin', 'lapine'], ['lion', 'lionne'], ['chien', 'chienne'], ['ane', 'anesse'],
  ['tigre', 'tigresse'], ['ogre', 'ogresse'], ['singe', 'guenon'],
];

/** Même espèce, au genre près. */
export function memeEspece(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return JUMELLES.some(([m, f]) => (a === m && b === f) || (a === f && b === m));
}

/**
 * Cette marionnette peut-elle tenir ce rôle du fonds ? Le même juge que le
 * générateur (couples interdits, taille), plus l'exigence de l'espèce citée.
 * Rend la raison du refus, pour que l'écran de distribution l'explique, ou
 * null quand tout va bien.
 */
export function problemeAttribution(
  marionnette: Pick<Marionnette, 'nom' | 'description'>,
  role: RoleSignature,
): 'interdit' | 'espece' | null {
  const espece = especeMarionnette(marionnette);
  const roleConte = roleConteDe(role);
  if (compatibiliteEspece(espece, familleRole(roleConte)) === INTERDIT) return 'interdit';
  if (tailleIncompatible(espece, roleConte)) return 'interdit';
  if (role.especeImposee && !memeEspece(espece?.mot, role.espece)) return 'espece';
  return null;
}

/** Évalue tout le fonds. L'ordre d'entrée est conservé. */
export function evaluerModeles(
  signatures: SignatureModele[],
  troupe: Pick<Marionnette, 'id' | 'nom' | 'description' | 'traits'>[],
  reglages: ReglagesFiltre,
  options: OptionsEvaluation,
): ModeleEvalue[] {
  return signatures.map((s) => evaluerModele(s, troupe, reglages, options));
}
