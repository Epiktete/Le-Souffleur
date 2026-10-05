// Mémoire des spectacles du fonds déjà faits par cette famille (CDC §7) :
// « on ne propose pas un spectacle déjà fait ». Même logement que l'historique
// des contes (localStorage), mais au niveau du MODÈLE : deux adaptations du
// même conte sont deux spectacles, refaire l'autre reste permis.
//
// Contrairement à l'historique des contes, ce n'est pas un malus mais un
// masque : l'interface cache le modèle et le compte parmi les écartés.

const CLE = 'souffleur.banque.joues';

export function lireModelesJoues(): Set<string> {
  try {
    const brut = localStorage.getItem(CLE);
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return new Set(Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function noterModeleJoue(id: string): void {
  const joues = lireModelesJoues();
  joues.add(id);
  try {
    localStorage.setItem(CLE, JSON.stringify([...joues]));
  } catch {
    // Stockage refusé (navigation privée) : le modèle pourra être reproposé.
  }
}
