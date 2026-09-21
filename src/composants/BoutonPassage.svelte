<script lang="ts">
  // Bouton fléché placé sur le côté d'une boîte, pour faire passer une
  // marionnette de la bibliothèque à la scène et inversement.
  //
  // Il tient lieu de glisser-déposer (CDC §7). Le sens de la flèche suit la
  // disposition des colonnes, la
  // bibliothèque étant à gauche et le studio au centre. Tout fonctionne au clic
  // comme au clavier, sans dépendre de la précision du pointeur.

  interface Props {
    /** 'droite' envoie vers la scène, 'gauche' renvoie vers la bibliothèque. */
    sens: 'droite' | 'gauche';
    /** Libellé lu par les lecteurs d'écran, la flèche seule ne disant rien. */
    libelle: string;
    desactive?: boolean;
    surAction: () => void;
  }
  let { sens, libelle, desactive = false, surAction }: Props = $props();
</script>

<button
  type="button"
  class="passage"
  class:gauche={sens === 'gauche'}
  title={libelle}
  aria-label={libelle}
  disabled={desactive}
  onclick={surAction}
>
  <!-- Chevron dessiné en SVG : pas d'emoji dans l'interface (CDC §11). -->
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {#if sens === 'droite'}
      <path d="M8 4 L18 12 L8 20" />
    {:else}
      <path d="M16 4 L6 12 L16 20" />
    {/if}
  </svg>
</button>

<style>
  .passage {
    /* Cible tactile pleine hauteur, collée au bord de la boîte. */
    width: var(--cible-tactile);
    min-width: var(--cible-tactile);
    align-self: stretch;
    min-height: var(--cible-tactile);
    padding: 0;
    border: none;
    border-left: var(--bordure) solid var(--encre);
    background: var(--gris);
    color: var(--papier);
    box-shadow: none;
  }
  .passage.gauche {
    border-left: none;
    border-right: var(--bordure) solid var(--encre);
  }
  .passage:hover:not(:disabled) {
    box-shadow: none;
    background: var(--encre2);
    transform: none;
  }
  .passage:disabled { background: var(--papier); color: var(--gris); opacity: 1; }

  svg {
    width: 20px;
    height: 20px;
    display: block;
    margin: 0 auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    /* Angles droits jusque dans les icônes (charte §11). */
    stroke-linecap: butt;
    stroke-linejoin: miter;
  }
</style>
