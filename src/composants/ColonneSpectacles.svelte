<script lang="ts">
  // Colonne de droite : les spectacles générés (CDC §7).
  // Du plus récent au plus ancien. Chaque boîte affiche le titre, la durée
  // estimée, l'âge, les vignettes de la distribution, la date et le statut
  // s'il n'est pas complet.
  import Vignette from './Vignette.svelte';
  import { formaterDuree } from '../services/duree';
  import { naviguer } from '../services/routeur';
  import { spectacles } from '../etat/spectacles.svelte';
  import { t, tsp, tsv } from '../textes';
  import { exporterSpectacle, nomDeFichier, telecharger } from '../services/sauvegarde';
  import type { Spectacle } from '../types';

  let aSupprimer = $state<Spectacle | null>(null);
  let enRenommage = $state<string | null>(null);
  let titreSaisi = $state('');

  $effect(() => { void spectacles.charger(); });

  function ouvrir(s: Spectacle) {
    naviguer({ nom: 'script', spectacleId: s.id });
  }

  function commencerRenommage(s: Spectacle) {
    enRenommage = s.id;
    titreSaisi = s.titre;
  }

  async function validerRenommage(id: string) {
    const propre = titreSaisi.trim();
    enRenommage = null;
    if (propre) await spectacles.renommer(id, propre);
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    const id = aSupprimer.id;
    aSupprimer = null;
    await spectacles.supprimer(id);
  }

  /** « 19 septembre 2026 ». */
  function dateCourte(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }
</script>

{#if !spectacles.chargee}
  <p class="secondaire">…</p>
{:else if spectacles.liste.length === 0}
  <p class="secondaire">{t.vide.spectacles}</p>
{:else}
  <ul>
    {#each spectacles.liste as s (s.id)}
      <li class="boite boite-ombre">
        {#if enRenommage === s.id}
          <div class="renommage">
            <label class="invisible" for="titre-{s.id}">{tsp.renommer}</label>
            <input
              id="titre-{s.id}"
              bind:value={titreSaisi}
              maxlength="80"
              onkeydown={(e) => {
                if (e.key === 'Enter') void validerRenommage(s.id);
                if (e.key === 'Escape') enRenommage = null;
              }}
            />
            <button class="secondaire-bouton" onclick={() => validerRenommage(s.id)}>
              {tsp.renommer}
            </button>
          </div>
        {:else}
          <button class="tete" onclick={() => ouvrir(s)}>
            <span class="titre">{s.titre}</span>
            <span class="mono meta">
              {tsp.meta(formaterDuree(s.dureeEstimeeSecondes), s.parametres.ageAuditoire)}
            </span>
            <span class="distribution">
              {#each s.distribution.slice(0, 5) as m (m.id)}
                <Vignette nom={m.nom} taille={26} />
              {/each}
            </span>
            <span class="mono date">{dateCourte(s.creeLe)}</span>
            {#if tsp.statuts[s.statut]}
              <span class="badge statut">{tsp.statuts[s.statut]}</span>
            {/if}
          </button>

          <div class="actions">
            <button class="secondaire-bouton" onclick={() => commencerRenommage(s)}>
              {tsp.renommer}
            </button>
            <!-- Un seul spectacle, pour l'envoyer à un autre parent (CDC §12). -->
            <button
              class="secondaire-bouton"
              onclick={() => telecharger(nomDeFichier(s.titre), exporterSpectacle($state.snapshot(s) as Spectacle))}
            >
              {tsv.exporterSpectacle}
            </button>
            <button class="secondaire-bouton" onclick={() => (aSupprimer = s)}>
              {tsp.supprimer}
            </button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

{#if aSupprimer}
  <div class="voile" role="dialog" aria-modal="true" aria-label={tsp.supprimer}>
    <div class="boite boite-ombre confirmation">
      <p>{tsp.confirmerSuppression(aSupprimer.titre)}</p>
      <div class="boutons">
        <button class="secondaire-bouton" onclick={() => (aSupprimer = null)}>{tsp.annuler}</button>
        <button onclick={confirmerSuppression}>{tsp.supprimerDefinitivement}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  ul { list-style: none; margin: 0; padding: 0; }
  li { margin-bottom: calc(var(--ombre) + 8px); }

  .secondaire { font-size: 13px; }

  .tete {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    width: 100%;
    padding: 10px;
    border: none;
    background: var(--papier);
    color: var(--encre);
    box-shadow: none;
    text-align: left;
    text-transform: none;
    letter-spacing: normal;
    font-family: var(--police-texte);
    font-size: 14px;
    font-weight: 400;
  }
  .tete:hover { background: var(--papier); box-shadow: none; transform: none; }

  .titre {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    font-size: 15px;
    overflow-wrap: anywhere;
  }
  .meta, .date { color: var(--encre2); font-size: 11px; }
  .distribution { display: flex; gap: 3px; flex-wrap: wrap; }
  .statut { margin-top: 2px; }

  .actions {
    display: flex;
    gap: 6px;
    padding: 0 10px 10px;
  }
  .actions button { flex: 1; font-size: 10px; min-height: 36px; }

  .renommage { display: flex; gap: 6px; padding: 10px; }
  .renommage input { flex: 1; font-size: 14px; }
  .renommage button { font-size: 10px; }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .voile {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgb(10 10 10 / 0.6);
    z-index: 30;
  }
  .confirmation { max-width: 420px; padding: 16px; }
  .boutons { display: flex; gap: 8px; margin-top: 14px; }
  .boutons button { flex: 1; font-size: 10px; }
</style>
