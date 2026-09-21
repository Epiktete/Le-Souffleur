import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de parcours (CDC §3 et §13).
 * Playwright démarre lui-même l'application en mode prévisualisation, sur le
 * build réel : c'est ce qui sera publié.
 */
export default defineConfig({
  testDir: './tests-parcours',
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
