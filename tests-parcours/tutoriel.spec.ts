// Parcours du mini tuto : la fenêtre en trois étapes, ouverte par le bouton
// « Aide » de l'en-tête.
import { expect, test } from '@playwright/test';

const fenetre = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: /Créez vos marionnettes|Préparez le studio|Relisez, puis jouez/ });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('le bouton « Aide » ouvre le tuto sur sa première étape', async ({ page }) => {
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  await expect(fenetre(page)).toBeVisible();
  await expect(fenetre(page)).toContainText('Étape 1 sur 3');
  await expect(fenetre(page).getByRole('heading', { name: 'Créez vos marionnettes' })).toBeFocused();
});

test('aucune carte de tuto n’encombre le studio', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Premier spectacle ?' })).toHaveCount(0);
  await expect(page.getByText('Voir le tuto')).toHaveCount(0);
});

test('on parcourt les trois étapes, clé IA et touches comprises, puis on ferme', async ({ page }) => {
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  const f = fenetre(page);

  // Étape 1 : créer ses marionnettes.
  await expect(f).toContainText('+ Nouvelle marionnette');
  // Pas de retour possible à la première étape : le bouton est masqué.
  await expect(f.getByRole('button', { name: 'Précédent' })).toBeHidden();

  // Étape 2 : le studio, et l'encadré de la clé IA.
  await f.getByRole('button', { name: 'Suivant' }).click();
  await expect(f).toContainText('Étape 2 sur 3');
  await expect(f.getByRole('heading', { name: 'Une seule fois : votre clé IA' })).toBeVisible();
  await expect(f).toContainText('Mémoriser la clé sur cet appareil');
  await expect(f).toContainText('Générer le script');

  // Étape 3 : relire et jouer, avec les touches dessinées.
  await f.getByRole('button', { name: 'Suivant' }).click();
  await expect(f).toContainText('Étape 3 sur 3');
  await expect(f.locator('kbd')).toHaveText(['Espace', '←', 'M', 'Échap']);
  await expect(f).toContainText('Tester ma pédale');

  // Retour, puis fin du tuto.
  await f.getByRole('button', { name: 'Précédent' }).click();
  await expect(f).toContainText('Étape 2 sur 3');
  await f.getByRole('button', { name: 'Suivant' }).click();
  await f.getByRole('button', { name: 'C’est parti !' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('le bouton « Aide » ouvre le tuto, Échap le ferme, les numéros sautent d’une étape à l’autre', async ({ page }) => {
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  const f = fenetre(page);
  await expect(f).toContainText('Étape 1 sur 3');

  await f.getByRole('button', { name: /3\s*Relisez, puis jouez/ }).click();
  await expect(f).toContainText('Étape 3 sur 3');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('le tuto mène aux paramètres IA pour coller sa clé', async ({ page }) => {
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  await fenetre(page).getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Ouvrir les Paramètres IA' }).click();
  await expect(page).toHaveURL(/#\/parametres$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Clé API')).toBeVisible();
});

test('les boutons que le tuto nomme existent vraiment à l’écran', async ({ page }) => {
  // Étape 1 : on peut suivre le tuto à la lettre.
  await expect(page.getByRole('button', { name: '+ Nouvelle marionnette' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Personnages' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Paramètres IA/ })).toBeVisible();
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await expect(page.getByLabel('Nom')).toBeVisible();
  await expect(page.getByLabel('Description')).toBeVisible();
});
