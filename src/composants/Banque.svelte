<script lang="ts">
  // Colonne centrale, mode Banque (CDC §7, « La colonne centrale a deux
  // modes ») : les spectacles déjà écrits du fonds, resservis sans nouvelle
  // génération.
  //
  // La scène et les réglages sont LES MÊMES composants que le Studio : ils
  // lisent le même état, et ce que le parent y règle se retrouve d'un mode à
  // l'autre. En mode Banque, ils serviront à filtrer les fiches (étape C du
  // chantier « la banque ») ; pour l'instant, toutes les fiches sont montrées.
  import Scene from './Scene.svelte';
  import ReglagesStudio from './ReglagesStudio.svelte';
  import { tba } from '../textes';
  import { bibliotheque } from '../etat/bibliotheque.svelte';
  import { signatures, type SignatureModele } from '../services/banque';
  import { conteParId, essenceDuConte } from '../services/repertoire';
  import { formaterDuree } from '../services/duree';

  // Même besoin que le Studio : la Marionnethèque doit être chargée même
  // quand sa colonne est un tiroir fermé (sous 1 024 px).
  $effect(() => { if (!bibliotheque.chargee) void bibliotheque.charger(); });

  // Le fonds est empaqueté avec l'application : la liste est connue d'avance.
  // Les plus jeunes publics d'abord, puis le plus court d'abord.
  const fiches = signatures().sort(
    (a, b) => a.ageAuditoire - b.ageAuditoire || a.dureeEstimeeSecondes - b.dureeEstimeeSecondes,
  );

  /** Le synopsis d'une fiche : l'Essence du conte d'origine (CDC §7). */
  function essence(f: SignatureModele): string {
    const conte = conteParId(f.conteId);
    return conte ? essenceDuConte(conte) : '';
  }

  /** La ligne « D'après … » de la fiche du conte d'origine. */
  function dApres(f: SignatureModele): string {
    const conte = conteParId(f.conteId);
    return conte ? tba.fiche.dApres(conte.source) : '';
  }

  /** Ce qu'on affiche pour un rôle : son espèce, ou un mot neutre. */
  function nomRole(role: SignatureModele['roles'][number]): string {
    return role.espece ?? tba.fiche.roleSansEspece;
  }
</script>

<div class="banque">
  <Scene />

  <ReglagesStudio />

  {#if fiches.length === 0}
    <p class="aide" role="status">{tba.fondsVide}</p>
  {:else}
    <p class="aide" role="status">{tba.intro(fiches.length)}</p>

    <ul class="fiches">
      {#each fiches as f (f.id)}
        <li class="boite fiche">
          <h3>{f.titre}</h3>
          <p class="meta mono">
            {formaterDuree(f.dureeEstimeeSecondes)}
            · {tba.fiche.age(f.ageAuditoire)}
            · {tba.fiche.personnages(f.roles.length)}
            · {tba.fiche.marionnettistes(f.nbMarionnettistes)}
          </p>
          {#if essence(f)}
            <p class="essence">{essence(f)}</p>
          {/if}
          <ul class="roles">
            {#each f.roles as role (role.cle)}
              <li>
                <span class="role-nom">{nomRole(role)}</span>
                {#if role.traits.length > 0}
                  <span class="role-traits">— {role.traits.join(', ')}</span>
                {/if}
              </li>
            {/each}
          </ul>
          {#if dApres(f)}
            <p class="dapres">{dApres(f)}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .banque { display: flex; flex-direction: column; gap: 20px; padding-bottom: 8px; }

  .aide { font-size: 13px; color: var(--encre2); margin: 0; }

  .fiches {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fiche { padding: 12px 14px; }
  .fiche h3 { margin: 0 0 4px; font-size: 16px; }

  .meta { font-size: 11px; color: var(--encre2); margin: 0 0 8px; }

  .essence { font-size: 14px; margin: 0 0 8px; }

  .roles { list-style: none; margin: 0; padding: 0; font-size: 13px; }
  .roles li { margin: 2px 0; }
  .role-nom { font-weight: 600; }
  .role-traits { color: var(--encre2); }

  .dapres { font-size: 12px; font-style: italic; color: var(--encre2); margin: 8px 0 0; }
</style>
