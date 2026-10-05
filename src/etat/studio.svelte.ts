// Réglages du studio : la scène et les curseurs (CDC §7).
//
// Ces réglages sont conservés entre deux visites : le CDC §7 le demande
// explicitement. Ils sont donc relus au démarrage et réenregistrés à chaque
// changement, avec un léger délai pour ne pas écrire à chaque pixel de curseur.

import { BORNES } from '../config';
import { ecrireReglage, lireReglage } from '../services/db';
import type { Id, NiveauInteraction, ReglagesStudio } from '../types';

/**
 * Niveau d'interaction proposé par défaut selon l'âge (CDC §7 : « valeur par
 * défaut déduite de l'âge », et tableau d'adaptation à l'âge du §6).
 */
export function interactionParDefaut(age: number): NiveauInteraction {
  if (age <= 6) return 'beaucoup';
  if (age <= 8) return 'quelques';
  return 'quelques';
}

function reglagesInitiaux(): ReglagesStudio {
  const age = BORNES.ageAuditoire.defaut;
  return {
    dureeMinutes: BORNES.dureeMinutes.defaut,
    ageAuditoire: age,
    nbMarionnettistes: 1,
    interactionPublic: interactionParDefaut(age),
    marionnetteIds: [],
    ebauche: '',
  };
}

function creerStudio() {
  let r = $state<ReglagesStudio>(reglagesInitiaux());
  let chargee = $state(false);
  /** Vrai quand l'utilisateur a choisi l'interaction lui-même : on ne la
   *  déduira plus de l'âge, pour ne pas écraser son choix. */
  let interactionChoisieALaMain = $state(false);
  let minuteurEcriture: ReturnType<typeof setTimeout> | undefined;

  /** Enregistre, au plus une fois toutes les 400 ms. */
  function enregistrerBientot() {
    if (!chargee) return; // on n'écrase pas le stockage avant de l'avoir lu
    clearTimeout(minuteurEcriture);
    minuteurEcriture = setTimeout(() => {
      void ecrireReglage('studio', $state.snapshot(r) as ReglagesStudio).catch((e) => {
        console.error('Le Souffleur — réglages du studio : échec du stockage', e);
      });
    }, 400);
  }

  return {
    get valeurs() { return r; },
    get chargee() { return chargee; },

    /** Nombre de mains disponibles : 2 par marionnettiste (CDC §1). */
    get mainsDisponibles() {
      return r.nbMarionnettistes * BORNES.mainsParMarionnettiste;
    },

    /** Vrai s'il y a plus de marionnettes que de mains : message d'aide (§7). */
    get plusDeMarionnettesQueDeMains() {
      return r.marionnetteIds.length > this.mainsDisponibles;
    },

    get sceneVide() { return r.marionnetteIds.length === 0; },

    get scenePleine() {
      return r.marionnetteIds.length >= BORNES.marionnettesParSpectacle.max;
    },

    async charger() {
      try {
        const enregistres = await lireReglage('studio');
        if (enregistres) {
          r = { ...reglagesInitiaux(), ...enregistres };
          // Des réglages relus viennent d'un choix de l'utilisateur.
          interactionChoisieALaMain = true;
        }
      } catch (e) {
        console.error('Le Souffleur — réglages du studio : échec de la lecture', e);
      } finally {
        chargee = true;
      }
    },

    /** Ajoute une marionnette à la scène, si la place le permet. */
    ajouter(id: Id) {
      if (r.marionnetteIds.includes(id) || this.scenePleine) return;
      r.marionnetteIds = [...r.marionnetteIds, id];
      enregistrerBientot();
    },

    /**
     * Remplace la scène par cette troupe, dans l'ordre donné.
     *
     * Sert au mode automatique : quand le parent retient une histoire choisie
     * sans qu'il ait garni la scène, il doit retrouver sur la scène les
     * marionnettes que l'outil a distribuées (CDC §7).
     */
    garnirScene(ids: Id[]) {
      const troupe = ids.slice(0, BORNES.marionnettesParSpectacle.max);
      if (troupe.length === 0) return;
      r.marionnetteIds = troupe;
      enregistrerBientot();
    },

    retirer(id: Id) {
      r.marionnetteIds = r.marionnetteIds.filter((x) => x !== id);
      enregistrerBientot();
    },

    enScene(id: Id) {
      return r.marionnetteIds.includes(id);
    },

    /** Retire de la scène des marionnettes qui n'existent plus (suppression). */
    nettoyer(idsExistants: Id[]) {
      const connus = new Set(idsExistants);
      const filtres = r.marionnetteIds.filter((id) => connus.has(id));
      if (filtres.length !== r.marionnetteIds.length) {
        r.marionnetteIds = filtres;
        enregistrerBientot();
      }
    },

    definirDuree(minutes: number) {
      r.dureeMinutes = minutes;
      enregistrerBientot();
    },

    definirAge(ans: number) {
      r.ageAuditoire = ans;
      // L'interaction suit l'âge tant que l'utilisateur ne l'a pas fixée.
      if (!interactionChoisieALaMain) r.interactionPublic = interactionParDefaut(ans);
      enregistrerBientot();
    },

    definirMarionnettistes(nb: 1 | 2) {
      r.nbMarionnettistes = nb;
      enregistrerBientot();
    },

    definirInteraction(niveau: NiveauInteraction) {
      r.interactionPublic = niveau;
      interactionChoisieALaMain = true;
      enregistrerBientot();
    },

    definirEbauche(texte: string) {
      r.ebauche = texte.slice(0, BORNES.ebauche.max);
      enregistrerBientot();
    },
  };
}

export const studio = creerStudio();
