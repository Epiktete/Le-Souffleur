// État de la bibliothèque de marionnettes, partagé par les composants.
//
// C'est le seul endroit qui parle au service de stockage pour les marionnettes :
// les composants se contentent de lire `liste` et d'appeler ces fonctions.

import {
  enregistrerMarionnette,
  listerMarionnettes,
  supprimerMarionnette,
} from '../services/db';
import { dupliquerMarionnette } from '../services/marionnettes';
import type { Marionnette } from '../types';

/**
 * Svelte enveloppe l'état réactif dans des objets Proxy. IndexedDB, qui copie
 * les données avec l'algorithme de clonage structuré du navigateur, refuse ces
 * objets et lève une erreur. On en prend donc un instantané ordinaire avant
 * toute écriture.
 */
function instantane(m: Marionnette): Marionnette {
  return $state.snapshot(m) as Marionnette;
}

/** Le détail des erreurs part dans la console : il aide au diagnostic et ne
 *  contient aucune donnée sensible (la clé API n'est pas gérée ici). */
function journaliser(operation: string, e: unknown) {
  console.error(`Le Souffleur — ${operation} : échec du stockage`, e);
}

function creerBibliotheque() {
  let liste = $state<Marionnette[]>([]);
  let chargee = $state(false);
  let erreur = $state<string | null>(null);

  return {
    get liste() { return liste; },
    /** Faux tant que la première lecture du stockage n'est pas revenue. */
    get chargee() { return chargee; },
    /** Message à afficher si le stockage a refusé une opération. */
    get erreur() { return erreur; },

    /** Lit le stockage. Appelée une fois au montage de la bibliothèque. */
    async charger() {
      try {
        liste = await listerMarionnettes();
        erreur = null;
      } catch (e) {
        journaliser('lecture', e);
        erreur = String(e);
      } finally {
        chargee = true;
      }
    },

    /** Crée ou met à jour une marionnette, puis rafraîchit la liste. */
    async enregistrer(m: Marionnette): Promise<boolean> {
      try {
        await enregistrerMarionnette(instantane(m));
        liste = await listerMarionnettes();
        erreur = null;
        return true;
      } catch (e) {
        journaliser('enregistrement', e);
        erreur = String(e);
        return false;
      }
    },

    async supprimer(id: string): Promise<boolean> {
      try {
        await supprimerMarionnette(id);
        liste = await listerMarionnettes();
        erreur = null;
        return true;
      } catch (e) {
        journaliser('suppression', e);
        erreur = String(e);
        return false;
      }
    },

    /** Duplique une marionnette et renvoie la copie enregistrée. */
    async dupliquer(source: Marionnette): Promise<Marionnette | null> {
      const copie = dupliquerMarionnette(instantane(source), liste.map((m) => m.nom));
      return (await this.enregistrer(copie)) ? copie : null;
    },
  };
}

export const bibliotheque = creerBibliotheque();
