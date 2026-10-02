<script lang="ts">
  // Les deux onglets de la colonne centrale : Studio et Banque (CDC §7,
  // « La colonne centrale a deux modes »). Chaque onglet est une route
  // (#/studio, #/banque) : le bouton retour du navigateur rebascule.
  import { t, tba } from '../textes';
  import { ATELIER_DISPONIBLE } from '../config';
  import { naviguer, type ModeAccueil } from '../services/routeur';

  interface Props {
    mode: ModeAccueil;
  }
  let { mode }: Props = $props();

  // La Contothèque d'abord, à gauche : c'est l'ordre voulu par Nicolas.
  const onglets: [ModeAccueil, string][] = [
    ['banque', tba.onglets.banque],
    ['studio', tba.onglets.studio],
  ];
</script>

<nav class="onglets-mode" aria-label={tba.onglets.legende}>
  {#each onglets as [cle, libelle] (cle)}
    <button
      disabled={cle === 'studio' && !ATELIER_DISPONIBLE}
      class:fonction-en-pause={cle === 'studio' && !ATELIER_DISPONIBLE}
      class:actif={mode === cle}
      aria-current={mode === cle ? 'page' : undefined}
      onclick={() => naviguer({ nom: 'accueil', mode: cle })}
    >{libelle}{#if cle === 'studio' && !ATELIER_DISPONIBLE}<span class="mention-bientot">{t.bientot.badge}</span>{/if}</button>
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
    border: none;
    border-right: var(--bordure) solid var(--encre);
    font-size: 11px;
    letter-spacing: 0.12em;
    box-shadow: none;
  }
  .onglets-mode button:not(:disabled) { background: var(--papier); color: var(--encre); }
  .onglets-mode button:hover:not(:disabled) { background: var(--papier); transform: none; }
  .onglets-mode button:last-child { border-right: none; }
  .onglets-mode button.actif:not(:disabled) {
    background: var(--encre);
    color: var(--papier);
    box-shadow: inset 0 4px 0 var(--accent);
  }
  .onglets-mode button.actif:hover:not(:disabled) { background: var(--encre); }
</style>
