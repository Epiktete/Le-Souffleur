<script lang="ts">
  // Bandeau des tableaux, tout en haut de l'écran de script (CDC §8).
  //
  // Un clic déplie ce qu'il faut préparer pour ce décor : la description et le
  // matériel, en une seule liste. C'est la liste de préparation ; elle n'existe
  // qu'ici, pour ne pas dire deux fois la même chose à deux endroits.
  import { tsc } from '../textes';
  import type { Acte, Tableau } from '../types';

  interface Props {
    tableaux: Tableau[];
    actes: Acte[];
  }
  let { tableaux, actes }: Props = $props();

  let deplieId = $state<string | null>(null);

  function actesDe(tableauId: string): Acte[] {
    return actes.filter((a) => a.tableauId === tableauId);
  }
</script>

<section class="bandeau" aria-label={tsc.tableaux}>
  <h3 class="eyebrow-secondaire">{tsc.tableaux}</h3>

  <div class="boites">
    {#each tableaux as tableau, index (tableau.id)}
      {@const deplie = deplieId === tableau.id}
      <article class="boite boite-ombre">
        <button
          class="tete-tableau"
          aria-expanded={deplie}
          onclick={() => (deplieId = deplie ? null : tableau.id)}
        >
          {tsc.tableauNumero(index + 1, tableau.titre)}
          <span class="mono lieu">
            {actesDe(tableau.id).map((a) => tsc.acte(a.numero)).join(', ')}
          </span>
        </button>

        <!--
          Toujours dans la page, masqué seulement à l'écran quand c'est replié :
          la préparation doit figurer entière sur le script imprimé.
        -->
        <div class="detail" hidden={!deplie}>
          {#if tableau.description}
            <p>{tableau.description}</p>
          {/if}

          {#if tableau.accessoires.length > 0}
            <ul class="cases">
              {#each tableau.accessoires as a (a)}
                <li><span class="case" aria-hidden="true"></span>{a}</li>
              {/each}
            </ul>
          {/if}
        </div>
      </article>
    {/each}
  </div>
</section>

<style>
  .bandeau { margin-bottom: 24px; }
  h3 { display: block; margin-bottom: 10px; }

  .boites {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--ombre) + 8px);
    align-items: flex-start;
  }
  article { flex: 1 1 260px; max-width: 420px; }

  .tete-tableau {
    display: block;
    width: 100%;
    padding: 10px;
    border: none;
    background: var(--papier);
    color: var(--encre);
    box-shadow: none;
    text-align: left;
    font-family: var(--police-texte);
    font-size: 15px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: -0.02em;
  }
  .tete-tableau:hover { background: var(--papier); box-shadow: none; transform: none; }

  .lieu { display: block; margin-top: 3px; font-size: 10px; color: var(--encre2); }

  .detail { padding: 0 10px 10px; border-top: var(--bordure) solid var(--encre); }
  p { font-size: 14px; margin: 10px 0 0; }

  /* Cases à cocher à la main, pour pointer le matériel réuni. */
  .cases { list-style: none; margin: 10px 0 0; padding: 0; }
  .cases li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    margin-bottom: 5px;
  }
  .case {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    border: var(--bordure) solid var(--encre);
  }

  /* À l'impression, chaque décor apparaît entier : c'est la préparation. */
  @media print {
    .detail[hidden] { display: block !important; }
    .tete-tableau { padding-left: 0; }
    article { box-shadow: none; }
  }
</style>
