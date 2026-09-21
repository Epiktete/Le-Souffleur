<script lang="ts">
  // Racine de l'application. Elle ne fait que deux choses : afficher l'en-tête
  // et choisir l'écran correspondant à la route (CDC §7).
  import Entete from './composants/Entete.svelte';
  import Accueil from './composants/Accueil.svelte';
  import EcranIntrouvable from './composants/EcranIntrouvable.svelte';
  import ParametresIa from './composants/ParametresIa.svelte';
  import EcranSpectacle from './composants/EcranSpectacle.svelte';
  import { reglagesIa } from './etat/reglagesIa.svelte';
  import { studio } from './etat/studio.svelte';
  import { t } from './textes';
  import { analyserFragment, type Route } from './services/routeur';
  import { demanderStockagePersistant } from './services/db';

  let route = $state<Route>(analyserFragment(location.hash));
  let tiroir = $state<'bibliotheque' | 'spectacles' | null>(null);

  $effect(() => {
    const surChangement = () => {
      route = analyserFragment(location.hash);
      tiroir = null; // changer d'écran referme le tiroir
    };
    window.addEventListener('hashchange', surChangement);
    return () => window.removeEventListener('hashchange', surChangement);
  });

  // Demande au navigateur de ne pas effacer les données automatiquement (CDC §12).
  // Aucun de ces effets ne provoque d'appel réseau.
  $effect(() => { void demanderStockagePersistant(); });

  // Réglages relus une fois au démarrage : le studio et le fournisseur d'IA
  // doivent être retrouvés d'une visite à l'autre (CDC §7).
  $effect(() => {
    void reglagesIa.charger();
    void studio.charger();
  });

  function surTiroir(lequel: 'bibliotheque' | 'spectacles') {
    tiroir = tiroir === lequel ? null : lequel;
  }

  // Le mode spectacle occupe tout l'écran : pas d'en-tête (CDC §9).
  const pleinEcran = $derived(route.nom === 'jouer' || route.nom === 'script');
</script>

<div class="application" class:plein-ecran={pleinEcran}>
  {#if !pleinEcran}
    <Entete {surTiroir} avecBandeau={route.nom === 'accueil'} />
  {/if}

  {#if route.nom === 'accueil'}
    <Accueil {tiroir} surFermerTiroir={() => (tiroir = null)} />
  {:else if route.nom === 'parametres'}
    <ParametresIa />
  {:else if route.nom === 'script' || route.nom === 'jouer'}
    <EcranSpectacle spectacleId={route.spectacleId} mode={route.nom} />
  {:else}
    <EcranIntrouvable titre={t.navigation.introuvable} message={t.navigation.introuvable} detail={route.fragment} />
  {/if}
</div>

<style>
  /* L'en-tête est fixe en hauteur, le reste occupe ce qui reste, sans que la
     page entière ne défile : chaque colonne gère son propre défilement. */
  .application {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100vh;
    /* iOS : évite que la barre du navigateur ne rogne le bas de l'écran. */
    height: 100dvh;
  }
  .application.plein-ecran { grid-template-rows: minmax(0, 1fr); }
</style>
