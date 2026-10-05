// État de la visite guidée de la première fois : une suite de bulles, chacune
// pointée vers une zone de l'écran. Trois séquences, jouées chacune une seule
// fois, au moment où l'on arrive pour la première fois sur l'écran concerné.
// Ce qui a déjà été vu est retenu sur cet appareil (localStorage).

import { tv } from '../textes';

export type Sequence = keyof typeof tv.sequences;

const CLE = 'souffleur.visite.vues';

function lireVues(): Sequence[] {
  try {
    const brut = localStorage.getItem(CLE);
    const vues: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(vues) ? vues.filter((v): v is Sequence => v in tv.sequences) : [];
  } catch {
    return [];
  }
}

function ecrireVues(vues: Sequence[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify(vues));
  } catch {
    // Stockage refusé (navigation privée) : la visite reviendra, sans gravité.
  }
}

function creerVisite() {
  let sequence = $state<Sequence | null>(null);
  let etape = $state(0);

  const bulles = $derived(sequence ? tv.sequences[sequence] : []);

  return {
    get sequence() { return sequence; },
    get etape() { return etape; },
    /** La bulle affichée, ou null quand aucune visite n'est en cours. */
    get bulle() { return bulles[etape] ?? null; },

    /** Lance une séquence si elle n'a jamais été vue sur cet appareil. */
    lancer(nom: Sequence) {
      if (sequence || lireVues().includes(nom)) return;
      sequence = nom;
      etape = 0;
    },
    suivante() {
      if (etape < bulles.length - 1) etape++;
      else this.terminer();
    },
    /** Termine la séquence en cours et la retient comme vue. */
    terminer() {
      if (!sequence) return;
      const vues = lireVues();
      if (!vues.includes(sequence)) ecrireVues([...vues, sequence]);
      sequence = null;
      etape = 0;
    },
  };
}

export const visite = creerVisite();
