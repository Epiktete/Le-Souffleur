// Le spectacle ouvert dans l'écran de script (CDC §8).
//
// Il porte l'édition de chaque élément, l'annulation et le rétablissement sur
// la session, et le recalcul permanent de la durée et des contrôles de scène.
//
// Chaque modification est enregistrée aussitôt : le parent ne doit jamais
// perdre une correction faite la veille du spectacle.

import { enregistrerSpectacle, lireSpectacle, nouvelId } from '../services/db';
import { dureeSpectacle } from '../services/duree';
import { controler, type Probleme } from '../services/scene';
import type { Acte, ElementScript, Id, Spectacle } from '../types';

/** Profondeur de l'historique d'annulation, sur la session seulement. */
const HISTORIQUE_MAX = 50;

function creerSpectacleCourant() {
  let spectacle = $state<Spectacle | null>(null);
  let chargement = $state(true);
  let introuvable = $state(false);
  let enregistrement = $state(false);

  /** Historique : instantanés des actes, avant et après chaque modification. */
  let passe = $state<Acte[][]>([]);
  let futur = $state<Acte[][]>([]);

  let minuteur: ReturnType<typeof setTimeout> | undefined;

  /** Copie ordinaire des actes : ni Proxy, ni référence partagée. */
  function copieActes(actes: Acte[]): Acte[] {
    return structuredClone($state.snapshot(actes)) as Acte[];
  }

  /** Enregistre, au plus une fois par seconde. */
  function enregistrerBientot() {
    if (!spectacle) return;
    clearTimeout(minuteur);
    enregistrement = true;
    minuteur = setTimeout(async () => {
      try {
        if (spectacle) {
          await enregistrerSpectacle($state.snapshot(spectacle) as Spectacle);
        }
      } catch (e) {
        console.error('Le Souffleur — script : échec de l’enregistrement', e);
      } finally {
        enregistrement = false;
      }
    }, 800);
  }

  /** Applique une modification des actes, en la rendant annulable. */
  function modifier(action: (actes: Acte[]) => void) {
    if (!spectacle) return;
    passe = [...passe.slice(-(HISTORIQUE_MAX - 1)), copieActes(spectacle.actes)];
    futur = [];

    const actes = copieActes(spectacle.actes);
    action(actes);
    spectacle.actes = actes;
    spectacle.dureeEstimeeSecondes = dureeSpectacle(actes);
    enregistrerBientot();
  }

  function trouverActe(actes: Acte[], acteId: Id): Acte | undefined {
    return actes.find((a) => a.id === acteId);
  }

  return {
    get spectacle() { return spectacle; },
    get chargement() { return chargement; },
    get introuvable() { return introuvable; },
    get enregistrement() { return enregistrement; },
    get peutAnnuler() { return passe.length > 0; },
    get peutRetablir() { return futur.length > 0; },

    /** Nom d'une marionnette de la distribution figée. */
    nomDe(id: Id): string {
      return spectacle?.distribution.find((m) => m.id === id)?.nom ?? '?';
    },

    /**
     * Couleur attribuée à une marionnette en mode lecture, de 1 à 5 (CDC §9).
     *
     * En représentation, le marionnettiste doit voir d'un coup d'œil que la
     * réplique change de bouche. Le prompteur a cinq teintes : au-delà de
     * cinq marionnettes, les couleurs se répètent. Ce n'est pas gênant, car
     * la couleur ne fait que doubler le nom, qui reste écrit en toutes lettres.
     */
    couleurDe(id: Id): 1 | 2 | 3 | 4 | 5 {
      const rang = spectacle?.distribution.findIndex((m) => m.id === id) ?? -1;
      return (rang < 0 ? 0 : rang % 5) + 1 as 1 | 2 | 3 | 4 | 5;
    },

    /**
     * Badge « M1 » ou « M2 » pour chaque élément parlé, quand il y a deux
     * marionnettistes (CDC §8). Il dépend de la main dans laquelle la
     * marionnette est entrée, donc de tout ce qui précède : la carte est
     * construite en un seul parcours du script.
     */
    get badges(): Map<Id, 'M1' | 'M2'> {
      const carte = new Map<Id, 'M1' | 'M2'>();
      if (!spectacle || spectacle.parametres.nbMarionnettistes < 2) return carte;

      /** Dernière main connue de chaque marionnette. */
      const mainDe = new Map<Id, 'M1' | 'M2'>();
      for (const acte of spectacle.actes) {
        for (const e of acte.elements) {
          if (e.type === 'entree') {
            mainDe.set(e.marionnetteId, e.mainMarionnettiste.startsWith('M1') ? 'M1' : 'M2');
          }
          if (e.type === 'replique' || e.type === 'adresse_public') {
            const main = mainDe.get(e.marionnetteId);
            if (main) carte.set(e.id, main);
          }
        }
      }
      return carte;
    },

    /**
     * Problèmes détectés, recalculés à chaque modification (CDC §8).
     * Ils ne bloquent rien : ce sont des avertissements affichés à côté de
     * l'élément concerné.
     */
    get problemes(): Probleme[] {
      if (!spectacle) return [];
      return controler({
        actes: spectacle.actes,
        nbMarionnettistes: spectacle.parametres.nbMarionnettistes,
        marionnetteIds: spectacle.distribution.map((m) => m.id),
        nomDe: (id) => this.nomDe(id),
        interactionPublic: spectacle.parametres.interactionPublic,
        dureeCibleSecondes: spectacle.parametres.dureeMinutes * 60,
      });
    },

    async charger(id: Id) {
      chargement = true;
      introuvable = false;
      passe = [];
      futur = [];
      try {
        const s = await lireSpectacle(id);
        spectacle = s ?? null;
        introuvable = !s;
      } catch (e) {
        console.error('Le Souffleur — script : échec de la lecture', e);
        introuvable = true;
      } finally {
        chargement = false;
      }
    },

    fermer() {
      clearTimeout(minuteur);
      spectacle = null;
      passe = [];
      futur = [];
    },

    /* ---------------------------------------------------------------- */
    /* En-tête                                                           */
    /* ---------------------------------------------------------------- */

    definirTitre(titre: string) {
      if (!spectacle) return;
      spectacle.titre = titre;
      enregistrerBientot();
    },

    /* ---------------------------------------------------------------- */
    /* Édition des éléments                                              */
    /* ---------------------------------------------------------------- */

    /** Remplace un élément par sa version modifiée. */
    remplacerElement(acteId: Id, element: ElementScript) {
      modifier((actes) => {
        const acte = trouverActe(actes, acteId);
        if (!acte) return;
        const index = acte.elements.findIndex((e) => e.id === element.id);
        if (index >= 0) acte.elements[index] = element;
      });
    },

    /** Insère un nouvel élément avant ou après un autre. */
    insererElement(acteId: Id, voisinId: Id, ou: 'avant' | 'apres', element: ElementScript) {
      modifier((actes) => {
        const acte = trouverActe(actes, acteId);
        if (!acte) return;
        const index = acte.elements.findIndex((e) => e.id === voisinId);
        if (index < 0) return;
        acte.elements.splice(ou === 'avant' ? index : index + 1, 0, element);
      });
    },

    supprimerElement(acteId: Id, elementId: Id) {
      modifier((actes) => {
        const acte = trouverActe(actes, acteId);
        if (!acte) return;
        acte.elements = acte.elements.filter((e) => e.id !== elementId);
      });
    },

    /** Déplace un élément d'un cran vers le haut ou vers le bas. */
    deplacerElement(acteId: Id, elementId: Id, sens: -1 | 1) {
      modifier((actes) => {
        const acte = trouverActe(actes, acteId);
        if (!acte) return;
        const index = acte.elements.findIndex((e) => e.id === elementId);
        const cible = index + sens;
        if (index < 0 || cible < 0 || cible >= acte.elements.length) return;
        const [element] = acte.elements.splice(index, 1);
        acte.elements.splice(cible, 0, element);
      });
    },

    /** Remplace tous les éléments d'un acte, après une régénération. */
    remplacerActe(acteId: Id, elements: ElementScript[]) {
      modifier((actes) => {
        const acte = trouverActe(actes, acteId);
        if (acte) acte.elements = elements;
      });
    },

    /* ---------------------------------------------------------------- */
    /* Annuler et rétablir, sur la session (CDC §8)                      */
    /* ---------------------------------------------------------------- */

    annuler() {
      if (!spectacle || passe.length === 0) return;
      const precedent = passe[passe.length - 1];
      passe = passe.slice(0, -1);
      futur = [copieActes(spectacle.actes), ...futur];
      spectacle.actes = precedent;
      spectacle.dureeEstimeeSecondes = dureeSpectacle(precedent);
      enregistrerBientot();
    },

    retablir() {
      if (!spectacle || futur.length === 0) return;
      const suivant = futur[0];
      futur = futur.slice(1);
      passe = [...passe, copieActes(spectacle.actes)];
      spectacle.actes = suivant;
      spectacle.dureeEstimeeSecondes = dureeSpectacle(suivant);
      enregistrerBientot();
    },
  };
}

export const spectacleCourant = creerSpectacleCourant();

/** Fabrique un élément vierge du type demandé, pour une insertion. */
export function elementVierge(
  type: ElementScript['type'],
  marionnetteId: Id,
): ElementScript {
  const id = nouvelId();
  switch (type) {
    case 'replique':
      return { id, type, marionnetteId, texte: '' };
    case 'adresse_public':
      return { id, type, marionnetteId, texte: '', attenteReponse: false };
    case 'entree':
    case 'sortie':
      return { id, type, marionnetteId, mainMarionnettiste: 'M1G' };
    default:
      return { id, type: type as 'didascalie', texte: '' };
  }
}
