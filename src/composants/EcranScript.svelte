<script lang="ts">
  // Écran de script (CDC §8) : lire, corriger, préparer les décors.
  // Il occupe toute la largeur, avec un bouton retour et un gros bouton Jouer.
  import BandeauTableaux from './BandeauTableaux.svelte';
  import ElementScriptVue from './ElementScript.svelte';
  import Vignette from './Vignette.svelte';
  import RegenererActe from './RegenererActe.svelte';
  import { formaterDuree } from '../services/duree';
  import { spectacleCourant } from '../etat/spectacleCourant.svelte';
  import { t, tl, tsc } from '../textes';
  import { visite } from '../etat/visite.svelte';
  import type { Id } from '../types';

  interface Props {
    spectacleId: Id;
    /** Ferme le spectacle et revient à l'accueil. */
    surQuitter: () => void;
    /** Bascule vers le mode lecture. */
    surLire: () => void;
  }
  let { surQuitter, surLire }: Props = $props();

  /** Élément en cours d'édition, ou null. */
  let editionId = $state<Id | null>(null);

  const s = $derived(spectacleCourant.spectacle);
  const deuxMarionnettistes = $derived(s?.parametres.nbMarionnettistes === 2);

  // Le premier script ouvert : la visite montre comment corriger et jouer.
  $effect(() => { if (s) visite.lancer('script'); });

  /** Avertissements rattachés à un élément précis. */
  function problemesDe(acteNumero: number, position: number) {
    return spectacleCourant.problemes.filter(
      (p) => p.acteNumero === acteNumero && p.position === position,
    );
  }

  // Annuler et rétablir au clavier (CDC §8).
  function surTouche(e: KeyboardEvent) {
    // Échap ferme le spectacle, sauf si l'on est en train de saisir du texte.
    if (e.key === 'Escape') {
      const cible = e.target as HTMLElement | null;
      const saisie = cible?.tagName === 'INPUT' || cible?.tagName === 'TEXTAREA';
      if (!saisie) { surQuitter(); return; }
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    const touche = e.key.toLowerCase();
    if (touche === 'z' && !e.shiftKey) {
      e.preventDefault();
      spectacleCourant.annuler();
    } else if ((touche === 'z' && e.shiftKey) || touche === 'y') {
      e.preventDefault();
      spectacleCourant.retablir();
    }
  }
</script>

<svelte:window onkeydown={surTouche} />

{#if spectacleCourant.chargement}
  <main class="etat"><p class="secondaire">…</p></main>

{:else if spectacleCourant.introuvable || !s}
  <main class="etat">
    <p>{tsc.introuvable}</p>
    <button class="secondaire-bouton" onclick={surQuitter}>{t.navigation.retourAccueil}</button>
  </main>

{:else}
  <!--
    Un seul élément racine : l'application place le contenu de la route dans
    une unique cellule de grille. Deux enfants s'y superposeraient, et la barre
    d'actions passerait sous le script.
  -->
  <div class="ecran">
  <!-- Barre d'actions, masquée à l'impression -->
  <div class="barre sans-impression">
    <span class="eyebrow mode">{tl.modeEdition}</span>

    <div class="historique">
      <button
        class="secondaire-bouton"
        disabled={!spectacleCourant.peutAnnuler}
        onclick={() => spectacleCourant.annuler()}
      >{tsc.annuler}</button>
      <button
        class="secondaire-bouton"
        disabled={!spectacleCourant.peutRetablir}
        onclick={() => spectacleCourant.retablir()}
      >{tsc.retablir}</button>
      <button class="secondaire-bouton" onclick={() => window.print()}>{tsc.imprimer}</button>
    </div>

    <button class="cta jouer" data-visite="jouer" onclick={surLire}>{tsc.jouer}</button>
    <button class="secondaire-bouton croix" onclick={surQuitter} aria-label={tl.quitter}>
      ✕
    </button>
  </div>

  <main>
    <!-- En-tête du script : le titre est modifiable sur place -->
    <header>
      <label class="invisible" for="titre-spectacle">{tsc.titreModifiable}</label>
      <input
        id="titre-spectacle"
        class="titre"
        value={s.titre}
        maxlength="80"
        oninput={(e) => spectacleCourant.definirTitre(e.currentTarget.value)}
      />

      {#if s.pitch}<p class="pitch">{s.pitch}</p>{/if}
      <p class="mono meta">
        {formaterDuree(s.dureeEstimeeSecondes)}
        · {tsc.ageValeur(s.parametres.ageAuditoire)}
        · {s.parametres.nbMarionnettistes}
        {s.parametres.nbMarionnettistes > 1 ? 'marionnettistes' : 'marionnettiste'}
      </p>

      <!-- La fiche des voix est un aide-mémoire précieux pour le parent. -->
      <div class="distribution">
        {#each s.distribution as m (m.id)}
          <div class="fiche">
            <Vignette nom={m.nom} taille={40} />
            <div>
              <p class="nom">{m.nom}</p>
              <p class="voix">{m.voix || tsc.sansVoix}</p>
            </div>
          </div>
        {/each}
      </div>
    </header>

    <BandeauTableaux tableaux={s.tableaux} actes={s.actes} />

    <!-- Corps du script : les actes se suivent -->
    {#each s.actes as acte (acte.id)}
      {@const tableau = s.tableaux.find((tb) => tb.id === acte.tableauId)}
      <section class="acte">
        <div class="tete-acte">
          <h2>{tsc.acte(acte.numero)} — {acte.titre}</h2>
          {#if tableau}<p class="mono lieu">{tableau.titre}</p>{/if}
          <div class="sans-impression">
            <RegenererActe acteId={acte.id} acteNumero={acte.numero} />
          </div>
        </div>

        {#if acte.resume}<p class="resume">{acte.resume}</p>{/if}

        {#each acte.elements as element, index (element.id)}
          <ElementScriptVue
            {element}
            acteId={acte.id}
            position={index + 1}
            problemes={problemesDe(acte.numero, index + 1)}
            badge={deuxMarionnettistes ? (spectacleCourant.badges.get(element.id) ?? '') : ''}
            enEdition={editionId === element.id}
            surEditer={() => (editionId = element.id)}
            surFermerEdition={() => (editionId = null)}
          />
        {/each}
      </section>
    {/each}
  </main>
  </div>

{/if}

<style>
  /* La barre reste en haut, le script défile seul en dessous. */
  .ecran {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  main {
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 16px 20px 64px;
    overflow-y: auto;
  }
  .etat { padding: 32px 20px; }
  .secondaire { font-size: 13px; }

  .barre {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 10px 20px;
    border-bottom: var(--bordure) solid var(--encre);
    background: var(--papier);
  }
  .mode { flex: 0 0 auto; }
  .historique { display: flex; gap: 6px; flex: 1; }
  .croix { min-height: 44px; padding: 10px 14px; }
  .historique button { font-size: 10px; min-height: 36px; }
  .jouer { min-height: 44px; font-size: 13px; letter-spacing: 0.14em; padding: 10px 24px; }

  header { margin-bottom: 24px; }
  .titre {
    border: none;
    padding: 0;
    background: transparent;
    font-family: var(--police-texte);
    font-size: 26px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: -0.04em;
    min-height: 0;
  }
  .titre:hover { outline: 2px dashed var(--gris); }

  .pitch { font-size: 16px; margin: 8px 0 4px; }
  .meta { font-size: 12px; color: var(--encre2); margin: 8px 0 12px; }

  .distribution { display: flex; flex-wrap: wrap; gap: 14px; }
  .fiche { display: flex; align-items: center; gap: 8px; }
  .fiche .nom {
    margin: 0;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 13px;
    letter-spacing: -0.02em;
  }
  .fiche .voix { margin: 0; font-size: 12px; color: var(--encre2); max-width: 26ch; }

  .acte { margin-bottom: 32px; }
  .tete-acte {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
    padding-bottom: 6px;
    border-bottom: var(--bordure) solid var(--encre);
    margin-bottom: 10px;
  }
  .tete-acte h2 { font-size: 19px; }
  .lieu { font-size: 11px; color: var(--encre2); flex: 1; }
  .resume { font-size: 14px; color: var(--encre2); margin-bottom: 12px; }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
