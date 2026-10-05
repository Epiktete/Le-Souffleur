import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';

/** Les mentions accompagnent aussi le site distribué, pas seulement le dépôt. */
function mentionsDeDistribution(): Plugin {
  return {
    name: 'mentions-de-distribution',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const [source, fileName] of [
        ['LICENSE', 'licences/Le-Souffleur.txt'],
        ['NOTICE', 'licences/NOTICE.txt'],
        ['THIRD_PARTY_NOTICES.md', 'licences/Tiers.txt'],
      ]) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(source, import.meta.url), 'utf8') });
      }
      const paquets = new Set<string>();
      for (const sortie of Object.values(bundle)) {
        if (sortie.type !== 'chunk') continue;
        for (const module of Object.keys(sortie.modules)) {
          const nom = module.replaceAll('\\', '/').match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1];
          if (nom) paquets.add(nom);
        }
      }
      const mentions = [...paquets].sort().map((nom) => {
        const dossier = new URL(`node_modules/${nom}/`, import.meta.url);
        const licences = readdirSync(dossier).filter((fichier) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(fichier));
        if (!licences.length) throw new Error(`Licence de la bibliothèque ${nom} introuvable.`);
        return `=== ${nom} ===\n\n` + licences.map((fichier) => readFileSync(new URL(fichier, dossier), 'utf8')).join('\n\n');
      });
      this.emitFile({ type: 'asset', fileName: 'licences/Dependances.txt', source: mentions.join('\n\n') });
    },
  };
}

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
  plugins: [svelte(), cspDeProduction(), mentionsDeDistribution()],
  // Chemins relatifs : le build fonctionne aussi bien à la racine d'un domaine
  // que dans un sous-dossier GitHub Pages, sans reconfiguration (CDC §14).
  base: './',
  build: {
    // Cible large : deux dernières versions de Chrome, Edge, Firefox et Safari.
    target: 'es2022',
  },
});
