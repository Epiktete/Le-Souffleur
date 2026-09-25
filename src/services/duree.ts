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
