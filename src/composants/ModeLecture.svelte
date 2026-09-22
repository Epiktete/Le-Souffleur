<script lang="ts">
  // Mode lecture : le spectacle joué (CDC §9).
  //
  // Deux colonnes : les dialogues à gauche, en grand, et tout ce qui s'y
  // rapporte à droite, plus petit. Le marionnettiste se concentre sur ce qu'il
  // doit dire et trouve le reste d'un coup d'œil, sans jamais confondre.
  //
  // On tourne la page, on ne fait jamais défiler : avec une peluche sur chaque
  // main, seul le pied est libre.
  import { PROMPTEUR } from '../config';
  import { tl, tsc } from '../textes';
  import { spectacleCourant } from '../etat/spectacleCourant.svelte';
  import { lecture } from '../etat/lecture.svelte';
  import { visite } from '../etat/visite.svelte';
  import {
    commandeDe,
    commandeDuToucher,
    empecherDefaut,
    filtrer,
    soumisAuRebond,
    type Commande,
  } from '../services/commandes';
  import {
    construireRangees,
    decouperTropLongues,
    pageDeLaRangee,
    paginer,
    type Page,
    type Rangee,
  } from '../services/pagination';
  import TestTouches from './TestTouches.svelte';
  import type { ElementScript } from '../types';

  interface Props {
    surQuitter: () => void;
    surEditer: () => void;
  }
  let { surQuitter, surEditer }: Props = $props();

  // La première lecture : la visite rappelle comment tourner les pages.
  $effect(() => { visite.lancer('lecture'); });

  const s = $derived(spectacleCourant.spectacle);
  const rangees = $derived(s ? construireRangees(s.actes) : []);

  /** Mesures et découpage. */
  let zoneMesure = $state<HTMLElement>();
  let zonePage = $state<HTMLElement>();
  let hauteurs = $state<Map<string, number>>(new Map());
  let hauteurDisponible = $state(0);

  // Une tirade plus haute que l'écran est coupée à la phrase plutôt que
  // tronquée : en représentation, il ne faut jamais perdre la fin d'un texte.
  const rangeesDecoupees = $derived(decouperTropLongues(rangees, hauteurs, hauteurDisponible));
  const pages = $derived(paginer(rangeesDecoupees, hauteurs, hauteurDisponible));
  const pageCourante = $derived(pages[lecture.page] as Page | undefined);

  let menuOuvert = $state(false);
  let testOuvert = $state(false);
  let decorAnnonce = $state(false);
  /** Dernier appui retenu, pour l'anti-rebond. */
  let dernierAppui: number | null = null;
  /** Bref retour visuel : le parent doit savoir que la pédale a répondu. */
  let flash = $state(false);

  const tableau = $derived(
    s?.tableaux.find((t) => t.id === pageCourante?.tableauId),
  );

  /* ---------------------------------------------------------------- */
  /* Mesure : on rend les rangées hors écran pour connaître leur hauteur */
  /* ---------------------------------------------------------------- */

  /** Vrai si deux jeux de mesures sont identiques. */
  function memesHauteurs(a: Map<string, number>, b: Map<string, number>): boolean {
    if (a.size !== b.size) return false;
    for (const [cle, valeur] of a) if (b.get(cle) !== valeur) return false;
    return true;
  }

  $effect(() => {
    // On remesure quand le texte change, et quand le découpage change : une
    // tirade coupée produit de nouvelles rangées, qu'il faut mesurer à leur
    // tour.
    void lecture.taillePx;
    void rangeesDecoupees;

    const mesurer = () => {
      if (!zoneMesure) return;

      const nouvelles = new Map<string, number>();
      for (const enfant of zoneMesure.children) {
        const element = enfant as HTMLElement;
        const cle = element.dataset.rangee;
        if (!cle) continue;
        // La marge qui sépare deux rangées compte dans la hauteur occupée :
        // l'oublier ferait déborder la page d'autant de fois qu'il y a de
        // rangées.
        const marge = parseFloat(getComputedStyle(element).marginBottom) || 0;
        nouvelles.set(cle, element.offsetHeight + marge);
      }
      // Sans cette garde, l'effet boucle : les mesures changent le découpage,
      // qui relance l'effet, qui remesure. On s'arrête dès que rien ne bouge.
      if (!memesHauteurs(nouvelles, hauteurs)) hauteurs = nouvelles;

      // clientHeight comprend le rembourrage : c'est la hauteur du contenu
      // qu'il faut, sinon la dernière rangée d'une page est rognée.
      let disponible = 0;
      if (zonePage) {
        const style = getComputedStyle(zonePage);
        disponible = zonePage.clientHeight
          - (parseFloat(style.paddingTop) || 0)
          - (parseFloat(style.paddingBottom) || 0);
      }
      // Une hauteur NULLE n'est pas une mesure : c'est l'absence de mesure.
      //
      // Pendant qu'un changement de décor est annoncé, la zone de page n'est
      // plus disposée et clientHeight vaut zéro. Sans cette garde, tout le
      // spectacle se repliait alors sur une seule page, la position était
      // ramenée en arrière, l'annonce de décor se rejouait — et le spectacle
      // tournait en rond sur ce décor, page après page, sans jamais avancer.
      // Le garde-fou de decorVuPour ne suffisait pas : c'est le nombre de
      // pages qui changeait sous lui.
      if (disponible > 0 && disponible !== hauteurDisponible) {
        hauteurDisponible = disponible;
      }
    };

    // Après le rendu, et à chaque redimensionnement de la fenêtre.
    const image = requestAnimationFrame(mesurer);
    window.addEventListener('resize', mesurer);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener('resize', mesurer);
    };
  });

  /**
   * Redécoupage : agrandir le texte ou tourner la tablette change le nombre de
   * pages. On retrouve alors la page de la rangée qu'on était en train de lire.
   *
   * Ce repositionnement n'a lieu QUE lorsque le découpage change. L'appliquer
   * à chaque tour de page ramènerait aussitôt à la page précédente, puisque
   * l'ancre y pointe encore : le spectacle serait bloqué sur sa première page.
   */
  let pagesPrecedentes: Page[] | null = null;

  $effect(() => {
    const actuelles = pages;
    if (actuelles === pagesPrecedentes) return;

    const ancre = pagesPrecedentes ? lecture.rangeeAncre : null;
    pagesPrecedentes = actuelles;
    if (actuelles.length === 0) return;

    if (ancre) lecture.allerA(pageDeLaRangee(actuelles, ancre));
    else if (lecture.page >= actuelles.length) lecture.allerA(actuelles.length - 1);
  });

  /**
   * Un changement de décor s'annonce et attend un appui (CDC §9).
   *
   * On retient la page déjà annoncée : sans cela, une remesure de l'écran
   * recalculerait les pages, l'effet se rejouerait et l'annonce reviendrait
   * sans fin, bloquant le spectacle sur ce décor.
   */
  let decorVuPour = $state<number | null>(null);

  $effect(() => {
    const numero = lecture.page;
    if (pages[numero]?.changementTableau && decorVuPour !== numero) decorAnnonce = true;
  });

  /** Referme l'annonce de décor et retient qu'elle a été vue. */
  function fermerDecor() {
    decorVuPour = lecture.page;
    decorAnnonce = false;
  }

  /* ---------------------------------------------------------------- */
  /* Commandes                                                         */
  /* ---------------------------------------------------------------- */

  /** Va à une page et met l'ancre à jour, repère du prochain redécoupage. */
  function allerA(numero: number) {
    const borne = Math.min(Math.max(numero, 0), Math.max(pages.length - 1, 0));
    lecture.allerA(borne);
    const premiere = pages[borne]?.rangees[0]?.id;
    if (premiere) lecture.memoriserAncre(premiere);
  }

  function executer(commande: Commande) {
    flash = true;
    setTimeout(() => (flash = false), 120);

    switch (commande) {
      case 'suivant':
        // Un écran de changement de décor se referme avant d'avancer.
        if (decorAnnonce) { fermerDecor(); return; }
        allerA(lecture.page + 1);
        break;
      case 'precedent':
        if (decorAnnonce) { fermerDecor(); return; }
        allerA(lecture.page - 1);
        break;
      case 'debut': allerA(0); break;
      case 'menu': menuOuvert = !menuOuvert; break;
      case 'quitter': surQuitter(); break;
      case 'plusGrand': lecture.agrandir(); break;
      case 'plusPetit': lecture.reduire(); break;
      default: break;
    }
  }

  function surTouche(e: KeyboardEvent) {
    if (testOuvert) return; // la page de test capte les appuis elle-même
    const commande = commandeDe(e.key);
    if (!commande) return;
    if (empecherDefaut(e.key)) e.preventDefault();

    // Le rebond ne concerne que les tours de page : Échap et le menu doivent
    // répondre immédiatement, même juste après un autre appui.
    const rebond = soumisAuRebond(commande);
    const rejet = filtrer(e.repeat, e.timeStamp, rebond ? dernierAppui : null);
    if (rejet) return;
    if (rebond) dernierAppui = e.timeStamp;
    executer(commande);
  }

  function surToucher(e: PointerEvent) {
    if (menuOuvert || testOuvert) return;
    const cible = e.currentTarget as HTMLElement;
    const rejet = filtrer(false, e.timeStamp, dernierAppui);
    if (rejet) return;
    dernierAppui = e.timeStamp;
    executer(commandeDuToucher(e.clientX - cible.getBoundingClientRect().left, cible.clientWidth));
  }

  /* ---------------------------------------------------------------- */
  /* Écran allumé et plein écran                                       */
  /* ---------------------------------------------------------------- */

  let veilleSignalee = $state(false);

  $effect(() => {
    let verrou: WakeLockSentinel | null = null;
    const demander = async () => {
      try {
        verrou = await navigator.wakeLock?.request('screen') ?? null;
      } catch {
        veilleSignalee = true;
      }
    };
    if ('wakeLock' in navigator) void demander();
    else veilleSignalee = true;

    // Le verrou saute quand l'onglet passe en arrière-plan : on le reprend.
    const surVisibilite = () => {
      if (document.visibilityState === 'visible' && 'wakeLock' in navigator) void demander();
    };
    document.addEventListener('visibilitychange', surVisibilite);

    return () => {
      document.removeEventListener('visibilitychange', surVisibilite);
      void verrou?.release().catch(() => {});
    };
  });

  function texteDe(e: ElementScript): string {
    return 'texte' in e ? e.texte : '';
  }

  function nomDe(e: ElementScript): string {
    return 'marionnetteId' in e ? spectacleCourant.nomDe(e.marionnetteId) : '';
  }

  /**
   * Classe de couleur d’un personnage, de c1 à c5 (CDC §9).
   *
   * Le marionnettiste doit voir que la réplique change de bouche sans avoir à
   * lire le nom. La couleur ne remplace jamais le nom : elle le double.
   */
  function couleurDe(e: ElementScript): string {
    return 'marionnetteId' in e ? `c${spectacleCourant.couleurDe(e.marionnetteId)}` : '';
  }
</script>

<svelte:window onkeydown={surTouche} />

<div
  class="lecture"
  class:inverse={lecture.inverse}
  class:flash
  style="--taille: {lecture.taillePx}px"
  role="application"
  aria-label={tl.modeLecture}
  onpointerdown={surToucher}
>
  <!-- Bandeau discret : acte, tableau, page, temps écoulé (CDC §9) -->
  <!--
    Ne reste ici que ce qui ne se trouve nulle part ailleurs : où l'on en est,
    et depuis combien de temps. L'acte est annoncé par son titre dans la page,
    et le décor par son propre écran : les répéter en haut encombrerait pour
    rien un écran qu'on lit en jouant.
  -->
  <div class="bandeau mono" data-visite="bandeau">
    <span class="place">{tl.page(lecture.page + 1, Math.max(pages.length, 1))}</span>
    <span>{lecture.tempsEcoule}</span>
    <button class="commande" onclick={(e) => { e.stopPropagation(); menuOuvert = true; }}>
      {tl.menu}
    </button>
    <button class="commande" onclick={(e) => { e.stopPropagation(); surQuitter(); }} aria-label={tl.quitter}>
      ✕
    </button>
  </div>

  <!-- Progression : le rouge marque la position dans le spectacle (§11) -->
  <div class="progression" aria-hidden="true">
    <div class="avancee" style="width: {pages.length ? ((lecture.page + 1) / pages.length) * 100 : 0}%"></div>
  </div>

  {#if decorAnnonce && tableau}
    <!-- Écran intercalaire : on ne joue pas pendant qu'on change le décor. -->
    <div class="decor" data-visite="page">
      <p class="mono etiquette">{tl.changementDecor}</p>
      <p class="titre-decor">{tableau.titre}</p>
      {#if tableau.description}<p class="description">{tableau.description}</p>{/if}
      <p class="mono continuer">{tl.continuer}</p>
    </div>

  {:else}
    <div class="page" data-visite="page" bind:this={zonePage}>
      {#if !pageCourante}
        <p class="vide">{tl.vide}</p>
      {:else}
        {#each pageCourante.rangees as rangee (rangee.id)}
          <div class="rangee" class:indication={!!rangee.scene}>{@render contenuRangee(rangee)}</div>
        {/each}
      {/if}
    </div>
  {/if}

  <!--
    Zone de mesure : les mêmes rangées, avec EXACTEMENT le même contenu, rendues
    hors écran à la même largeur.

    Le contenu vient du même fragment que la page réelle : une version
    simplifiée mesurerait trop court, et la dernière réplique d'une page se
    retrouverait coupée en bas de l'écran — précisément ce que la pagination
    doit empêcher.
  -->
  <div class="mesure" bind:this={zoneMesure} aria-hidden="true">
    <!-- Les rangées entières : c'est sur leur hauteur qu'on décide s'il faut
         couper une tirade. -->
    {#each rangees as rangee (rangee.id)}
      <div class="rangee" class:indication={!!rangee.scene} data-rangee={rangee.id}>{@render contenuRangee(rangee)}</div>
    {/each}
    <!-- Puis les morceaux réellement affichés, pour la mise en pages. -->
    {#each rangeesDecoupees as rangee (rangee.id)}
      <div class="rangee" class:indication={!!rangee.scene} data-rangee={rangee.id}>{@render contenuRangee(rangee)}</div>
    {/each}
  </div>
</div>

<!-- Le contenu d'une rangée, partagé par la page affichée et la mesure. -->
{#snippet contenuRangee(rangee: Rangee)}
  <!--
    Un seul fil, dans l'ordre du jeu : répliques et indications scéniques se
    suivent, et c'est leur forme qui les distingue. À droite, seulement la
    façon de dire la réplique d'en face.
  -->
  <div class="fil">
    {#if rangee.debutActe}
      <p class="mono acte">{tl.acte(rangee.acteNumero)} — {rangee.acteTitre}</p>
    {/if}
    {#if rangee.dialogue}
      {@const d = rangee.dialogue}
      <div class="bulle {couleurDe(d)}" class:public={d.type === 'adresse_public'}>
        <p class="nom mono">
          <span class="pastille" aria-hidden="true"></span>
          {nomDe(d)}
          {#if rangee.suite}<span class="suite">{tl.suite}</span>{/if}
          {#if spectacleCourant.badges.get(d.id)}
            <span class="badge-m">{spectacleCourant.badges.get(d.id)}</span>
          {/if}
          {#if d.type === 'adresse_public'}
            <span class="au-public">{tsc.labelPublic}</span>
          {/if}
        </p>
        <p class="dit">{texteDe(d)}</p>
        {#if d.type === 'adresse_public' && d.attenteReponse}
          <p class="mono attente">{tsc.attendreReponse}</p>
        {/if}
      </div>
    {:else if rangee.scene}
      {@render elementScene(rangee.scene)}
    {/if}
  </div>

  <div class="jeu">
    {#if rangee.dialogue?.type === 'replique' && rangee.dialogue.ton && !rangee.suite}
      <p class="ton">{rangee.dialogue.ton}</p>
    {/if}
  </div>
{/snippet}

{#snippet elementScene(e: ElementScript)}
  {#if e.type === 'entree' || e.type === 'sortie'}
    {@const main = e.mainMarionnettiste.endsWith('G') ? tsc.mainGauche : tsc.mainDroite}
    <p class="mono mouvement {couleurDe(e)}">
      <span class="pastille" aria-hidden="true"></span>
      {e.type === 'entree' ? tsc.entree(nomDe(e), main) : tsc.sortie(nomDe(e), main)}
    </p>
  {:else if e.type === 'note_marionnettiste'}
    <p class="note">{texteDe(e)}</p>
  {:else}
    <p class="didascalie">{texteDe(e)}</p>
  {/if}
{/snippet}

{#if menuOuvert}
  <div class="menu" role="dialog" aria-modal="true" aria-label={tl.menu}>
    <div class="menu-boite">
      <p class="mono">{tl.taille} : {lecture.taillePx} px</p>
      <div class="ligne">
        <button onclick={() => lecture.reduire()} disabled={lecture.taillePx <= PROMPTEUR.taillePxMin}>
          {tl.textemoins}
        </button>
        <button onclick={() => lecture.agrandir()} disabled={lecture.taillePx >= PROMPTEUR.taillePxMax}>
          {tl.texteplus}
        </button>
      </div>
      <button onclick={() => lecture.basculerInverse()}>{tl.inverser}</button>
      <button onclick={() => { allerA(0); menuOuvert = false; }}>{tl.debut}</button>
      <button onclick={() => { testOuvert = true; menuOuvert = false; }}>{tl.testTouches}</button>
      <button onclick={surEditer}>{tl.modeEdition}</button>
      <button onclick={surQuitter}>{tl.quitter}</button>
      <button class="secondaire-bouton" onclick={() => (menuOuvert = false)}>{tl.fermer}</button>
      {#if veilleSignalee}<p class="aide">{tl.veille}</p>{/if}
    </div>
  </div>
{/if}

{#if testOuvert}
  <TestTouches surFermer={() => (testOuvert = false)} />
{/if}

<style>
  /* Fond encre et texte papier par défaut : la pièce est souvent sombre et un
     écran blanc éblouit (CDC §9). */
  .lecture {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--encre);
    color: var(--papier);
    /* Teintes des personnages, claires sur le fond sombre (voir plus bas). */
    --lecture-bleu: #5B9BE6;
    --lecture-vert: #4FB477;
    --lecture-bronze: #D9A63A;
    overflow: hidden;
    cursor: pointer;
    user-select: none;
  }
  .lecture.inverse {
    background: var(--papier);
    color: var(--encre);
    /* Les mêmes teintes, assombries pour rester lisibles sur le papier. */
    --lecture-bleu: #2F6DB5;
    --lecture-vert: #2C7A4B;
    --lecture-bronze: #8A6414;
  }

  /* Bref retour visuel à chaque appui reçu : le parent doit savoir que la
     pédale a fonctionné (CDC §9). */
  .lecture.flash .progression { background: var(--accent); }

  .bandeau {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 14px;
    font-size: 12px;
    opacity: 0.75;
    flex: 0 0 auto;
  }
  .place { margin-right: auto; }

  .commande {
    min-height: 32px;
    padding: 4px 10px;
    border: 1px solid currentColor;
    background: transparent;
    color: inherit;
    box-shadow: none;
    font-size: 11px;
  }
  .commande:hover { background: transparent; box-shadow: none; transform: none; }

  .progression { height: 3px; background: transparent; flex: 0 0 auto; }
  .avancee { height: 100%; background: var(--accent); }

  /* --- La page ------------------------------------------------- */
  .page {
    flex: 1;
    min-height: 0;
    padding: 12px 24px 24px;
    overflow: hidden;
  }

  .rangee {
    display: grid;
    /* Le fil occupe les trois quarts : c'est ce qu'on suit en jouant. */
    grid-template-columns: 3fr 1fr;
    gap: 24px;
    align-items: start;
    margin-bottom: 18px;
  }
  /* Une indication scénique reste près de ce qu'elle enchaîne. */
  .rangee.indication { margin-bottom: 10px; }
  .fil p { margin: 0; color: inherit; }
  .acte { font-size: 12px; opacity: 0.7; margin-bottom: 6px; }

  /* --- Une couleur par marionnette (CDC §9) ---------------------
     Cinq teintes bien distinctes : papier, bleu, bronze, vert, rouge. Le
     gris de la charte, trop proche du papier, n'en fait plus partie. Le
     bleu, le vert et le bronze n'existent qu'ici, en deux versions : claire
     sur fond sombre, sombre sur fond papier. Au-delà de cinq marionnettes
     les teintes se répètent — sans perte, puisque le nom reste écrit.

     Une barre et une pastille portent la couleur ; sur fond sombre, le nom
     la prend aussi (toutes les teintes y dépassent 4,5:1). Sur papier, le
     rouge tomberait sous ce seuil : le nom y reste à l'encre. */
  .bulle {
    --perso: currentColor;
    border-left: 5px solid var(--perso);
    padding-left: 12px;
  }
  .c2 { --perso: var(--lecture-bleu); }
  .c3 { --perso: var(--lecture-bronze); }
  .c4 { --perso: var(--lecture-vert); }
  .c5 { --perso: var(--accent); }
  .lecture:not(.inverse) .bulle .nom { color: var(--perso); opacity: 1; }
  /* Une adresse au public se distingue par le trait, jamais par la seule
     couleur : celle-ci appartient déjà au personnage. */
  .bulle.public { border-left-style: double; border-left-width: 7px; }

  .pastille {
    display: inline-block;
    width: 0.5em;
    height: 0.5em;
    margin-right: 0.4em;
    background: var(--perso, currentColor);
  }

  .nom {
    font-size: calc(var(--taille) * 0.45);
    letter-spacing: 0.1em;
    opacity: 0.85;
    margin-bottom: 2px;
  }
  .suite { opacity: 0.7; margin-left: 6px; }
  .badge-m {
    border: 1px solid currentColor;
    padding: 0 5px;
    margin-left: 6px;
  }
  .au-public {
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 0 5px;
    margin-left: 6px;
  }

  /* Casse normale pour le texte dit : les capitales ralentissent la lecture
     d'un texte long (CDC §11, exception assumée). */
  .dit {
    font-size: var(--taille);
    line-height: 1.3;
    overflow-wrap: break-word;
  }
  .attente { font-size: 12px; opacity: 0.75; margin-top: 4px; }

  /* --- Les indications scéniques, dans le fil ------------------
     Elles se lisent entre les répliques mais ne se disent jamais : plus
     petites, décalées au niveau du texte dit, et chacune avec sa forme —
     italique pour ce qui se fait, capitales pour qui entre et sort, un cadre
     pour la consigne au marionnettiste. */
  .didascalie {
    font-style: italic;
    font-size: calc(var(--taille) * 0.6);
    line-height: 1.35;
    padding-left: 17px;
    opacity: 0.85;
  }
  .mouvement {
    font-size: calc(var(--taille) * 0.42);
    letter-spacing: 0.08em;
    padding-left: 17px;
  }
  .lecture:not(.inverse) .mouvement { color: var(--perso); }

  /* --- À droite : comment dire la réplique d'en face ------------ */
  .ton {
    margin: 0;
    padding-top: 2px;
    font-style: italic;
    font-size: calc(var(--taille) * 0.5);
    line-height: 1.3;
    color: inherit;
  }
  @media (max-width: 700px) {
    .rangee { grid-template-columns: 1fr; gap: 2px; }
    .jeu:empty { display: none; }
    .ton { padding-left: 17px; }
  }
  /* La note garde un fond distinct : elle ne se dit jamais à voix haute. */
  .fil .note {
    margin-left: 17px;
    font-size: calc(var(--taille) * 0.45);
    border: 1px solid currentColor;
    padding: 6px 8px;
  }

  .vide { font-size: 20px; opacity: 0.8; }

  /* --- Changement de décor -------------------------------------- */
  .decor {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    text-align: center;
    padding: 24px;
  }
  .decor p { color: inherit; margin: 0; }
  .etiquette { font-size: 14px; color: var(--accent); }
  .titre-decor {
    font-size: calc(var(--taille) * 1.1);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: -0.02em;
  }
  .description { font-size: calc(var(--taille) * 0.5); max-width: 40ch; opacity: 0.85; }
  .continuer { font-size: 12px; opacity: 0.7; }

  /* --- Zone de mesure, invisible mais rendue -------------------- */
  .mesure {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    visibility: hidden;
    pointer-events: none;
    padding: 12px 24px 24px;
  }

  /* --- Menu ----------------------------------------------------- */
  .menu {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(10 10 10 / 0.75);
    z-index: 40;
  }
  .menu-boite {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 260px;
    padding: 16px;
    border: var(--bordure) solid var(--encre);
    background: var(--papier);
  }
  .menu-boite p { margin: 0; color: var(--encre2); font-size: 11px; }
  .ligne { display: flex; gap: 8px; }
  .ligne button { flex: 1; }
  .aide { font-size: 12px; }
</style>
