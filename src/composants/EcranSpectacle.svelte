<script lang="ts">
  // Ouvrir un spectacle donne accès à deux modes plein écran (CDC §9) :
  // l'édition, pour lire et corriger, et la lecture, pour
  // jouer. On bascule de l'un à l'autre, et on sort par Échap ou par la croix.
  //
  // Ce composant ne fait que porter les deux modes et gérer la sortie : chaque
  // mode a son propre fichier.
  import EcranScript from './EcranScript.svelte';
  import ModeLecture from './ModeLecture.svelte';
  import { lecture } from '../etat/lecture.svelte';
  import { spectacleCourant } from '../etat/spectacleCourant.svelte';
  import { naviguer } from '../services/routeur';
  import { tl } from '../textes';
  import type { Id } from '../types';

  interface Props {
    spectacleId: Id;
    /** 'script' ouvre l'édition, 'jouer' ouvre la lecture. */
    mode: 'script' | 'jouer';
  }
  let { spectacleId, mode }: Props = $props();

  // Le spectacle est chargé ici, une fois pour les deux modes : basculer de
  // l'édition à la lecture ne doit pas le relire ni perdre les corrections.
  $effect(() => {
    void spectacleCourant.charger(spectacleId);
    return () => spectacleCourant.fermer();
  });

  /** Proposition de reprise, affichée avant d'entrer en lecture. */
  let reprisePossible = $state(false);

  /**
   * Décidé une seule fois, à l'entrée en lecture.
   *
   * Cet effet ne doit LIRE aucun état qu'il modifie ensuite : il se
   * réexécuterait au moindre choix du parent et relancerait le spectacle à sa
   * première page, juste après qu'il a demandé à reprendre.
   */
  $effect(() => {
    const id = spectacleId;
    if (mode !== 'jouer') return;

    if (lecture.positionMemorisee(id) > 0) reprisePossible = true;
    else void lecture.commencer(id, false);

    return () => lecture.arreter();
  });

  function reprendre(depuisLeDebut: boolean) {
    reprisePossible = false;
    void lecture.commencer(spectacleId, !depuisLeDebut);
  }

  function quitter() {
    naviguer({ nom: 'accueil' });
  }

  function versLecture() {
    naviguer({ nom: 'jouer', spectacleId });
  }

  function versEdition() {
    naviguer({ nom: 'script', spectacleId });
  }
</script>

{#if mode === 'jouer' && reprisePossible}
  <!-- Reprise à la position quittée (CDC §9) -->
  <div class="reprise">
    <div class="boite boite-ombre">
      <p>{tl.reprendre(lecture.positionMemorisee(spectacleId) + 1)}</p>
      <div class="boutons">
        <button class="cta" onclick={() => reprendre(false)}>
          {tl.reprendre(lecture.positionMemorisee(spectacleId) + 1)}
        </button>
        <button class="secondaire-bouton" onclick={() => reprendre(true)}>
          {tl.recommencer}
        </button>
      </div>
    </div>
  </div>

{:else if mode === 'jouer'}
  {#if spectacleCourant.spectacle}
    <ModeLecture surQuitter={quitter} surEditer={versEdition} />
  {:else}
    <!-- Le spectacle se charge : EcranScript s'en occupe et le partage. -->
    <div class="attente"></div>
  {/if}

{:else}
  <EcranScript {spectacleId} surQuitter={quitter} surLire={versLecture} />
{/if}

<style>
  .reprise {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 20px;
  }
  .boite { max-width: 420px; padding: 16px; }
  .boutons { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }

  .attente { height: 100%; }
</style>
