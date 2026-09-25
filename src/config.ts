// Constantes réglables du Souffleur (CDC §13 : tout ce qui se calibre vit ici).
// Un non-développeur peut modifier ces valeurs sans toucher au reste du code.

import type { NomEtape } from './services/pipeline';

/** Nom de l'outil, affiché dans l'en-tête et le titre de la page. */
export const NOM_OUTIL = 'Le Souffleur';

/** Version du schéma des données stockées. À incrémenter lors d'une migration. */
export const VERSION_SCHEMA = 1;

/**
 * Calcul de la durée estimée d'un spectacle (CDC §6).
 * Ces trois valeurs sont des hypothèses à calibrer en chronométrant
 * deux spectacles réels.
 */
export const DUREE = {
  /** Mots prononcés par minute par le marionnettiste. */
  motsParMinute: 100,
  /** Secondes ajoutées pour chaque didascalie (action scénique). */
  secondesParDidascalie: 3,
  /** Secondes ajoutées pour chaque adresse au public qui attend une réponse. */
  secondesParAttenteReponse: 8,
  /** Écart toléré entre la durée visée du SPECTACLE et sa durée estimée. */
  toleranceActe: 0.2,
  /**
   * Écart toléré pour UN acte, plus large : les actes sont inégaux par nature,
   * et une correction demandée pour dix secondes coûte un appel entier.
   */
  toleranceParActe: 0.35,
} as const;

/** Bornes des réglages du studio (CDC §4). */
export const BORNES = {
  // Trente minutes : les pièces de Guignol du répertoire font jusqu'à 6 800
  // mots, soit plus d'une heure lues telles quelles. À trente minutes on les
  // coupe sans les mutiler.
  dureeMinutes: { min: 2, max: 30, defaut: 5 },
  ageAuditoire: { min: 3, max: 10, defaut: 5 },
  marionnettesParSpectacle: { min: 1, max: 6 },
  /** Chaque marionnettiste a deux mains, donc deux marionnettes au plus. */
  mainsParMarionnettiste: 2,
  nomMarionnette: { min: 1, max: 40 },
  descriptionMarionnette: { max: 500 },
  /** Les traits sont facultatifs : ils affinent, ils ne sont pas un péage. */
  traitsMarionnette: { min: 0, max: 6 },
  ebauche: { max: 2000 },
} as const;

/** Appels à l'IA (CDC §5). Repris de l'étape 0. */
export const IA = {
  /**
   * Délai maximal par appel, en millisecondes.
   *
   * Large : la transposition récrit un conte entier, et un modèle à
   * raisonnement décompte sa réflexion du même temps. Un délai trop court
   * arrête une génération qui travaillait encore.
   */
  delaiMs: 240_000,
  /** Nombre maximal de relances quand le modèle renvoie un JSON invalide. */
  relancesJsonMax: 1,
  /** Nombre maximal de séries de nouvelles propositions d'histoires (CDC §6, étape 4). */
  relancesPistesMax: 3,
} as const;

/**
 * Les étapes affichées, réparties entre les deux phases (CDC §7).
 *
 * Un test vérifie que ces deux listes couvrent exactement NOMS_ETAPES : c'est
 * ce qui garantit qu'aucune étape ajoutée au pipeline ne passera à la trappe.
 */

/**
 * Durée typique de chaque étape de génération, en secondes (CDC §7).
 *
 * Elles ne servent QU'À la barre de progression, et uniquement à montrer que
 * l'application n'est pas figée. Une génération dure une à deux minutes sans
 * rien afficher entre deux étapes : le parent croit que ça a planté.
 *
 * Ce sont des ordres de grandeur, pas des mesures : la barre d'une étape en
 * cours avance vers ces durées sans jamais atteindre sa fin, et c'est le
 * passage à l'étape suivante qui la termine. Elle ne ment donc jamais en
 * annonçant « terminé » sur une étape qui tourne encore.
 */
export const ETAPES_PROPOSITIONS: NomEtape[] = ['propositions'];

export const ETAPES_ECRITURE: NomEtape[] = [
  'transposition',
  'construction',
  'ecriture',
  'controles',
  'relecture',
  'corrections',
  'assemblage',
];

export const DUREES_ETAPES: Record<NomEtape, number> = {
  propositions: 60,
  transposition: 60,
  construction: 50,
  ecriture: 60,
  controles: 1,
  relecture: 25,
  corrections: 30,
  assemblage: 1,
} as const;

/** Mode spectacle (CDC §9). */
export const PROMPTEUR = {
  taillePxDefaut: 40,
  taillePxMin: 28,
  taillePxMax: 72,
  /** Appuis ignorés en dessous de ce délai, pour absorber le rebond des pédales. */
  antiRebondMs: 300,
} as const;

/** Largeurs de rupture du layout, en pixels (CDC §7). */
export const RUPTURES = {
  /** Sous cette largeur, les colonnes latérales deviennent des tiroirs. */
  tiroirs: 1024,
  /** Sous cette largeur, navigation par onglets en bas d'écran. */
  onglets: 700,
} as const;
