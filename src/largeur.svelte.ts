// Largeur de la fenêtre, partagée par l'en-tête et l'accueil (CDC §7).
// Isolée ici pour que les deux composants prennent la même décision sur les
// ruptures de layout, sans dupliquer l'écouteur de redimensionnement.

import { RUPTURES } from './config';

function creerLargeur() {
  let px = $state(typeof window === 'undefined' ? 1280 : window.innerWidth);

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => { px = window.innerWidth; });
  }

  return {
    get px() { return px; },
    /** Sous 1024 px : les colonnes latérales deviennent des tiroirs. */
    get etroit() { return px < RUPTURES.tiroirs; },
    /** Sous 700 px : navigation par onglets en bas d'écran. */
    get tresEtroit() { return px < RUPTURES.onglets; },
  };
}

export const largeur = creerLargeur();
