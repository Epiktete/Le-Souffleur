<script lang="ts">
  // Colonne centrale, mode Banque (CDC §7, « La colonne centrale a deux
  // modes ») : les spectacles déjà écrits du fonds, resservis sans nouvelle
  // génération.
  //
  // La scène et les réglages sont LES MÊMES composants que le Studio : ils
  // lisent le même état, et ce que le parent y règle se retrouve d'un mode à
  // l'autre. En mode Banque, ils FILTRENT les fiches : durée, âge,
  // marionnettistes, troupe (scène garnie, sinon toute la Marionnethèque), et
  // rien n'est écarté en silence.
  import { onDestroy } from 'svelte';
  import Scene from './Scene.svelte';
  import ReglagesStudio from './ReglagesStudio.svelte';
  import DistributionBanque from './DistributionBanque.svelte';
  import { tba, tg, tsv } from '../textes';
  import type { Marionnette } from '../types';
  import { studio } from '../etat/studio.svelte';
  import { bibliotheque } from '../etat/bibliotheque.svelte';
  import { banque } from '../etat/banque.svelte';
  import { spectacles } from '../etat/spectacles.svelte';
  import { naviguer } from '../services/routeur';
  import { signatures, type SignatureModele } from '../services/banque';
  import {
    evaluerModeles,
    type AttributionBanque,
    type Ecart,
    type Genre,
    type ModeleEvalue,
  } from '../services/appariement';
  import { lireModelesJoues } from '../services/historiqueBanque';
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

  /** La troupe : la scène garnie, sinon toute la Marionnethèque. */
  const sceneGarnie = $derived(!studio.sceneVide);
  const troupe = $derived(
    sceneGarnie
      ? studio.valeurs.marionnetteIds
        .map((id) => bibliotheque.liste.find((m) => m.id === id))
        .filter((m) => m !== undefined)
      : bibliotheque.liste,
  );

  /**
   * Les modèles déjà faits par cette famille. Le stockage local n'est pas
   * réactif : on relit après chaque création, pour que le spectacle tout juste
   * fait disparaisse de la liste.
   */
  let joues = $state(lireModelesJoues());

  const evaluations = $derived(evaluerModeles(
    fiches,
    troupe,
    {
      dureeMinutes: studio.valeurs.dureeMinutes,
      ageAuditoire: studio.valeurs.ageAuditoire,
      nbMarionnettistes: studio.valeurs.nbMarionnettistes,
    },
    { facultatives: !sceneGarnie, dejaJoues: joues },
  ));

  const jouables = $derived(evaluations.filter((e) => e.ecarts.length === 0));
  const ecartes = $derived(evaluations.filter((e) => e.ecarts.length > 0));

  /**
   * La ligne qui compte les écartés : chaque raison au plus une fois par
   * spectacle (la première, dans l'ordre où les filtres se lisent).
   */
  const RAISONS: [Ecart, (n: number) => string][] = [
    ['dejaJoue', tba.filtres.dejaJoue],
    ['duree', tba.filtres.duree],
    ['age', tba.filtres.age],
    ['marionnettistes', tba.filtres.marionnettistes],
    ['nombre', tba.filtres.nombre],
    ['distribution', tba.filtres.distribution],
  ];
  const ligneEcartes = $derived.by(() => {
    if (ecartes.length === 0) return '';
    const parRaison = new Map<Ecart, number>();
    for (const e of ecartes) {
      const premiere = RAISONS.find(([r]) => e.ecarts.includes(r));
      if (premiere) parRaison.set(premiere[0], (parRaison.get(premiere[0]) ?? 0) + 1);
    }
    const raisons = RAISONS
      .filter(([r]) => parRaison.has(r))
      .map(([r, texte]) => texte(parRaison.get(r)!))
      .join(', ');
    return tba.filtres.ecartes(ecartes.length, raisons);
  });

  /** Liste vide : quel réglage relâcher en premier (CDC §7) ? */
  const conseil = $derived.by(() => {
    if (jouables.length > 0 || fiches.length === 0) return '';
    const parDuree = ecartes.filter((e) => e.ecarts.includes('duree'));
    if (parDuree.length > 0) {
      const min = Math.min(...parDuree.map((e) => e.signature.dureeEstimeeSecondes));
      return tba.filtres.relacherDuree(Math.ceil(min / 60));
    }
    const parAge = ecartes.filter((e) => e.ecarts.includes('age'));
    if (parAge.length > 0) {
      return tba.filtres.relacherAge(Math.min(...parAge.map((e) => e.signature.ageAuditoire)));
    }
    return '';
  });

  /**
   * La fiche choisie, figée au clic : l'évaluation et la troupe du moment.
   * Les réglages restent modifiables au-dessus, mais ils ne retirent pas
   * l'écran sous les pieds du parent ; le retour rend la liste, à jour.
   */
  let choisi = $state<{ evalue: ModeleEvalue; troupe: Marionnette[] } | null>(null);

  /** La distribution courante de l'écran de retouche ; null si un interdit. */
  let distributionCourante = $state<AttributionBanque[] | null>(null);
  /** Les « il / elle » répondus pour les marionnettes au genre muet. */
  let genresCourants = $state<Partial<Record<string, Genre>>>({});

  function choisirFiche(e: ModeleEvalue) {
    choisi = { evalue: e, troupe: [...troupe] };
    distributionCourante = e.distribution;
    genresCourants = {};
  }

  function fermerFiche() {
    choisi = null;
    distributionCourante = null;
    genresCourants = {};
    banque.reinitialiser();
    joues = lireModelesJoues();
  }

  function creer() {
    if (!choisi || !distributionCourante) return;
    void banque.creer(
      choisi.evalue.signature.id,
      choisi.evalue.signature.conteId,
      distributionCourante,
      choisi.troupe,
      genresCourants,
    );
  }

  // Le spectacle créé doit apparaître aussitôt dans la colonne de droite.
  $effect(() => {
    if (banque.phase === 'termine') void spectacles.charger();
  });

  function ouvrirSpectacle() {
    const id = banque.spectacleId;
    fermerFiche();
    if (id) naviguer({ nom: 'script', spectacleId: id });
  }

  // En quittant le mode après une création, on doit retrouver la Banque
  // prête pour une nouvelle création (même règle que le Studio).
  onDestroy(() => {
    if (banque.phase === 'termine') banque.reinitialiser();
  });

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

  {#if choisi}
    {@const f = choisi.evalue.signature}
    <div class="boite fiche choisie">
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
      {#if dApres(f)}
        <p class="dapres">{dApres(f)}</p>
      {/if}
    </div>

    {#if choisi.evalue.distribution}
      <DistributionBanque
        signature={f}
        troupe={choisi.troupe}
        graine={choisi.evalue.distribution}
        surRetour={fermerFiche}
        surChangement={(d, genres) => {
          distributionCourante = d;
          genresCourants = genres;
        }}
      />
    {/if}

    {#if banque.phase === 'termine'}
      <section class="boite fin">
        <span class="eyebrow">{tg.fin.titre}</span>
        {#if banque.avertissement}
          <p class="aide" role="status">{banque.avertissement}</p>
        {/if}
        {#if banque.rappelSauvegarde}
          <p class="aide" role="status">{tsv.rappel}</p>
        {/if}
        <button class="cta" onclick={ouvrirSpectacle}>{tg.fin.ouvrir}</button>
      </section>
    {:else if banque.phase === 'repli'}
      <!-- La retouche d'accords a échoué : rien n'est enregistré, le parent
           tranche entre les accords d'origine et renoncer (CDC §7). -->
      <section class="boite erreur">
        <span class="eyebrow">{tba.creation.repli.titre}</span>
        <p role="alert">{tba.creation.repli.explication(banque.causeRepli)}</p>
        <div class="boutons">
          <button class="secondaire-bouton" onclick={() => banque.reinitialiser()}>
            {tba.creation.repli.renoncer}
          </button>
          <button onclick={() => void banque.creerQuandMeme()}>
            {tba.creation.repli.quandMeme}
          </button>
        </div>
      </section>
    {:else if banque.phase === 'erreur'}
      <section class="boite erreur">
        <span class="eyebrow">{tg.erreur.titre}</span>
        <p role="alert">{banque.erreur}</p>
        <div class="boutons">
          <button class="secondaire-bouton" onclick={() => banque.reinitialiser()}>
            {tg.erreur.fermer}
          </button>
          <button onclick={creer}>{tg.erreur.reessayer}</button>
        </div>
      </section>
    {:else}
      <!-- Le CTA de ce mode : créer sans nouvelle écriture (CDC §7). -->
      <button
        class="cta creer"
        disabled={!distributionCourante || banque.phase === 'creation'}
        onclick={creer}
      >
        {banque.phase === 'creation' ? tba.creation.enCours : tba.creation.bouton}
      </button>
      {#if !distributionCourante}
        <p class="aide" aria-live="polite">{tba.distribution.interditBloque}</p>
      {/if}
    {/if}
  {:else if fiches.length === 0}
    <p class="aide" role="status">{tba.fondsVide}</p>
  {:else}
    <p class="aide" role="status">{tba.intro(fiches.length)}</p>

    {#if jouables.length === 0}
      <p class="aide vide" role="status">
        {tba.filtres.aucun}
        {#if conseil}{' '}{conseil}{/if}
      </p>
    {:else}
      <ul class="fiches">
        {#each jouables as e (e.signature.id)}
          {@const f = e.signature}
          <li>
            <!-- Toute la fiche est le bouton : un clic mène à la distribution. -->
            <button type="button" class="boite fiche" onclick={() => choisirFiche(e)}>
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
              <!-- Les personnages, sans leurs traits : les attributs
                   n'intéressent pas le parent à ce stade (2026-09-28). -->
              <p class="roles">{f.roles.map(nomRole).join(' · ')}</p>
              {#if dApres(f)}
                <p class="dapres">{dApres(f)}</p>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if ligneEcartes}
      <p class="aide" role="status">{ligneEcartes}</p>
    {/if}
  {/if}
</div>

<style>
  .banque { display: flex; flex-direction: column; gap: 20px; padding-bottom: 8px; }

  .aide { font-size: 13px; color: var(--encre2); margin: 0; }
  /* Le vide s'explique : un peu plus visible que la ligne de compte. */
  .vide { border-left: 4px solid var(--accent); padding-left: 10px; color: var(--encre); }

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

  /* La fiche-bouton garde l'allure d'une boîte, pas d'un bouton d'action. */
  button.fiche {
    display: block;
    width: 100%;
    text-align: left;
    font: inherit;
    letter-spacing: normal;
    text-transform: none;
    cursor: pointer;
  }

  .meta { font-size: 11px; color: var(--encre2); margin: 0 0 8px; }

  .essence { font-size: 14px; margin: 0 0 8px; }

  .roles { margin: 0; font-size: 13px; font-weight: 600; }

  .dapres { font-size: 12px; font-style: italic; color: var(--encre2); margin: 8px 0 0; }

  .creer {
    width: 100%;
    min-height: 56px;
    font-size: 14px;
    letter-spacing: 0.14em;
  }

  .fin, .erreur { padding: 14px; }
  .fin .eyebrow, .erreur .eyebrow { margin-bottom: 10px; }
  .fin button { width: 100%; margin-top: 12px; }

  /* Le rouge signale l'erreur, conformément au §11. */
  .erreur p { border-left: 4px solid var(--accent); padding-left: 10px; font-size: 14px; }
  .boutons { display: flex; gap: 8px; margin-top: 12px; }
  .boutons button { flex: 1; }
</style>
