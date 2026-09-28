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
  import { attributionPermise, type AttributionBanque } from '../services/appariement';

  interface Props {
    signature: SignatureModele;
    /** Les marionnettes offertes aux sélecteurs : la scène, ou toute la Marionnethèque. */
    troupe: Marionnette[];
    /** La distribution proposée, dans l'ordre des rôles (r1, r2…). */
    graine: AttributionBanque[];
    surRetour: () => void;
    /**
     * Prévenu à chaque retouche, avec la distribution courante et son état :
     * le parent (Banque.svelte) y branche la création. Null tant qu'un
     * interdit subsiste.
     */
    surChangement?: (distribution: AttributionBanque[] | null) => void;
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
  const interdits = $derived(signature.roles.map((role, k) => {
    const m = marionnette(attribution[k]);
    return m ? !attributionPermise(m, role) : true;
  }));

  const distribution = $derived(interdits.some(Boolean)
    ? null
    : signature.roles.map((r, k): AttributionBanque => ({ cle: r.cle, marionnetteId: attribution[k] })));

  $effect(() => { surChangement?.(distribution); });

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
      <li class="boite role" class:interdit={interdits[k]}>
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

        {#if interdits[k]}
          <p class="alerte" role="alert">
            {tba.distribution.interdit(marionnette(attribution[k])?.nom ?? '?', nomRole(role))}
          </p>
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

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
