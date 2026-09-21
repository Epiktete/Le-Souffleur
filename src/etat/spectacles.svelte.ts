// Liste des spectacles, colonne de droite (CDC §7).

import { listerSpectacles, supprimerSpectacle, enregistrerSpectacle } from '../services/db';
import type { Spectacle } from '../types';

function creerSpectacles() {
  let liste = $state<Spectacle[]>([]);
  let chargee = $state(false);

  return {
    get liste() { return liste; },
    get chargee() { return chargee; },

    async charger() {
      try {
        liste = await listerSpectacles();
      } catch (e) {
        console.error('Le Souffleur — spectacles : échec de la lecture', e);
      } finally {
        chargee = true;
      }
    },

    async renommer(id: string, titre: string) {
      const s = liste.find((x) => x.id === id);
      if (!s) return;
      await enregistrerSpectacle({ ...$state.snapshot(s) as Spectacle, titre });
      await this.charger();
    },

    async supprimer(id: string) {
      await supprimerSpectacle(id);
      await this.charger();
    },
  };
}

export const spectacles = creerSpectacles();
