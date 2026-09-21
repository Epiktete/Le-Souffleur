// État du mode lecture : page courante, taille du texte, temps écoulé (CDC §9).
//
// La taille du texte est mémorisée par appareil : un parent qui a réglé son
// confort de lecture ne doit pas le refaire à chaque spectacle.
// La position est mémorisée elle aussi, pour proposer de reprendre là où l'on
// s'est arrêté.

import { PROMPTEUR } from '../config';
import { ecrireReglage, lireReglage } from '../services/db';
import type { Id } from '../types';

/** Positions mémorisées, par spectacle. Elles ne vivent que sur l'appareil. */
const CLE_POSITIONS = 'le-souffleur-positions';

function lirePositions(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLE_POSITIONS) ?? '{}');
  } catch {
    return {};
  }
}

function ecrirePositions(positions: Record<string, number>) {
  try {
    localStorage.setItem(CLE_POSITIONS, JSON.stringify(positions));
  } catch {
    // Stockage refusé (navigation privée) : on se passe de la reprise.
  }
}

function creerLecture() {
  let page = $state(0);
  let taillePx = $state<number>(PROMPTEUR.taillePxDefaut);
  let inverse = $state(false);
  /** Identifiant de la première rangée affichée, repère de redécoupage. */
  let rangeeAncre = $state<Id | null>(null);

  let debut = $state<number | null>(null);
  let secondes = $state(0);
  let spectacleId: Id | null = null;
  let horloge: ReturnType<typeof setInterval> | undefined;

  function enregistrerPosition() {
    if (!spectacleId) return;
    const positions = lirePositions();
    positions[spectacleId] = page;
    ecrirePositions(positions);
  }

  return {
    get page() { return page; },
    get taillePx() { return taillePx; },
    get inverse() { return inverse; },
    get rangeeAncre() { return rangeeAncre; },

    /** « 4:07 », temps depuis le début de la représentation. */
    get tempsEcoule() {
      const m = Math.floor(secondes / 60);
      const s = secondes % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    },

    /** Position mémorisée pour ce spectacle, ou 0. */
    positionMemorisee(id: Id): number {
      return lirePositions()[id] ?? 0;
    },

    /** Ouvre le mode lecture pour un spectacle. */
    async commencer(id: Id, reprendre: boolean) {
      spectacleId = id;
      page = reprendre ? this.positionMemorisee(id) : 0;
      rangeeAncre = null;
      secondes = 0;
      debut = Date.now();

      clearInterval(horloge);
      horloge = setInterval(() => {
        if (debut !== null) secondes = Math.floor((Date.now() - debut) / 1000);
      }, 1000);

      try {
        const memorisee = await lireReglage('taillePrompteur');
        if (memorisee) taillePx = memorisee;
      } catch {
        // Réglage indisponible : on garde la taille par défaut.
      }
    },

    arreter() {
      clearInterval(horloge);
      horloge = undefined;
      debut = null;
      enregistrerPosition();
      spectacleId = null;
    },

    allerA(nouvelle: number) {
      page = Math.max(0, nouvelle);
      enregistrerPosition();
    },

    memoriserAncre(id: Id) { rangeeAncre = id; },

    agrandir() { this.definirTaille(taillePx + 4); },
    reduire() { this.definirTaille(taillePx - 4); },

    definirTaille(px: number) {
      taillePx = Math.min(PROMPTEUR.taillePxMax, Math.max(PROMPTEUR.taillePxMin, px));
      void ecrireReglage('taillePrompteur', taillePx).catch(() => {});
    },

    basculerInverse() { inverse = !inverse; },
  };
}

export const lecture = creerLecture();
