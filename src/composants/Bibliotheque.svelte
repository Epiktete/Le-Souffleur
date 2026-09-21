<script lang="ts">
  // Colonne de gauche : la bibliothèque de marionnettes (CDC §7).
  // Bouton de création en haut, champ de recherche à partir de 8 marionnettes,
  // une boîte par marionnette, fiche dépliable, et le formulaire en panneau
  // latéral.
  import CarteMarionnette from './CarteMarionnette.svelte';
  import PanneauMarionnette from './PanneauMarionnette.svelte';
  import { bibliotheque } from '../etat/bibliotheque.svelte';
  import { studio } from '../etat/studio.svelte';
  import { filtrerMarionnettes, marionnetteVierge } from '../services/marionnettes';
  import { t, tb } from '../textes';
  import type { Marionnette } from '../types';

  /** Le champ de recherche n'apparaît qu'à partir de ce nombre (CDC §7). */
  const SEUIL_RECHERCHE = 8;

  let recherche = $state('');
  let deplieeId = $state<string | null>(null);
  /** Marionnette en cours d'édition dans le panneau, ou null si fermé. */
  let edition = $state<{ marionnette: Marionnette; creation: boolean } | null>(null);
  /** Marionnette dont la suppression attend confirmation. */
  let aSupprimer = $state<Marionnette | null>(null);

  $effect(() => { void bibliotheque.charger(); });

  const visibles = $derived(filtrerMarionnettes(bibliotheque.liste, recherche));
  const rechercheVisible = $derived(bibliotheque.liste.length >= SEUIL_RECHERCHE);

  function creer() {
    edition = { marionnette: marionnetteVierge(), creation: true };
  }

  function modifier(m: Marionnette) {
    edition = { marionnette: m, creation: false };
  }

  async function enregistrer(m: Marionnette): Promise<boolean> {
    const ok = await bibliotheque.enregistrer(m);
    if (ok) {
      edition = null;
      deplieeId = m.id; // on montre le résultat de la saisie
    }
    return ok;
  }

  async function dupliquer(m: Marionnette) {
    const copie = await bibliotheque.dupliquer(m);
    if (copie) deplieeId = copie.id;
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    const id = aSupprimer.id;
    aSupprimer = null;
    if (!(await bibliotheque.supprimer(id))) return;
    if (deplieeId === id) deplieeId = null;
    // Une marionnette supprimée ne doit pas rester sur la scène du studio.
    studio.retirer(id);
  }
</script>

<div class="bibliotheque">
  <button class="creer" onclick={creer}>{tb.nouvelle}</button>

  {#if rechercheVisible}
    <div class="recherche">
      <label class="invisible" for="recherche-marionnette">{tb.rechercher}</label>
      <input
        id="recherche-marionnette"
        type="search"
        bind:value={recherche}
        placeholder={tb.rechercherCourt}
      />
    </div>
  {/if}

  <!-- Le nombre est annoncé aux lecteurs d'écran (CDC §12). -->
  <p class="invisible" aria-live="polite">{tb.nombre(visibles.length)}</p>

  {#if bibliotheque.erreur}
    <p class="erreur" role="alert">{t.stockage.erreurOuverture}</p>
  {/if}

  {#if !bibliotheque.chargee}
    <p class="secondaire">…</p>
  {:else if bibliotheque.liste.length === 0}
    <p class="secondaire">{t.vide.bibliotheque}</p>
  {:else if visibles.length === 0}
    <p class="secondaire">{tb.aucunResultat}</p>
  {:else}
    <ul>
      {#each visibles as m (m.id)}
        <li>
          <CarteMarionnette
            marionnette={m}
            depliee={deplieeId === m.id}
            enScene={studio.enScene(m.id)}
            scenePleine={studio.scenePleine}
            surBasculer={() => (deplieeId = deplieeId === m.id ? null : m.id)}
            surModifier={() => modifier(m)}
            surDupliquer={() => dupliquer(m)}
            surSupprimer={() => (aSupprimer = m)}
            surMettreEnScene={() => studio.ajouter(m.id)}
          />
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if edition}
  <!-- La clé recrée le panneau quand on passe à une autre marionnette :
       sans elle, le formulaire garderait les valeurs de la précédente. -->
  {#key edition.marionnette.id}
  <PanneauMarionnette
    marionnette={edition.marionnette}
    creation={edition.creation}
    surEnregistrer={enregistrer}
    surAnnuler={() => (edition = null)}
  />
  {/key}
{/if}

{#if aSupprimer}
  <!-- Confirmation de suppression, exigée par le CDC §7. -->
  <div class="voile" role="dialog" aria-modal="true" aria-label={tb.supprimer}>
    <div class="boite boite-ombre confirmation">
      <p>{tb.confirmerSuppression(aSupprimer.nom)}</p>
      <div class="actions">
        <button class="secondaire-bouton" onclick={() => (aSupprimer = null)}>{tb.annuler}</button>
        <button onclick={confirmerSuppression}>{tb.supprimerDefinitivement}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bibliotheque { display: flex; flex-direction: column; gap: 10px; }

  .creer { width: 100%; }
  .recherche input { font-size: 14px; }

  ul { list-style: none; margin: 0; padding: 0; }

  .secondaire { font-size: 13px; }

  .erreur {
    padding-left: 8px;
    border-left: 4px solid var(--accent);
    font-size: 14px;
    color: var(--encre);
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Voile de confirmation : encre translucide, sans flou (charte §11). */
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
  .confirmation p { font-size: 15px; }
  .actions { display: flex; gap: 8px; margin-top: 14px; }
  .actions button { flex: 1; font-size: 10px; }
</style>
