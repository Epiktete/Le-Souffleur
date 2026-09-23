<script lang="ts">
  // La scène : le haut du studio, où se rassemblent les marionnettes du
  // spectacle à venir (CDC §7). De 1 à 6 marionnettes.
  //
  // Chaque boîte porte sur son côté gauche une flèche qui la renvoie vers la
  // bibliothèque. Pas de glisser-déposer : un clic suffit, au clavier aussi.
  import Vignette from './Vignette.svelte';
  import BoutonPassage from './BoutonPassage.svelte';
  import { BORNES } from '../config';
  import { ts } from '../textes';
  import { bibliotheque } from '../etat/bibliotheque.svelte';
  import { studio } from '../etat/studio.svelte';

  // Les marionnettes de la scène, dans l'ordre où elles ont été ajoutées.
  const enScene = $derived(
    studio.valeurs.marionnetteIds
      .map((id) => bibliotheque.liste.find((m) => m.id === id))
      .filter((m) => m !== undefined),
  );
</script>

<section class="scene" data-visite="personnages" class:vide={studio.sceneVide} aria-label={ts.scene.titre}>
  <div class="tete">
    <h3 class="eyebrow-secondaire">{ts.scene.titre}</h3>
    <span class="mono compte" aria-live="polite">
      {ts.scene.compte(enScene.length, BORNES.marionnettesParSpectacle.max)}
    </span>
  </div>

  {#if studio.sceneVide}
    <p class="secondaire invite">{ts.scene.vide}</p>
    <!-- Rien n'oblige à choisir : l'outil sait le faire (CDC §7). -->
    {#if bibliotheque.liste.length > 0}
      <p class="secondaire invite">{ts.scene.videAutomatique}</p>
    {/if}
  {:else}
    <ul>
      {#each enScene as m (m.id)}
        <li class="boite">
          <div class="rangee">
            <!-- Flèche vers la gauche : de la scène vers la bibliothèque. -->
            <BoutonPassage
              sens="gauche"
              libelle={ts.scene.versLaBibliotheque(m.nom)}
              surAction={() => studio.retirer(m.id)}
            />
            <div class="identite">
              <Vignette nom={m.nom} taille={36} />
              <span class="nom">{m.nom}</span>
            </div>
          </div>
        </li>
      {/each}
    </ul>

    {#if studio.scenePleine}
      <p class="secondaire">{ts.scene.pleine(BORNES.marionnettesParSpectacle.max)}</p>
    {/if}
  {/if}

  <!--
    Message d'aide contextuel, pas une erreur (CDC §7) : avoir plus de
    marionnettes que de mains est parfaitement jouable, le script gérera les
    entrées et les sorties.
  -->
  {#if studio.plusDeMarionnettesQueDeMains}
    <p class="aide-mains" aria-live="polite">
      {ts.aideMains(
        enScene.length,
        studio.valeurs.nbMarionnettistes,
        studio.mainsDisponibles,
      )}
    </p>
  {/if}
</section>

<style>
  .scene {
    /* Bordure en pointillés longs quand la scène est vide, pleine sinon (§11). */
    border: var(--bordure) solid var(--encre);
    padding: 12px;
    margin-bottom: 20px;
  }
  .scene.vide { border-style: dashed; }

  .tete {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .compte { color: var(--encre2); }

  .invite { font-size: 13px; max-width: 46ch; }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  li { flex: 0 1 auto; }

  .rangee { display: flex; align-items: stretch; }
  .identite { display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 8px; }
  .nom {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    font-size: 14px;
  }

  /* Le rouge signale : ici ce n'est qu'une information, donc bordure encre. */
  .aide-mains {
    margin: 12px 0 0;
    padding: 8px 10px;
    border-left: 4px solid var(--encre);
    background: var(--papier);
    font-size: 13px;
    color: var(--encre2);
  }

  .secondaire { margin-top: 10px; font-size: 12px; }
</style>
