// Interprétation des appuis pendant le spectacle (CDC §9).
//
// Les pédales tourne-pages du commerce envoient, selon les modèles, Espace,
// les flèches ou Page suivante : toutes ces touches sont acceptées.
//
// Deux pièges à éviter, qui ruineraient une représentation :
//   - la répétition automatique d'une touche maintenue enfoncée, qui ferait
//     défiler tout le spectacle d'un coup ;
//   - le rebond des pédales, qui envoient parfois deux appuis très rapprochés.
//
// La logique est isolée ici pour être testable sans navigateur, et réutilisée
// telle quelle par la page de test des touches.

import { PROMPTEUR } from '../config';

export type Commande = 'suivant' | 'precedent' | 'debut' | 'menu' | 'quitter'
  | 'plusGrand' | 'plusPetit' | null;

const SUIVANT = new Set([' ', 'Spacebar', 'ArrowRight', 'ArrowDown', 'PageDown', 'Enter']);
const PRECEDENT = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);

/** Traduit une touche en commande, sans tenir compte du rebond. */
export function commandeDe(touche: string): Commande {
  if (SUIVANT.has(touche)) return 'suivant';
  if (PRECEDENT.has(touche)) return 'precedent';
  if (touche === 'Home') return 'debut';
  if (touche === 'Escape') return 'quitter';
  if (touche === 'm' || touche === 'M') return 'menu';
  if (touche === '+' || touche === '=') return 'plusGrand';
  if (touche === '-' || touche === '_') return 'plusPetit';
  return null;
}

/** Pourquoi un appui a été ignoré, le cas échéant. */
export type Rejet = 'repetition' | 'rebond' | null;

/**
 * Filtre les appuis parasites.
 *
 * @param repetee   vrai si le navigateur signale une touche maintenue
 * @param instant   horodatage de l'appui, en millisecondes
 * @param precedent horodatage de l'appui retenu précédemment, ou null
 */
export function filtrer(
  repetee: boolean,
  instant: number,
  precedent: number | null,
): Rejet {
  if (repetee) return 'repetition';
  if (precedent !== null && instant - precedent < PROMPTEUR.antiRebondMs) return 'rebond';
  return null;
}

/**
 * L'anti-rebond ne vaut que pour les tours de page.
 *
 * Il existe pour absorber le rebond mécanique des pédales. L'appliquer à
 * « quitter » ou au menu serait un défaut : on appuierait sur Échap et rien ne
 * se passerait, sans comprendre pourquoi.
 */
export function soumisAuRebond(commande: Commande): boolean {
  return commande === 'suivant' || commande === 'precedent';
}

/**
 * Faut-il empêcher le comportement par défaut du navigateur ?
 * Espace et les flèches font défiler la page : pendant un spectacle, c'est
 * exactement ce qu'il ne faut pas.
 */
export function empecherDefaut(touche: string): boolean {
  return SUIVANT.has(touche) || PRECEDENT.has(touche) || touche === 'Home';
}

/**
 * Commande déduite d'un toucher : les deux tiers droits font avancer, le
 * tiers gauche fait reculer (CDC §9).
 */
export function commandeDuToucher(x: number, largeur: number): Commande {
  if (largeur <= 0) return null;
  return x < largeur / 3 ? 'precedent' : 'suivant';
}
