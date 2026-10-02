// Parcours de la Contothèque : les onglets, les filtres, la distribution et
// la création sans aucun appel IA (chantier « la banque », CDC §7).
import { expect, test, type Page } from '@playwright/test';
import { creerMarionnette } from './aides';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

/** Ouvre l'onglet Contothèque de la colonne centrale. */
async function ouvrirContotheque(page: Page) {
  await page.getByRole('navigation', { name: 'Mode de création' })
    .getByRole('button', { name: 'Contothèque' }).click();
}

/**
 * La troupe du Chaperon rouge : les espèces se lisent dans les noms, et la
 * louve prouve que la bascule d'accords marche de bout en bout.
 */
async function troupeDuChaperon(page: Page) {
  await creerMarionnette(page, 'Poupette la Poupée');
  await creerMarionnette(page, 'Louve Grise');
  await creerMarionnette(page, 'Mamie Rose');
}

/**
 * La fiche du Chaperon dans la colonne centrale — et pas la carte du
 * spectacle créé, dans la colonne de droite, qui porte le même titre.
 */
function ficheChaperon(page: Page) {
  return page.getByRole('region', { name: 'Studio' })
    .getByRole('button', { name: /Le Petit Chaperon rouge/ });
}

test('la Contothèque est le mode d’accueil, l’Atelier à droite, le retour rebascule', async ({ page }) => {
  const onglets = page.getByRole('navigation', { name: 'Mode de création' });
  await expect(onglets.getByRole('button').first()).toHaveText('Contothèque');
  await expect(onglets.getByRole('button').last()).toHaveText('Atelier');

  // Sans fragment, on arrive sur la Contothèque (décision du 2026-09-28).
  await expect(onglets.getByRole('button', { name: 'Contothèque' }))
    .toHaveAttribute('aria-current', 'page');

  await onglets.getByRole('button', { name: 'Atelier' }).click();
  await expect(page).toHaveURL(/#\/studio$/);
  await page.goBack();
  await expect(onglets.getByRole('button', { name: 'Contothèque' }))
    .toHaveAttribute('aria-current', 'page');
});

test('les fiches s’affichent selon les filtres, et les écartés sont comptés', async ({ page }) => {
  await troupeDuChaperon(page);
  await ouvrirContotheque(page);

  // Durée par défaut (5 min) : le Chaperon (8 min réelles) est écarté, et
  // rien ne disparaît en silence.
  await expect(page.getByText(/spectacles? écartés?/)).toBeVisible();
  await expect(ficheChaperon(page)).toHaveCount(0);

  await page.getByLabel('Durée').fill('10');
  await expect(ficheChaperon(page)).toBeVisible();
  // Sans traits dans la fiche : les personnages, rien d'autre.
  await expect(ficheChaperon(page)).toContainText('poupee · loup · mamie');
});

test('la recherche combine type et origine, et son effacement conserve les réglages de jeu', async ({ page }) => {
  await troupeDuChaperon(page);
  await page.getByLabel('Durée', { exact: true }).fill('10');
  await page.getByLabel('Type de récit', { exact: true }).selectOption('conte');
  await page.getByLabel('Origine', { exact: true }).selectOption('France');
  await page.getByLabel('Titre ou auteur', { exact: true }).fill('CHAPERON');
  await expect(ficheChaperon(page)).toBeVisible();
  await ficheChaperon(page).click();
  await page.getByRole('button', { name: 'Revenir aux spectacles' }).click();
  await expect(page.getByLabel('Titre ou auteur', { exact: true })).toHaveValue('CHAPERON');
  await page.getByRole('navigation', { name: 'Mode de création' }).getByRole('button', { name: 'Atelier' }).click();
  await ouvrirContotheque(page);
  await expect(page.getByLabel('Titre ou auteur', { exact: true })).toHaveValue('CHAPERON');
  await page.getByLabel('Type de récit', { exact: true }).selectOption('fable');
  await expect(ficheChaperon(page)).toHaveCount(0);
  await expect(page.getByText('Aucun spectacle ne correspond à cette recherche.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  await expect(page.getByLabel('Titre ou auteur', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Type de récit', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Origine', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Durée', { exact: true })).toHaveValue('10');
  await expect(ficheChaperon(page)).toBeVisible();
});

test('un résultat de recherche reste soumis aux contraintes de jeu, même sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Type de récit', { exact: true }).selectOption('fable');
  await page.getByLabel('Origine', { exact: true }).selectOption('France');
  await page.getByLabel('Titre ou auteur', { exact: true }).fill('FLORIAN miroir');
  await expect(page.getByText('Aucun spectacle du fonds ne passe les réglages actuels.', { exact: false })).toBeVisible();
  await expect(page.getByText(/1 sur \d+ dans la recherche/)).toBeVisible();
  await expect(page.getByText(/spectacles? écartés?/)).toBeVisible();
  await expect(page.getByText('Aucun spectacle ne correspond à cette recherche.', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByLabel('Titre ou auteur', { exact: true })).toHaveValue('FLORIAN miroir');
  await expect(page.getByLabel('Type de récit', { exact: true })).toHaveValue('fable');
  await expect(page.getByLabel('Origine', { exact: true })).toHaveValue('France');
});

test('critère d’acceptation : une louve joue le loup, création sans clé, accords au féminin', async ({ page }) => {
  await troupeDuChaperon(page);
  await ouvrirContotheque(page);
  await page.getByLabel('Durée').fill('10');

  await ficheChaperon(page).click();

  // L'écran de distribution : proposée d'office, sans question de genre.
  await expect(page.getByRole('region', { name: 'Qui joue qui ?' })).toBeVisible();
  await expect(page.getByText('se dira')).toHaveCount(0);

  const bouton = page.getByRole('button', { name: 'Créer le spectacle' });
  await expect(bouton).toBeEnabled();
  await bouton.click();

  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir le script' }).click();

  // Le script s'ouvre, accordé pour la louve : « commère », jamais « compère ».
  await expect(page).toHaveURL(/#\/spectacle\//);
  await expect(page.getByText('commère Louve Grise').first()).toBeVisible();
  await expect(page.getByText('compère Louve Grise')).toHaveCount(0);
});

test('le réglage d’interaction dose les adresses au public du spectacle créé', async ({ page }) => {
  await troupeDuChaperon(page);
  await ouvrirContotheque(page);
  await page.getByLabel('Durée').fill('10');
  await page.getByRole('group', { name: 'Interaction avec le public' })
    .getByRole('button', { name: 'Aucune' }).click();

  await ficheChaperon(page).click();
  await page.getByRole('button', { name: 'Créer le spectacle' }).click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir le script' }).click();

  // Plus une seule adresse au public dans le script.
  await expect(page.getByText('AU PUBLIC')).toHaveCount(0);
});

test('un spectacle déjà fait n’est plus proposé', async ({ page }) => {
  await troupeDuChaperon(page);
  await ouvrirContotheque(page);
  await page.getByLabel('Durée').fill('10');

  await ficheChaperon(page).click();
  await page.getByRole('button', { name: 'Créer le spectacle' }).click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible();
  await page.getByRole('button', { name: 'Revenir aux spectacles' }).click();

  await expect(ficheChaperon(page)).toHaveCount(0);
  await expect(page.getByText(/déjà joué/)).toBeVisible();
});
