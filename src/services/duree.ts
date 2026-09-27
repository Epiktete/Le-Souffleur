// Durée estimée d'un spectacle (CDC §6, « Budget de durée »).
//
// C'est l'APPLICATION qui calcule la durée, jamais le modèle : un LLM ne sait
// pas compter, et une durée fausse ruinerait la préparation du parent.
//
// Formule :  d = m / v × 60 + 3 × n_did + 8 × n_att
//   m      nombre de mots dits (répliques et adresses au public)
//   v      vitesse de jeu, 100 mots par minute par défaut
//   n_did  nombre de didascalies
//   n_att  nombre d'adresses au public qui attendent une réponse
//
// Les trois constantes vivent dans config.ts et restent à calibrer en
// chronométrant deux spectacles réels (CDC §14).

import { DUREE } from '../config';
import type { Acte, ElementScript } from '../types';

/**
 * Compte les mots réellement prononcés. Les tirets et apostrophes ne séparent
 * pas : « l'arc-en-ciel » est un mot.
 *
 * La typographie française met une espace avant « ? », « ! », « : » et « ; ».
 * Un découpage naïf sur les espaces compterait donc chaque point
 * d'interrogation comme un mot — et les dialogues de marionnettes en sont
 * pleins. On ne garde que les fragments contenant au moins une lettre ou un
 * chiffre.
 */
export function compterMots(texte: string): number {
  return texte
    .trim()
    .split(/\s+/)
    .filter((fragment) => /[\p{L}\p{N}]/u.test(fragment))
    .length;
}

/** Détail du calcul, utile pour expliquer une durée à l'écran. */
export interface DetailDuree {
  secondes: number;
  mots: number;
  didascalies: number;
  attentesReponse: number;
}

/** Durée estimée d'une suite d'éléments, en secondes. */
/**
 * La part d'une note qui se dit à voix haute.
 *
 * Les prompts imposent une forme unique pour la voix d'un personnage sans
 * marionnette : « Voix du Bœuf, en coulisse : "Meuh." ». Tout ce qui suit le
 * deux-points est prononcé par le parent ; le reste est une consigne de jeu.
 * Une note ordinaire ne contient pas cette amorce et ne compte donc pour rien.
 */
export function motsDitsEnCoulisse(texte: string): string {
  const m = /voix\s+(?:de|du|des|d’|d')[^:]*en\s+coulisse\s*:(.*)/is.exec(texte);
  return m ? m[1] : '';
}

/** Une voix en coulisse, décomposée pour être lue comme une réplique. */
export interface VoixEnCoulisse {
  /** Le personnage qui parle, tel que la note le nomme (« Nuage »). */
  qui: string;
  /** Vrai pour le conteur : ce n'est pas un personnage, mais le parent. */
  conteur?: boolean;
  /** Ce que le parent dit, sans guillemets. */
  dit: string;
  /** Ce qui reste de la note : une consigne de jeu, parfois vide. */
  consigne: string;
}

/**
 * Reconnaît une voix en coulisse (« Voix du Nuage, en coulisse : « C'est le
 * Vent. » — dit sans montrer de marionnette ») et la décompose.
 *
 * En représentation, ce texte-là SE DIT : le mode lecture doit l'afficher
 * comme une réplique, pas comme une note qu'on ne lit jamais à voix haute.
 */
export function voixEnCoulisse(texte: string): VoixEnCoulisse | null {
  const m = /voix\s+(?:de\s+la|de\s+l['’]|de|du|des|d['’])\s*([^:]*?)\s*,?\s*en\s+coulisse\s*:\s*(.*)$/is.exec(texte);
  if (!m) return null;
  const qui = m[1].trim();
  const reste = m[2].trim();
  // Les mots dits sont entre guillemets ; ce qui suit est une consigne.
  const cite = /^[«"“]\s*([\s\S]*?)\s*[»"”]\s*(.*)$/s.exec(reste);
  const dit = (cite ? cite[1] : reste).trim();
  const consigne = (cite ? cite[2] : '').replace(/^[—–\-.,;\s]+/, '').trim();
  if (!qui || !dit) return null;
  return { qui, dit, consigne };
}

export function dureeElements(elements: ElementScript[]): DetailDuree {
  let mots = 0;
  let didascalies = 0;
  let attentesReponse = 0;

  for (const e of elements) {
    switch (e.type) {
      case 'replique':
        mots += compterMots(e.texte);
        break;
      case 'adresse_public':
        mots += compterMots(e.texte);
        if (e.attenteReponse) attentesReponse++;
        break;
      case 'didascalie':
        didascalies++;
        break;
      // Une note n'est pas dite à voix haute — SAUF quand elle porte la voix
      // en coulisse d'un personnage sans marionnette, que le parent dit bel
      // et bien. Avec une seule peluche, tout un rôle passe par là (CDC §6),
      // et ne pas le compter faisait tomber la durée estimée à moins de la
      // moitié du réel : mesuré au relais, deux minutes annoncées pour un
      // spectacle de cinq.
      case 'note_marionnettiste':
        mots += compterMots(motsDitsEnCoulisse(e.texte));
        break;
      // Le conteur est dit à voix haute, par le parent : ses mots comptent.
      case 'conteur':
        mots += compterMots(e.texte);
        break;
      // Les entrées et sorties se font pendant le reste : elles ne consomment
      // pas de temps.
      default:
        break;
    }
  }

  const secondes =
    (mots / DUREE.motsParMinute) * 60
    + DUREE.secondesParDidascalie * didascalies
    + DUREE.secondesParAttenteReponse * attentesReponse;

  return { secondes: Math.round(secondes), mots, didascalies, attentesReponse };
}

/**
 * La part des mots dits qui vient du conteur, en pourcentage arrondi. Un
 * spectacle reste du théâtre, pas une lecture : l'écran de script l'affiche
 * pour qu'on la voie (CDC §6, « La dose »).
 */
export function partDuConteur(actes: Acte[]): number {
  let conteur = 0;
  let total = 0;
  for (const acte of actes) {
    for (const e of acte.elements) {
      if (e.type === 'conteur') conteur += compterMots(e.texte);
      total += dureeElements([e]).mots;
    }
  }
  return total ? Math.round((100 * conteur) / total) : 0;
}

/** Durée estimée d'un spectacle entier, en secondes. */
export function dureeSpectacle(actes: Acte[]): number {
  return actes.reduce((total, acte) => total + dureeElements(acte.elements).secondes, 0);
}

/** « 4 min 30 s », pour l'affichage. */
export function formaterDuree(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = Math.round(secondes % 60);
  if (minutes === 0) return `${reste} s`;
  if (reste === 0) return `${minutes} min`;
  return `${minutes} min ${reste} s`;
}

/**
 * Vrai si la durée tombe dans la tolérance autour de la cible (±20 % par
 * défaut). Sert au contrôle d'un acte comme du spectacle entier.
 */
export function dansLaTolerance(secondesReelles: number, secondesCibles: number): boolean {
  const ecart = Math.abs(secondesReelles - secondesCibles);
  return ecart <= secondesCibles * DUREE.toleranceActe;
}

/**
 * Budget de mots pour atteindre une durée visée, à répartir entre les actes
 * (CDC §6, étape 6). On raisonne en mots seuls : les forfaits des didascalies
 * et des attentes ne sont pas connus avant l'écriture.
 */
export function budgetMots(secondesCibles: number): number {
  return Math.round((secondesCibles / 60) * DUREE.motsParMinute);
}

/** Un acte qui dit nettement moins de mots que le découpage ne lui en prévoyait. */
export interface ActeCourt {
  numero: number;
  dits: number;
  prevus: number;
  /** Les mots qui manquent pour atteindre ce qui était prévu. */
  manque: number;
}

/**
 * Les actes courts, comptés en MOTS DITS contre le budget du découpage.
 *
 * Un modèle ne sait pas compter : au relais du 2026-09-27, les actes du
 * Chaperon disaient de 10 à 30 % de mots de moins que prévu, jusqu'à 64 mots
 * pour 150. La durée estimée ne le voyait pas, parce qu'elle ajoute 3 s par
 * didascalie et ne se juge que sur le spectacle entier. On compte donc ici
 * les mots seuls, acte par acte, et l'on donne l'écart au directeur éditorial,
 * qui complète avec le conte (CDC §6, « Budget de durée »).
 */
export function actesCourts(actes: Acte[], budgetsMots: Record<number, number>): ActeCourt[] {
  const courts: ActeCourt[] = [];
  for (const acte of actes) {
    const prevus = budgetsMots[acte.numero] ?? 0;
    if (prevus <= 0) continue;
    const dits = dureeElements(acte.elements).mots;
    if (dits >= prevus * DUREE.seuilActeCourt) continue;
    courts.push({ numero: acte.numero, dits, prevus, manque: prevus - dits });
  }
  return courts;
}
