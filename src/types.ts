// Modèle de données du Souffleur, repris du CDC §4.
// Un spectacle contient des tableaux (les décors) et des actes ; chaque acte se
// déroule dans un seul tableau et contient une suite ordonnée d'éléments.

/** Identifiant unique, au format UUID v4. */
export type Id = string;

/** Une marionnette de la bibliothèque, ou sa copie figée dans un spectacle. */
export interface Marionnette {
  id: Id;
  /** 1 à 40 caractères, obligatoire. */
  nom: string;
  /** Apparence, espèce. 0 à 500 caractères. */
  description: string;
  /** 1 à 6 traits, issus de la liste proposée ou libres. */
  traits: string[];
  /** Ex. « voix grave, parle lentement, dit "sapristi" ». */
  voix?: string;
  /** Photo redimensionnée à 512 px au plus, en JPEG. Jamais envoyée à l'IA en V1. */
  photo?: Blob;
  creeLe: string;
  modifieLe: string;
}

export type NiveauInteraction = 'aucune' | 'quelques' | 'beaucoup';

/** Réglages du studio au moment de la génération. */
export interface ParametresGeneration {
  /** 2 à 20 minutes, par pas de 1. */
  dureeMinutes: number;
  /** 3 à 10 ans, par pas de 1. */
  ageAuditoire: number;
  nbMarionnettistes: 1 | 2;
  interactionPublic: NiveauInteraction;
  /** 0 à 2 000 caractères. */
  ebauche?: string;
  /** 1 à 6 marionnettes. */
  marionnetteIds: Id[];
  /** Modèle utilisé, conservé pour traçabilité. */
  modele: string;
}

/** Un décor, réutilisable par plusieurs actes. */
export interface Tableau {
  id: Id;
  /** Ex. « La forêt enchantée ». */
  titre: string;
  /** Décor à préparer, 2 à 4 phrases. */
  description: string;
  /** Objets à fabriquer ou à trouver. */
  accessoires: string[];
  /** Prompt text-to-image prêt à copier. La génération d'image est hors V1. */
  promptImage: string;
}

/**
 * Main d'un marionnettiste : M1 ou M2, gauche (G) ou droite (D).
 * Sert au contrôle « mains disponibles » (CDC §6).
 */
export type Main = 'M1G' | 'M1D' | 'M2G' | 'M2D';

export type ElementScript =
  | { id: Id; type: 'replique'; marionnetteId: Id; texte: string; ton?: string }
  /** Action scénique. */
  | { id: Id; type: 'didascalie'; texte: string }
  | { id: Id; type: 'adresse_public'; marionnetteId: Id; texte: string; attenteReponse: boolean }
  /** Jamais dit à voix haute. */
  | { id: Id; type: 'note_marionnettiste'; texte: string }
  | { id: Id; type: 'entree' | 'sortie'; marionnetteId: Id; mainMarionnettiste: Main };

export interface Acte {
  id: Id;
  numero: number;
  titre: string;
  tableauId: Id;
  /** 1 à 2 phrases. */
  resume: string;
  elements: ElementScript[];
}

export type StatutSpectacle =
  | 'propositions'
  | 'choix_en_attente'
  | 'ecriture'
  | 'complet'
  | 'erreur';

/**
 * Résultats intermédiaires du pipeline de génération (CDC §6).
 * Chaque étape enrichit la bible, ce qui permet de reprendre après une erreur.
 * Les champs restent volontairement souples : leur forme précise est vérifiée
 * par les schémas zod (services/schemas.ts) au moment où ils sont produits.
 */
export interface Bible {
  dossier?: unknown;
  /**
   * Un spectacle est l'adaptation d'un conte de la contothèque : son
   * identifiant, le synopsis choisi par le parent, le texte transposé et
   * l'adaptation décidée (changements, tableaux, actes).
   */
  conteId?: string;
  contesPresentes?: unknown;
  /** Combien de contes passaient les barrières du choix. */
  jouables?: unknown;
  synopsisProposes?: unknown;
  synopsis?: unknown;
  ajustement?: string;
  transposition?: unknown;
  adaptation?: unknown;
  relecture?: unknown;
}

export interface Spectacle {
  id: Id;
  titre: string;
  /** Une phrase. */
  pitch: string;
  morale?: string;
  parametres: ParametresGeneration;
  /** Copie figée des marionnettes au moment de la génération (CDC §4). */
  distribution: Marionnette[];
  tableaux: Tableau[];
  actes: Acte[];
  /** Calculée par l'application, jamais par le modèle. */
  dureeEstimeeSecondes: number;
  statut: StatutSpectacle;
  bible: Bible;
  creeLe: string;
  modifieLe: string;
}

/** Fournisseur d'IA configuré, au format Chat Completions (CDC §5). */
export interface ReglagesIa {
  /** Identifiant du préréglage retenu, ou « autre ». */
  fournisseurId: string;
  baseUrl: string;
  modele: string;
  /**
   * Clé API, présente uniquement si l'utilisateur a coché
   * « Mémoriser la clé sur cet appareil » (CDC §5).
   */
  cle?: string;
}

/** Réglages du studio conservés entre deux visites (CDC §7). */
export interface ReglagesStudio {
  dureeMinutes: number;
  ageAuditoire: number;
  nbMarionnettistes: 1 | 2;
  interactionPublic: NiveauInteraction;
  marionnetteIds: Id[];
  ebauche: string;
}

/**
 * Contenu du magasin « reglages », une entrée par clé.
 * Cette table fait le lien entre une clé et le type de sa valeur, ce qui évite
 * de confondre les réglages du studio et ceux de l'IA.
 */
export interface ReglagesParCle {
  ia: ReglagesIa;
  studio: ReglagesStudio;
  /** Corps de texte du prompteur, mémorisé par appareil (CDC §9). */
  taillePrompteur: number;
  /** Version du schéma des données, pour les migrations futures (CDC §4). */
  versionSchema: number;
}

export type CleReglage = keyof ReglagesParCle;

/** Une entrée du magasin « reglages », telle qu'elle est stockée. */
export interface Reglage {
  cle: CleReglage;
  valeur: ReglagesParCle[CleReglage];
}
