// Étape P du pipeline (CDC §6) : le dossier.
//
// C'est l'application qui le construit, à partir de l'ébauche du parent, des
// fiches des marionnettes et des réglages du studio. Il est le point de départ
// de TOUS les appels : chaque étape reçoit le dossier plus les seules parties
// de la bible qui lui sont utiles.
//
// C'est le principe « une bible, pas une conversation » : on évite un
// historique qui grossit à chaque tour, et les propositions écartées qui
// parasiteraient l'écriture.

import { budgetMots } from './duree';
import type { Marionnette, NiveauInteraction, ParametresGeneration } from '../types';

/** Fiche d'une marionnette, telle qu'envoyée au modèle. Jamais la photo (§12). */
export interface FicheMarionnette {
  nom: string;
  description: string;
  traits: string[];
  voix?: string;
}

export interface Dossier {
  marionnettes: FicheMarionnette[];
  dureeMinutes: number;
  ageAuditoire: number;
  nbMarionnettistes: 1 | 2;
  interactionPublic: NiveauInteraction;
  ebauche?: string;
  /** Budget de mots dits pour le spectacle entier. */
  budgetMotsTotal: number;
}

/**
 * Construit le dossier. Les photos ne sont jamais incluses : le CDC §12
 * interdit de les envoyer au fournisseur en V1.
 */
export function construireDossier(
  marionnettes: Marionnette[],
  parametres: Omit<ParametresGeneration, 'modele' | 'marionnetteIds'>,
): Dossier {
  return {
    marionnettes: marionnettes.map((m) => ({
      nom: m.nom,
      description: m.description,
      traits: [...m.traits],
      voix: m.voix,
    })),
    dureeMinutes: parametres.dureeMinutes,
    ageAuditoire: parametres.ageAuditoire,
    nbMarionnettistes: parametres.nbMarionnettistes,
    interactionPublic: parametres.interactionPublic,
    ebauche: parametres.ebauche?.trim() || undefined,
    budgetMotsTotal: budgetMots(parametres.dureeMinutes * 60),
  };
}

/**
 * Retrouve l'identifiant d'une marionnette à partir du nom renvoyé par le
 * modèle. La comparaison ignore la casse, les accents et les espaces en trop :
 * un modèle écrit « doudou lapin » là où la fiche dit « Doudou Lapin ».
 *
 * Renvoie undefined si le nom ne correspond à personne, ce qui est un problème
 * à signaler et non à deviner.
 */
export function trouverMarionnetteId(
  nom: string,
  distribution: Marionnette[],
): string | undefined {
  const cible = normaliser(nom);
  const exact = distribution.find((m) => normaliser(m.nom) === cible);
  if (exact) return exact.id;

  // Repli : le modèle a pu n'écrire que le premier mot (« Doudou » pour
  // « Doudou Lapin »). On n'accepte ce repli que s'il est sans ambiguïté.
  const partiels = distribution.filter(
    (m) => normaliser(m.nom).startsWith(cible) || cible.startsWith(normaliser(m.nom)),
  );
  return partiels.length === 1 ? partiels[0].id : undefined;
}

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
