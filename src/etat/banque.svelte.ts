// L'état de la création depuis le fonds (mode Banque, CDC §7).
//
// Le petit frère de `generation.svelte.ts` : quatre phases au lieu de six,
// pas de choix d'histoires ni d'écriture — l'instanciation est un remplacement
// par le code, quasi instantané. Le spectacle créé est enregistré comme les
// autres, noté dans l'historique des contes (le Studio ne le reproposera pas
// aussitôt) et dans le registre des modèles joués (la Banque le masquera).

import type { Marionnette, Spectacle } from '../types';
import { tba } from '../textes';
import { enregistrerSpectacle } from '../services/db';
import { noterRencontres } from '../services/historiqueContes';
import { noterModeleJoue } from '../services/historiqueBanque';
import { noterSpectacleCree } from '../services/sauvegarde';
import { instancier, ErreurInstanciation } from '../services/instanciation';
import type { AttributionBanque } from '../services/appariement';

export type PhaseBanque = 'repos' | 'creation' | 'termine' | 'erreur';

function creerEtatBanque() {
  let phase = $state<PhaseBanque>('repos');
  let erreur = $state('');
  let spectacleId = $state<string | null>(null);
  /** Rappel de sauvegarde, au 3e spectacle créé sans export (CDC §12). */
  let rappelSauvegarde = $state(false);

  return {
    get phase() { return phase; },
    get erreur() { return erreur; },
    get spectacleId() { return spectacleId; },
    get rappelSauvegarde() { return rappelSauvegarde; },

    /**
     * Crée et enregistre un spectacle depuis un modèle du fonds.
     * La distribution est dans l'ordre des rôles (r1, r2…).
     */
    async creer(
      modeleId: string,
      conteId: string,
      distribution: AttributionBanque[],
      marionnetheque: Marionnette[],
    ) {
      if (phase === 'creation') return;
      phase = 'creation';
      erreur = '';
      spectacleId = null;

      try {
        const spectacle: Spectacle = await instancier(modeleId, distribution, marionnetheque);
        await enregistrerSpectacle(spectacle);
        spectacleId = spectacle.id;
        rappelSauvegarde = noterSpectacleCree();
        // Un conte joué depuis la banque ne doit pas revenir aussitôt au
        // Studio, et le modèle ne doit plus être proposé à cette famille.
        if (conteId) noterRencontres([conteId], 'joue');
        noterModeleJoue(modeleId);
        phase = 'termine';
      } catch (e) {
        erreur = e instanceof ErreurInstanciation ? e.message : tba.creation.echec;
        console.error('Le Souffleur — création depuis la banque :', e);
        phase = 'erreur';
      }
    },

    reinitialiser() {
      phase = 'repos';
      erreur = '';
      spectacleId = null;
    },
  };
}

export const banque = creerEtatBanque();
