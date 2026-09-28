// L'APPARIEMENT : quels spectacles du fonds sont jouables ici et maintenant ?
//
// Le mode Banque (CDC §7) ne pilote pas une écriture : il filtre. Ce module
// évalue chaque signature du fonds contre la troupe et les réglages du studio,
// et dit soit « jouable, et voici qui jouerait quoi », soit pourquoi pas —
// jamais un silence : l'interface compte et explique chaque écarté.
//
// La distribution réutilise le calcul du générateur (`meilleureDistribution`,
// couples interdits compris) à travers un PSEUDO-CONTE bâti depuis la
// signature : `choixContes.ts` n'est pas modifié.

import { BANQUE } from '../config';
import type { Marionnette } from '../types';
import type { Conte, RoleConte } from './repertoire';
import type { SignatureModele } from './banque';
import {
  compatibiliteEspece,
  especeMarionnette,
  familleRole,
  INTERDIT,
  meilleureDistribution,
  tailleIncompatible,
  type Famille,
} from './choixContes';

/** Un rôle d'une signature du fonds, tel que l'index le donne. */
type RoleSignature = SignatureModele['roles'][number];

/** Les réglages du studio qui servent de filtres (CDC §7). */
export interface ReglagesFiltre {
  dureeMinutes: number;
  ageAuditoire: number;
  nbMarionnettistes: 1 | 2;
}

/** Pourquoi un spectacle du fonds est écarté. */
export type Ecart =
  /** Déjà fait par cette famille : on ne le repropose pas (CDC §7). */
  | 'dejaJoue'
  /** Sa durée réelle dépasse la cible, tolérance comprise. */
  | 'duree'
  /** Son âge minimum conseillé dépasse l'âge réglé. */
  | 'age'
  /** Il demande deux marionnettistes, le réglage n'en donne qu'un. */
  | 'marionnettistes'
  /** Il a plus de rôles que de marionnettes disponibles. */
  | 'nombre'
  /** Aucune distribution sans couple interdit n'existe. */
  | 'distribution';

/** Qui tient un rôle du modèle : la clé du rôle, la marionnette dessus. */
export interface AttributionBanque {
  cle: string;
  marionnetteId: string;
}

/** Une signature évaluée : jouable avec sa distribution, ou écartée et dite. */
export interface ModeleEvalue {
  signature: SignatureModele;
  ecarts: Ecart[];
  /**
   * La meilleure distribution, DANS L'ORDRE DES RÔLES (r1, r2…) — l'ordre
   * qu'exige `peupler` — : la graine de l'écran de distribution. Null quand
   * le spectacle est écarté.
   */
  distribution: AttributionBanque[] | null;
}

/* ------------------------------------------------------------------ */
/* Le pseudo-conte                                                     */
/* ------------------------------------------------------------------ */

/**
 * La catégorie qu'aurait ce rôle dans une fiche de conte, retrouvée depuis sa
 * famille. Une famille inconnue devient « animal » : `familleRole` en fera un
 * rôle neutre (0,5 pour tout le monde), ce qui est le bon défaut quand on ne
 * sait rien.
 */
function categorieDe(famille: Famille | null): RoleConte['categorie'] {
  if (famille === 'enfant' || famille === 'adulte' || famille === 'vieux' || famille === 'noble') {
    return 'humain';
  }
  if (famille === 'feerique' || famille === 'monstre') return 'merveilleux';
  if (famille === 'objet') return 'objet';
  return 'animal';
}

function roleConteDe(r: RoleSignature): RoleConte {
  return {
    nom: r.espece ?? r.cle,
    espece: r.espece ?? '',
    categorie: categorieDe(r.famille),
    traits: [...r.traits],
    fonction: '',
    figurant: false,
  };
}

/**
 * Le pseudo-conte d'une signature : juste ce qu'il faut pour que
 * `meilleureDistribution` travaille. Tous ses rôles sont principaux — un
 * modèle du fonds n'a pas de figurant, chaque variable doit être tenue.
 */
export function conteDeSignature(s: SignatureModele): Conte {
  return {
    id: s.conteId,
    titre: s.titre,
    culture: '',
    source: '',
    genre: '',
    ageMin: s.ageAuditoire,
    ageMax: 10,
    personnages: s.roles.length,
    figurants: 0,
    roles: s.roles.map(roleConteDe),
    lieux: '',
    ressorts: '',
    structure: '',
    corps: '',
  };
}

/* ------------------------------------------------------------------ */
/* L'évaluation                                                        */
/* ------------------------------------------------------------------ */

export interface OptionsEvaluation {
  /**
   * Vrai quand la troupe est toute la Marionnethèque (scène vide) : les
   * marionnettes en trop restent au placard, comme au mode automatique.
   */
  facultatives: boolean;
  /** Les identifiants des modèles déjà instanciés par cette famille. */
  dejaJoues?: ReadonlySet<string>;
}

/**
 * Évalue une signature. Les écarts s'additionnent (un spectacle peut être à
 * la fois trop long et déjà joué) ; la distribution n'est calculée que si le
 * reste passe, elle est le dernier juge.
 */
export function evaluerModele(
  s: SignatureModele,
  troupe: Pick<Marionnette, 'id' | 'nom' | 'description' | 'traits'>[],
  reglages: ReglagesFiltre,
  options: OptionsEvaluation,
): ModeleEvalue {
  const ecarts: Ecart[] = [];

  if (options.dejaJoues?.has(s.id)) ecarts.push('dejaJoue');
  if (s.dureeEstimeeSecondes > reglages.dureeMinutes * 60 * (1 + BANQUE.toleranceDuree)) {
    ecarts.push('duree');
  }
  if (s.ageAuditoire > reglages.ageAuditoire) ecarts.push('age');
  if (s.nbMarionnettistes > reglages.nbMarionnettistes) ecarts.push('marionnettistes');
  if (s.roles.length > troupe.length) ecarts.push('nombre');

  if (ecarts.length > 0) return { signature: s, ecarts, distribution: null };

  const conte = conteDeSignature(s);
  const attributions = meilleureDistribution(troupe, conte, {
    facultatives: options.facultatives,
  });
  if (!attributions) return { signature: s, ecarts: ['distribution'], distribution: null };

  // De l'ordre des marionnettes à l'ordre des rôles. Les rôles du pseudo-conte
  // sont comparés par référence : deux rôles de même espèce (les deux sœurs
  // des Fées) restent distincts.
  const distribution = conte.roles.map((role, k): AttributionBanque | null => {
    const a = attributions.find((x) => x.role === role);
    return a ? { cle: s.roles[k].cle, marionnetteId: a.marionnetteId } : null;
  });
  if (distribution.some((d) => d === null)) {
    // Tous les rôles d'un modèle sont exigés : ne peut pas arriver, mais un
    // rôle sans marionnette ferait planter `peupler` — on écarte proprement.
    return { signature: s, ecarts: ['distribution'], distribution: null };
  }

  return { signature: s, ecarts: [], distribution: distribution as AttributionBanque[] };
}

/**
 * Cette marionnette peut-elle tenir ce rôle du fonds ? Le même juge que le
 * générateur (couples interdits, taille), pour la retouche manuelle de
 * l'écran de distribution.
 */
export function attributionPermise(
  marionnette: Pick<Marionnette, 'nom' | 'description'>,
  role: RoleSignature,
): boolean {
  const espece = especeMarionnette(marionnette);
  const roleConte = roleConteDe(role);
  if (compatibiliteEspece(espece, familleRole(roleConte)) === INTERDIT) return false;
  return !tailleIncompatible(espece, roleConte);
}

/** Évalue tout le fonds. L'ordre d'entrée est conservé. */
export function evaluerModeles(
  signatures: SignatureModele[],
  troupe: Pick<Marionnette, 'id' | 'nom' | 'description' | 'traits'>[],
  reglages: ReglagesFiltre,
  options: OptionsEvaluation,
): ModeleEvalue[] {
  return signatures.map((s) => evaluerModele(s, troupe, reglages, options));
}
