<script lang="ts">
  // Colonne centrale : le studio (CDC §7).
  // Les personnages en haut, puis les réglages, l'ébauche facultative, et le
  // bouton « Générer le script » qui est le CTA principal.
  //
  // Pendant la génération, le bouton laisse place à la barre de progression,
  // puis à l'écran de choix des trois histoires, puis à une seconde
  // progression (CDC §6 et §7).
  import { onDestroy } from 'svelte';
  import Scene from './Scene.svelte';
  import ReglagesStudio from './ReglagesStudio.svelte';
  import Progression from './Progression.svelte';
  import ChoixHistoires from './ChoixHistoires.svelte';
  import { BORNES } from '../config';
  import { tb, tg, ts } from '../textes';
  import { studio } from '../etat/studio.svelte';
  import { reglagesIa } from '../etat/reglagesIa.svelte';
  import { bibliotheque } from '../etat/bibliotheque.svelte';
  import { generation } from '../etat/generation.svelte';
  import { spectacles } from '../etat/spectacles.svelte';
  import { naviguer } from '../services/routeur';

  /** Message affiché quand la génération n'est pas encore possible. */
  const blocage = $derived(studio.sceneVide ? ts.generer.sansMarionnette : null);

  /** Les marionnettes retenues, dans l'ordre de la scène. */
  const distribution = $derived(
    studio.valeurs.marionnetteIds
      .map((id) => bibliotheque.liste.find((m) => m.id === id))
      .filter((m) => m !== undefined),
  );

  function generer() {
    // Sans clé, le bouton ouvre la configuration au lieu de générer (CDC §7).
    if (!reglagesIa.pretPourGenerer) {
      naviguer({ nom: 'parametres' });
      return;
    }
    void generation.proposer(distribution, {
      dureeMinutes: studio.valeurs.dureeMinutes,
      ageAuditoire: studio.valeurs.ageAuditoire,
      nbMarionnettistes: studio.valeurs.nbMarionnettistes,
      interactionPublic: studio.valeurs.interactionPublic,
      ebauche: studio.valeurs.ebauche,
    });
  }

  // Un spectacle terminé doit apparaître aussitôt dans la colonne de droite.
  $effect(() => {
    if (generation.phase === 'termine') void spectacles.charger();
  });

  /** Zone où s'affichent progression, choix et fin de génération. */
  let zoneGeneration = $state<HTMLElement>();

  // Le studio est une colonne longue : sans cela, l'écran de choix apparaîtrait
  // sous la ligne de flottaison et le parent croirait qu'il ne s'est rien passé.
  $effect(() => {
    const phase = generation.phase;
    if (phase === 'choix' || phase === 'termine' || phase === 'erreur') {
      zoneGeneration?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  // Quand on quitte le studio après une génération terminée — pour lire le
  // script, le jouer, ou ouvrir le spectacle depuis la colonne de droite —,
  // on doit retrouver au retour le studio prêt pour une nouvelle génération,
  // et non l'encart « Votre spectacle est prêt ».
  // Seule la génération est remise à zéro : les marionnettes et les réglages
  // du studio restent. Un choix d'histoire en attente, lui, est gardé : le
  // parent doit pouvoir y revenir (CDC §6).
  onDestroy(() => {
    if (generation.phase === 'termine') generation.reinitialiser();
  });

  function ouvrirSpectacle() {
    const id = generation.spectacleId;
    generation.reinitialiser();
    if (id) naviguer({ nom: 'script', spectacleId: id });
  }
</script>

<div class="studio">
  <Scene />

  <ReglagesStudio />

  <!-- Ébauche de scénario : facultative, 2 000 caractères (CDC §7) -->
  <div class="ebauche">
    <label for="ebauche" class="mono">{ts.ebauche.titre}</label>
    <textarea
      id="ebauche"
      value={studio.valeurs.ebauche}
      maxlength={BORNES.ebauche.max}
      aria-describedby="ebauche-aide"
      oninput={(e) => studio.definirEbauche(e.currentTarget.value)}
    ></textarea>
    <p id="ebauche-aide" class="aide">{ts.ebauche.aide}</p>
    <p class="compteur mono">
      {tb.compteur(studio.valeurs.ebauche.length, BORNES.ebauche.max)}
    </p>
  </div>

  <div class="generation" bind:this={zoneGeneration}>
    {#if generation.enCours}
      <Progression />

    {:else if generation.phase === 'choix'}
      <ChoixHistoires />

    {:else if generation.phase === 'termine'}
      <section class="boite fin">
        <span class="eyebrow">{tg.fin.titre}</span>
        {#if generation.jetons.total}
          <p class="aide">{tg.fin.jetons(generation.jetons.total)}</p>
        {/if}
        <button class="cta" onclick={ouvrirSpectacle}>{tg.fin.ouvrir}</button>
      </section>

    {:else if generation.phase === 'erreur'}
      <section class="boite erreur">
        <span class="eyebrow">{tg.erreur.titre}</span>
        <p role="alert">{generation.erreur}</p>
        {#if generation.detailErreur}
          <details>
            <summary class="mono">{tg.erreur.details}</summary>
            <p class="aide">{tg.erreur.detailsAide}</p>
            <pre>{generation.detailErreur}</pre>
          </details>
        {/if}
        <div class="boutons">
          <button class="secondaire-bouton" onclick={() => generation.reinitialiser()}>
            {tg.erreur.fermer}
          </button>
          <button onclick={generer}>{tg.erreur.reessayer}</button>
        </div>
      </section>

    {:else}
      <!-- CTA principal : large et rouge, le seul de cet écran (charte §11) -->
      <button class="cta generer" disabled={!!blocage} onclick={generer}>
        {reglagesIa.pretPourGenerer ? ts.generer.bouton : ts.generer.sansCle}
      </button>
      <!-- Le bouton désactivé doit dire pourquoi il l'est (CDC §7) -->
      {#if blocage}
        <p class="aide" aria-live="polite">{blocage}</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .studio { display: flex; flex-direction: column; gap: 20px; padding-bottom: 8px; }

  .ebauche > label { display: block; margin-bottom: 6px; }
  .ebauche textarea { min-height: 110px; }
  .aide { font-size: 13px; color: var(--encre2); margin: 6px 0 0; }
  .compteur { color: var(--encre2); font-size: 11px; text-align: right; margin: 4px 0 0; }

  .generer {
    width: 100%;
    min-height: 56px;
    font-size: 14px;
    letter-spacing: 0.14em;
  }

  .fin, .erreur { padding: 14px; }
  .fin .eyebrow, .erreur .eyebrow { margin-bottom: 10px; }
  .fin button { width: 100%; margin-top: 12px; }

  /* Le rouge signale l'erreur, conformément au §11. */
  .erreur p { border-left: 4px solid var(--accent); padding-left: 10px; font-size: 14px; }
  details { margin-top: 10px; }
  summary { cursor: pointer; font-size: 11px; letter-spacing: 0.12em; }
  pre {
    margin: 6px 0 0;
    padding: 8px;
    border: var(--bordure) solid var(--encre);
    background: var(--papier);
    font-family: var(--police-mono);
    font-size: 11px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .boutons { display: flex; gap: 8px; margin-top: 12px; }
  .boutons button { flex: 1; }
</style>
