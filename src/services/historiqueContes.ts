// Mémoire des contes déjà rencontrés sur cet appareil, pour varier les
// propositions : sans elle, les mêmes peluches ramènent toujours les mêmes
// contes en tête du classement.
//
// Deux sortes de rencontres :
//   - « joue » : un spectacle a été écrit à partir de ce conte. Sa note perd
//     75 %.
//   - « propose » : le conte a été montré au parent parmi les trois synopsis,
//     sans être choisi. Sa note perd 30 % à chaque fois, sans descendre sous
//     30 % de sa valeur de départ.
// Seules les rencontres récentes comptent : la mémoire ne garde que les
// dernières, et un conte oublié retrouve sa place.

export type Rencontre = { conte: string; type: 'propose' | 'joue' };

export const MALUS = {
  /** Facteur appliqué à la note d'un conte déjà joué. */
  joue: 0.25,
  /** Facteur appliqué à chaque fois qu'un conte a été montré sans être choisi. */
  propose: 0.7,
  /**
   * Les présentations cumulées ne font pas descendre un conte sous ce
   * facteur. Un conte joué, lui, tombe à 0,25 : il doit céder la place.
   */
  plancher: 0.3,
  /** Nombre de rencontres gardées en mémoire, les plus récentes. */
  memoire: 60,
} as const;

const CLE = 'souffleur.contes.historique';

export function lireHistorique(): Rencontre[] {
  try {
    const brut = localStorage.getItem(CLE);
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste)
      ? liste.filter((r): r is Rencontre =>
        !!r && typeof r.conte === 'string' && (r.type === 'propose' || r.type === 'joue'))
      : [];
  } catch {
    return [];
  }
}

/** Ajoute des rencontres à la mémoire, en oubliant les plus anciennes. */
export function noterRencontres(contes: string[], type: Rencontre['type']) {
  const liste = [...lireHistorique(), ...contes.map((conte) => ({ conte, type }))];
  try {
    localStorage.setItem(CLE, JSON.stringify(liste.slice(-MALUS.memoire)));
  } catch {
    // Stockage refusé (navigation privée) : les propositions varieront moins.
  }
}

/**
 * Le facteur de chaque conte rencontré, entre 0 et 1. Un conte joué
 * n'est pas aussi compté comme « montré sans être choisi » : il l'a été.
 */
export function malusDe(historique: Rencontre[]): Record<string, number> {
  const joues = new Set(historique.filter((r) => r.type === 'joue').map((r) => r.conte));
  const facteurs: Record<string, number> = {};
  for (const r of historique) {
    if (r.type === 'propose' && joues.has(r.conte)) continue;
    if (r.type === 'joue') facteurs[r.conte] = (facteurs[r.conte] ?? 1) * MALUS.joue;
    else facteurs[r.conte] = Math.max(MALUS.plancher, (facteurs[r.conte] ?? 1) * MALUS.propose);
  }
  return facteurs;
}
