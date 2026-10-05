import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // fake-indexeddb fournit une IndexedDB en mémoire : les tests du stockage
    // tournent sans navigateur.
    setupFiles: ['tests/preparation.ts'],
  },
});
