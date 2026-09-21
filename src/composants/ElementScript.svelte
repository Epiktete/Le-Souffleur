<script lang="ts">
  // Un élément du script : réplique, action, adresse au public, note, entrée
  // ou sortie (CDC §8).
  //
  // Les rendus sont volontairement distincts sans ajouter de couleur hors
  // charte. Exception assumée du §11 : le texte est en casse normale, car les
  // capitales ralentissent la lecture d'un texte long. Seuls les noms des
  // marionnettes et les labels restent en capitales.
  import { tsc } from '../textes';
  import { spectacleCourant, elementVierge } from '../etat/spectacleCourant.svelte';
  import type { ElementScript, Id, Main } from '../types';
  import type { Probleme } from '../services/scene';

  interface Props {
    element: ElementScript;
    acteId: Id;
    /** Position dans l'acte, à partir de 1. Sert à situer un avertissement. */
    position: number;
    /** Avertissements portant sur cet élément. */
    problemes: Probleme[];
    /**
     * « M1 » ou « M2 » avec deux marionnettistes, pour savoir qui parle
     * (CDC §8). Vide sinon.
     */
    badge: string;
    enEdition: boolean;
    surEditer: () => void;
    surFermerEdition: () => void;
  }
  let {
    element, acteId, position, problemes, badge,
    enEdition, surEditer, surFermerEdition,
  }: Props = $props();

  const nom = $derived(
    'marionnetteId' in element ? spectacleCourant.nomDe(element.marionnetteId) : '',
  );

  function libelleMain(main: Main): string {
    return main.endsWith('G') ? tsc.mainGauche : tsc.mainDroite;
  }

  /* ---------------------------------------------------------------- */
  /* Édition sur place                                                 */
  /* ---------------------------------------------------------------- */

  // Copie de travail. La valeur initiale n'a pas d'importance : l'effet
  // ci-dessous la remplace dès que l'édition s'ouvre, et la referme sans rien
  // écrire si le parent annule.
  // svelte-ignore state_referenced_locally
  let brouillon = $state<ElementScript>({ ...element });

  $effect(() => {
    if (enEdition) brouillon = structuredClone($state.snapshot(element)) as ElementScript;
  });

  function valider() {
    spectacleCourant.remplacerElement(acteId, $state.snapshot(brouillon) as ElementScript);
    surFermerEdition();
  }

  function inserer(ou: 'avant' | 'apres') {
    const premiere = spectacleCourant.spectacle?.distribution[0]?.id ?? '';
    spectacleCourant.insererElement(acteId, element.id, ou, elementVierge('replique', premiere));
  }
</script>

<div class="element" class:probleme={problemes.length > 0}>
  {#if enEdition}
    <!-- ---------------------------------------------------------- -->
    <!-- Formulaire d'édition sur place                              -->
    <!-- ---------------------------------------------------------- -->
    <div class="edition">
      <div class="champs">
        {#if 'marionnetteId' in brouillon}
          <label>
            <span class="mono">{tsc.quiParle}</span>
            <select bind:value={brouillon.marionnetteId}>
              {#each spectacleCourant.spectacle?.distribution ?? [] as m (m.id)}
                <option value={m.id}>{m.nom}</option>
              {/each}
            </select>
          </label>
        {/if}

        {#if brouillon.type === 'entree' || brouillon.type === 'sortie'}
          <label>
            <span class="mono">{tsc.main}</span>
            <select bind:value={brouillon.mainMarionnettiste}>
              {#each ['M1G', 'M1D', 'M2G', 'M2D'] as const as m (m)}
                <option value={m}>{m}</option>
              {/each}
            </select>
          </label>
        {/if}

        {#if brouillon.type === 'replique'}
          <label>
            <span class="mono">{tsc.ton}</span>
            <input bind:value={brouillon.ton} maxlength="40" />
          </label>
        {/if}
      </div>

      {#if 'texte' in brouillon}
        <label class="texte">
          <span class="mono">{tsc.typesElements[brouillon.type]}</span>
          <textarea bind:value={brouillon.texte} rows="3"></textarea>
        </label>
      {/if}

      {#if brouillon.type === 'adresse_public'}
        <label class="case">
          <input type="checkbox" bind:checked={brouillon.attenteReponse} />
          <span>{tsc.attendreReponseCase}</span>
        </label>
      {/if}

      <div class="actions">
        <button onclick={valider}>{tsc.valider}</button>
        <button class="secondaire-bouton" onclick={surFermerEdition}>{tsc.annulerEdition}</button>
        <button
          class="secondaire-bouton"
          onclick={() => spectacleCourant.deplacerElement(acteId, element.id, -1)}
          aria-label={tsc.monter}
        >↑</button>
        <button
          class="secondaire-bouton"
          onclick={() => spectacleCourant.deplacerElement(acteId, element.id, 1)}
          aria-label={tsc.descendre}
        >↓</button>
        <button class="secondaire-bouton" onclick={() => inserer('avant')}>
          {tsc.insererAvant}
        </button>
        <button class="secondaire-bouton" onclick={() => inserer('apres')}>
          {tsc.insererApres}
        </button>
        <button
          class="secondaire-bouton"
          onclick={() => spectacleCourant.supprimerElement(acteId, element.id)}
        >{tsc.supprimerElement}</button>
      </div>
    </div>

  {:else}
    <!-- ---------------------------------------------------------- -->
    <!-- Affichage                                                   -->
    <!-- ---------------------------------------------------------- -->
    <button class="lecture" onclick={surEditer} aria-label="{tsc.modifier} ({position})">
      {#if element.type === 'replique'}
        <p class="replique">
          <span class="nom">{nom}</span>
          {#if badge}<span class="badge">{badge}</span>{/if}
          {#if element.ton}<span class="ton">({element.ton})</span>{/if}
          <span class="dit">{element.texte}</span>
        </p>

      {:else if element.type === 'didascalie'}
        <p class="didascalie">
          <span class="mono label">{tsc.labelAction}</span>
          <span class="dit">{element.texte}</span>
        </p>

      {:else if element.type === 'adresse_public'}
        <p class="adresse">
          <span class="mono label">{tsc.labelPublic}</span>
          <span class="nom">{nom}</span>
          {#if badge}<span class="badge">{badge}</span>{/if}
          <span class="dit">{element.texte}</span>
          {#if element.attenteReponse}
            <span class="mono attente">{tsc.attendreReponse}</span>
          {/if}
        </p>

      {:else if element.type === 'note_marionnettiste'}
        <p class="note">
          <span class="mono label">{tsc.labelNote}</span>
          <span class="dit">{element.texte}</span>
        </p>

      {:else}
        <p class="mouvement mono">
          {element.type === 'entree'
            ? tsc.entree(nom, libelleMain(element.mainMarionnettiste))
            : tsc.sortie(nom, libelleMain(element.mainMarionnettiste))}
        </p>
      {/if}
    </button>

    {#if problemes.length > 0}
      <ul class="avertissements">
        {#each problemes as p, i (i)}
          <li>{p.message}</li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .element { margin-bottom: 4px; }

  /* La zone de lecture est un bouton : un clic la rend modifiable (CDC §8). */
  .lecture {
    display: block;
    width: 100%;
    padding: 4px 6px;
    border: none;
    background: transparent;
    color: var(--encre);
    box-shadow: none;
    text-align: left;
    text-transform: none;
    letter-spacing: normal;
    font-family: var(--police-texte);
    font-size: 17px;
    font-weight: 400;
    min-height: 0;
  }
  .lecture:hover {
    background: transparent;
    box-shadow: none;
    transform: none;
    outline: 2px dashed var(--gris);
  }

  p { margin: 0; color: var(--encre); }

  /* Casse normale pour le texte dit, capitales pour les noms et les labels. */
  .dit { font-weight: 400; }

  .nom {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin-right: 6px;
  }
  .ton { font-style: italic; color: var(--encre2); margin-right: 6px; }

  .label {
    display: inline-block;
    margin-right: 8px;
    font-size: 10px;
    color: var(--encre2);
  }

  /* Action scénique : italique, en retrait, précédée d'un label mono. */
  .didascalie { font-style: italic; padding-left: 24px; color: var(--encre2); }

  /* Adresse au public : encadré à bordure encre épaisse. */
  .adresse {
    border: 3px solid var(--encre);
    padding: 8px 10px;
    margin: 6px 0;
  }
  .attente {
    display: inline-block;
    margin-left: 8px;
    font-size: 10px;
    color: var(--encre2);
  }

  /* Note au marionnettiste : fond encre, texte papier. On voit immédiatement
     que ce texte ne se dit pas à voix haute. */
  .note {
    background: var(--encre);
    color: var(--papier);
    padding: 8px 10px;
    margin: 6px 0;
  }
  .note .label { color: var(--papier); }

  /* Entrée ou sortie : ligne pleine largeur en mono. */
  .mouvement {
    padding: 5px 0;
    border-top: 1px solid var(--encre);
    border-bottom: 1px solid var(--encre);
    font-size: 12px;
    letter-spacing: 0.1em;
    color: var(--encre2);
  }

  /* Avertissement non bloquant : le rouge signale (charte §11). */
  .element.probleme .lecture { border-left: 4px solid var(--accent); }
  .avertissements { margin: 2px 0 8px 10px; padding-left: 16px; }
  .avertissements li { font-size: 13px; color: var(--encre); }

  /* --- Édition ------------------------------------------------- */
  .edition {
    border: var(--bordure) solid var(--encre);
    padding: 10px;
    margin: 6px 0;
  }
  .champs { display: flex; flex-wrap: wrap; gap: 10px; }
  label { display: block; font-size: 14px; }
  label > span.mono { display: block; margin-bottom: 3px; font-size: 10px; }
  .texte { margin-top: 10px; }
  .texte textarea { font-size: 16px; }
  select { min-width: 140px; }

  .case { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
  .case input {
    width: 20px;
    min-width: 20px;
    height: 20px;
    min-height: 20px;
    appearance: none;
    -webkit-appearance: none;
    border: var(--bordure) solid var(--encre);
    background: var(--papier);
    padding: 0;
  }
  .case input:checked { background: var(--encre); }

  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .actions button { font-size: 10px; min-height: 36px; padding: 6px 10px; }
</style>
