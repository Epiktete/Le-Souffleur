// Routage par le fragment d'URL (CDC §7).
//
// Le fragment (ce qui suit le #) est utilisé plutôt que le chemin pour deux
// raisons : le bouton retour du navigateur fonctionne, et l'application reste
// hébergeable sur GitHub Pages ou ouvrable en fichier unique, sans réécriture
// d'URL côté serveur.

/** Les écrans de l'application. */
export type Route =
  | { nom: 'accueil' }
  | { nom: 'parametres' }
  | { nom: 'script'; spectacleId: string }
  | { nom: 'jouer'; spectacleId: string }
  | { nom: 'introuvable'; fragment: string };

/** Traduit un fragment d'URL en route. Fonction pure, donc testable. */
export function analyserFragment(fragment: string): Route {
  // On accepte « #/studio », « /studio » ou « studio ».
  const chemin = fragment.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (chemin === '' || chemin === 'studio') return { nom: 'accueil' };
  if (chemin === 'parametres') return { nom: 'parametres' };

  const morceaux = chemin.split('/');
  if (morceaux[0] === 'spectacle' && morceaux[1]) {
    if (morceaux.length === 2) return { nom: 'script', spectacleId: morceaux[1] };
    if (morceaux.length === 3 && morceaux[2] === 'jouer') {
      return { nom: 'jouer', spectacleId: morceaux[1] };
    }
  }
  return { nom: 'introuvable', fragment: chemin };
}

/** Construit le fragment correspondant à une route. */
export function fragmentDe(route: Route): string {
  switch (route.nom) {
    case 'accueil': return '#/studio';
    case 'parametres': return '#/parametres';
    case 'script': return `#/spectacle/${route.spectacleId}`;
    case 'jouer': return `#/spectacle/${route.spectacleId}/jouer`;
    case 'introuvable': return `#/${route.fragment}`;
  }
}

/** Navigue vers une route en ajoutant une entrée à l'historique. */
export function naviguer(route: Route): void {
  location.hash = fragmentDe(route);
}
