<script lang="ts">
  // Écran d'une adresse qui ne correspond à aucune page de l'application.
  import { t } from '../textes';

  interface Props {
    titre: string;
    message: string;
    /** Identifiant repris de l'URL, affiché pour vérifier le routage. */
    detail?: string;
  }
  let { titre, message, detail }: Props = $props();
</script>

<main>
  <div class="boite boite-ombre">
    <span class="eyebrow">{titre}</span>
    <p>{message}</p>
    {#if detail}
      <p class="secondaire">Identifiant lu dans l’adresse : {detail}</p>
    {/if}
    <a class="bouton secondaire-bouton" href="#/studio">{t.navigation.retourAccueil}</a>
  </div>
</main>

<style>
  main { padding: 24px; }
  .boite { max-width: 560px; padding: 16px; }
  .boite :global(.bouton) { margin-top: 12px; }
  .eyebrow { margin-bottom: 12px; }
</style>
