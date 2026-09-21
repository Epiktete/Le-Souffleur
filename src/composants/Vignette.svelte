<script lang="ts">
  // Vignette d'une marionnette : sa photo, ou ses initiales sur fond encre
  // quand elle n'en a pas (CDC §7).
  import { initiales } from '../services/marionnettes';

  interface Props {
    nom: string;
    photo?: Blob;
    /** Côté de la vignette, en pixels. */
    taille?: number;
  }
  let { nom, photo, taille = 44 }: Props = $props();

  // L'URL d'un Blob doit être libérée, sinon la mémoire ne se vide jamais.
  let url = $state<string | null>(null);
  $effect(() => {
    if (!photo) { url = null; return; }
    const nouvelle = URL.createObjectURL(photo);
    url = nouvelle;
    return () => URL.revokeObjectURL(nouvelle);
  });
</script>

<div class="vignette" style="--cote: {taille}px">
  {#if url}
    <img src={url} alt="" />
  {:else}
    <span aria-hidden="true">{initiales(nom)}</span>
  {/if}
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
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
  span {
    font-family: var(--police-mono);
    font-size: calc(var(--cote) * 0.34);
    letter-spacing: 0.06em;
  }
</style>
