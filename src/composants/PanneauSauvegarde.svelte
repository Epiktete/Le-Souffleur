<script lang="ts">
  // Panneau « Sauvegarde » (CDC §12) : exporter toutes les données dans un
  // fichier, ou en importer un — avec un aperçu avant d'écrire quoi que ce
  // soit, et une confirmation avant de remplacer.
  import { tsv } from '../textes';
  import {
    exporterTout,
    importer,
    lireSauvegarde,
    nomDeFichier,
    noterExport,
    telecharger,
    type Apercu,
    type Sauvegarde,
  } from '../services/sauvegarde';
  import { bibliotheque } from '../etat/bibliotheque.svelte';
  import { spectacles } from '../etat/spectacles.svelte';

  interface Props { surFermer: () => void; }
  let { surFermer }: Props = $props();

  /** Le fichier lu, en attente de la décision du parent. */
  let lu = $state<{ sauvegarde: Sauvegarde; apercu: Apercu } | null>(null);
  let confirmation = $state(false);
  let message = $state<string | null>(null);
  let erreur = $state<string | null>(null);
  let enCours = $state(false);

  async function exporter() {
    erreur = null;
    try {
      telecharger(nomDeFichier('sauvegarde'), await exporterTout());
      noterExport();
      message = tsv.exporte;
    } catch (e) {
      console.error('Le Souffleur — export : échec', e);
      erreur = tsv.erreurs.ecriture;
    }
  }

  async function choisirFichier(e: Event) {
    const champ = e.currentTarget as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = ''; // pour pouvoir rechoisir le même fichier
    if (!fichier) return;
    message = null;
    erreur = null;
    const r = lireSauvegarde(await fichier.text());
    if (!r.ok) {
      erreur = tsv.erreurs[r.erreur];
      lu = null;
      return;
    }
    lu = { sauvegarde: r.sauvegarde, apercu: r.apercu };
  }

  async function appliquer(mode: 'ajouter' | 'remplacer') {
    if (!lu) return;
    enCours = true;
    erreur = null;
    try {
      const bilan = await importer($state.snapshot(lu.sauvegarde) as Sauvegarde, mode);
      if (mode === 'remplacer') {
        // Tout a changé, réglages compris : on repart d'une page neuve, qui
        // relit le stockage de bout en bout.
        location.reload();
        return;
      }
      await Promise.all([bibliotheque.charger(), spectacles.charger()]);
      message = tsv.bilan(bilan.marionnettes, bilan.spectacles, bilan.ignores);
      lu = null;
    } catch (e) {
      console.error('Le Souffleur — import : échec', e);
      erreur = tsv.erreurs.ecriture;
    } finally {
      enCours = false;
      confirmation = false;
    }
  }

  function dateLisible(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { dateStyle: 'long' });
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') surFermer(); }} />

<div class="voile" role="dialog" aria-modal="true" aria-label={tsv.titre}>
  <div class="boite boite-ombre panneau">
    <h2>{tsv.titre}</h2>
    <p class="aide">{tsv.intro}</p>

    {#if confirmation && lu}
      <p>{tsv.confirmerRemplacement}</p>
      <div class="boutons">
        <button class="secondaire-bouton" onclick={() => (confirmation = false)}>{tsv.annuler}</button>
        <button disabled={enCours} onclick={() => appliquer('remplacer')}>{tsv.confirmerOui}</button>
      </div>

    {:else if lu}
      <!-- Aperçu : rien n'est écrit tant que le parent n'a pas choisi. -->
      <p>{tsv.apercu(lu.apercu.marionnettes, lu.apercu.spectacles, dateLisible(lu.apercu.exporteLe))}</p>
      {#if lu.apercu.titres.length > 0}
        <ul class="titres">
          {#each lu.apercu.titres.slice(0, 6) as titre, i (i)}<li>{titre}</li>{/each}
          {#if lu.apercu.titres.length > 6}<li>…</li>{/if}
        </ul>
      {/if}
      <div class="choix">
        <button disabled={enCours} onclick={() => appliquer('ajouter')}>{tsv.ajouter}</button>
        <p class="aide">{tsv.ajouterAide}</p>
        <button class="secondaire-bouton" disabled={enCours} onclick={() => (confirmation = true)}>
          {tsv.remplacer}
        </button>
        <p class="aide">{tsv.remplacerAide}</p>
      </div>
      <button class="secondaire-bouton" onclick={() => (lu = null)}>{tsv.annuler}</button>

    {:else}
      <div class="choix">
        <button onclick={exporter}>{tsv.exporter}</button>
        <p class="aide">{tsv.exporterAide}</p>
        <label class="bouton bouton-fichier secondaire-bouton">
          {tsv.importer}
          <input type="file" accept="application/json,.json" onchange={choisirFichier} />
        </label>
        <p class="aide">{tsv.importerAide}</p>
      </div>
    {/if}

    {#if message}<p class="message" role="status">{message}</p>{/if}
    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}

    <button class="secondaire-bouton fermer" onclick={surFermer}>{tsv.fermer}</button>
  </div>
</div>

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
  .panneau {
    width: min(460px, 100%);
    max-height: 100%;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--papier);
  }
  h2 { font-size: 18px; margin: 0; }
  p { margin: 0; }
  .aide { font-size: 13px; color: var(--encre2); }
  .choix { display: flex; flex-direction: column; gap: 6px; }
  .choix .aide { margin-bottom: 8px; }
  .titres { margin: 0; padding-left: 18px; font-size: 13px; }
  .boutons { display: flex; gap: 8px; }
  .boutons button { flex: 1; }

  /* Le champ fichier natif est laid et varie d'un navigateur à l'autre : on
     le cache derrière un bouton de la charte, qui reste cliquable au clavier
     grâce au label. */
  .bouton-fichier {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .bouton-fichier input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .bouton-fichier:focus-within { outline: 3px solid var(--encre); outline-offset: 2px; }

  .message { font-size: 14px; border-left: 4px solid var(--encre); padding-left: 10px; }
  /* Le rouge signale l'erreur, conformément au §11. */
  .erreur { font-size: 14px; border-left: 4px solid var(--accent); padding-left: 10px; }
  .fermer { align-self: flex-end; }
</style>
