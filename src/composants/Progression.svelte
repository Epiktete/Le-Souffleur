<script lang="ts">
  // Barre de progression par étapes (CDC §7).
  // Pas de streaming en V1 : on affiche l'étape en cours, ce qui suffit et
  // simplifie l'analyse du JSON (CDC §5).
  import { DUREES_ETAPES, ETAPES_ECRITURE, ETAPES_PROPOSITIONS } from '../config';
  import { tg } from '../textes';
  import { generation } from '../etat/generation.svelte';
  import type { NomEtape } from '../services/pipeline';
  // L'écrivain à la plume : il dit, sans un mot, que le modèle est à l'ouvrage.
  import ecriture from '../../assets/Ecriture.webp';

  /**
   * Les étapes affichées.
   *
   * Deux étapes de la phase d'écriture sont faites par l'application et durent
   * une seconde : « Vérifications » et l'assemblage. Elles passeraient en un
   * clignement sans rien apprendre au parent. On ne montre que ce qui prend du
   * temps — le travail de la machine reste visible par
   * l'avancée de la jauge de l'étape en cours.
   */
  const INSTANTANEES: NomEtape[] = ['controles', 'assemblage'];

  const etapes = $derived(
    (generation.phase === 'propositions' ? ETAPES_PROPOSITIONS : ETAPES_ECRITURE)
      .filter((e) => !INSTANTANEES.includes(e)),
  );

  /**
   * Une seule étape ne fait pas une liste.
   *
   * La phase de propositions tient maintenant en un appel : une puce isolée
   * avec sa jauge ressemblait à une case à cocher oubliée. On l'affiche alors
   * comme une ligne de travail en cours, sans le décor de la liste.
   */
  const seule = $derived(etapes.length === 1);
  const courante = $derived(generation.avancement?.etape);

  /**
   * Position de l'étape en cours.
   *
   * On retient la dernière position connue : une étape absente de la liste
   * renverrait -1, et toutes les puces s'éteindraient d'un coup. C'est
   * exactement ce qui est arrivé en ajoutant « miseEnScene » au pipeline sans
   * l'ajouter ici — la liste paraissait s'effacer, comme si tout avait planté.
   */
  let dernierIndex = $state(0);
  /** Position brute, qui vaut -1 quand l'étape n'est pas dans la liste. */
  const position = $derived(courante ? etapes.indexOf(courante) : -1);
  /** Vrai quand le travail en cours est une étape que la liste ne montre pas. */
  const surUneInstantanee = $derived(!!courante && INSTANTANEES.includes(courante));

  // Un $derived ne doit rien écrire : c'est l'effet qui mémorise, le dérivé qui lit.
  $effect(() => {
    if (position >= 0) dernierIndex = position;
    // Une étape instantanée n'est pas dans la liste : on avance d'un cran pour
    // que la précédente se termine visiblement, au lieu de rester à 92 %.
    else if (surUneInstantanee) dernierIndex = Math.min(dernierIndex + 1, etapes.length - 1);
  });

  const indexCourant = $derived(position >= 0 ? position : dernierIndex);

  /* ---------------------------------------------------------------- */
  /* Avancement dans l'étape en cours                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Horloge, relancée à chaque changement d'étape.
   *
   * Le pipeline ne rend aucun compte pendant qu'un appel est en vol — il n'y a
   * pas de streaming (CDC §5) — et on ne va pas instrumenter chaque étape pour
   * si peu. Le temps écoulé suffit à prouver que l'application travaille.
   */
  let debutEtape = $state(Date.now());
  let maintenant = $state(Date.now());

  $effect(() => {
    void courante;
    debutEtape = Date.now();
    maintenant = Date.now();
    const horloge = setInterval(() => (maintenant = Date.now()), 250);
    return () => clearInterval(horloge);
  });

  const secondesEcoulees = $derived(Math.floor((maintenant - debutEtape) / 1000));

  /**
   * Fraction remplie de la barre d'une étape, entre 0 et 1.
   *
   * Pour les étapes qui écrivent acte par acte, c'est une vraie proportion.
   * Pour les autres, c'est une estimation de temps qui s'approche de la fin
   * sans jamais l'atteindre : seule l'étape suivante termine la barre. Une
   * barre qui plafonne à 92 % pendant que les secondes continuent de défiler
   * dit la vérité — ça travaille encore — là où une barre à 100 % mentirait.
   */
  function fraction(etape: NomEtape, index: number): number {
    if (indexCourant > index) return 1;
    if (indexCourant !== index) return 0;

    const a = generation.avancement;
    if (a?.acte && a.actesTotal) return Math.min(a.acte / a.actesTotal, 0.92);

    const duree = DUREES_ETAPES[etape] ?? 20;
    return Math.min(1 - Math.exp(-secondesEcoulees / duree), 0.92);
  }

  function libelle(etape: NomEtape): string {
    const base = tg.etapes[etape];
    const a = generation.avancement;
    if (etape === 'ecriture' && a?.etape === 'ecriture' && a.acte && a.actesTotal) {
      return `${base} — ${tg.acteSur(a.acte, a.actesTotal)}`;
    }
    return base;
  }
</script>

<div class="progression" role="status" aria-live="polite" aria-label={tg.enCours}>
  <div class="etapes" class:seule>
    <ol>
    {#each etapes as etape, index (etape)}
      {@const faite = indexCourant > index}
      {@const active = indexCourant === index}
      <li class:faite class:active>
        <span class="puce" aria-hidden="true"></span>
        <span class="libelle mono">{libelle(etape)}</span>
        <span class="jauge" aria-hidden="true">
          <span class="remplie" style="width: {fraction(etape, index) * 100}%"></span>
        </span>
        {#if active}
          <span class="secondes mono" aria-hidden="true">
            {#if generation.avancement?.essai}
              {tg.reprise(generation.avancement.essai)} ·
            {/if}
            {secondesEcoulees}s
          </span>
        {/if}
      </li>
    {/each}
    </ol>

    <button type="button" class="secondaire-bouton" onclick={() => generation.annuler()}>
      {tg.annuler}
    </button>
  </div>

  <!--
    Purement décorative : ce qui se passe est dit par la liste des étapes, que
    les lecteurs d'écran annoncent déjà.
  -->
  <img class="plume" src={ecriture} alt="" />
</div>

<style>
  .progression {
    display: flex;
    align-items: center;
    gap: 20px;
    border: var(--bordure) solid var(--encre);
    padding: 14px;
  }
  .etapes { flex: 1; min-width: 0; }

  /*
    L'image respire doucement pendant que le modèle travaille : une génération
    dure une à deux minutes, et un écran parfaitement immobile laisse croire
    que rien ne se passe.
  */
  .plume {
    flex: 0 0 auto;
    width: clamp(96px, 18%, 160px);
    height: auto;
    animation: respire 2.6s ease-in-out infinite;
    transform-origin: 60% 80%;
  }

  @keyframes respire {
    0%, 100% { transform: rotate(-1.2deg) translateY(0); }
    50%      { transform: rotate(1.2deg) translateY(-4px); }
  }

  /* Sous 560 px, la colonne du studio est trop étroite pour deux colonnes. */
  @media (max-width: 560px) {
    .progression { flex-direction: column; align-items: stretch; }
    .plume { align-self: center; width: 120px; }
  }

  ol { list-style: none; margin: 0 0 12px; padding: 0; }

  /*
    Une seule étape : on retire le décor de la liste.
    La phase de propositions tient en un appel, et une puce isolée avec sa
    jauge ressemblerait à une case oubliée. On garde
    la jauge et le compteur — ce sont eux qui disent que ça travaille — et on
    donne au libellé la taille d'un titre de travail en cours.
  */
  .seule .puce { display: none; }
  .seule .libelle { font-size: 16px; font-weight: 700; }
  .seule li { padding: 2px 0 8px; gap: 14px; }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 0;
    color: var(--gris);
  }
  .libelle { flex: 0 0 auto; }
  /* Le gris n'est admis qu'à partir de 24 px : les étapes à venir restent donc
     en encre2, simplement atténuées par l'absence de gras. */
  li { color: var(--encre2); }

  /* La jauge occupe la place qui reste, à droite du libellé. Elle ne mesure pas
     le travail du modèle — personne ne peut le mesurer sans streaming — elle
     montre que le temps passe et que rien n'est figé (CDC §7). */
  .jauge {
    flex: 1;
    min-width: 40px;
    height: 4px;
    background: var(--papier);
    border: 1px solid var(--encre2);
  }
  .remplie {
    display: block;
    height: 100%;
    background: var(--encre2);
    transition: width 0.25s linear;
  }
  li.active .remplie { background: var(--accent); }

  .secondes {
    flex: 0 0 auto;
    font-size: 11px;
    min-width: 34px;
    text-align: right;
    white-space: nowrap;
  }

  .puce {
    width: 12px;
    height: 12px;
    flex: 0 0 auto;
    border: var(--bordure) solid var(--encre);
    background: var(--papier);
  }
  li.faite .puce { background: var(--encre); }
  /* L'étape en cours porte l'accent : c'est le marqueur « vous êtes ici ». */
  li.active .puce { background: var(--accent); }
  li.active .libelle { font-weight: 700; color: var(--encre); }

  .libelle { font-size: 12px; letter-spacing: 0.06em; }

</style>
