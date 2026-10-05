<script lang="ts">
  // Une des trois colonnes de l'accueil (CDC §7).
  // Porte son eyebrow mono sur pastille encre et le contenu qui lui est confié.
  import type { Snippet } from 'svelte';

  interface Props {
    libelle: string;
    /** Message affiché quand la colonne n'a rien à montrer. */
    vide?: string;
    children?: Snippet;
  }
  let { libelle, vide, children }: Props = $props();
</script>

<section aria-label={libelle}>
  <div class="tete">
    <span class="eyebrow">{libelle}</span>
  </div>
  <div class="contenu">
    {#if children}
      {@render children()}
    {:else if vide}
      <p class="secondaire">{vide}</p>
    {/if}
  </div>
</section>

<style>
  section { display: flex; flex-direction: column; min-height: 0; height: 100%; }
  .tete { padding: 12px 12px 8px; }
  .contenu { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 16px; }
</style>
