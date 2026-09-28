// L'état de la création depuis le fonds (mode Contothèque, CDC §7).
//
// Le petit frère de `generation.svelte.ts` : quatre phases, aucun appel IA —
// l'instanciation est entièrement calculée (noms, accords annotés d'avance,
// fraction d'interactions). Le spectacle créé est enregistré comme les
// autres, noté dans l'historique des contes (le Studio ne le reproposera pas
// aussitôt) et dans le registre des modèles joués (la Contothèque le masque).

import type { Marionnette, NiveauInteraction } from '../types';
import { tba } from '../textes';
import { enregistrerSpectacle } from '../services/db';
import { noterRencontres } from '../services/historiqueContes';
import { noterModeleJoue } from '../services/historiqueBanque';
import { noterSpectacleCree } from '../services/sauvegarde';
import { instancier, ErreurInstanciation } from '../services/instanciation';
import type { AttributionBanque, Genre } from '../services/appariement';

export type PhaseBanque = 'repos' | 'creation' | 'termine' | 'erreur';

function creerEtatBanque() {
  let phase = $state<PhaseBanque>('repos');
  let erreur = $state('');
  let spectacleId = $state<string | null>(null);
  /** Rappel de sauvegarde, au 3e spectacle créé sans export (CDC §12). */
  let rappelSauvegarde = $state(false);
  /** Ce qui n'a pas pu être adapté (accords d'origine gardés), non bloquant. */
  let avertissements = $state<string[]>([]);

  return {
    get phase() { return phase; },
    get erreur() { return erreur; },
    get spectacleId() { return spectacleId; },
    get rappelSauvegarde() { return rappelSauvegarde; },
    get avertissements() { return avertissements; },

    /**
     * Crée et enregistre un spectacle depuis un modèle du fonds.
     * La distribution est dans l'ordre des rôles (r1, r2…) ; `genresChoisis`
     * porte les « il / elle » répondus à l'écran de distribution ;
     * `interactionPublic` est le réglage du studio.
     */
    async creer(
      modeleId: string,
      conteId: string,
      distribution: AttributionBanque[],
      marionnetheque: Marionnette[],
      genresChoisis: Partial<Record<string, Genre>> = {},
      interactionPublic?: NiveauInteraction,
    ) {
      if (phase === 'creation') return;
      phase = 'creation';
      erreur = '';
      avertissements = [];
      spectacleId = null;

      try {
        const r = await instancier(modeleId, distribution, marionnetheque, {
          genresChoisis,
          interactionPublic,
        });
        await enregistrerSpectacle(r.spectacle);
        spectacleId = r.spectacle.id;
        avertissements = r.avertissements;
        rappelSauvegarde = noterSpectacleCree();
        // Un conte joué depuis le fonds ne doit pas revenir aussitôt au
        // Studio, et le modèle ne doit plus être proposé à cette famille.
        if (conteId) noterRencontres([conteId], 'joue');
        noterModeleJoue(modeleId);
        phase = 'termine';
      } catch (e) {
        erreur = e instanceof ErreurInstanciation ? e.message : tba.creation.echec;
        console.error('Le Souffleur — création depuis le fonds :', e);
        phase = 'erreur';
      }
    },

    reinitialiser() {
      phase = 'repos';
      erreur = '';
      avertissements = [];
      spectacleId = null;
    },
  };
}

export const banque = creerEtatBanque();
