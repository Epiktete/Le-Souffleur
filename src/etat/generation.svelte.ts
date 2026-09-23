// Conduite d'une génération, de bout en bout (CDC §6 et §7).
//
// Deux phases pour le parent : « Proposer des histoires », puis, après son
// choix, « Écrire le script ». Entre les deux, le spectacle reste en statut
// « choix en attente » : le parent peut quitter l'écran et reprendre plus tard.

import { IA } from '../config';
import { ErreurIa, type Jetons } from '../services/connecteurIa';
import type { Dossier } from '../services/dossier';
import {
  assemblerSpectacle,
  cumulerJetons,
  ecrireScript,
  proposerHistoires,
  type Avancement,
  type PropositionsResultat,
} from '../services/pipeline';
import type { Synopsis } from '../services/schemas';
import type { Probleme } from '../services/scene';
import { enregistrerSpectacle } from '../services/db';
import { noterRencontres } from '../services/historiqueContes';
import type { Marionnette, ParametresGeneration, Spectacle } from '../types';
import { reglagesIa } from './reglagesIa.svelte';

/** Où en est le parent dans le parcours de génération. */
export type PhaseGeneration =
  | 'repos'
  | 'propositions'
  | 'choix'
  | 'ecriture'
  | 'termine'
  | 'erreur';

function creerGeneration() {
  let phase = $state<PhaseGeneration>('repos');
  let avancement = $state<Avancement | null>(null);
  let erreur = $state<string | null>(null);
  /** Détail technique, affichable pour diagnostiquer un modèle récalcitrant. */
  let detailErreur = $state<string | null>(null);
  let jetons = $state<Jetons>({});

  let propositions = $state<PropositionsResultat | null>(null);
  /** Contes et titres déjà montrés, pour ne pas les reproposer (3 relances au plus). */
  let contesVus = $state<string[]>([]);
  let titresVus = $state<string[]>([]);
  let relancesFaites = $state(0);

  let spectacleId = $state<string | null>(null);
  let problemes = $state<Probleme[]>([]);

  let controleur: AbortController | null = null;
  /** Contexte conservé entre les deux phases. */
  let contexte: {
    marionnettes: Marionnette[];
    parametres: Omit<ParametresGeneration, 'modele' | 'marionnetteIds'>;
    /** La Marionnethèque entière quand la scène était vide (CDC §7). */
    vivier?: Marionnette[];
  } | null = null;

  function options(surAvancement: (a: Avancement) => void) {
    controleur = new AbortController();
    return {
      acces: reglagesIa.acces,
      signal: controleur.signal,
      surAvancement,
      /**
       * Une étape qui recommence le dit. Le compteur repart à chaque nouvelle
       * étape, puisque surAvancement remplace l'objet sans « essai ».
       *
       * Sans cela, une cascade de reprises — conduite injouable, JSON
       * illisible, réponse coupée — est indiscernable d'un modèle lent : le
       * parent voit une étape figée plusieurs minutes sans savoir pourquoi.
       */
      surReprise: (raison: string) => {
        if (!avancement) return;
        avancement = {
          ...avancement,
          essai: (avancement.essai ?? 1) + 1,
          raisonReprise: raison,
        };
      },
    };
  }

  /**
   * Svelte enveloppe l'état réactif dans des Proxy, qu'IndexedDB refuse de
   * copier. On prend donc un instantané ordinaire dès l'entrée du pipeline :
   * tout ce qui en sort — dont la distribution figée du spectacle — est alors
   * fait d'objets ordinaires, enregistrables sans précaution supplémentaire.
   */
  function instantaneMarionnettes(liste: Marionnette[]): Marionnette[] {
    return $state.snapshot(liste) as Marionnette[];
  }

  function traiterErreur(e: unknown) {
    // Une annulation n'est pas une erreur : on revient simplement au repos.
    if (e instanceof ErreurIa && e.message.includes('annulée')) {
      phase = 'repos';
      avancement = null;
      return;
    }

    erreur = e instanceof ErreurIa ? e.message : String(e);

    // Le détail vient de la cause portée par l'erreur. Il ne contient jamais
    // la clé : seuls l'étape et la raison du refus y figurent.
    const cause = e instanceof ErreurIa ? (e.cause as Record<string, unknown> | undefined) : undefined;
    detailErreur = cause
      ? Object.entries(cause)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${k} : ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
          .join(' — ')
      : null;

    phase = 'erreur';
    avancement = null;
  }

  return {
    get phase() { return phase; },
    get avancement() { return avancement; },
    get erreur() { return erreur; },
    get detailErreur() { return detailErreur; },
    get jetons() { return jetons; },
    get propositions() { return propositions; },
    get spectacleId() { return spectacleId; },
    get problemes() { return problemes; },
    get relancesRestantes() { return IA.relancesPistesMax - relancesFaites; },
    get enCours() { return phase === 'propositions' || phase === 'ecriture'; },

    /**
     * Qui joue le conte choisi. En mode automatique c'est l'application qui
     * l'a décidé, conte par conte ; sinon c'est la scène garnie par le parent.
     */
    distributionDe(synopsis: Synopsis): Marionnette[] {
      return propositions?.distributionParConte[synopsis.conte] ?? contexte?.marionnettes ?? [];
    },

    /**
     * Phase 1 : étapes P à 3.
     *
     * `vivier` n'est donné que si la scène est vide : l'outil choisit alors
     * le conte d'abord, et qui le joue ensuite (CDC §7).
     */
    async proposer(
      marionnettes: Marionnette[],
      parametres: Omit<ParametresGeneration, 'modele' | 'marionnetteIds'>,
      vivier?: Marionnette[],
    ) {
      contexte = {
        marionnettes: instantaneMarionnettes(marionnettes),
        parametres,
        vivier: vivier && instantaneMarionnettes(vivier),
      };
      phase = 'propositions';
      erreur = null;
      detailErreur = null;
      jetons = {};
      contesVus = [];
      titresVus = [];
      relancesFaites = 0;
      problemes = [];
      spectacleId = null;

      try {
        const r = await proposerHistoires(
          contexte.marionnettes,
          parametres,
          options((a) => (avancement = a)),
          undefined,
          contexte.vivier,
        );
        propositions = r;
        noterRencontres(r.retenues.map((p) => p.conte), 'propose');
        jetons = cumulerJetons(jetons, r.jetons);
        phase = 'choix';
        avancement = null;
      } catch (e) {
        traiterErreur(e);
      }
    },

    /** « Proposer 3 autres histoires » : relance l'étape 1 (CDC §6). */
    async proposerAutres() {
      if (!contexte || !propositions || this.relancesRestantes <= 0) return;
      phase = 'propositions';
      erreur = null;
      // Les contes montrés au modèle sont exclus du choix, et pas seulement
      // les trois retenus : ceux qu'il a écartés une fois n'ont aucune raison
      // de mieux lui plaire la fois suivante, et d'autres doivent remonter.
      contesVus = [...contesVus, ...propositions.presentes];
      titresVus = [...titresVus, ...propositions.retenues.map((p) => p.titre)];
      relancesFaites++;

      try {
        const r = await proposerHistoires(
          contexte.marionnettes,
          contexte.parametres,
          options((a) => (avancement = a)),
          { dossier: propositions.dossier, contes: contesVus, titres: titresVus },
          contexte.vivier,
        );
        propositions = r;
        noterRencontres(r.retenues.map((p) => p.conte), 'propose');
        jetons = cumulerJetons(jetons, r.jetons);
        phase = 'choix';
        avancement = null;
      } catch (e) {
        traiterErreur(e);
      }
    },

    /** Phase 2 : adaptation puis écriture, après le choix du parent. */
    async ecrire(synopsis: Synopsis, ajustement: string) {
      if (!contexte || !propositions) return;
      phase = 'ecriture';
      erreur = null;

      // La troupe de CE conte : en mode automatique elle change d'un conte à
      // l'autre, et c'est seulement ici qu'elle est arrêtée.
      const troupe = this.distributionDe(synopsis);

      try {
        const script = await ecrireScript(
          propositions.dossier,
          troupe,
          synopsis,
          ajustement,
          options((a) => (avancement = a)),
        );
        jetons = cumulerJetons(jetons, script.jetons);

        const parametres: ParametresGeneration = {
          ...contexte.parametres,
          marionnetteIds: troupe.map((m) => m.id),
          modele: reglagesIa.modele,
        };

        const spectacle = assemblerSpectacle(script, troupe, parametres, {
          dossier: propositions.dossier as unknown,
          contesPresentes: propositions.presentes,
          jouables: propositions.jouables,
          synopsisProposes: propositions.retenues,
          synopsis,
          ajustement,
          conteId: script.conteId,
          adaptation: script.bibleAdaptation,
          transposition: script.bibleTransposition,
          relecture: script.bibleRelecture,
        });

        // Ceinture et bretelles : le spectacle ne contient déjà que des objets
        // ordinaires, mais une écriture dans IndexedDB ne doit jamais échouer
        // pour cette raison.
        await enregistrerSpectacle($state.snapshot(spectacle) as Spectacle);
        spectacleId = spectacle.id;
        noterRencontres([script.conteId], 'joue');
        problemes = script.problemes;
        phase = 'termine';
        avancement = null;
      } catch (e) {
        traiterErreur(e);
      }
    },

    /** Bouton « Annuler » pendant un appel (CDC §5). */
    annuler() {
      controleur?.abort();
    },

    /** Referme l'écran de choix ou d'erreur sans rien garder. */
    reinitialiser() {
      controleur?.abort();
      phase = 'repos';
      avancement = null;
      erreur = null;
      detailErreur = null;
      propositions = null;
      spectacleId = null;
      problemes = [];
      contexte = null;
    },
  };
}

export const generation = creerGeneration();

/** Dossier courant, exposé pour l'affichage. */
export type { Dossier };
