// Configuration du BANC D'ESSAI — outillage de développement, jamais livré.
//
// Le banc génère de vrais spectacles avec une vraie clé OpenRouter, pour que
// la qualité d'écriture puisse être jugée et corrigée en boucle. Il ne fait
// pas partie du Souffleur : rien ici n'est embarqué dans l'application.
//
// Pourquoi Vitest plutôt qu'un simple script Node : `src/services/repertoire.ts`
// charge les fiches avec la syntaxe de Vite (`?raw`, `import.meta.glob`), que
// `node` seul ne sait pas lire. Vitest les résout gratuitement, et il est déjà
// installé — aucune dépendance nouvelle.
//
// Lancement : npm run banc

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['banc/**/*.banc.ts'],
    // Une génération complète enchaîne une dizaine d'appels au modèle, et
    // chacun peut prendre une minute. On laisse très large.
    testTimeout: 30 * 60 * 1000,
    hookTimeout: 60 * 1000,
    // Les spectacles se génèrent l'un après l'autre : deux générations en
    // parallèle brouilleraient le journal et cogneraient la limite de débit.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
