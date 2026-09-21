<script lang="ts">
  // Le mini tutoriel : trois étapes, une par écran, pour faire son premier
  // spectacle — créer ses marionnettes, préparer le studio et générer, relire
  // puis jouer.
  //
  // Chaque étape dit quoi faire avec les libellés exacts de l'interface, en
  // gras pour qu'on les repère à l'écran, puis donne une seule astuce. On
  // avance avec « Suivant », on revient avec « Précédent », on saute
  // directement à une étape par ses numéros, et Échap ferme.
  import { ttu } from '../textes';
  import { tutoriel } from '../etat/tutoriel.svelte';
  import { naviguer } from '../services/routeur';

  const etape = $derived(ttu.etapes[tutoriel.etape]);
  const derniere = $derived(tutoriel.etape === tutoriel.total - 1);

  /**
   * Découpe un texte en morceaux normaux et en morceaux en gras (entre ** **).
   * Le texte vient de textes.ts : aucun HTML n'est interprété.
   */
  function morceaux(texte: string): { gras: boolean; texte: string }[] {
    return texte.split(/\*\*(.+?)\*\*/).map((t, i) => ({ gras: i % 2 === 1, texte: t }));
  }

  let titre = $state<HTMLElement>();

  // Le focus va au titre à l'ouverture et à chaque changement d'étape : un
  // lecteur d'écran annonce ainsi la nouvelle étape, et Tab mène aux boutons.
  $effect(() => {
    if (tutoriel.ouvert) {
      void tutoriel.etape;
      titre?.focus();
    }
  });

  /** Ferme le tuto et ouvre l'écran des paramètres IA. */
  function versParametres() {
    tutoriel.fermer();
    naviguer({ nom: 'parametres' });
  }

  function surTouche(e: KeyboardEvent) {
    if (tutoriel.ouvert && e.key === 'Escape') {
      e.preventDefault();
      tutoriel.fermer();
    }
  }
</script>

<svelte:window onkeydown={surTouche} />

{#if tutoriel.ouvert}
  <!-- Un clic sur le voile, hors de la fenêtre, la ferme. -->
  <!-- Échap ferme aussi, au clavier : le clic n'est qu'un raccourci. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="voile" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) tutoriel.fermer(); }}>
    <div class="fenetre boite boite-ombre" role="dialog" aria-modal="true" aria-labelledby="tuto-titre">
      <header>
        <span class="eyebrow">{ttu.titre}</span>
        <button type="button" class="fermer secondaire-bouton" aria-label={ttu.fermer} onclick={() => tutoriel.fermer()}>
          ✕
        </button>
      </header>

      <!-- Les trois étapes, cliquables : on peut sauter directement à la troisième. -->
      <ol class="pastilles" aria-label={ttu.titre}>
        {#each ttu.etapes as e, i (i)}
          <li>
            <button
              type="button"
              class="pastille"
              class:active={i === tutoriel.etape}
              aria-current={i === tutoriel.etape ? 'step' : undefined}
              onclick={() => tutoriel.allerA(i)}
            >
              <span class="numero">{i + 1}</span>
              <span class="nom">{e.titre}</span>
            </button>
          </li>
        {/each}
      </ol>

      <section class="etape">
        <p class="mono compteur">{ttu.etapeSur(tutoriel.etape + 1, tutoriel.total)}</p>
        <h2 id="tuto-titre" tabindex="-1" bind:this={titre}>{etape.titre}</h2>
        <p class="intro">
          {#each morceaux(etape.intro) as m, i (i)}{#if m.gras}<strong>{m.texte}</strong>{:else}{m.texte}{/if}{/each}
        </p>

        <ol class="actions">
          {#each etape.faire as ligne, i (i)}
            <li>
              {#each morceaux(ligne) as m, j (j)}{#if m.gras}<strong>{m.texte}</strong>{:else}{m.texte}{/if}{/each}
            </li>
          {/each}
        </ol>

        {#if tutoriel.etape === ttu.cle.etape}
          <!-- La clé IA : ce qui bloque la première génération, mis à part. -->
          <div class="cle">
            <h3>{ttu.cle.titre}</h3>
            <ul>
              {#each ttu.cle.faire as ligne, i (i)}
                <li>
                  {#each morceaux(ligne) as m, j (j)}{#if m.gras}<strong>{m.texte}</strong>{:else}{m.texte}{/if}{/each}
                </li>
              {/each}
            </ul>
            <button type="button" class="secondaire-bouton" onclick={versParametres}>
              {ttu.ouvrirParametres}
            </button>
          </div>
        {/if}

        {#if derniere}
          <!-- Les touches du mode lecture, dessinées : c'est ce qu'on retient. -->
          <ul class="touches">
            {#each ttu.touches as t, i (i)}
              <li><kbd>{t.touche}</kbd><span>{t.effet}</span></li>
            {/each}
          </ul>
        {/if}

        <aside class="astuce">
          <span class="mono etiquette">{ttu.astuce}</span>
          <p>
            {#each morceaux(etape.astuce) as m, i (i)}{#if m.gras}<strong>{m.texte}</strong>{:else}{m.texte}{/if}{/each}
          </p>
        </aside>
      </section>

      <footer>
        <button
          type="button"
          class="secondaire-bouton"
          disabled={tutoriel.etape === 0}
          onclick={() => tutoriel.precedente()}
        >
          {ttu.precedent}
        </button>
        <button type="button" class="cta" onclick={() => tutoriel.suivante()}>
          {derniere ? ttu.terminer : ttu.suivant}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .voile {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgb(10 10 10 / 0.6);
    z-index: 40;
  }

  .fenetre {
    width: min(620px, 100%);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--papier);
  }

  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .fermer { padding: 4px 10px; min-width: 0; }

  /* Les trois étapes, en ligne ; sur écran étroit, seuls les numéros restent. */
  .pastilles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pastille {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    text-align: left;
    background: var(--papier);
    color: var(--encre);
    border: var(--bordure) solid var(--encre);
    box-shadow: none;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }
  .pastille .numero {
    flex: none;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    font-family: var(--police-mono);
    font-size: 12px;
    border: var(--bordure) solid var(--encre);
  }
  .pastille .nom { font-size: 12px; line-height: 1.2; }
  /* L'étape en cours : la pastille prend l'accent, et un filet la souligne. */
  .pastille.active .numero { background: var(--accent); }
  .pastille.active { border-bottom-width: 4px; }

  .etape { display: flex; flex-direction: column; gap: 10px; }
  .compteur { margin: 0; font-size: 11px; color: var(--encre2); letter-spacing: 0.12em; }
  h2 { margin: 0; font-size: 20px; }
  h2:focus { outline: none; }
  .intro { margin: 0; font-size: 15px; }

  .actions {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 15px;
  }

  .touches {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    font-size: 14px;
  }
  .touches li { display: flex; align-items: center; gap: 8px; }
  kbd {
    display: inline-block;
    min-width: 34px;
    padding: 4px 10px;
    text-align: center;
    font-family: var(--police-mono);
    font-size: 13px;
    background: var(--papier);
    border: var(--bordure) solid var(--encre);
    box-shadow: 0 3px 0 var(--encre);
  }

  /* La clé IA : un encadré à part, bordé d'encre. */
  .cle {
    padding: 10px 12px;
    border: var(--bordure) solid var(--encre);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cle h3 { margin: 0; font-size: 15px; }
  .cle ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
  .cle button { align-self: flex-start; }

  /* L'astuce : marquée par un filet d'accent, jamais par la couleur seule. */
  .astuce {
    padding: 8px 12px;
    border-left: 4px solid var(--accent);
    background: color-mix(in srgb, var(--gris) 12%, var(--papier));
  }
  .astuce .etiquette { display: block; margin-bottom: 4px; font-size: 11px; color: var(--encre2); }
  .astuce p { margin: 0; font-size: 14px; }

  footer { display: flex; justify-content: space-between; gap: 10px; }
  footer button { flex: 1; }
  footer button:disabled { visibility: hidden; }

  @media (max-width: 560px) {
    .pastille .nom { display: none; }
    .pastille { justify-content: center; }
  }
</style>
