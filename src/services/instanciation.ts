// L'INSTANCIATION : d'un modèle du fonds à un spectacle de la famille.
//
// La voie nominale est SANS IA : `peupler` (services/banque.ts) remplace les
// variables par les noms des marionnettes, élisions comprises, et reconstruit
// le dossier. La retouche d'accords par un petit modèle — quand le genre
// grammatical ou l'espèce citée divergent — se branchera ici (étape F du
// chantier « la banque », CDC §7).

import type { Marionnette, Spectacle } from '../types';
import { tba } from '../textes';
import { chargerModele, peupler } from './banque';
import type { AttributionBanque } from './appariement';

/** Erreur d'instanciation, déjà traduite pour l'utilisateur. */
export class ErreurInstanciation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurInstanciation';
  }
}

/**
 * Crée un spectacle depuis un modèle du fonds et une distribution.
 *
 * La distribution est DANS L'ORDRE DES RÔLES (r1, r2…), telle que l'écran de
 * distribution la rend : c'est l'ordre que `peupler` exige.
 */
export async function instancier(
  modeleId: string,
  distribution: AttributionBanque[],
  marionnetheque: Marionnette[],
): Promise<Spectacle> {
  const modele = await chargerModele(modeleId);
  if (!modele) throw new ErreurInstanciation(tba.creation.introuvable);

  const marionnettes = distribution.map((d) =>
    marionnetheque.find((m) => m.id === d.marionnetteId));
  if (marionnettes.some((m) => m === undefined)) {
    // Une marionnette supprimée entre la distribution et le clic : rare, mais
    // `peupler` planterait plus bas avec un message de développeur.
    throw new ErreurInstanciation(tba.creation.echec);
  }

  return peupler(modele, marionnettes as Marionnette[]);
}
