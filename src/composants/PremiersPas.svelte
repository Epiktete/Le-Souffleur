<script lang="ts">
  // Carte « Premiers pas », en haut du studio : les trois étapes en une ligne
  // chacune, et un bouton vers le tuto détaillé. Elle ne bloque rien, et reste
  // jusqu'à ce que le parent la masque ; le tuto reste ensuite accessible par
  // le bouton « Aide » de l'en-tête.
  import { ttu } from '../textes';
  import { tutoriel } from '../etat/tutoriel.svelte';
</script>

{#if !tutoriel.carteMasquee}
  <section class="premiers-pas boite" aria-labelledby="premiers-pas-titre">
    <h2 id="premiers-pas-titre" class="eyebrow">{ttu.carte.titre}</h2>
    <ol>
      {#each ttu.carte.resume as ligne, i (i)}
        <li>
          <button type="button" class="lien" onclick={() => tutoriel.ouvrir(i)}>{ligne}</button>
        </li>
      {/each}
    </ol>
    <div class="boutons">
      <button type="button" onclick={() => tutoriel.ouvrir(0)}>{ttu.carte.ouvrir}</button>
      <button type="button" class="secondaire-bouton" onclick={() => tutoriel.masquerCarte()}>
        {ttu.carte.masquer}
      </button>
    </div>
  </section>
{/if}

<style>
  .premiers-pas { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  h2 { align-self: flex-start; margin: 0; }
  ol { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 4px; }
  /* Chaque étape ouvre le tuto à cette étape-là : un lien, pas un bouton gris. */
  .lien {
    min-height: 0;
    line-height: 1.4;
    padding: 0;
    border: none;
    background: none;
    box-shadow: none;
    color: var(--encre);
    font: inherit;
    font-size: 14px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .boutons { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
</style>
