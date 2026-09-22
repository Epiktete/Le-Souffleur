// Parcours de la visite guidée de la première fois : des bulles pointées vers
// les zones de l'écran, dans l'ordre d'utilisation, effacées d'un clic.
import { expect, test, type Page } from '@playwright/test';
import { creerMarionnette } from './aides';
import { installerFauxModele, TROIS_MARIONNETTES } from './faux-modele';

// Un navigateur vierge : la visite n'a encore jamais été vue.
test.use({ storageState: { cookies: [], origins: [] } });

const bulle = (page: Page) => page.getByRole('dialog', { name: 'Visite guidée' });

/** Vrai si la bulle est collée sous la zone, ou juste au-dessus. */
async function pointeVers(page: Page, zone: string) {
  const b = await bulle(page).boundingBox();
  const z = await page.locator(`[data-visite="${zone}"]`).first().boundingBox();
  if (!b || !z) return false;
  const dessous = Math.abs(b.y - (z.y + z.height)) < 20;
  const dessus = Math.abs(b.y + b.height - z.y) < 20;
  const recouvre = b.x < z.x + z.width && b.x + b.width > z.x;
  return (dessous || dessus) && recouvre;
}

test('à la première visite, les bulles montrent l’accueil dans l’ordre, un clic chacune', async ({ page }) => {
  await page.goto('/');
  const attendues: [string, string][] = [
    ['cle', 'clé IA'],
    ['marionnette', 'Créez une marionnette'],
    ['personnages', 'Placez ici'],
    ['reglages', 'Réglez la durée'],
    ['generer', 'Générez'],
  ];
  for (const [zone, texte] of attendues) {
    await expect(bulle(page)).toContainText(texte);
    expect(await pointeVers(page, zone)).toBe(true);
    // Un clic n'importe où : ici, en plein milieu de l'écran.
    await page.mouse.click(640, 360);
  }
  await expect(bulle(page)).toHaveCount(0);

  // Vue une fois, elle ne revient plus.
  await page.reload();
  await expect(page.getByRole('button', { name: '+ Nouvelle marionnette' })).toBeVisible();
  await expect(bulle(page)).toHaveCount(0);
});

test('le clic qui efface une bulle ne déclenche rien dessous', async ({ page }) => {
  await page.goto('/');
  await expect(bulle(page)).toContainText('clé IA');
  const bouton = await page.locator('[data-visite="marionnette"]').boundingBox();
  await page.mouse.click(bouton!.x + 10, bouton!.y + 10);
  // Le formulaire de création ne s'est pas ouvert : la bulle suivante, si.
  await expect(bulle(page)).toContainText('Créez une marionnette');
  await expect(page.getByLabel('Nom')).toHaveCount(0);
});

test('Échap termine la visite, le bouton « Aide » garde le tuto complet', async ({ page }) => {
  await page.goto('/');
  await expect(bulle(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bulle(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Créez vos marionnettes' })).toBeVisible();
});

test('le premier script puis la première lecture ont chacun leurs bulles', async ({ page }) => {
  await installerFauxModele(page);
  await page.goto('/#/parametres');
  await page.getByLabel('Clé API').fill('cle-de-test');
  await page.getByLabel('Mémoriser la clé sur cet appareil').check();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Enregistré.')).toBeVisible();

  await page.goto('/');
  await expect(bulle(page)).toBeVisible();
  await page.keyboard.press('Escape');
  for (const nom of TROIS_MARIONNETTES) {
    await creerMarionnette(page, nom);
    await page.getByRole('button', { name: `Ajouter ${nom} aux personnages` }).click();
  }
  await page.getByRole('button', { name: 'Générer le script' }).click();
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click({ timeout: 15000 });
  await page.getByRole('button', { name: 'Ouvrir le script' }).click({ timeout: 25000 });

  // Le script : corriger une ligne, puis jouer.
  await expect(bulle(page)).toContainText('corriger');
  expect(await pointeVers(page, 'element')).toBe(true);
  await page.mouse.click(20, 20);
  await expect(bulle(page)).toContainText('Jouez');
  expect(await pointeVers(page, 'jouer')).toBe(true);
  await page.mouse.click(20, 20);
  await expect(bulle(page)).toHaveCount(0);

  // La lecture : une touche efface la bulle sans tourner la page.
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.getByRole('application', { name: 'Lecture' })).toBeVisible();
  await expect(bulle(page)).toContainText('Barre Espace');
  const place = page.locator('.bandeau .place');
  const avant = await place.textContent();
  await page.keyboard.press(' ');
  await expect(bulle(page)).toContainText('Échap');
  await page.keyboard.press(' ');
  await expect(bulle(page)).toContainText('improvisation');
  await page.keyboard.press(' ');
  await expect(bulle(page)).toHaveCount(0);
  await expect(place).toHaveText(avant!);

  // Ensuite, la barre Espace tourne bien les pages.
  await page.keyboard.press(' ');
  await expect(place).not.toHaveText(avant!);
});
