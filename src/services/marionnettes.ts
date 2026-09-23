// Règles métier des marionnettes : validation, création, duplication.
//
// La validation est isolée ici (et non dans le formulaire) pour deux raisons :
// elle est testable sans navigateur, et elle servira aussi à contrôler les
// données importées depuis un fichier JSON (CDC §12).

import { z } from 'zod';
import { BORNES } from '../config';
import { tb } from '../textes';
import type { Marionnette } from '../types';
import { nouvelId } from './db';

/**
 * Forme attendue du formulaire. Les messages sont ceux affichés à l'utilisateur :
 * en français, sans jargon.
 */
export const schemaSaisieMarionnette = z.object({
  nom: z
    .string()
    .trim()
    .min(BORNES.nomMarionnette.min, tb.erreurs.nomVide)
    .max(BORNES.nomMarionnette.max, tb.erreurs.nomTropLong),
  description: z
    .string()
    .trim()
    .max(BORNES.descriptionMarionnette.max, tb.erreurs.descriptionTropLongue),
  traits: z
    .array(z.string().trim().min(1))
    .min(BORNES.traitsMarionnette.min, tb.erreurs.traitsVides)
    .max(BORNES.traitsMarionnette.max, tb.erreurs.traitsTropNombreux),
  voix: z.string().trim().max(200, tb.erreurs.voixTropLongue),
});

export type SaisieMarionnette = z.infer<typeof schemaSaisieMarionnette>;

/** Résultat d'une validation : soit les champs par erreur, soit rien. */
export type ErreursSaisie = Partial<Record<keyof SaisieMarionnette, string>>;

/**
 * Valide une saisie et renvoie la première erreur de chaque champ.
 * Un seul message par champ suffit : en afficher plusieurs embrouille.
 */
export function validerSaisie(saisie: SaisieMarionnette): ErreursSaisie {
  const resultat = schemaSaisieMarionnette.safeParse(saisie);
  if (resultat.success) return {};

  const erreurs: ErreursSaisie = {};
  for (const probleme of resultat.error.issues) {
    const champ = probleme.path[0] as keyof SaisieMarionnette | undefined;
    if (champ && !erreurs[champ]) erreurs[champ] = probleme.message;
  }
  return erreurs;
}

/** Vrai si la saisie ne comporte aucune erreur. */
export function saisieValide(saisie: SaisieMarionnette): boolean {
  return Object.keys(validerSaisie(saisie)).length === 0;
}

/** Marionnette vierge, pour ouvrir le formulaire de création. */
export function marionnetteVierge(): Marionnette {
  const maintenant = new Date().toISOString();
  return {
    id: nouvelId(),
    nom: '',
    description: '',
    traits: [],
    voix: '',
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}

/**
 * Copie d'une marionnette, avec un nouvel identifiant et un nom distinct.
 * « Loulou » devient « Loulou (copie) », puis « Loulou (copie 2) », etc., sans
 * dépasser la longueur maximale du nom.
 */
export function dupliquerMarionnette(source: Marionnette, nomsExistants: string[]): Marionnette {
  const maintenant = new Date().toISOString();
  return {
    ...source,
    id: nouvelId(),
    nom: nomDeCopie(source.nom, nomsExistants),
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}

/** Cherche un nom de copie libre. Exporté pour être testable seul. */
export function nomDeCopie(nomSource: string, nomsExistants: string[]): string {
  const pris = new Set(nomsExistants.map((n) => n.toLowerCase()));
  const max = BORNES.nomMarionnette.max;

  for (let n = 1; n < 100; n++) {
    const marque = n === 1 ? ` (${tb.suffixeCopie})` : ` (${tb.suffixeCopie} ${n})`;
    // Le nom d'origine est tronqué si besoin pour que la marque tienne.
    const base = nomSource.slice(0, Math.max(1, max - marque.length));
    const candidat = base + marque;
    if (!pris.has(candidat.toLowerCase())) return candidat;
  }
  // Cas extrême : on retombe sur un nom forcément unique.
  return nomSource.slice(0, max - 6) + ' ' + Date.now().toString().slice(-4);
}

/** Initiales affichées sur la vignette de la marionnette (CDC §7). */
export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

/**
 * Filtre la bibliothèque sur le nom, la description et les traits.
 * La comparaison ignore la casse et les accents : « rusé » trouve « RUSE ».
 */
export function filtrerMarionnettes(liste: Marionnette[], recherche: string): Marionnette[] {
  const terme = sansAccents(recherche);
  if (!terme) return liste;
  return liste.filter((m) =>
    sansAccents(`${m.nom} ${m.description} ${m.traits.join(' ')} ${m.voix ?? ''}`).includes(terme),
  );
}

function sansAccents(texte: string): string {
  return texte
    .normalize('NFD')
    // Retire les signes diacritiques isolés par la décomposition NFD.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
