<script lang="ts">
  // Accueil : les trois colonnes du CDC §7.
  //   - marionnethèque à gauche, 300 px
  //   - studio au centre, flexible
  //   - spectacles à droite, 280 px
  //
  // Sous 1024 px, les colonnes latérales deviennent des tiroirs ouverts depuis
  // l'en-tête ; sous 700 px, la navigation passe par des onglets en bas d'écran.
  import Colonne from './Colonne.svelte';
  import Bibliotheque from './Bibliotheque.svelte';
  import Studio from './Studio.svelte';
  import ColonneSpectacles from './ColonneSpectacles.svelte';
  import { t } from '../textes';
  import { largeur } from '../largeur.svelte';

  type Panneau = 'bibliotheque' | 'spectacles';

  interface Props {
    /** Tiroir ouvert, piloté par l'en-tête. */
    tiroir: Panneau | null;
    surFermerTiroir: () => void;
  }
  let { tiroir, surFermerTiroir }: Props = $props();

  /** Onglet visible sous 700 px. */
  let ongletActif = $state<Panneau | 'studio'>('studio');

  const onglets: [Panneau | 'studio', string][] = [
    ['bibliotheque', t.colonnes.bibliotheque],
    ['studio', t.colonnes.studio],
    ['spectacles', t.colonnes.spectacles],
  ];
</script>

{#if largeur.tresEtroit}
  <!-- Sous 700 px : un seul panneau à la fois. -->
  <main class="panneau-unique">
    {#if ongletActif === 'bibliotheque'}
      <Colonne libelle={t.colonnes.bibliotheque}><Bibliotheque /></Colonne>
    {:else if ongletActif === 'studio'}
      <Colonne libelle={t.colonnes.studio}><Studio /></Colonne>
    {:else}
      <Colonne libelle={t.colonnes.spectacles}><ColonneSpectacles /></Colonne>
    {/if}
  </main>

  <nav class="barre-onglets" aria-label={t.navigation.accueil}>
    {#each onglets as [cle, libelle] (cle)}
      <button
        class:actif={ongletActif === cle}
        aria-current={ongletActif === cle ? 'page' : undefined}
        onclick={() => (ongletActif = cle)}
      >{libelle}</button>
    {/each}
  </nav>
{:else}
  <main class="trois-colonnes" class:etroit={largeur.etroit}>
    {#if !largeur.etroit}
      <div class="bibliotheque">
        <Colonne libelle={t.colonnes.bibliotheque}><Bibliotheque /></Colonne>
      </div>
    {/if}

    <div class="studio">
      <Colonne libelle={t.colonnes.studio}><Studio /></Colonne>
    </div>

    {#if !largeur.etroit}
      <div class="spectacles">
        <Colonne libelle={t.colonnes.spectacles}><ColonneSpectacles /></Colonne>
      </div>
    {/if}
  </main>

  {#if largeur.etroit && tiroir}
    <div class="tiroir" class:droite={tiroir === 'spectacles'}>
      <div class="tiroir-tete">
        <button class="secondaire-bouton" onclick={surFermerTiroir}>{t.entete.fermer}</button>
      </div>
      {#if tiroir === 'bibliotheque'}
        <Colonne libelle={t.colonnes.bibliotheque}><Bibliotheque /></Colonne>
      {:else}
        <Colonne libelle={t.colonnes.spectacles}><ColonneSpectacles /></Colonne>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .trois-colonnes {
    display: grid;
    /* 300 px | flexible | 280 px, comme le CDC §7 l'impose. */
    grid-template-columns: var(--largeur-bibliotheque) minmax(0, 1fr) var(--largeur-spectacles);
    min-height: 0;
    height: 100%;
  }
  .trois-colonnes.etroit { grid-template-columns: minmax(0, 1fr); }

  .bibliotheque { border-right: var(--bordure) solid var(--encre); min-width: 0; }
  .spectacles { border-left: var(--bordure) solid var(--encre); min-width: 0; }
  .studio { min-width: 0; }

  .panneau-unique { min-height: 0; height: 100%; }

  /* Tiroir : il recouvre le studio, bordure pleine du côté de l'écran. */
  .tiroir {
    position: fixed;
    top: var(--hauteur-entete);
    bottom: 0;
    left: 0;
    width: min(320px, 85vw);
    background: var(--papier);
    border-right: var(--bordure) solid var(--encre);
    display: flex;
    flex-direction: column;
    z-index: 10;
  }
  .tiroir.droite {
    left: auto;
    right: 0;
    border-right: none;
    border-left: var(--bordure) solid var(--encre);
  }
  .tiroir-tete { padding: 8px 12px 0; }

  .barre-onglets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: var(--bordure) solid var(--encre);
  }
  .barre-onglets button {
    background: var(--papier);
    color: var(--encre);
    border: none;
    border-right: var(--bordure) solid var(--encre);
    font-size: 10px;
    box-shadow: none;
  }
  .barre-onglets button:hover { background: var(--papier); transform: none; }
  .barre-onglets button:last-child { border-right: none; }
  /* L'onglet courant : encre, plus la barre accent « vous êtes ici » (§11). */
  .barre-onglets button.actif {
    background: var(--encre);
    color: var(--papier);
    box-shadow: inset 0 4px 0 var(--accent);
  }
  .barre-onglets button.actif:hover { background: var(--encre); }
</style>
