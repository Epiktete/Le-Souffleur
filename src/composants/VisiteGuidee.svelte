<script lang="ts">
  // La visite guidée de la première fois : une bulle à la fois, avec une
  // flèche vers la zone qu'elle explique (marquée par un attribut data-visite).
  // Un clic n'importe où, ou n'importe quelle touche, passe à la suivante ;
  // Échap termine la séquence. Une zone absente ou invisible (écran étroit,
  // tiroir fermé) est simplement sautée.
  import { visite } from '../etat/visite.svelte';
  import { tv } from '../textes';

  type Rect = { top: number; left: number; width: number; height: number };

  const MARGE = 16;
  const FLECHE = 12;

  let cible = $state<Rect | null>(null);
  let bulleEl = $state<HTMLDivElement | undefined>();
  let hauteurBulle = $state(0);
  let largeurBulle = $state(0);
  let fenetre = $state({ l: window.innerWidth, h: window.innerHeight });

  function trouver(nom: string): HTMLElement | null {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-visite="${nom}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
    return null;
  }

  function mesurer(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    cible = { top: r.top, left: r.left, width: r.width, height: r.height };
    fenetre = { l: window.innerWidth, h: window.innerHeight };
  }

  // À chaque bulle : attendre que la zone soit affichée (quelques images au
  // plus, le temps que l'écran se construise), la rendre visible, la mesurer.
  $effect(() => {
    const bulle = visite.bulle;
    cible = null;
    if (!bulle) return;
    let essais = 0;
    let image = 0;
    let el: HTMLElement | null = null;
    const chercher = () => {
      el = trouver(bulle.cible);
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        mesurer(el);
      } else if (++essais < 30) {
        image = requestAnimationFrame(chercher);
      } else {
        visite.suivante();
      }
    };
    chercher();
    const remesurer = () => { if (el) mesurer(el); };
    window.addEventListener('resize', remesurer);
    window.addEventListener('scroll', remesurer, true);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener('resize', remesurer);
      window.removeEventListener('scroll', remesurer, true);
    };
  });

  $effect(() => {
    if (cible && bulleEl) bulleEl.focus({ preventScroll: true });
  });

  // La bulle se place sous la zone s'il y a la place, sinon au-dessus, sinon
  // dans la zone elle-même (une zone qui occupe tout l'écran, comme la page
  // de lecture) ; la flèche vise toujours le centre de la zone.
  const position = $derived.by(() => {
    if (!cible) return null;
    const centreX = cible.left + cible.width / 2;
    const bas = cible.top + cible.height;
    let sens: 'haut' | 'bas' | 'aucun';
    let top: number;
    if (bas + FLECHE + hauteurBulle + MARGE <= fenetre.h) {
      sens = 'haut';
      top = bas + FLECHE;
    } else if (cible.top - FLECHE - hauteurBulle - MARGE >= 0) {
      sens = 'bas';
      top = cible.top - FLECHE - hauteurBulle;
    } else {
      sens = 'aucun';
      top = Math.max(MARGE, cible.top + cible.height / 2 - hauteurBulle / 2);
    }
    const left = Math.min(
      Math.max(MARGE, centreX - largeurBulle / 2),
      Math.max(MARGE, fenetre.l - MARGE - largeurBulle),
    );
    const flecheX = Math.min(Math.max(centreX - left, 18), largeurBulle - 18);
    return { top, left, sens, flecheX };
  });

  function surTouche(e: KeyboardEvent) {
    if (!visite.bulle) return;
    // La touche est prise par la visite : elle ne doit pas, en plus, tourner
    // la page de lecture ou déclencher un raccourci.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') visite.terminer();
    else visite.suivante();
  }

  $effect(() => {
    // Phase de capture : passer avant les raccourcis des écrans.
    window.addEventListener('keydown', surTouche, true);
    return () => window.removeEventListener('keydown', surTouche, true);
  });
</script>

{#if visite.bulle}
  <!-- Le voile prend tous les clics : aucun ne doit atteindre l'écran dessous. -->
  <div class="voile" role="presentation" onclick={() => visite.suivante()}>
    {#if cible}
      <div
        class="projecteur"
        style="top: {cible.top - 6}px; left: {cible.left - 6}px; width: {cible.width + 12}px; height: {cible.height + 12}px"
      ></div>
    {/if}
    <div
      class="bulle boite"
      class:placee={!!position}
      role="dialog"
      aria-label={tv.nom}
      tabindex="-1"
      bind:this={bulleEl}
      bind:clientHeight={hauteurBulle}
      bind:clientWidth={largeurBulle}
      style={position ? `top: ${position.top}px; left: ${position.left}px; --fleche-x: ${position.flecheX}px` : ''}
      data-sens={position?.sens}
    >
      <p>{visite.bulle.texte}</p>
      <p class="mono continuer">{tv.continuer}</p>
    </div>
  </div>
{/if}

<style>
  .voile {
    position: fixed;
    inset: 0;
    z-index: 60;
    cursor: pointer;
  }

  /* La zone expliquée reste claire ; tout le reste est assombri. */
  .projecteur {
    position: fixed;
    border: var(--bordure) solid var(--accent);
    box-shadow: 0 0 0 100vmax rgb(10 10 10 / 0.55);
    pointer-events: none;
  }

  .bulle {
    position: fixed;
    width: min(300px, calc(100vw - 32px));
    padding: 14px 16px;
    background: var(--papier);
    visibility: hidden;
    outline: none;
  }
  .bulle.placee { visibility: visible; }
  .bulle p { margin: 0; font-size: 16px; }
  .bulle .continuer { margin-top: 8px; font-size: 11px; color: var(--encre2); }

  /* La flèche : un carré tourné, à cheval sur le bord de la bulle. */
  .bulle[data-sens='haut']::before,
  .bulle[data-sens='bas']::before {
    content: '';
    position: absolute;
    left: calc(var(--fleche-x) - 9px);
    width: 16px;
    height: 16px;
    background: var(--papier);
    border: var(--bordure) solid var(--encre);
    transform: rotate(45deg);
  }
  .bulle[data-sens='haut']::before {
    top: -10px;
    border-right: none;
    border-bottom: none;
  }
  .bulle[data-sens='bas']::before {
    bottom: -10px;
    border-left: none;
    border-top: none;
  }
</style>
