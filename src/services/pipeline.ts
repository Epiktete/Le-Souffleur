// Orchestration du pipeline de génération (CDC §6).
//
// Le générateur n'invente pas d'histoire : il part d'un conte de la
// contothèque (wiki/), choisi pour les marionnettes de la famille, et l'adapte
// en lui restant fidèle.
//
// Deux phases pour le parent :
//
//   « Proposer des histoires »
//     1. le CHOIX DES CONTES, fait par l'application : deux barrières (âge,
//        nombre de personnages), puis une note pondérée — nombre, traits,
//        ébauche, durée, espèce (voir choixContes.ts) ;
//     2. un appel : le modèle retient trois contes parmi les huit meilleurs,
//        et écrit pour chacun un synopsis que le parent lit sur une carte.
//
//   L'espèce de chaque personnage dans le texte est calculée par
//   l'application (une marionnette animale garde son espèce) et imposée au
//   modèle à toutes les étapes. La durée n'est qu'une indication : la fin du
//   conte se joue toujours en entier.
//
//   « Écrire le script », après le choix du parent, en trois passes :
//     PASSE 1, la transposition : un appel récrit le texte intégral du conte
//        en remplaçant les personnages par les marionnettes, et ne change que
//        ce que ce remplacement impose (plus ce qui a mal vieilli) ;
//     PASSE 2, la mise en scène : un appel découpe le texte transposé en
//        tableaux et en actes, puis un appel par acte l'écrit — les paroles du
//        texte reprises telles quelles, la narration devenue didascalies,
//        effets de scène et apartés ;
//     PASSE 3, la revue : contrôles automatiques, puis le directeur
//        éditorial, qui lit le conte d'origine et le script, dresse la liste
//        de ses remarques (compréhension, cohérence, fidélité, place des
//        didascalies et des apartés) et réécrit lui-même chaque acte
//        concerné ; puis l'assemblage.
//
// Chaque étape est un appel indépendant. L'application maintient la bible, qui
// s'enrichit du résultat de chaque étape ; chaque appel reçoit le dossier plus
// les seules parties utiles.

import { IA } from '../config';
import {
  promptCorrectionActe,
  promptDecoupage,
  promptTransposition,
  promptEcrireActe,
  promptRelecture,
  promptSynopsis,
} from '../prompts';
import { appelerModele, ErreurIa, type Acces, type Jetons } from './connecteurIa';
import { construireDossier, dossierPour, trouverMarionnetteId, type Dossier } from './dossier';
import { budgetMots, dureeElements, dureeSpectacle } from './duree';
import {
  choisirContes,
  especeDansLeTexte,
  especeMarionnette,
  roleParNom,
  type Candidat,
} from './choixContes';
import { extraireJson } from './jsonLlm';
import { conteParId, reference, texteDuConte, type Conte } from './repertoire';
import { lireHistorique, malusDe } from './historiqueContes';
import {
  attribuerMains,
  controler,
  MARQUE_A_CORRIGER,
  simulerActe,
  type EtatScene,
  type Probleme,
} from './scene';
import {
  schemaActeEcrit,
  schemaAdaptation,
  schemaRelecture,
  schemaSynopsisPour,
  schemaTransposition,
  valider,
  type Adaptation,
  type Conduite,
  type ElementEcrit,
  type Synopsis,
  type Transposition,
  type Relecture,
} from './schemas';
import { compterMots } from './mots';
import { nouvelId } from './db';
import { t } from '../textes';
import type {
  Acte,
  ElementScript,
  Main,
  Marionnette,
  MarionnetteDistribuee,
  ParametresGeneration,
  Spectacle,
  Tableau,
} from '../types';
import type { z } from 'zod';

/**
 * Budget de SORTIE par étape, en jetons.
 *
 * Attention au contresens : ce n'est pas une dépense, c'est un plafond. On ne
 * paie que ce que le modèle écrit vraiment. Un plafond trop bas, en revanche,
 * coûte très cher : un modèle à raisonnement épuise le budget en réflexion,
 * ne rend aucun texte, et l'essai entier est facturé pour rien avant qu'on ne
 * relance avec le double.
 *
 * Mesuré sur le banc avec Sonnet 5 : l'étape des synopsis avait consommé
 * 24 784 jetons de sortie pour un JSON qui en fait moins de 2 500 — un premier
 * essai perdu, puis un second réussi. Des plafonds larges dès le départ font
 * donc BAISSER la facture et suppriment un appel, donc de l'attente.
 */
const BUDGETS = {
  synopsis: 32000,
  /** Un plancher : il grandit avec la longueur du conte (voir ecrireScript). */
  transposition: 32000,
  adaptation: 32000,
  ecriture: 24000,
  relecture: 24000,
} as const;

/**
 * Températures par étape. Basses : il ne s'agit pas d'inventer mais d'adapter,
 * et la fantaisie du modèle est précisément ce qui éloigne du conte.
 */
const TEMPERATURES = {
  synopsis: 0.7,
  transposition: 0.3,
  decoupage: 0.4,
  ecriture: 0.5,
  relecture: 0.2,
  correction: 0.5,
} as const;

/**
 * Les étapes, dans l'ordre du pipeline (CDC §7).
 *
 * C'est une VALEUR et pas seulement un type : l'interface doit pouvoir
 * vérifier qu'elle les affiche toutes. « propositions » est l'étape des
 * synopsis, « construction » celle du découpage.
 */
export const NOMS_ETAPES = [
  'propositions',
  'transposition',
  'construction',
  'ecriture',
  'controles',
  'relecture',
  'corrections',
  'assemblage',
] as const;

/** Nom d'étape affiché dans la barre de progression (CDC §7). */
export type NomEtape = (typeof NOMS_ETAPES)[number];

export interface Avancement {
  etape: NomEtape;
  /** Numéro de l'acte en cours d'écriture, le cas échéant. */
  acte?: number;
  actesTotal?: number;
  /**
   * Numéro de l'appel en cours DANS cette étape, à partir de 2. Sans ce
   * compteur, une cascade de reprises est indiscernable d'un modèle lent.
   */
  essai?: number;
  /** Pourquoi l'étape recommence, en deux mots, pour l'affichage. */
  raisonReprise?: string;
}

export interface OptionsPipeline {
  acces: Acces;
  signal: AbortSignal;
  surAvancement: (a: Avancement) => void;
  /** Appelé quand l'étape en cours doit refaire un appel. */
  surReprise?: (raison: string) => void;
}

/** Jetons cumulés sur toute une génération (CDC §10). */
export function cumulerJetons(total: Jetons, ajout?: Jetons): Jetons {
  if (!ajout) return total;
  return {
    entree: (total.entree ?? 0) + (ajout.entree ?? 0),
    sortie: (total.sortie ?? 0) + (ajout.sortie ?? 0),
    total: (total.total ?? 0) + (ajout.total ?? 0),
  };
}

/**
 * Un appel au modèle, dont la réponse est lue et validée.
 * En cas de JSON invalide, une relance renvoie au modèle le message d'erreur
 * précis (CDC §6, « Lecture des réponses »).
 */
async function appelJson<T>(
  o: OptionsPipeline,
  prompts: { system: string; user: string },
  schema: z.ZodType<T>,
  temperature: number,
  maxTokens: number,
  /** Nom de l'étape, pour le journal de diagnostic. */
  etape: string,
): Promise<{ valeur: T; jetons?: Jetons }> {
  let dernierProbleme = '';
  let tronquee = false;
  let budget = maxTokens;
  let jetonsCumules: Jetons = {};

  // Une relance de plus est accordée aux troncatures : elles se corrigent en
  // augmentant le budget, pas en réexpliquant le format au modèle.
  const essaisMax = IA.relancesJsonMax + 1;

  for (let essai = 0; essai <= essaisMax; essai++) {
    const user = essai === 0 || tronquee
      ? prompts.user
      : `${prompts.user}\n\nTa réponse précédente était invalide : ${dernierProbleme}\n`
        + 'Renvoie uniquement un objet JSON conforme au format demandé.';

    let reponse;
    try {
      reponse = await appelerModele(
        o.acces,
        [{ role: 'system', content: prompts.system }, { role: 'user', content: user }],
        { temperature, maxTokens: budget, signal: o.signal },
      );
    } catch (e) {
      if (e instanceof ErreurIa && e.message === t.erreursIa.reponseTronquee && essai < essaisMax) {
        journaliserEchec(etape, essai, 'réponse vide, budget épuisé', '', budget);
        o.surReprise?.('réponse vide');
        budget *= 2;
        tronquee = true;
        continue;
      }
      throw e;
    }

    jetonsCumules = cumulerJetons(jetonsCumules, reponse.jetons);

    if (reponse.tronquee) {
      journaliserEchec(etape, essai, `coupée (${reponse.motifArret})`, reponse.texte, budget);
      o.surReprise?.('réponse coupée');
      budget *= 2;
      tronquee = true;
      dernierProbleme = 'la réponse a été coupée avant la fin';
      continue;
    }
    tronquee = false;

    const extrait = extraireJson(reponse.texte);
    if (!extrait.ok) {
      journaliserEchec(etape, essai, extrait.erreur, reponse.texte, budget);
      o.surReprise?.('JSON illisible');
      dernierProbleme = extrait.erreur;
      continue;
    }

    const controle = valider(schema, extrait.valeur);
    if (controle.ok) return { valeur: controle.valeur, jetons: jetonsCumules };

    journaliserEchec(etape, essai, controle.erreur, reponse.texte, budget);
    o.surReprise?.('réponse hors format');
    dernierProbleme = controle.erreur;
  }

  throw new ErreurIa(
    tronquee ? t.erreursIa.reponseTronquee : t.erreursIa.jsonInvalide,
    { etape, dernierProbleme },
  );
}

/**
 * Journalise un échec d'étape dans la console. Ne contient jamais la clé API :
 * seuls le nom de l'étape, la cause et un extrait de la réponse y figurent.
 */
function journaliserEchec(etape: string, essai: number, cause: string, texte: string, budget: number) {
  console.warn(
    `Le Souffleur — étape « ${etape} », essai ${essai + 1} : ${cause}. `
    + `Budget de ${budget} jetons. Début de la réponse : `
    + `${JSON.stringify(texte.slice(0, 300))}`,
  );
}

/* ================================================================== */
/* Phase 1 : proposer trois histoires                                  */
/* ================================================================== */

export interface PropositionsResultat {
  dossier: Dossier;
  /** Les contes retenus par le score et montrés au modèle. Pour la bible. */
  presentes: string[];
  /** Combien de contes passaient les barrières (âge et nombre). */
  jouables: number;
  /** Les trois synopsis, dans l'ordre de préférence du modèle. */
  retenues: Synopsis[];
  /**
   * Mode automatique : qui joue, conte par conte. La scène étant vide, la
   * distribution n'est connue qu'après le choix du conte — et elle diffère
   * d'un candidat à l'autre. Vide quand le parent a garni la scène lui-même.
   */
  distributionParConte: Record<string, Marionnette[]>;
  jetons: Jetons;
}

/**
 * Phase 1 : le choix des contes par l'application, puis trois synopsis.
 *
 * Le paramètre `dejaVu` sert au bouton « Proposer 3 autres histoires » : les
 * contes déjà montrés sont exclus, et d'autres remontent.
 */
export async function proposerHistoires(
  marionnettes: Marionnette[],
  parametres: Omit<ParametresGeneration, 'modele' | 'marionnetteIds'>,
  o: OptionsPipeline,
  dejaVu?: { dossier: Dossier; contes: string[]; titres: string[] },
  /**
   * La Marionnethèque entière, quand la scène est vide : l'outil choisit le
   * conte d'abord, puis qui le joue. Le dossier est alors bâti sur la RÉUNION
   * des marionnettes retenues sur les huit candidats, jamais sur le vivier
   * entier — sinon le prompt enfle et le modèle mélange les peluches.
   */
  vivier?: Marionnette[],
): Promise<PropositionsResultat> {
  o.surAvancement({ etape: 'propositions' });

  const reglages = dejaVu?.dossier ?? construireDossier(vivier ?? marionnettes, parametres);
  const choix = choisirContes(marionnettes, {
    ageAuditoire: reglages.ageAuditoire,
    dureeMinutes: reglages.dureeMinutes,
    nbMarionnettistes: reglages.nbMarionnettistes,
    exclus: dejaVu?.contes,
    ebauche: reglages.ebauche,
    // Les contes déjà joués ou déjà montrés sur cet appareil reculent.
    malus: malusDe(lireHistorique()),
    vivier,
  });
  // Moins de trois contes : le répertoire est épuisé pour ces marionnettes,
  // après trois séries de relances. Ce n'est pas une panne du modèle.
  if (choix.candidats.length < 3) throw new ErreurIa(t.erreursIa.repertoireEpuise);

  const ids = choix.candidats.map((c) => c.conte.id);

  // Qui joue, conte par conte. Sur une scène garnie, c’est toujours la même
  // troupe ; avec le vivier, elle change d’un candidat à l’autre.
  const parId = new Map((vivier ?? marionnettes).map((m) => [m.id, m]));
  const distributionParConte: Record<string, Marionnette[]> = {};
  for (const c of choix.candidats) {
    distributionParConte[c.conte.id] = c.distribution
      .map((a) => parId.get(a.marionnetteId))
      .filter((m): m is Marionnette => m !== undefined);
  }

  // Le dossier ne décrit que les marionnettes capables de jouer l’un des huit
  // contes retenus : la réunion des distributions, jamais la Marionnethèque
  // entière — sinon le prompt enfle et le modèle mélange les peluches.
  const surScene = vivier
    ? vivier.filter((m) => Object.values(distributionParConte).some((d) => d.some((x) => x.id === m.id)))
    : marionnettes;
  const dossier = dejaVu?.dossier ?? construireDossier(surScene, parametres);

  const r = await appelJson(
    o,
    promptSynopsis(
      dossier,
      choix.candidats.map((c) => formaterCandidat(c, surScene, dossier.budgetMotsTotal))
        .join('\n\n'),
      dejaVu?.titres ?? [],
      Boolean(vivier),
    ),
    schemaSynopsisPour(ids, surScene.map((m) => m.nom)),
    TEMPERATURES.synopsis,
    BUDGETS.synopsis,
    'synopsis',
  );

  const retenues: Synopsis[] = r.valeur.synopsis.slice(0, 3).map((s) => {
    const conte = conteParId(s.conte)!;
    return {
      ...s,
      id: s.conte,
      reference: reference(conte),
      // Les noms sont remis dans leur graphie exacte : le modèle écrit parfois
      // « doudou lapin » là où la fiche dit « Doudou Lapin ».
      distribution: s.distribution.map((d) => ({
        ...d,
        marionnette: surScene.find((m) => m.id === trouverMarionnetteId(d.marionnette, surScene))?.nom
          ?? d.marionnette,
      })),
    };
  });

  return {
    dossier,
    presentes: ids,
    jouables: choix.jouables,
    retenues,
    distributionParConte: vivier ? distributionParConte : {},
    jetons: r.jetons ?? {},
  };
}

/** Ce que la longueur du conte demande, dit en une ligne au modèle. */
export function longueurConte(motsConte: number, motsSpectacle: number): string {
  if (!motsConte) return 'Longueur du conte inconnue.';
  const r = motsConte / Math.max(1, motsSpectacle);
  // Quatre verdicts et non trois : un conte plus COURT que le spectacle
  // recevait « on le joue, en coupant au plus un épisode », alors qu'il faut
  // l'étoffer. Le modèle devait deviner que la formule ne s'appliquait pas.
  const verdict = r < 0.7
    ? 'il faudra le jouer plus longuement qu’il ne se raconte'
    : r <= 1.1
      ? 'presque la bonne taille : on le joue tel quel, sans rien couper'
      : r <= 3
        ? 'un peu plus long que le spectacle : on le joue en coupant au plus un épisode'
        : 'il faudra supprimer des épisodes entiers';
  return `Le conte fait environ ${motsConte} mots ; le spectacle en dira environ ${motsSpectacle} : ${verdict}.`;
}

/**
 * Un conte retenu, tel que le modèle le lit pour choisir : sa longueur, ses
 * rôles, la distribution proposée par l'application avec ce que devient
 * l'espèce de chaque personnage, et le corps de sa fiche.
 */
export function formaterCandidat(c: Candidat, marionnettes: Marionnette[], motsSpectacle: number): string {
  const k = c.conte;
  const roles = k.roles
    .map((r) => `  - ${r.nom} (${r.espece}) : ${r.traits.join(', ') || '—'}`
      + `${r.figurant ? ' — figurant' : ''}`)
    .join('\n');
  const distribution = c.distribution
    .map((a) => {
      const m = marionnettes.find((x) => x.id === a.marionnetteId);
      const espece = m ? especeDansLeTexte(m, a.role, true) : null;
      return `  - ${a.marionnetteNom} joue ${a.role.nom}`
        + (espece ? ` [${espece}]` : '')
        + (a.communs.length ? ` (en commun : ${a.communs.join(', ')})` : '');
    })
    .join('\n');
  // Un rôle PRINCIPAL sans marionnette n'arrive qu'avec une seule marionnette
  // pour un conte à deux : il ne se supprime pas, il se joue à la voix.
  const principaux = c.sansMarionnette.filter((r) => !r.figurant);
  const figurants = c.sansMarionnette.filter((r) => r.figurant);
  const sans = (principaux.length
    ? `\nRôle principal sans marionnette, joué à la voix depuis la coulisse par le parent : `
      + principaux.map((r) => r.nom).join(', ')
    : '')
    + (figurants.length
      ? `\nRôles sans marionnette, à supprimer, fondre ou laisser en coulisse : `
        + figurants.map((r) => r.nom).join(', ')
      : '');
  return `### ${k.id} — ${k.titre}
Origine : ${k.culture}. ${k.source}.
${capitale(k.genre)}, pour les ${k.ageMin}-${k.ageMax} ans. ${k.personnages} rôle(s) principal(aux), ${k.figurants} figurant(s).
${longueurConte(c.mots, motsSpectacle)}
Rôles du conte :
${roles}
Distribution proposée :
${distribution}${sans}

${k.corps}`;
}

/**
 * L'espèce de chaque personnage dans le texte, pour la distribution choisie
 * par le parent. Calculée par l'application et imposée au modèle : il ne doit
 * jamais écrire « Petit Dragon le renard ».
 */
/**
 * Quand le conte fait de deux personnages des SOSIES et que les marionnettes
 * ne se ressemblent plus.
 *
 * « Le Lièvre et le Hérisson » tient dans une ruse : la femme du hérisson lui
 * ressemble trait pour trait, et le lièvre s'y trompe. Le conte donne donc la
 * même espèce aux deux rôles. Si le parent n'a qu'une tortue et un pingouin,
 * la ruse s'effondre en silence — le lièvre n'a plus aucune raison de se
 * tromper, et personne ne le dit au modèle.
 *
 * On le lui dit, et on lui laisse le soin de remotiver la ressemblance.
 */
function sosiesRompus(conte: Conte, s: Synopsis, marionnettes: Marionnette[]): string {
  const parEspece = new Map<string, { role: string; nom: string; espece: string | null }[]>();
  for (const d of s.distribution) {
    const role = roleParNom(conte, d.role);
    if (!role) continue;
    const m = marionnettes.find((x) => x.id === trouverMarionnetteId(d.marionnette, marionnettes));
    if (!m) continue;
    const cle = role.espece.toLowerCase().trim();
    parEspece.set(cle, [
      ...(parEspece.get(cle) ?? []),
      { role: role.nom, nom: m.nom, espece: especeMarionnette(m)?.mot ?? null },
    ]);
  }
  const avertissements: string[] = [];
  for (const [espece, groupe] of parEspece) {
    if (groupe.length < 2) continue;
    if (new Set(groupe.map((g) => g.espece)).size === 1) continue;
    avertissements.push(
      `Dans le conte, ${groupe.map((g) => g.role).join(' et ')} sont tous des ${espece}s `
      + 'et se ressemblent : c’est souvent le ressort de l’histoire. Ici ce sont '
      + `${groupe.map((g) => g.nom).join(' et ')}, qui ne se ressemblent plus. Remotive la `
      + 'ressemblance par autre chose — le même chapeau, le même cri, une cachette, '
      + 'un dos tourné — ou rends la confusion possible autrement. Ne fais pas comme si de rien n’était.',
    );
  }
  return avertissements.length ? `${avertissements.map((a) => `⚠ ${a}`).join('\n')}\n\n` : '';
}

export function formaterEspeces(conte: Conte, s: Synopsis, marionnettes: Marionnette[]): string {
  const consignes = s.distribution
    .map((d) => {
      const m = marionnettes.find((x) => x.id === trouverMarionnetteId(d.marionnette, marionnettes));
      return m ? especeDansLeTexte(m, roleParNom(conte, d.role)) : null;
    })
    .filter((x): x is string => x !== null);
  if (consignes.length === 0) return '';
  const sosies = sosiesRompus(conte, s, marionnettes);
  return `${sosies}L’ESPÈCE DES PERSONNAGES DANS LE TEXTE, impératif : chaque marionnette
animale garde son espèce. Le nom de l’animal du conte disparaît de ce QUI SE
JOUE — répliques, didascalies, titres, résumés, formules — et seulement de là.
Les champs où tu expliques ton travail au parent (« changements », « note »)
peuvent nommer l’animal d’origine : c’est même le plus clair pour lui.
Le nom générique d’une espèce qui ne désigne PAS un personnage (« on chasse
les loups en hiver ») ne change pas non plus.
${consignes.map((x) => `- ${x}`).join('\n')}`;
}

function capitale(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ================================================================== */
/* Phase 2 : écrire le script                                          */
/* ================================================================== */

export interface ScriptResultat {
  titre: string;
  pitch: string;
  morale?: string;
  tableaux: Tableau[];
  actes: Acte[];
  dureeEstimeeSecondes: number;
  /** Problèmes restants, affichés en avertissement (CDC §6). */
  problemes: Probleme[];
  /** Le conte adapté, pour la bible et la régénération d'un acte. */
  conteId: string;
  /**
   * Voix et tic de langage décidés pour ce spectacle, par identifiant de
   * marionnette. Vide quand la pièce n'en appelle aucun.
   */
  voix: Record<string, string>;
  /** Passe 1 : le texte du conte transposé, référence de toute la suite. */
  bibleTransposition: Transposition;
  bibleAdaptation: Adaptation;
  bibleRelecture: unknown;
  jetons: Jetons;
}

export async function ecrireScript(
  dossierPropositions: Dossier,
  distribution: Marionnette[],
  synopsis: Synopsis,
  ajustement: string,
  o: OptionsPipeline,
): Promise<ScriptResultat> {
  // En mode automatique, le dossier de la phase 1 listait la réunion des
  // distributions des huit candidats. On le resserre sur celles qui jouent
  // vraiment : les étapes d'écriture ne doivent pas lire le nom des autres.
  const dossier = dossierPour(dossierPropositions, distribution);
  let jetons: Jetons = {};
  const nomDe = (id: string) => distribution.find((m) => m.id === id)?.nom ?? id;

  const conte = conteParId(synopsis.conte);
  if (!conte) throw new ErreurIa(t.erreursIa.conteIntrouvable, { conte: synopsis.conte });
  // Qui tient quel rôle : sert de repli quand le modèle écrit le nom du rôle
  // du conte au lieu de celui de la peluche.
  const roles = tableDesRoles(conte, synopsis, distribution);
  o.surAvancement({ etape: 'transposition' });
  const texte = await texteDuConte(conte.id);
  // Le synopsis, suivi de l'espèce que chaque personnage prend dans le texte.
  const blocSynopsis = [formaterSynopsis(synopsis, ajustement), formaterEspeces(conte, synopsis, distribution)]
    .filter(Boolean).join('\n\n');

  /* ---------------------------------------------------------------- */
  /* Passe 1 : la transposition                                        */
  /* ---------------------------------------------------------------- */

  // Le modèle récrit le conte ENTIER : il lui faut de quoi écrire autant de
  // mots qu'il en lit, plus sa réflexion.
  const pTransposition = promptTransposition(dossier);
  const rTransposition = await appelJson(
    o,
    {
      system: pTransposition.system,
      user: `${pTransposition.user}\n\n${formaterConte(conte, texte)}\n\n${blocSynopsis}`,
    },
    schemaTransposition,
    TEMPERATURES.transposition,
    Math.max(BUDGETS.transposition, Math.round(compterMots(texte) * 2.2) + 8000),
    'transposition',
  );
  jetons = cumulerJetons(jetons, rTransposition.jetons);
  const transposition = rTransposition.valeur;
  const blocConte = formaterTransposition(conte, transposition);

  /* ---------------------------------------------------------------- */
  /* Passe 2, première moitié : le découpage                           */
  /* ---------------------------------------------------------------- */

  o.surAvancement({ etape: 'construction' });
  let adaptation: Adaptation | null = null;
  let erreurConduite: string | undefined;
  let conduiteRefusee: string | undefined;

  for (let essai = 0; essai < 2; essai++) {
    const prompts = promptDecoupage(dossier, erreurConduite, conduiteRefusee);
    const r = await appelJson(
      o,
      { system: prompts.system, user: `${prompts.user}\n\n${blocConte}\n\n${blocSynopsis}` },
      schemaAdaptation,
      TEMPERATURES.decoupage,
      BUDGETS.adaptation,
      'découpage',
    );
    jetons = cumulerJetons(jetons, r.jetons);

    // On simule le découpage seul : on ne paie pas les dialogues pour
    // découvrir ensuite que trois marionnettes tiennent dans deux mains, ou
    // qu'une peluche choisie par le parent n'entre jamais.
    const problemes = simulerConduite(r.valeur, dossier.nbMarionnettistes, distribution);
    adaptation = r.valeur;
    if (problemes.length === 0) break;

    erreurConduite = problemes.map((pb) => `- ${pb.message}`).join('\n');
    conduiteRefusee = r.valeur.actes
      .map((a) => `Acte ${a.numero} : `
        + (a.mouvements.map((mv) => `${mv.type} ${mv.marionnette}`).join(', ') || 'aucun mouvement'))
      .join('\n');
    o.surReprise?.('découpage injouable');
  }
  if (!adaptation) throw new ErreurIa(t.erreursIa.jsonInvalide);

  // Ce que reçoit chaque appel d'écriture : le conte ENTIER, le synopsis que
  // le parent a choisi, et le découpage.
  const blocAdaptation = `${blocConte}

${blocSynopsis}

${formaterAdaptation(adaptation)}`;

  const tableauxParCle = new Map<string, Tableau>();
  const tableaux: Tableau[] = adaptation.tableaux.map((tb) => {
    const tableau: Tableau = {
      id: nouvelId(),
      titre: tb.titre,
      description: tb.description,
      accessoires: tb.accessoires,
      promptImage: tb.promptImage,
    };
    tableauxParCle.set(tb.id, tableau);
    return tableau;
  });

  /* ---------------------------------------------------------------- */
  /* Étape 4 : écriture, un appel par acte                             */
  /* ---------------------------------------------------------------- */

  const actesConduite = [...adaptation.actes].sort((a, b) => a.numero - b.numero);
  const actes: Acte[] = [];
  let etatScene: EtatScene = {};

  for (const [index, ac] of actesConduite.entries()) {
    o.surAvancement({ etape: 'ecriture', acte: index + 1, actesTotal: actesConduite.length });

    const aSuivre = actesConduite
      .slice(index + 1)
      .map((a) => `Acte ${a.numero} — ${a.titre} : ${a.resume}`)
      .join('\n');

    const r = await appelJson(
      o,
      promptEcrireActe(
        dossier,
        blocAdaptation,
        formaterConduiteActe(ac),
        formaterScript(actes, nomDe),
        aSuivre,
        decrireEtatScene(etatScene, nomDe),
      ),
      schemaActeEcrit,
      TEMPERATURES.ecriture,
      BUDGETS.ecriture,
      `acte ${ac.numero}`,
    );
    jetons = cumulerJetons(jetons, r.jetons);

    const elements = convertirElements(
      r.valeur.elements, distribution, dossier.nbMarionnettistes, etatScene, roles,
    );
    actes.push({
      id: nouvelId(),
      numero: ac.numero,
      titre: ac.titre,
      tableauId: tableauxParCle.get(ac.tableauId)?.id ?? tableaux[0].id,
      resume: ac.resume,
      elements,
    });

    etatScene = simulerActe(elements, dossier.nbMarionnettistes, nomDe, etatScene, ac.numero).etatFinal;
  }

  /* ---------------------------------------------------------------- */
  /* Étapes 5 à 7 : contrôles, relecture, corrections                  */
  /* ---------------------------------------------------------------- */

  o.surAvancement({ etape: 'controles' });
  const dureeCible = dossier.dureeMinutes * 60;
  const controlerTout = () => controler({
    actes,
    nbMarionnettistes: dossier.nbMarionnettistes,
    marionnetteIds: distribution.map((m) => m.id),
    nomDe,
    interactionPublic: dossier.interactionPublic,
    dureeCibleSecondes: dureeCible,
  });
  let problemes = controlerTout();

  // La relecture est systématique : un spectacle parfaitement jouable peut
  // être parfaitement incompréhensible, et c'est ce que la machine ne voit pas.
  o.surAvancement({ etape: 'relecture' });
  // La revue finale est un garde-fou, pas une condition : si elle échoue
  // (réponse hors format, modèle récalcitrant), le spectacle déjà écrit est
  // livré tel quel plutôt que perdu. Seule une annulation l'interrompt.
  let relecture: Relecture = { remarques: [] };
  const conteOriginal = formaterConte(conte, texte).replace('LE CONTE À ADAPTER', 'LE CONTE D’ORIGINE');
  try {
    const rRelecture = await appelJson(
      o,
      promptRelecture(
        dossier,
        formaterScript(actes, nomDe),
        // Pas les écarts de DURÉE : le directeur éditorial a pour consigne de
        // ne jamais proposer de couper pour gagner du temps, et lui montrer
        // « resserre de quarante mots » le met en contradiction avec
        // lui-même. La durée se règle à la passe de correction, pas ici.
        formaterProblemes(problemes.filter((p) => !/trop (court|long)/.test(p.message))),
        tableaux.map((tb) => `- ${tb.titre} : ${tb.description || '(aucune description)'}`).join('\n'),
        conteOriginal,
        transposition.texte,
      ),
      schemaRelecture,
      TEMPERATURES.relecture,
      BUDGETS.relecture,
      'relecture',
    );
    jetons = cumulerJetons(jetons, rRelecture.jetons);
    relecture = rRelecture.valeur;
  } catch (e) {
    if ((e as ErreurIa).message === t.erreursIa.annule) throw e;
    console.warn('Le Souffleur — la revue finale a échoué ; le spectacle est livré sans elle.', e);
  }
  const relus = relecture.remarques;

  const actesACorriger = new Set<number>([
    ...problemes
      .filter((p) => (p.gravite === 'bloquant' || p.gravite === 'important') && p.acteNumero !== undefined)
      .map((p) => p.acteNumero as number),
    // Toutes les remarques du directeur éditorial sont appliquées, détails
    // compris : ce sont ses modifications, et il les réécrit lui-même.
    ...relus
      .filter((p) => p.acte !== undefined)
      .map((p) => p.acte as number),
  ]);

  /**
   * Réécrit les actes désignés, puis recompte les problèmes.
   *
   * `remarques` n'est donné qu'à la première passe : les remarques du
   * directeur éditorial portent sur le script qu'il a lu, pas sur sa
   * réécriture.
   */
  const corriger = async (
    aCorriger: Set<number>,
    remarques: typeof relus,
  ) => {
    o.surAvancement({ etape: 'corrections' });
    let etat: EtatScene = {};
    // Le script tel que le directeur l'a lu : chaque réécriture s'y accorde.
    const scriptRelu = formaterScript(actes, nomDe);

    for (const acte of actes) {
      if (aCorriger.has(acte.numero)) {
        const conduiteActe = actesConduite.find((a) => a.numero === acte.numero);
        const sesProblemes = [
          ...problemes
            .filter((p) => p.acteNumero === acte.numero)
            .map((p) => `- [${p.gravite}] ${p.message}`),
          ...remarques
            .filter((p) => p.acte === acte.numero)
            .map((p) => `- [${p.gravite}] ${p.remarque}`
              + (p.modification ? `\n  Modification : ${p.modification}` : '')),
        ].join('\n');
        try {
          const r = await appelJson(
            o,
            promptCorrectionActe(
              dossier,
              conduiteActe ? formaterConduiteActe(conduiteActe) : '',
              formaterActe(acte, nomDe),
              sesProblemes,
              decrireEtatScene(etat, nomDe),
              blocAdaptation,
              conteOriginal,
              scriptRelu,
            ),
            schemaActeEcrit,
            TEMPERATURES.correction,
            BUDGETS.ecriture,
            `correction de l'acte ${acte.numero}`,
          );
          jetons = cumulerJetons(jetons, r.jetons);
          acte.elements = convertirElements(
            r.valeur.elements, distribution, dossier.nbMarionnettistes, etat, roles,
          );
        } catch (e) {
          // Une correction qui échoue n'annule pas le spectacle : le problème
          // restera affiché en avertissement (CDC §6).
          if ((e as ErreurIa).message === t.erreursIa.annule) throw e;
        }
      }
      etat = simulerActe(acte.elements, dossier.nbMarionnettistes, nomDe, etat, acte.numero).etatFinal;
    }
    problemes = controlerTout();
  };

  if (actesACorriger.size > 0) await corriger(actesACorriger, relus);

  // SECONDE PASSE, une seule, et seulement sur ce qui BLOQUE encore : une
  // réplique qu'on n'a pas su attribuer, une marionnette qui parle hors scène.
  // Une première réécriture rate parfois sa cible, et le parent se retrouvait
  // alors avec la note « À corriger » à la place du texte. On ne repasse pas
  // sur les écarts de durée ni sur le style : ce serait payer cher pour peu.
  const bloquantsRestants = new Set(
    problemes
      .filter((p) => p.gravite === 'bloquant' && p.acteNumero !== undefined)
      .map((p) => p.acteNumero as number),
  );
  if (bloquantsRestants.size > 0) {
    o.surReprise?.('des problèmes bloquants subsistent après correction');
    await corriger(bloquantsRestants, []);
  }

  o.surAvancement({ etape: 'assemblage' });
  return {
    // Le titre est celui de la carte choisie : le titre du conte d'origine.
    titre: synopsis.titre || adaptation.titre,
    pitch: adaptation.pitch || synopsis.accroche,
    tableaux,
    actes,
    dureeEstimeeSecondes: dureeSpectacle(actes),
    problemes,
    conteId: conte.id,
    voix: voixParMarionnette(adaptation, distribution),
    bibleTransposition: transposition,
    bibleAdaptation: adaptation,
    bibleRelecture: relecture,
    jetons,
  };
}

/* ================================================================== */
/* Mises en forme pour les prompts                                     */
/* ================================================================== */

/** Clé de comparaison d'un nom : sans accents, sans casse, sans article. */
function cleAlias(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^(le |la |les |l'|l’|un |une )/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Qui tient quel rôle, pour rattraper le modèle quand il écrit le nom du rôle
 * du conte (« Renard Roublard ») au lieu de celui de la peluche.
 *
 * On indexe les deux graphies — celle du synopsis et celle de la fiche, qui ne
 * coïncident pas toujours — et chaque mot distinctif du nom du rôle.
 */
export function tableDesRoles(
  conte: Conte,
  synopsis: Synopsis,
  distribution: Marionnette[],
): Map<string, string> {
  const table = new Map<string, string>();
  for (const d of synopsis.distribution) {
    const id = trouverMarionnetteId(d.marionnette, distribution);
    if (!id) continue;
    table.set(cleAlias(d.role), id);
    const role = roleParNom(conte, d.role);
    if (!role) continue;
    table.set(cleAlias(role.nom), id);
    for (const mot of role.nom.split(/\s+/)) if (mot.length > 3) table.set(cleAlias(mot), id);
  }
  return table;
}

/**
 * Le conte transposé (passe 1), tel que le reçoivent le découpage, chaque
 * acte et les corrections : la référence dont on prend les répliques.
 */
export function formaterTransposition(c: Conte, tr: Transposition): string {
  const retouches = tr.changements.length
    ? `\nRetouches déjà faites à la transposition :\n${tr.changements.map((x) => `- ${x}`).join('\n')}`
    : '';
  return `LE CONTE, TRANSPOSÉ POUR LES MARIONNETTES DU PARENT : ${reference(c)}
C’est le texte de référence : les répliques y sont prises mot pour mot.

Fiche du conte :
${c.corps}${retouches}

TEXTE TRANSPOSÉ (environ ${compterMots(tr.texte)} mots) :
"""
${tr.texte}
"""`;
}

/**
 * Le conte, tel que le reçoivent l'adaptation et l'écriture : sa fiche, puis
 * son texte intégral. Si le texte manque, la fiche seule — c'est mieux que
 * rien, et cela ne devrait jamais arriver.
 */
export function formaterConte(c: Conte, texte: string): string {
  const integral = texte
    ? `TEXTE INTÉGRAL DU CONTE (environ ${compterMots(texte)} mots) :
"""
${texte}
"""`
    : 'Le texte intégral n’est pas disponible : adapte à partir de la fiche seule.';
  return `LE CONTE À ADAPTER : ${reference(c)}

Fiche du conte :
${c.corps}

${integral}`;
}

/** Le synopsis que le parent a choisi, avec sa consigne d'ajustement. */
function formaterSynopsis(s: Synopsis, ajustement: string): string {
  const consigne = ajustement
    ? `\n\nConsigne d’ajustement du parent, à respecter :\n« ${ajustement} »`
    : '';
  return `LE SYNOPSIS CHOISI PAR LE PARENT : ${s.titre}
${s.accroche}
${s.resume.map((x) => `- ${x}`).join('\n')}

Distribution :
${s.distribution.map((d) => `- ${d.marionnette} joue ${d.role}${d.note ? ` : ${d.note}` : ''}`).join('\n')}

Changements annoncés au parent :
${s.changements.length ? s.changements.map((x) => `- ${x}`).join('\n') : '- aucun'}${consigne}`;
}

/** Le découpage décidé, tel que le reçoit chaque acte. */
function formaterAdaptation(a: Adaptation): string {
  return `L’ADAPTATION DÉCIDÉE : « ${a.titre} »
${a.pitch}

Ce qui change par rapport au conte, et que tu respectes :
${a.changements.length ? a.changements.map((x) => `- ${x}`).join('\n') : '- rien'}

Plan du spectacle :
${[...a.actes].sort((x, y) => x.numero - y.numero)
    .map((ac) => `- Acte ${ac.numero}, ${ac.titre} : ${ac.resume}${ac.passage ? ` (${ac.passage})` : ''}`)
    .join('\n')}`;
}

function formaterConduiteActe(a: Conduite['actes'][number]): string {
  return `Acte ${a.numero} — ${a.titre}
Résumé : ${a.resume}
Passage du conte joué par cet acte : ${a.passage || '(non précisé)'}
Déroulé :
${a.temps.map((tp, i) => `  ${i + 1}. ${tp}`).join('\n')}
Entrées et sorties prévues par le découpage. C’est un PLAN, pas un ordre à
exécuter : si la scène demande autre chose — un personnage qui doit rester
pour parler, un échange qui exige deux présences —, arrange-le autrement,
pourvu que les contraintes de scène tiennent. Ne coupe pas une réplique du
conte parce que le plan fait sortir celui qui la dit : fais-le sortir après.
Dans TA réponse, chaque entrée et chaque sortie porte un champ « main » :
choisis-la librement, c’est l’application qui l’arrêtera.
${a.mouvements.map((m) => `  ${m.type} — ${m.marionnette}`).join('\n')}
Moments avec le public :
${a.momentsPublic.map((m) => `  - ${m}`).join('\n')}
Budget indicatif pour cet acte : environ ${a.budgetMots} mots dits. C'est une
jauge, jamais une limite : la fidélité au texte du conte passe devant, et la
fin de l'acte se joue en entier. Dépasser vaut mieux que couper une réplique
du conte.`;
}

/* ================================================================== */
/* Conversions et contrôles                                            */
/* ================================================================== */

/**
 * Convertit les éléments écrits par le modèle (qui nomme les marionnettes) en
 * éléments du modèle de données (qui les identifie).
 *
 * Un nom inconnu ne fait pas échouer la génération : l'élément est transformé
 * en note au marionnettiste, visible et corrigeable à la main, plutôt que de
 * perdre tout un acte.
 */
export function convertirElements(
  ecrits: ElementEcrit[],
  distribution: Marionnette[],
  /** Pour recalculer les mains : le modèle ne peut pas les connaître. */
  nbMarionnettistes: 1 | 2 = 1,
  /** État laissé par l'acte précédent : une marionnette peut y être restée. */
  etatInitial: EtatScene = {},
  /**
   * Nom d'un RÔLE du conte → identifiant de la marionnette qui le tient.
   *
   * Le modèle retombe parfois sur le nom du rôle (« Renard Roublard ») au lieu
   * de celui de la peluche (« Papa Baleine »). Sans ce repli, la réplique était
   * effacée et remplacée par une note : le personnage disparaissait du
   * spectacle au moment même où il fait l'histoire.
   */
  alias: Map<string, string> = new Map(),
): ElementScript[] {
  const resultat: ElementScript[] = [];

  for (const e of ecrits) {
    if (e.type === 'didascalie' || e.type === 'note_marionnettiste') {
      resultat.push({ id: nouvelId(), type: e.type, texte: e.texte });
      continue;
    }

    const marionnetteId = trouverMarionnetteId(e.marionnette, distribution)
      ?? alias.get(cleAlias(e.marionnette));
    if (!marionnetteId) {
      resultat.push({
        id: nouvelId(),
        type: 'note_marionnettiste',
        texte: `${MARQUE_A_CORRIGER} « ${e.marionnette} » ne fait pas partie de la distribution.`,
      });
      continue;
    }

    switch (e.type) {
      case 'replique':
        resultat.push({ id: nouvelId(), type: 'replique', marionnetteId, texte: nettoyerReplique(e.texte), ton: e.ton });
        break;
      case 'adresse_public':
        resultat.push({
          id: nouvelId(),
          type: 'adresse_public',
          marionnetteId,
          texte: nettoyerReplique(e.texte),
          attenteReponse: e.attenteReponse,
        });
        break;
      case 'entree':
      case 'sortie':
        resultat.push({
          id: nouvelId(),
          type: e.type,
          marionnetteId,
          mainMarionnettiste: e.main as Main,
        });
        break;
    }
  }

  // La main que le modèle indique n'est qu'une préférence : elle est gardée si
  // elle est libre, recalculée sinon.
  return attribuerMains(resultat, nbMarionnettistes, etatInitial);
}

/**
 * Retire les tirets de dialogue qu'une réplique reprise du conte garde souvent
 * en tête (« — — Eh bien, qu'y a-t-il ? »). C'est mécanique : l'application
 * s'en charge plutôt que de compter sur le modèle.
 */
export function nettoyerReplique(texte: string): string {
  return texte.replace(/^(\s*[—–-]\s*)+/, '').trim();
}

/**
 * Simule le découpage avant toute écriture. Les mouvements sont
 * joués dans l'ordre des actes.
 */
export function simulerConduite(
  conduite: Conduite,
  nbMarionnettistes: 1 | 2,
  distribution: Marionnette[],
): Probleme[] {
  const nomDe = (id: string) => distribution.find((m) => m.id === id)?.nom ?? id;
  const problemes: Probleme[] = [];
  let etat: EtatScene = {};

  for (const acte of [...conduite.actes].sort((a, b) => a.numero - b.numero)) {
    const elements: ElementScript[] = [];
    for (const mv of acte.mouvements) {
      const id = trouverMarionnetteId(mv.marionnette, distribution);
      if (!id) {
        problemes.push({
          gravite: 'bloquant',
          acteNumero: acte.numero,
          message: `« ${mv.marionnette} » ne fait pas partie de la distribution.`,
        });
        continue;
      }
      elements.push({
        id: nouvelId(),
        type: mv.type,
        marionnetteId: id,
        mainMarionnettiste: mv.main as Main,
      });
    }
    const r = simulerActe(
      attribuerMains(elements, nbMarionnettistes, etat), nbMarionnettistes, nomDe, etat, acte.numero,
    );
    problemes.push(...r.problemes);
    etat = r.etatFinal;
  }

  // Un acte ne doit pas être une NAVETTE : l'un sort pour que l'autre entre,
  // encore et encore. Deux plafonds suffisent à casser la pente, et ils
  // tombent AVANT que le moindre dialogue ne soit payé.
  for (const acte of conduite.actes) {
    const entreesPar = new Map<string, number>();
    for (const mv of acte.mouvements) {
      if (mv.type !== 'entree') continue;
      const nom = trouverMarionnetteId(mv.marionnette, distribution) ?? mv.marionnette;
      entreesPar.set(nom, (entreesPar.get(nom) ?? 0) + 1);
    }
    for (const [id, fois] of entreesPar) {
      if (fois > 2) {
        const nom = distribution.find((m) => m.id === id)?.nom ?? id;
        problemes.push({
          gravite: 'bloquant',
          acteNumero: acte.numero,
          message: `${nom} entre ${fois} fois dans l’acte ${acte.numero} : c’est une `
            + 'navette, pas une scène. Fais tenir la rencontre en une seule fois, '
            + 'ou donne à cet acte un mouvement qui change la situation.',
        });
      }
    }
    if (acte.mouvements.length > 8) {
      problemes.push({
        gravite: 'bloquant',
        acteNumero: acte.numero,
        message: `L’acte ${acte.numero} compte ${acte.mouvements.length} entrées et `
          + 'sorties : les personnages passent plus de temps à se relayer qu’à jouer. '
          + 'Huit au maximum.',
      });
    }
  }

  // Aucune marionnette choisie par le parent ne reste en coulisse.
  const vues = new Set<string>();
  for (const acte of conduite.actes) {
    for (const mv of acte.mouvements) {
      const id = trouverMarionnetteId(mv.marionnette, distribution);
      if (id) vues.add(id);
    }
  }
  for (const m of distribution) {
    if (!vues.has(m.id)) {
      problemes.push({
        gravite: 'bloquant',
        message: `${m.nom} n’entre jamais en scène : donne-lui une entrée et une sortie.`,
      });
    }
  }

  return problemes;
}

/** État de la scène décrit en français, pour le prompt de l'acte suivant. */
export function decrireEtatScene(etat: EtatScene, nomDe: (id: string) => string): string {
  const entrees = Object.entries(etat).filter(([, id]) => id !== undefined);
  if (entrees.length === 0) return 'La scène est vide, toutes les mains sont libres.';
  return entrees.map(([main, id]) => `${nomDe(id as string)} est en scène, main ${main}.`).join('\n');
}

function formaterActe(acte: Acte, nomDe: (id: string) => string): string {
  return acte.elements.map((e, i) => `${i + 1}. ${formaterElement(e, nomDe)}`).join('\n');
}

function formaterElement(e: ElementScript, nomDe: (id: string) => string): string {
  switch (e.type) {
    case 'replique':
      return `${nomDe(e.marionnetteId)} : « ${e.texte} »${e.ton ? ` (${e.ton})` : ''}`;
    case 'didascalie':
      return `[action] ${e.texte}`;
    case 'adresse_public':
      return `${nomDe(e.marionnetteId)} au public : « ${e.texte} »`
        + `${e.attenteReponse ? ' (attend une réponse)' : ''}`;
    case 'note_marionnettiste':
      return `[note] ${e.texte}`;
    default:
      return `[${e.type}] ${nomDe(e.marionnetteId)} — main ${e.mainMarionnettiste}`;
  }
}

function formaterScript(actes: Acte[], nomDe: (id: string) => string): string {
  return actes
    .map((a) => `--- Acte ${a.numero} : ${a.titre} ---\n${formaterActe(a, nomDe)}`)
    .join('\n\n');
}

function formaterProblemes(problemes: Probleme[]): string {
  if (problemes.length === 0) return 'Aucun.';
  return problemes
    .map((p) => {
      const ou = p.acteNumero ? `acte ${p.acteNumero}` : 'spectacle';
      const el = p.position ? `, élément ${p.position}` : '';
      return `- [${p.gravite}] (${ou}${el}) ${p.message}`;
    })
    .join('\n');
}

/** Assemble le spectacle final, prêt à enregistrer (étape 8). */
export function assemblerSpectacle(
  script: ScriptResultat,
  distribution: Marionnette[],
  parametres: ParametresGeneration,
  bible: Record<string, unknown>,
): Spectacle {
  const maintenant = new Date().toISOString();
  return {
    id: nouvelId(),
    titre: script.titre,
    pitch: script.pitch,
    morale: script.morale,
    parametres,
    // La voix appartient au spectacle, pas à la peluche : elle ne vit que sur
    // cette copie figée, jamais dans la Marionnethèque.
    distribution: distribution.map((m): MarionnetteDistribuee =>
      script.voix[m.id] ? { ...m, voix: script.voix[m.id] } : { ...m }),
    tableaux: script.tableaux,
    actes: script.actes,
    dureeEstimeeSecondes: script.dureeEstimeeSecondes,
    // Un problème non résolu après les corrections n'empêche pas l'enregistrement
    // (CDC §6) : il est affiché en avertissement sur l'élément concerné.
    statut: 'complet',
    bible,
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}

/**
 * Les voix décidées au découpage, ramenées aux identifiants des marionnettes.
 *
 * Le modèle écrit des noms ; on les retrouve avec la même tolérance que partout
 * ailleurs (« doudou lapin » pour « Doudou Lapin »). Un nom qu'on ne reconnaît
 * pas est ignoré : une voix de trop ne vaut pas de perdre le spectacle.
 */
export function voixParMarionnette(
  adaptation: Adaptation,
  distribution: Marionnette[],
): Record<string, string> {
  const voix: Record<string, string> = {};
  for (const v of adaptation.voix ?? []) {
    const texte = v.voix.trim();
    if (!texte) continue;
    const id = trouverMarionnetteId(v.marionnette, distribution);
    if (id) voix[id] = texte;
  }
  return voix;
}

/** Budget de mots d'un acte, pour l'affichage et les contrôles. */
export function budgetActe(dureeMinutes: number, nbActes: number): number {
  return Math.round(budgetMots(dureeMinutes * 60) / Math.max(1, nbActes));
}

/** Durée estimée d'un acte, réexportée pour l'écran de script. */
export { dureeElements };

/* ================================================================== */
/* Régénérer un acte depuis l'écran de script (CDC §6 et §8)           */
/* ================================================================== */

/**
 * Relance l'écriture d'un seul acte, avec une consigne facultative du parent,
 * puis la simulation de scène sur cet acte.
 *
 * Le conte, sa transposition, le synopsis et l'adaptation sont relus dans la
 * bible. Un spectacle qui ne les a pas (importé d'une ancienne sauvegarde) est
 * réécrit à partir de son titre et de son pitch.
 */
export async function regenererActe(
  spectacle: Spectacle,
  acteId: string,
  consigne: string,
  o: OptionsPipeline,
): Promise<{ elements: ElementScript[]; problemes: Probleme[]; jetons?: Jetons }> {
  const index = spectacle.actes.findIndex((a) => a.id === acteId);
  if (index < 0) throw new ErreurIa(t.erreursIa.reponseIncomprehensible);

  const acte = spectacle.actes[index];
  const distribution = spectacle.distribution;
  const nomDe = (id: string) => distribution.find((m) => m.id === id)?.nom ?? id;

  const bible = spectacle.bible as {
    dossier?: Dossier;
    conteId?: string;
    synopsis?: Synopsis;
    transposition?: Transposition;
    adaptation?: Adaptation;
  };
  const dossier = bible.dossier ?? construireDossier(distribution, spectacle.parametres);

  const conte = bible.conteId ? conteParId(bible.conteId) : undefined;
  let blocAdaptation = `Titre : ${spectacle.titre}\n${spectacle.pitch}`;
  if (conte) {
    blocAdaptation = [
      // Le conte transposé s'il existe ; les spectacles d'avant les trois
      // passes n'ont que le texte d'origine.
      bible.transposition
        ? formaterTransposition(conte, bible.transposition)
        : formaterConte(conte, await texteDuConte(conte.id)),
      bible.synopsis ? formaterSynopsis(bible.synopsis, '') : '',
      bible.synopsis ? formaterEspeces(conte, bible.synopsis, distribution) : '',
      bible.adaptation ? formaterAdaptation(bible.adaptation) : '',
    ].filter(Boolean).join('\n\n');
  }
  const conduiteActe = bible.adaptation?.actes.find((a) => a.numero === acte.numero);

  // État de la scène au début de l'acte, rejoué depuis le premier.
  let etat: EtatScene = {};
  for (const precedent of spectacle.actes.slice(0, index)) {
    etat = simulerActe(
      precedent.elements, spectacle.parametres.nbMarionnettistes, nomDe, etat, precedent.numero,
    ).etatFinal;
  }

  const aSuivre = spectacle.actes
    .slice(index + 1)
    .map((a) => `Acte ${a.numero} — ${a.titre} : ${a.resume}`)
    .join('\n');

  const r = await appelJson(
    o,
    promptEcrireActe(
      dossier,
      blocAdaptation,
      conduiteActe
        ? formaterConduiteActe(conduiteActe)
        : `Acte ${acte.numero} — ${acte.titre}\nRésumé : ${acte.resume}`,
      formaterScript(spectacle.actes.slice(0, index), nomDe),
      aSuivre,
      decrireEtatScene(etat, nomDe),
      consigne.trim() || undefined,
    ),
    schemaActeEcrit,
    TEMPERATURES.ecriture,
    BUDGETS.ecriture,
    `régénération de l'acte ${acte.numero}`,
  );

  const elements = convertirElements(
    r.valeur.elements, distribution, spectacle.parametres.nbMarionnettistes, etat,
  );
  const problemes = simulerActe(
    elements, spectacle.parametres.nbMarionnettistes, nomDe, etat, acte.numero,
  ).problemes;

  return { elements, problemes, jetons: r.jetons };
}
