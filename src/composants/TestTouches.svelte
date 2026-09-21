<script lang="ts">
  // Page de test des touches (CDC §9).
  //
  // Elle affiche la touche reçue à chaque appui, pour vérifier une pédale
  // AVANT le spectacle plutôt que devant les enfants. Elle emploie exactement
  // la même logique que le mode lecture, y compris l'anti-rebond : ce qui est
  // ignoré ici le sera aussi pendant la représentation.
  import { tl } from '../textes';
  import {
    commandeDe,
    empecherDefaut,
    filtrer,
    soumisAuRebond,
    type Rejet,
  } from '../services/commandes';

  interface Props {
    surFermer: () => void;
  }
  let { surFermer }: Props = $props();

  interface Appui {
    touche: string;
    effet: string;
    rejet: Rejet;
    horodatage: number;
  }

  let appuis = $state<Appui[]>([]);
  let dernierRetenu: number | null = null;

  function libelleEffet(touche: string): string {
    const c = commandeDe(touche);
    if (c === 'suivant') return tl.test.effetSuivant;
    if (c === 'precedent') return tl.test.effetPrecedent;
    if (c === 'quitter') return tl.quitter;
    if (c === 'menu') return tl.menu;
    if (c === 'debut') return tl.debut;
    if (c === 'plusGrand') return tl.texteplus;
    if (c === 'plusPetit') return tl.textemoins;
    return tl.test.effetAucun;
  }

  function surTouche(e: KeyboardEvent) {
    // Échap ferme la page de test : c'est la seule touche qui garde son sens.
    if (e.key === 'Escape') { surFermer(); return; }
    if (empecherDefaut(e.key)) e.preventDefault();

    // Même règle que pendant le spectacle : ce qui est ignoré ici le sera là.
    const rebond = soumisAuRebond(commandeDe(e.key));
    const rejet = filtrer(e.repeat, e.timeStamp, rebond ? dernierRetenu : null);
    if (!rejet && rebond) dernierRetenu = e.timeStamp;

    appuis = [
      { touche: nommer(e.key), effet: libelleEffet(e.key), rejet, horodatage: Date.now() },
      ...appuis,
    ].slice(0, 12);
  }

  /** Un espace ne se voit pas : on le nomme. */
  function nommer(touche: string): string {
    if (touche === ' ' || touche === 'Spacebar') return 'Espace';
    return touche;
  }
</script>

<svelte:window onkeydown={surTouche} />

<div class="test" role="dialog" aria-modal="true" aria-label={tl.test.titre}>
  <div class="boite">
    <div class="tete">
      <h2>{tl.test.titre}</h2>
      <button class="secondaire-bouton" onclick={surFermer}>{tl.fermer}</button>
    </div>

    <p class="aide">{tl.test.aide}</p>

    {#if appuis.length === 0}
      <p class="attente mono" aria-live="polite">{tl.test.enAttente}</p>
    {:else}
      <ul aria-live="polite">
        {#each appuis as a (a.horodatage)}
          <li class:ignore={a.rejet !== null}>
            <span class="touche mono">{a.touche}</span>
            <span class="effet">
              {#if a.rejet === 'repetition'}
                {tl.test.ignoreRepetition}
              {:else if a.rejet === 'rebond'}
                {tl.test.ignoreRebond}
              {:else}
                {a.effet}
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .test {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgb(10 10 10 / 0.8);
    z-index: 50;
  }
  .boite {
    width: min(560px, 100%);
    max-height: 90vh;
    overflow-y: auto;
    padding: 16px;
    border: var(--bordure) solid var(--encre);
    background: var(--papier);
    box-shadow: var(--ombre) var(--ombre) 0 var(--encre);
  }

  .tete { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .tete h2 { flex: 1; font-size: 17px; }
  .tete button { font-size: 10px; min-height: 36px; }

  .aide { font-size: 13px; color: var(--encre2); }
  .attente { font-size: 12px; color: var(--encre2); margin-top: 16px; }

  ul { list-style: none; margin: 14px 0 0; padding: 0; }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--gris);
  }
  /* Un appui ignoré est marqué : c'est une information utile, pas une erreur. */
  li.ignore { opacity: 0.6; }

  .touche {
    min-width: 8ch;
    padding: 4px 8px;
    border: var(--bordure) solid var(--encre);
    font-size: 13px;
    text-transform: none;
    letter-spacing: 0.06em;
  }
  .effet { font-size: 14px; color: var(--encre); }
</style>
