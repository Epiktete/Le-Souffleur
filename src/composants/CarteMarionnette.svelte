<script lang="ts">
  // Une boîte de la bibliothèque (CDC §7) : vignette, nom, jusqu'à 3 traits.
  // Un clic déplie la fiche complète dans la colonne, avec ses actions.
  import Vignette from './Vignette.svelte';
  import BoutonPassage from './BoutonPassage.svelte';
  import { tb, ts } from '../textes';
  import type { Marionnette } from '../types';

  interface Props {
    marionnette: Marionnette;
    depliee: boolean;
    /** Vraie si la marionnette est déjà sur la scène du studio. */
    enScene: boolean;
    /** Vraie si la scène a atteint ses 6 marionnettes. */
    scenePleine: boolean;
    surBasculer: () => void;
    surModifier: () => void;
    surDupliquer: () => void;
    surSupprimer: () => void;
    /** Envoie la marionnette vers la scène. */
    surMettreEnScene: () => void;
  }
  let {
    marionnette: m, depliee, enScene, scenePleine,
    surBasculer, surModifier, surDupliquer, surSupprimer, surMettreEnScene,
  }: Props = $props();

  /** La boîte n'affiche que 3 traits ; la fiche dépliée les montre tous. */
  const traitsVisibles = $derived(m.traits.slice(0, 3));
  const traitsCaches = $derived(Math.max(0, m.traits.length - 3));
</script>

<article class="boite boite-ombre" class:en-scene={enScene}>
  <div class="rangee">
    <!-- Le bouton porte le clic : la boîte reste accessible au clavier. -->
    <button class="tete" onclick={surBasculer} aria-expanded={depliee}>
      <Vignette nom={m.nom} />
      <span class="identite">
        <span class="nom">{m.nom}</span>
        {#if traitsVisibles.length > 0}
          <span class="traits">
            {#each traitsVisibles as trait (trait)}
              <span class="badge">{trait}</span>
            {/each}
            {#if traitsCaches > 0}<span class="badge">+{traitsCaches}</span>{/if}
          </span>
        {/if}
        {#if enScene}
          <span class="mono en-scene-mention">{ts.scene.dejaEnScene}</span>
        {/if}
      </span>
    </button>

    <!-- Flèche vers la droite : de la bibliothèque vers la scène. -->
    <BoutonPassage
      sens="droite"
      libelle={ts.scene.versLaScene(m.nom)}
      desactive={enScene || scenePleine}
      surAction={surMettreEnScene}
    />
  </div>

  {#if depliee}
    <div class="fiche">
      {#if m.description}
        <p>{m.description}</p>
      {/if}

      {#if m.traits.length > 0}
        <p class="ligne">
          <span class="mono etiquette">{tb.champTraits}</span>
          <span class="traits">
            {#each m.traits as trait (trait)}
              <span class="badge">{trait}</span>
            {/each}
          </span>
        </p>
      {/if}

      {#if m.voix}
        <p class="ligne">
          <span class="mono etiquette">{tb.champVoix}</span>
          <span>{m.voix}</span>
        </p>
      {/if}

      <div class="actions">
        <button class="secondaire-bouton" onclick={surModifier}>{tb.modifier}</button>
        <button class="secondaire-bouton" onclick={surDupliquer}>{tb.dupliquer}</button>
        <button class="secondaire-bouton" onclick={surSupprimer}>{tb.supprimer}</button>
      </div>
    </div>
  {/if}
</article>

<style>
  article { margin-bottom: calc(var(--ombre) + 8px); }

  /* La boîte et son bouton de passage forment une rangée. */
  .rangee { display: flex; align-items: stretch; }

  /* Marionnette retenue pour le spectacle : barre accent à gauche. Elle marque
     un état, elle ne décore pas (§11). */
  article.en-scene { border-left: 6px solid var(--accent); }
  .en-scene-mention { color: var(--encre2); font-size: 10px; }

  /* La tête de boîte est un bouton, mais elle doit ressembler à la boîte. */
  .tete {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
    padding: 8px;
    border: none;
    background: var(--papier);
    color: var(--encre);
    text-align: left;
    text-transform: none;
    letter-spacing: normal;
    font-family: var(--police-texte);
    font-size: 15px;
    font-weight: 400;
    /* Ni relief ni décalage : la boîte qui l'entoure porte déjà les deux. */
    box-shadow: none;
  }
  .tete:hover {
    box-shadow: none;
    background: var(--papier);
    transform: none;
  }

  .identite { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .nom {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }
  .traits { display: flex; flex-wrap: wrap; gap: 4px; }

  .fiche {
    padding: 0 8px 8px;
    border-top: var(--bordure) solid var(--encre);
    margin-top: 4px;
    padding-top: 8px;
  }
  .fiche p { font-size: 14px; }
  .ligne { display: flex; flex-direction: column; gap: 4px; }
  .etiquette { color: var(--encre2); }

  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .actions :global(button) { min-height: var(--cible-tactile); padding: 8px 10px; font-size: 10px; }
</style>
