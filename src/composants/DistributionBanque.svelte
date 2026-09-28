<script lang="ts">
  // L'écran de distribution du mode Banque (CDC §7) : une boîte par rôle du
  // modèle, la marionnette proposée dessus, et un sélecteur pour retoucher.
  //
  // La distribution arrive DÉJÀ FAITE (le calcul du générateur, via
  // l'appariement) ; la retouche échange plutôt qu'elle n'écrase : choisir une
  // marionnette déjà prise ailleurs échange les deux rôles, et aucun rôle ne
  // reste vide. Un couple interdit marque la boîte, s'explique, et bloquera la
  // création — même règle que le générateur. Jamais de glisser-déposer.
  import { tba } from '../textes';
  import type { Marionnette } from '../types';
  import type { SignatureModele } from '../services/banque';
  import {
    genreMarionnette,
    problemeAttribution,
    type AttributionBanque,
    type Genre,
  } from '../services/appariement';

  interface Props {
    signature: SignatureModele;
    /** Les marionnettes offertes aux sélecteurs : la scène, ou toute la Marionnethèque. */
    troupe: Marionnette[];
    /** La distribution proposée, dans l'ordre des rôles (r1, r2…). */
    graine: AttributionBanque[];
    surRetour: () => void;
    /**
     * Prévenu à chaque retouche, avec la distribution courante (null tant
     * qu'un interdit subsiste) et les genres répondus à l'écran : le parent
     * (Banque.svelte) y branche la création.
     */
    surChangement?: (
      distribution: AttributionBanque[] | null,
      genres: Partial<Record<string, Genre>>,
    ) => void;
  }
  let { signature, troupe, graine, surRetour, surChangement }: Props = $props();

  /**
   * La marionnette de chaque rôle, dans l'ordre des rôles. La graine n'est
   * lue qu'à l'ouverture, à dessein : c'est une proposition de départ, les
   * retouches du parent ne doivent pas être écrasées par un recalcul.
   */
  // svelte-ignore state_referenced_locally
  let attribution = $state<string[]>(graine.map((a) => a.marionnetteId));

  function marionnette(id: string): Marionnette | undefined {
    return troupe.find((m) => m.id === id);
  }

  /** Les rôles mal attribués : la boîte se marque, la création se bloque. */
  const problemes = $derived(signature.roles.map((role, k) => {
    const m = marionnette(attribution[k]);
    return m ? problemeAttribution(m, role) : 'interdit';
  }));

  const distribution = $derived(problemes.some((p) => p !== null)
    ? null
    : signature.roles.map((r, k): AttributionBanque => ({ cle: r.cle, marionnetteId: attribution[k] })));

  /**
   * Quand rien ne dit le genre d'une marionnette, on demande plutôt que de
   * deviner (CDC §7) : « il / elle » sur la boîte du rôle. La réponse suit la
   * marionnette, pas le rôle : un échange de rôles la conserve.
   */
  const genresAsDemander = $derived(signature.roles.map((_r, k) => {
    const m = marionnette(attribution[k]);
    return m !== undefined && genreMarionnette(m) === null ? m : null;
  }));
  let genresChoisis = $state<Partial<Record<string, Genre>>>({});

  /** Les genres répondus, portés sur la clé du rôle que chacun tient. */
  const genresParRole = $derived.by(() => {
    const genres: Partial<Record<string, Genre>> = {};
    signature.roles.forEach((role, k) => {
      const m = genresAsDemander[k];
      const choisi = m ? genresChoisis[m.id] : undefined;
      if (choisi) genres[role.cle] = choisi;
    });
    return genres;
  });

  $effect(() => { surChangement?.(distribution, genresParRole); });

  /** Retouche : choisir une marionnette déjà prise ailleurs échange les rôles. */
  function choisir(k: number, id: string) {
    const j = attribution.indexOf(id);
    const nouvelle = [...attribution];
    if (j >= 0 && j !== k) nouvelle[j] = attribution[k];
    nouvelle[k] = id;
    attribution = nouvelle;
  }

  /** Ce qu'on affiche pour un rôle : son espèce, ou un mot neutre. */
  function nomRole(role: SignatureModele['roles'][number]): string {
    return role.espece ?? tba.fiche.roleSansEspece;
  }
</script>

<section class="distribution" aria-label={tba.distribution.titre}>
  <div class="tete">
    <span class="eyebrow">{tba.distribution.titre}</span>
    <button class="secondaire-bouton" onclick={surRetour}>{tba.distribution.retour}</button>
  </div>
  <p class="aide">{tba.distribution.aide}</p>

  <ul class="roles">
    {#each signature.roles as role, k (role.cle)}
      <li class="boite role" class:interdit={problemes[k] !== null}>
        <p class="role-nom">{tba.distribution.role(nomRole(role))}</p>
        {#if role.traits.length > 0}
          <p class="role-traits">{role.traits.join(', ')}</p>
        {/if}

        <label>
          <span class="visually-hidden">{tba.distribution.choisir(nomRole(role))}</span>
          <select
            value={attribution[k]}
            onchange={(e) => choisir(k, e.currentTarget.value)}
          >
            {#each troupe as m (m.id)}
              <option value={m.id}>{m.nom}</option>
            {/each}
          </select>
        </label>

        {#if problemes[k] === 'interdit'}
          <p class="alerte" role="alert">
            {tba.distribution.interdit(marionnette(attribution[k])?.nom ?? '?', nomRole(role))}
          </p>
        {:else if problemes[k] === 'espece'}
          <p class="alerte" role="alert">
            {tba.distribution.especeImposee(marionnette(attribution[k])?.nom ?? '?', role.espece ?? '?')}
          </p>
        {/if}

        {#if genresAsDemander[k]}
          {@const m = genresAsDemander[k]!}
          <fieldset class="genre">
            <legend>{tba.distribution.genre.question(m.nom)}</legend>
            {#each (['masculin', 'feminin'] as const) as g (g)}
              <button
                type="button"
                class:actif={genresChoisis[m.id] === g}
                aria-pressed={genresChoisis[m.id] === g}
                onclick={() => (genresChoisis = { ...genresChoisis, [m.id]: g })}
              >{g === 'masculin' ? tba.distribution.genre.il : tba.distribution.genre.elle}</button>
            {/each}
          </fieldset>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .distribution { display: flex; flex-direction: column; gap: 10px; }

  .tete { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

  .aide { font-size: 13px; color: var(--encre2); margin: 0; }

  .roles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .role { padding: 10px 12px; }
  /* Le rouge signale la faute, conformément au §11. */
  .role.interdit { border-left: 4px solid var(--accent); }

  .role-nom { margin: 0 0 2px; font-weight: 600; font-size: 14px; }
  .role-traits { margin: 0 0 8px; font-size: 12px; color: var(--encre2); }

  select { width: 100%; }

  .alerte { margin: 8px 0 0; font-size: 13px; }

  .genre { border: none; margin: 8px 0 0; padding: 0; display: flex; align-items: center; gap: 6px; }
  .genre legend { float: left; margin-right: 8px; font-size: 12px; color: var(--encre2); }
  .genre button { min-width: 48px; font-size: 11px; }
  .genre button.actif {
    background: var(--encre);
    color: var(--papier);
    box-shadow: inset 0 3px 0 var(--accent);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
