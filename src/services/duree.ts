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
      // Les notes au marionnettiste ne sont pas dites à voix haute, et les
      // entrées et sorties se font pendant le reste : ni l'une ni l'autre ne
      // consomment de temps.
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
