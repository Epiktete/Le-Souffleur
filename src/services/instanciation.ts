// L'INSTANCIATION : d'un modèle du fonds à un spectacle de la famille.
//
// TOUT EST FAIT PAR LE CODE, sans aucun appel IA (décision du 2026-09-28) :
//
//   1. LES ACCORDS. Chaque modèle porte, calculée une fois à l'annotation
//      (banc/annoter.banc.ts), la version de l'autre genre de chaque rôle :
//      une liste de remplacements vérifiés. Quand le genre de la marionnette
//      diffère de celui du rôle d'origine, le code l'applique — tout ou rien
//      par rôle, jamais un texte à moitié accordé.
//   2. LES INTERACTIONS. Les adresses au public sont classées à l'annotation ;
//      le réglage du studio en garde une fraction : aucune (0), quelques
//      (la moitié), beaucoup (toutes). La durée estimée est recalculée.
//   3. LES NOMS. `peupler` (services/banque.ts) remplace les variables par
//      les noms des marionnettes, élisions comprises.
//
// Les mentions d'espèce suivent le mot ET le genre de la peluche, même
// quand seul le genre change. Seules les espèces imposées font barrière.

import type { Marionnette, NiveauInteraction, Spectacle } from '../types';
import { tba } from '../textes';
import {
  chargerModele,
  peupler,
  lignesModele,
  rendreMention,
  type SpectacleModele,
} from './banque';
import { dureeSpectacle } from './duree';
import { libelleEspece } from './choixContes';
import { genreMarionnette, type AttributionBanque, type Genre } from './appariement';

/** Erreur d'instanciation, déjà traduite pour l'utilisateur. */
export class ErreurInstanciation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurInstanciation';
  }
}

export interface OptionsInstanciation {
  /** Les genres choisis à l'écran (« il / elle ») pour les marionnettes muettes. */
  genresChoisis?: Partial<Record<string, Genre>>;
  /** Le réglage d'interaction du studio : la fraction d'adresses gardée. */
  interactionPublic?: NiveauInteraction;
}

export interface ResultatInstanciation {
  spectacle: Spectacle;
  /**
   * Ce qui n'a pas pu être adapté, en français : accords indisponibles pour
   * un rôle (modèle pas encore annoté, ou extrait qui ne correspond plus).
   * Vide dans le cas nominal.
   */
  avertissements: string[];
}

/**
 * Met les mentions d'espèce d'un rôle à l'espèce de la peluche : chaque
 * gabarit est rendu avec l'espèce et le genre cibles, puis appliqué. Tout ou
 * rien par rôle, avec la même tolérance que les accords pour un extrait
 * qu'un autre rôle aurait déjà transformé.
 */
function mettreALEspece(
  modele: SpectacleModele,
  cle: string,
  espece: string,
  genre: Genre,
): boolean {
  const role = modele.roles.find((r) => r.cle === cle);
  if (!role?.especeMentions) return false;
  const lignes = new Map(lignesModele(modele).map((l) => [l.id, l]));

  const rendus = role.especeMentions.map((m) => ({
    ...m,
    apres: rendreMention(m.gabarit, espece, genre),
  }));
  for (const r of rendus) {
    const ligne = lignes.get(r.id);
    if (!ligne) return false;
    const texte = ligne.lire();
    if (!texte.includes(r.avant) && !texte.includes(r.apres)) return false;
  }
  for (const r of rendus) {
    const ligne = lignes.get(r.id)!;
    ligne.ecrire(ligne.lire().split(r.avant).join(r.apres));
  }
  return true;
}

/**
 * Applique à un rôle du modèle sa version de l'autre genre. Tout ou rien :
 * chaque extrait est vérifié avant la première écriture.
 */
function basculerGenre(modele: SpectacleModele, cle: string): boolean {
  const role = modele.roles.find((r) => r.cle === cle);
  if (!role?.accords) return false;
  const lignes = new Map(lignesModele(modele).map((l) => [l.id, l]));

  // Deux rôles peuvent partager un extrait (« deux sœurs » → « deux enfants »
  // chez les Fées) : quand un autre rôle a déjà appliqué le même remplacement,
  // « avant » a disparu mais « apres » est là — c'est satisfait, pas cassé.
  for (const r of role.accords.remplacements) {
    const ligne = lignes.get(r.id);
    if (!ligne) return false;
    const texte = ligne.lire();
    if (!texte.includes(r.avant) && !texte.includes(r.apres)) return false;
  }
  for (const r of role.accords.remplacements) {
    const ligne = lignes.get(r.id)!;
    ligne.ecrire(ligne.lire().split(r.avant).join(r.apres));
  }
  return true;
}

/** Combien d'adresses au public garder, selon le réglage (CDC §7). */
export function adressesGardees(total: number, niveau: NiveauInteraction): number {
  if (niveau === 'aucune') return 0;
  if (niveau === 'quelques') return Math.ceil(total / 2);
  return total;
}

/**
 * Retire du modèle les adresses au public en trop : on garde les premières du
 * classement (les plus précieuses), on retire les autres.
 */
function reduireInteractions(modele: SpectacleModele, niveau: NiveauInteraction): void {
  const ordre = modele.interactionsOrdonnees;
  if (!ordre || ordre.length === 0) return;
  const gardees = new Set(ordre.slice(0, adressesGardees(ordre.length, niveau)));
  const retirees = new Set(ordre.filter((id) => !gardees.has(id)));
  for (const a of modele.actes) {
    a.elements = a.elements.filter((e) => !(e.type === 'adresse_public' && retirees.has(e.id)));
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
  options: OptionsInstanciation = {},
): Promise<ResultatInstanciation> {
  const charge = await chargerModele(modeleId);
  if (!charge) throw new ErreurInstanciation(tba.creation.introuvable);
  // Copie de travail : le module garde les fichiers du fonds en cache, et les
  // bascules d'accords ne doivent pas s'y accumuler d'une création à l'autre.
  return instancierModele(structuredClone(charge), distribution, marionnetheque, options);
}

/** Le travail lui-même, sur un modèle DÉJÀ à soi (jamais celui du cache). */
export function instancierModele(
  modele: SpectacleModele,
  distribution: AttributionBanque[],
  marionnetheque: Marionnette[],
  options: OptionsInstanciation = {},
): ResultatInstanciation {
  const marionnettes = distribution.map((d) =>
    marionnetheque.find((m) => m.id === d.marionnetteId));
  if (marionnettes.some((m) => m === undefined)) {
    // Une marionnette supprimée entre la distribution et le clic : rare, mais
    // `peupler` planterait plus bas avec un message de développeur.
    throw new ErreurInstanciation(tba.creation.echec);
  }
  const troupe = marionnettes as Marionnette[];

  const avertissements: string[] = [];

  // 1. L'espèce, rôle par rôle : le texte prend le mot de la peluche
  //    (décision du 2026-09-28). Un rôle sans mention n'a rien à changer.
  modele.roles.forEach((role, k) => {
    const m = troupe[k];
    if (!role.especeMentions?.length || !role.espece) return;
    const cible = libelleEspece(m);
    if (cible === null) {
      avertissements.push(tba.creation.especeInconnue(m.nom, role.espece));
      return;
    }
    const plat = (t: string) =>
      t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const genre = genreMarionnette(m) ?? options.genresChoisis?.[role.cle]
      ?? role.genre ?? 'masculin';
    // Les gabarits portent aussi les articles et adjectifs : le même mot
    // d'espèce ne dispense de les rendre que si le genre reste identique.
    if (plat(cible) === plat(role.espece) && genre === role.genre) return;
    if (!mettreALEspece(modele, role.cle, cible.trim().toLowerCase(), genre)) {
      avertissements.push(tba.creation.especeIndisponible(m.nom));
    }
  });

  // 2. Les accords, rôle par rôle.
  modele.roles.forEach((role, k) => {
    const m = troupe[k];
    const cible = genreMarionnette(m) ?? options.genresChoisis?.[role.cle] ?? null;
    const origine = role.genre ?? null;
    if (cible === null || cible === origine) return;
    if (origine !== null && role.accords?.vers === cible) {
      if (!basculerGenre(modele, role.cle)) {
        avertissements.push(tba.creation.accordsIndisponibles(m.nom));
      }
    } else {
      // Modèle pas encore annoté (ou genre d'origine inconnu) : le texte
      // garde les accords d'origine, et on le dit.
      avertissements.push(tba.creation.accordsIndisponibles(m.nom));
    }
  });

  // 3. Les interactions, selon le réglage du studio.
  reduireInteractions(modele, options.interactionPublic ?? modele.parametres.interactionPublic);

  // 4. Les noms, et la durée recalculée (des adresses ont pu partir).
  const spectacle = peupler(modele, troupe);
  spectacle.dureeEstimeeSecondes = dureeSpectacle(spectacle.actes);
  spectacle.parametres.interactionPublic = options.interactionPublic
    ?? modele.parametres.interactionPublic;

  return { spectacle, avertissements };
}
