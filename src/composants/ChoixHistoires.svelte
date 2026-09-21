<script lang="ts">
  // Écran de choix des trois histoires (CDC §6, étape 2).
  //
  // Chaque carte présente l'adaptation d'un conte de la contothèque. Elle dit
  // d'où vient l'histoire (« D'après… »), la raconte en quelques points avec les
  // noms des marionnettes, dit qui joue qui, et ce qui change par rapport au
  // conte d'origine : le parent choisit en connaissance de cause.
  //
  // Actions : « Choisir cette histoire », un champ « Ajuster » facultatif sur
  // chaque carte, et « Proposer 3 autres histoires » (3 relances au maximum).
  import { tg } from '../textes';
  import { generation } from '../etat/generation.svelte';
  import type { Synopsis } from '../services/schemas';

  /** Une consigne d'ajustement par carte : elles sont indépendantes. */
  let ajustements = $state<Record<string, string>>({});

  const synopsis = $derived(generation.propositions?.retenues ?? []);

  function choisir(s: Synopsis) {
    void generation.ecrire(s, (ajustements[s.id] ?? '').trim());
  }
</script>

<section class="choix">
  <header>
    <span class="eyebrow">{tg.choix.titre}</span>
    <p class="aide">{tg.choix.sousTitre}</p>
  </header>

  <div class="cartes">
    {#each synopsis as s (s.id)}
      <article class="boite boite-ombre">
        <h3>{s.titre}</h3>
        <p class="reference">
          <span class="mono etiquette">{tg.choix.dApres}</span>
          <span>{s.reference}</span>
        </p>

        {#if s.accroche}<p class="accroche">{s.accroche}</p>{/if}

        <div class="bloc">
          <span class="mono etiquette">{tg.choix.histoire}</span>
          <ul class="resume">
            <!-- Clé par index : deux points identiques casseraient l'écran. -->
            {#each s.resume as point, i (i)}<li>{point}</li>{/each}
          </ul>
        </div>

        <div class="bloc">
          <span class="mono etiquette">{tg.choix.distribution}</span>
          <ul class="distribution">
            {#each s.distribution as d, i (i)}
              <li>
                <strong>{d.marionnette}</strong> — {d.role}
                {#if d.note}<span class="note">{d.note}</span>{/if}
              </li>
            {/each}
          </ul>
        </div>

        {#if s.changements.length}
          <div class="bloc">
            <span class="mono etiquette">{tg.choix.changements}</span>
            <ul class="changements">
              {#each s.changements as c, i (i)}<li>{c}</li>{/each}
            </ul>
          </div>
        {/if}

        <div class="ajuster">
          <label for="ajuster-{s.id}" class="mono">{tg.choix.ajuster}</label>
          <input
            id="ajuster-{s.id}"
            maxlength="200"
            placeholder={tg.choix.ajusterAide}
            value={ajustements[s.id] ?? ''}
            oninput={(e) => (ajustements[s.id] = e.currentTarget.value)}
          />
        </div>

        <button type="button" class="cta" onclick={() => choisir(s)}>
          {tg.choix.choisir}
        </button>
      </article>
    {/each}
  </div>

  <div class="pied">
    {#if generation.relancesRestantes > 0}
      <button type="button" class="secondaire-bouton" onclick={() => generation.proposerAutres()}>
        {tg.choix.autres}
      </button>
      <span class="aide">{tg.choix.autresRestantes(generation.relancesRestantes)}</span>
    {:else}
      <span class="aide">{tg.choix.plusDeRelances}</span>
    {/if}
    <button type="button" class="secondaire-bouton" onclick={() => generation.reinitialiser()}>
      {tg.choix.abandonner}
    </button>
  </div>
</section>

<style>
  .choix { display: flex; flex-direction: column; gap: 14px; }

  header .eyebrow { margin-bottom: 8px; }
  .aide { font-size: 13px; color: var(--encre2); margin: 0; }

  /* Trois cartes côte à côte, qui se replient quand la colonne rétrécit. */
  .cartes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: calc(var(--ombre) + 8px);
  }

  article {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }
  h3 { font-size: 15px; margin: 0; }

  /*
    La référence au conte d'origine : on la marque comme on marque l'accent
    ailleurs — par un filet, jamais par de la couleur seule.
  */
  .reference {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 4px 0 4px 10px;
    border-left: 3px solid var(--accent);
    font-size: 13px;
    font-style: italic;
  }
  .reference .etiquette { font-style: normal; }

  .accroche {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--gris);
  }

  .bloc { display: flex; flex-direction: column; gap: 4px; }
  .etiquette { color: var(--encre2); font-size: 12px; }

  ul { margin: 0; padding-left: 18px; list-style: square; font-size: 14px; }
  li { margin-bottom: 3px; }
  .distribution { list-style: none; padding-left: 0; font-size: 13px; }
  .note { display: block; color: var(--encre2); font-size: 12px; }
  .changements { font-size: 13px; color: var(--encre2); }

  .ajuster { margin-top: auto; }
  .ajuster label { display: block; margin-bottom: 4px; }
  .ajuster input { font-size: 13px; }

  .pied { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
</style>
