<script lang="ts">
  // En-tête fin de 56 px (CDC §7) : nom de l'outil, paramètres IA avec
  // indicateur d'état de la clé, menu de sauvegarde, lien d'aide.
  // Sur écran étroit, il porte aussi les deux boutons d'ouverture des tiroirs.
  import { t } from '../textes';
  import { naviguer } from '../services/routeur';
  import { largeur } from '../largeur.svelte';
  // Le bandeau du haut : le souffleur dans son trou, vu de la salle.
  // Vite l'empaquette et lui donne une empreinte ; aucun appel extérieur.
  import bandeauSouffleur from '../../assets/Lesouffleur.webp';
  // Le nom de l'outil, dessiné. L'attribut alt le porte pour les lecteurs
  // d'écran : ce n'est pas une décoration, c'est le titre.
  import titreSouffleur from '../../assets/Titre.webp';
  import { reglagesIa } from '../etat/reglagesIa.svelte';
  import { tutoriel } from '../etat/tutoriel.svelte';

  interface Props {
    surTiroir: (lequel: 'bibliotheque' | 'spectacles') => void;
    /** Le bandeau illustré ne coiffe que le menu principal. */
    avecBandeau: boolean;
  }
  let { surTiroir, avecBandeau }: Props = $props();

  // Indicateur d'état de la clé API (CDC §7).
  const etatCle = $derived(
    reglagesIa.etat === 'ok' ? t.etatCle.ok : t.etatCle.absente,
  );

  const tiroirsVisibles = $derived(largeur.etroit && !largeur.tresEtroit);
</script>

<div class="entete sans-impression" class:avec-bandeau={avecBandeau}>
  <!--
    Bandeau illustré, réservé au menu principal : ailleurs, il ne ferait
    qu'occuper la place utile.
  -->
  {#if avecBandeau}
    <img class="bandeau" src={bandeauSouffleur} alt="" />
  {/if}

  <header>
  {#if tiroirsVisibles}
    <button class="secondaire-bouton" onclick={() => surTiroir('bibliotheque')}>
      {t.colonnes.bibliotheque}
    </button>
  {/if}

  <h1>
    <a href="#/studio">
      <img class="titre" src={titreSouffleur} alt={t.entete.nom} />
    </a>
  </h1>

  <nav>
    <button class="secondaire-bouton" data-visite="cle" onclick={() => naviguer({ nom: 'parametres' })}>
      {t.entete.parametresIa}
      <span class="badge">{etatCle}</span>
    </button>
    <button class="secondaire-bouton">{t.entete.sauvegarde}</button>
    <button class="secondaire-bouton" onclick={() => tutoriel.ouvrir(0)}>{t.entete.aide}</button>
  </nav>

  {#if tiroirsVisibles}
    <button class="secondaire-bouton" onclick={() => surTiroir('spectacles')}>
      {t.colonnes.spectacles}
    </button>
  {/if}
  </header>
</div>

<style>
  .entete {
    position: relative;
    border-bottom: var(--bordure) solid var(--encre);
  }
  /* Sans bandeau, l'en-tête reprend sa hauteur ordinaire. */
  .entete:not(.avec-bandeau) { height: var(--hauteur-entete); }

  /* Le dessin fait 2928 × 352, soit un rapport de 8,3 pour 1. À 11 vw de
     haut, il en reste 91 % : on cale le cadrage en haut, ce qui rogne un peu
     le plancher mais garde le castelet entier, souffleur compris. */
  .bandeau {
    display: block;
    width: 100%;
    height: clamp(88px, 11vw, 150px);
    object-fit: cover;
    object-position: center top;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    height: var(--hauteur-entete);
    padding: 0 12px;
    background: var(--papier);
  }

  /*
    Sur le bandeau, la barre se pose en bas de l'image : le plancher est la
    zone la plus claire et la plus unie du dessin, donc la plus sûre pour
    lire. Le fond de la barre disparaît, et chaque élément porte son propre
    fond opaque — c'est déjà le cas des boutons.
  */
  .avec-bandeau header {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: transparent;
  }

  /* Le nom pousse la navigation vers la droite. */
  h1 { flex: 1; margin: 0; line-height: 0; }
  h1 a { display: inline-block; text-decoration: none; }
  h1 a:hover { text-decoration: none; opacity: 0.8; }

  /*
    Le dessin est un carré de 1024 px dont le mot n'occupe que le centre :
    898 × 223, soit 4 pour 1. On donne au cadre ce rapport et on recadre en
    « cover », ce qui écarte les marges transparentes sans toucher au fichier.
  */
  .titre {
    display: block;
    height: 30px;
    aspect-ratio: 898 / 223;
    object-fit: cover;
    object-position: center;
  }

  /* Pas de cartouche autour du titre : le dessin porte déjà son contour noir
     et son ombre portée, faits pour tenir sur n'importe quel fond. En ajouter
     un second ferait doublon et rétrécirait le mot. */
  .avec-bandeau h1 { flex: 0 0 auto; }
  .avec-bandeau .titre { height: 40px; }
  .avec-bandeau nav { margin-left: auto; }

  nav { display: flex; gap: 8px; }

  /* En-tête fin : boutons compacts, sans ombre qui déborderait des 56 px. */
  header :global(button) {
    min-height: 36px;
    padding: 6px 10px;
    font-size: 11px;
    box-shadow: 2px 2px 0 var(--encre);
  }
  header :global(button:hover) {
    box-shadow: 2px 2px 0 var(--encre);
    transform: none;
    text-decoration: underline;
  }

  /* Sous 700 px la place manque : on ne garde que les paramètres IA (CDC §7). */
  @media (max-width: 700px) {
    nav :global(button:not(:first-child)) { display: none; }
    .titre { height: 22px; }
    /* Sur un écran étroit, la place va au studio, pas à la décoration ;
       le bandeau se réduit à ce qu'il faut pour porter la barre. */
    .bandeau { height: 64px; }
  }
</style>
