// État du mini tutoriel : la fenêtre en trois étapes, et la carte « Premiers
// pas » du studio.
//
// Que la carte soit masquée est une préférence de confort, propre à cet
// appareil : elle est gardée dans le localStorage, et tout accès est protégé —
// en navigation privée il peut échouer, et la carte réapparaît simplement.

import { ttu } from '../textes';

const CLE_CARTE_MASQUEE = 'souffleur.premiersPas.masques';

function lireMasquee(): boolean {
  try {
    return localStorage.getItem(CLE_CARTE_MASQUEE) === 'oui';
  } catch {
    return false;
  }
}

function creerTutoriel() {
  let ouvert = $state(false);
  let etape = $state(0);
  let carteMasquee = $state(lireMasquee());
  const total = ttu.etapes.length;

  return {
    get ouvert() { return ouvert; },
    /** Numéro de l'étape affichée, à partir de 0. */
    get etape() { return etape; },
    get total() { return total; },
    get carteMasquee() { return carteMasquee; },

    ouvrir(depuis = 0) {
      etape = Math.min(Math.max(depuis, 0), total - 1);
      ouvert = true;
    },
    fermer() {
      ouvert = false;
    },
    suivante() {
      if (etape < total - 1) etape++;
      else ouvert = false;
    },
    precedente() {
      if (etape > 0) etape--;
    },
    allerA(n: number) {
      etape = Math.min(Math.max(n, 0), total - 1);
    },

    masquerCarte() {
      carteMasquee = true;
      try {
        localStorage.setItem(CLE_CARTE_MASQUEE, 'oui');
      } catch {
        // Stockage refusé : la carte reviendra à la prochaine visite.
      }
    },
  };
}

export const tutoriel = creerTutoriel();
