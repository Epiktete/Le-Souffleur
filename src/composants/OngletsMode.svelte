<script lang="ts">
  // Les deux onglets de la colonne centrale : Studio et Banque (CDC §7,
  // « La colonne centrale a deux modes »). Chaque onglet est une route
  // (#/studio, #/banque) : le bouton retour du navigateur rebascule.
  import { tba } from '../textes';
  import { naviguer, type ModeAccueil } from '../services/routeur';

  interface Props {
    mode: ModeAccueil;
  }
  let { mode }: Props = $props();

  const onglets: [ModeAccueil, string][] = [
    ['studio', tba.onglets.studio],
    ['banque', tba.onglets.banque],
  ];
</script>

<nav class="onglets-mode" aria-label={tba.onglets.legende}>
  {#each onglets as [cle, libelle] (cle)}
    <button
      class:actif={mode === cle}
      aria-current={mode === cle ? 'page' : undefined}
      onclick={() => naviguer({ nom: 'accueil', mode: cle })}
    >{libelle}</button>
  {/each}
</nav>

<style>
  /* Même langage que la barre d'onglets des écrans étroits : boutons plats,
     l'onglet courant en encre avec la barre accent « vous êtes ici » (§11). */
  .onglets-mode {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border: var(--bordure) solid var(--encre);
  }
  .onglets-mode button {
    background: var(--papier);
    color: var(--encre);
    border: none;
    border-right: var(--bordure) solid var(--encre);
    font-size: 11px;
    letter-spacing: 0.12em;
    box-shadow: none;
  }
  .onglets-mode button:hover { background: var(--papier); transform: none; }
  .onglets-mode button:last-child { border-right: none; }
  .onglets-mode button.actif {
    background: var(--encre);
    color: var(--papier);
    box-shadow: inset 0 4px 0 var(--accent);
  }
  .onglets-mode button.actif:hover { background: var(--encre); }
</style>
