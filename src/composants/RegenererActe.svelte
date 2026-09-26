<script lang="ts">
  // Régénération d'un acte depuis l'écran de script (CDC §6 et §8).
  //
  // L'ancienne version est gardée le temps de comparer : rien n'est remplacé
  // tant que le parent n'a pas tranché.
  import { onDestroy } from 'svelte';
  import { t, tsc } from '../textes';
  import { spectacleCourant } from '../etat/spectacleCourant.svelte';
  import { reglagesIa } from '../etat/reglagesIa.svelte';
  import { regenererActe } from '../services/pipeline';
  import { ErreurIa } from '../services/connecteurIa';
  import type { ElementScript, Id } from '../types';

  interface Props {
    acteId: Id;
    acteNumero: number;
  }
  let { acteId, acteNumero }: Props = $props();

  let ouvert = $state(false);
  let consigne = $state('');
  let enCours = $state(false);
  let erreur = $state<string | null>(null);
  /** Ancienne version, conservée le temps de la comparaison. */
  let ancienne = $state<ElementScript[] | null>(null);

  let controleur: AbortController | null = null;

  // L'appel est lié à cet écran : quitter le script, ou passer en mode Jouer,
  // l'annule. Sinon l'acte était remplacé en pleine lecture, sans les boutons
  // « Garder / Revenir » pour trancher.
  onDestroy(() => controleur?.abort());

  async function lancer() {
    const s = spectacleCourant.spectacle;
    if (!s || !reglagesIa.pretPourGenerer) {
      erreur = 'Configurez votre clé IA avant de régénérer un acte.';
      return;
    }

    enCours = true;
    erreur = null;
    controleur = new AbortController();

    const spectacleId = s.id;

    try {
      const r = await regenererActe($state.snapshot(s), acteId, consigne, {
        acces: reglagesIa.acces,
        signal: controleur.signal,
        surAvancement: () => {},
      });
      if (spectacleCourant.spectacle?.id !== spectacleId) return;
      // L'ancienne version est celle d'AU MOMENT DU REMPLACEMENT : une
      // correction faite à la main pendant l'appel reste récupérable par
      // « Revenir à l'ancienne ».
      const acte = spectacleCourant.spectacle.actes.find((a) => a.id === acteId);
      const sauvegarde = acte
        ? (structuredClone($state.snapshot(acte.elements)) as ElementScript[])
        : null;
      spectacleCourant.remplacerActe(acteId, r.elements);
      ancienne = sauvegarde;
      ouvert = false;
      consigne = '';
    } catch (e) {
      // Annuler n'est pas une erreur : on revient simplement au formulaire.
      if (e instanceof ErreurIa && e.message === t.erreursIa.annule) return;
      erreur = e instanceof ErreurIa ? e.message : String(e);
    } finally {
      enCours = false;
    }
  }

  function garderNouvelle() {
    ancienne = null;
  }

  function revenirAncienne() {
    if (ancienne) spectacleCourant.remplacerActe(acteId, ancienne);
    ancienne = null;
  }
</script>

<div class="regeneration">
  {#if ancienne}
    <!-- Comparaison : l'ancienne version reste récupérable d'un clic. -->
    <div class="comparaison">
      <p class="mono">{tsc.comparaison}</p>
      <button onclick={garderNouvelle}>{tsc.garderNouvelle}</button>
      <button class="secondaire-bouton" onclick={revenirAncienne}>{tsc.revenirAncienne}</button>
    </div>

  {:else if enCours}
    <p class="mono attente" aria-live="polite">{tsc.regenererEnCours}</p>
    <button class="secondaire-bouton" onclick={() => controleur?.abort()}>
      {tsc.annulerEdition}
    </button>

  {:else if ouvert}
    <div class="formulaire">
      <label for="consigne-{acteId}" class="mono">{tsc.regenererConsigne}</label>
      <input
        id="consigne-{acteId}"
        bind:value={consigne}
        maxlength="200"
        placeholder={tsc.regenererConsigneAide}
        onkeydown={(e) => { if (e.key === 'Enter') lancer(); }}
      />
      <button onclick={lancer}>{tsc.regenererLancer}</button>
      <button class="secondaire-bouton" onclick={() => (ouvert = false)}>
        {tsc.annulerEdition}
      </button>
    </div>

  {:else}
    <!-- Le numéro ne figure que dans l'étiquette : à l'écran, le bouton est
         déjà dans son acte, et « Régénérer cet acte 1 » se lit mal. -->
    <button
      class="secondaire-bouton"
      aria-label="{tsc.regenerer} {acteNumero}"
      onclick={() => (ouvert = true)}
    >{tsc.regenerer}</button>
  {/if}

  {#if erreur}
    <p class="erreur" role="alert">{erreur}</p>
  {/if}
</div>

<style>
  .regeneration { display: flex; flex-direction: column; gap: 6px; }
  .regeneration button { font-size: 10px; min-height: 36px; padding: 6px 10px; }

  .formulaire { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .formulaire label { font-size: 10px; }
  .formulaire input { width: min(280px, 100%); font-size: 13px; min-height: 36px; }

  .comparaison { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .comparaison p { font-size: 11px; margin: 0; color: var(--encre2); }

  .attente { font-size: 11px; color: var(--encre2); margin: 0; }

  /* Le rouge signale l'erreur, conformément au §11. */
  .erreur {
    margin: 0;
    padding-left: 8px;
    border-left: 4px solid var(--accent);
    font-size: 13px;
  }
</style>
