<script lang="ts">
  // Vignette d'une marionnette : ses initiales sur fond encre (CDC §7).
  import { initiales } from '../services/marionnettes';

  interface Props {
    nom: string;
    /** Côté de la vignette, en pixels. */
    taille?: number;
  }
  let { nom, taille = 44 }: Props = $props();
</script>

<div class="vignette" style="--cote: {taille}px">
  <span aria-hidden="true">{initiales(nom)}</span>
</div>

<style>
  .vignette {
    width: var(--cote);
    height: var(--cote);
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border: var(--bordure) solid var(--encre);
    background: var(--encre);
    color: var(--papier);
    overflow: hidden;
  }
  span {
    font-family: var(--police-mono);
    font-size: calc(var(--cote) * 0.34);
    letter-spacing: 0.06em;
  }
</style>
