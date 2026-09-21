import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

/** Autorisations dont Vite a besoin en développement, et seulement là :
 *  un WebSocket vers localhost pour recharger la page à chaud. */
const AUTORISATIONS_DEV = ' http://localhost:* ws://localhost:*';

/**
 * index.html porte le CSP du développement. Ce plugin retire les autorisations
 * locales au moment du build, pour que le fichier publié n'autorise que https,
 * comme l'exige le CDC §12.
 *
 * Pour vérifier : `npm run build` puis chercher « connect-src » dans
 * dist/index.html — il ne doit plus y avoir de mention de localhost.
 */
function cspDeProduction(): Plugin {
  return {
    name: 'csp-de-production',
    apply: 'build',
    transformIndexHtml(html) {
      if (!html.includes(AUTORISATIONS_DEV)) {
        throw new Error(
          'CSP : les autorisations de développement sont introuvables dans '
          + 'index.html. Vérifiez la balise Content-Security-Policy.',
        );
      }
      return html.replace(AUTORISATIONS_DEV, '');
    },
  };
}

export default defineConfig({
  plugins: [svelte(), cspDeProduction()],
  // Chemins relatifs : le build fonctionne aussi bien à la racine d'un domaine
  // que dans un sous-dossier GitHub Pages, sans reconfiguration (CDC §14).
  base: './',
  build: {
    // Cible large : deux dernières versions de Chrome, Edge, Firefox et Safari.
    target: 'es2022',
  },
});
