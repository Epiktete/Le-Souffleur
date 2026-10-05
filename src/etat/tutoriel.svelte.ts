// État du mini tutoriel : la fenêtre en trois écrans ouverte par « Aide ».

import { ttu } from '../textes';

function creerTutoriel() {
  let ouvert = $state(false);
  let etape = $state(0);
  const total = ttu.etapes.length;

  return {
    get ouvert() { return ouvert; },
    /** Numéro de l'étape affichée, à partir de 0. */
    get etape() { return etape; },
    get total() { return total; },

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

  };
}

export const tutoriel = creerTutoriel();
