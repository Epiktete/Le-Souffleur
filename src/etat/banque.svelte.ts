// L'état de la création depuis le fonds (mode Banque, CDC §7).
//
// Le petit frère de `generation.svelte.ts` : cinq phases au lieu de six,
// pas de choix d'histoires ni d'écriture — l'instanciation est un remplacement
// par le code, plus au besoin UNE retouche d'accords par un petit modèle.
// Quand cette retouche échoue, rien n'est enregistré : le parent choisit
// entre les accords d'origine et renoncer (phase « repli »).
//
// Le spectacle créé est enregistré comme les autres, noté dans l'historique
// des contes (le Studio ne le reproposera pas aussitôt) et dans le registre
// des modèles joués (la Banque le masquera).

import type { Marionnette, Spectacle } from '../types';
import { tba } from '../textes';
import { enregistrerSpectacle } from '../services/db';
import { noterRencontres } from '../services/historiqueContes';
import { noterModeleJoue } from '../services/historiqueBanque';
import { noterSpectacleCree } from '../services/sauvegarde';
import { instancier, ErreurInstanciation } from '../services/instanciation';
import type { AttributionBanque, Genre } from '../services/appariement';
import { reglagesIa } from './reglagesIa.svelte';

export type PhaseBanque = 'repos' | 'creation' | 'repli' | 'termine' | 'erreur';

function creerEtatBanque() {
  let phase = $state<PhaseBanque>('repos');
  let erreur = $state('');
  let spectacleId = $state<string | null>(null);
  /** Rappel de sauvegarde, au 3e spectacle créé sans export (CDC §12). */
  let rappelSauvegarde = $state(false);
  /** Un avertissement non bloquant sur le spectacle créé (accords d'origine). */
  let avertissement = $state('');
  /** La cause du repli, et le spectacle qui attend la décision du parent. */
  let causeRepli = $state('');
  let enAttente: { spectacle: Spectacle; modeleId: string; conteId: string } | null = null;

  async function enregistrer(spectacle: Spectacle, modeleId: string, conteId: string) {
    await enregistrerSpectacle(spectacle);
    spectacleId = spectacle.id;
    rappelSauvegarde = noterSpectacleCree();
    // Un conte joué depuis la banque ne doit pas revenir aussitôt au Studio,
    // et le modèle ne doit plus être proposé à cette famille.
    if (conteId) noterRencontres([conteId], 'joue');
    noterModeleJoue(modeleId);
    phase = 'termine';
  }

  return {
    get phase() { return phase; },
    get erreur() { return erreur; },
    get spectacleId() { return spectacleId; },
    get rappelSauvegarde() { return rappelSauvegarde; },
    get avertissement() { return avertissement; },
    get causeRepli() { return causeRepli; },

    /**
     * Crée et enregistre un spectacle depuis un modèle du fonds.
     * La distribution est dans l'ordre des rôles (r1, r2…) ; `genresChoisis`
     * porte les « il / elle » répondus à l'écran de distribution.
     */
    async creer(
      modeleId: string,
      conteId: string,
      distribution: AttributionBanque[],
      marionnetheque: Marionnette[],
      genresChoisis: Partial<Record<string, Genre>> = {},
    ) {
      if (phase === 'creation') return;
      phase = 'creation';
      erreur = '';
      avertissement = '';
      causeRepli = '';
      spectacleId = null;
      enAttente = null;

      try {
        const r = await instancier(modeleId, distribution, marionnetheque, {
          acces: reglagesIa.pretPourGenerer ? reglagesIa.acces : null,
          genresChoisis,
        });

        if (r.retouche === 'refusee') {
          // Rien n'est enregistré : le parent tranche (CDC §7).
          enAttente = { spectacle: r.spectacle, modeleId, conteId };
          causeRepli = r.detail ?? '';
          phase = 'repli';
          return;
        }
        if (r.retouche === 'sansCle') avertissement = tba.creation.sansCle;
        await enregistrer(r.spectacle, modeleId, conteId);
      } catch (e) {
        erreur = e instanceof ErreurInstanciation ? e.message : tba.creation.echec;
        console.error('Le Souffleur — création depuis la banque :', e);
        phase = 'erreur';
      }
    },

    /** Depuis le repli : créer avec les accords d'origine. */
    async creerQuandMeme() {
      if (phase !== 'repli' || !enAttente) return;
      const { spectacle, modeleId, conteId } = enAttente;
      enAttente = null;
      try {
        avertissement = tba.creation.accordsOrigine;
        await enregistrer(spectacle, modeleId, conteId);
      } catch (e) {
        erreur = tba.creation.echec;
        console.error('Le Souffleur — création depuis la banque :', e);
        phase = 'erreur';
      }
    },

    reinitialiser() {
      phase = 'repos';
      erreur = '';
      avertissement = '';
      causeRepli = '';
      spectacleId = null;
      enAttente = null;
    },
  };
}

export const banque = creerEtatBanque();
