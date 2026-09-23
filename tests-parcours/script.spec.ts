// Parcours de l'écran de script (CDC §8), étape 4.
//
// Critère d'acceptation du §13 : « une réplique modifiée met à jour la durée ;
// l'impression tient sur des pages A4 lisibles ».
import { expect, type Page, test } from '@playwright/test';
import { creerMarionnette } from './aides';
import { installerFauxModele, TROIS_MARIONNETTES } from './faux-modele';

/** Génère un spectacle et ouvre son script. */
async function ouvrirUnScript(page: Page) {
  await installerFauxModele(page);

  await page.goto('/#/parametres');
  await page.getByLabel('Clé API').fill('cle-de-test');
  await page.getByLabel('Mémoriser la clé sur cet appareil').check();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Enregistré.')).toBeVisible();

  await page.goto('/');
  for (const nom of TROIS_MARIONNETTES) {
    await creerMarionnette(page, nom);
    await page.getByRole('button', { name: `Ajouter ${nom} aux personnages` }).click();
  }

  await page.getByRole('button', { name: 'Générer le script' }).click();
  await expect(page.getByText('Choisissez une histoire')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 25000 });

  await page.getByRole('button', { name: 'Ouvrir le script' }).click();
  await expect(page).toHaveURL(/#\/spectacle\//);
  await expect(page.getByRole('heading', { name: /Acte 1/ })).toBeVisible();
}

/** Durée affichée dans l'en-tête, en secondes. */
async function dureeAffichee(page: Page): Promise<number> {
  const texte = await page.locator('.meta').first().textContent() ?? '';
  const min = Number(/(\d+)\s*min/.exec(texte)?.[1] ?? 0);
  const sec = Number(/(\d+)\s*s\b/.exec(texte)?.[1] ?? 0);
  return min * 60 + sec;
}

test('le script généré s’affiche avec ses actes et sa distribution', async ({ page }) => {
  await ouvrirUnScript(page);

  // Les trois actes de la conduite simulée.
  for (const n of [1, 2, 3]) {
    await expect(page.getByRole('heading', { name: new RegExp(`Acte ${n}`) })).toBeVisible();
  }

  // La distribution, en tête du script, avec la voix décidée pour CE
  // spectacle — la fiche de la marionnette n'en porte plus.
  for (const nom of TROIS_MARIONNETTES) {
    await expect(page.locator('.distribution')).toContainText(nom);
  }
  await expect(page.locator('.distribution')).toContainText('voix fluette, parle vite');
  await expect(page.locator('.distribution')).toContainText('voix traînante, dit « sapristi »');
  // Celle dont la pièce n'appelle aucune voix particulière le dit.
  await expect(page.locator('.distribution')).toContainText('Pas de voix particulière');

  // Les labels des types d'éléments du §8.
  await expect(page.getByText('ACTION').first()).toBeVisible();
  await expect(page.getByText('AU PUBLIC').first()).toBeVisible();
  await expect(page.getByText('NOTE').first()).toBeVisible();
  await expect(page.getByText(/ENTRÉE : DOUDOU LAPIN/)).toBeVisible();
});

test('critère d’acceptation : une réplique modifiée met à jour la durée', async ({ page }) => {
  await ouvrirUnScript(page);

  const avant = await dureeAffichee(page);
  expect(avant).toBeGreaterThan(0);

  // On ouvre la première réplique et on la raccourcit fortement.
  await page.getByRole('button', { name: /Modifier cet élément \(2\)/ }).first().click();
  await page.locator('.edition textarea').fill('Trois petits mots.');
  await page.getByRole('button', { name: 'Valider' }).click();

  const apres = await dureeAffichee(page);
  expect(apres).toBeLessThan(avant);

  // La modification survit au rechargement : elle est enregistrée aussitôt.
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByText('Trois petits mots.')).toBeVisible();
  expect(await dureeAffichee(page)).toBe(apres);
});

test('les contrôles de scène se recalculent et avertissent sans bloquer', async ({ page }) => {
  await ouvrirUnScript(page);

  // On supprime la première entrée : les répliques qui suivent deviennent
  // celles d'une marionnette absente.
  await page.getByRole('button', { name: /Modifier cet élément \(1\)/ }).first().click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();

  await expect(page.getByText(/n’est pas en scène/).first()).toBeVisible();
  // L'avertissement ne bloque rien : le script reste lisible et modifiable.
  await expect(page.getByRole('heading', { name: /Acte 1/ })).toBeVisible();
});

test('annuler et rétablir, au bouton comme au clavier', async ({ page }) => {
  await ouvrirUnScript(page);

  await page.getByRole('button', { name: /Modifier cet élément \(2\)/ }).first().click();
  await page.locator('.edition textarea').fill('Version modifiée.');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Version modifiée.')).toBeVisible();

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByText('Version modifiée.')).toHaveCount(0);

  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByText('Version modifiée.')).toBeVisible();

  // Ctrl+Z puis Ctrl+Maj+Z (CDC §8).
  await page.keyboard.press('Control+z');
  await expect(page.getByText('Version modifiée.')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByText('Version modifiée.')).toBeVisible();
});

test('insérer, déplacer et supprimer un élément', async ({ page }) => {
  await ouvrirUnScript(page);

  // Tout est circonscrit au premier acte : les autres ont aussi un élément
  // en position 2, et un sélecteur global agirait sur le mauvais acte.
  const acte1 = page.locator('.acte').first();
  const elements = acte1.locator('.element');
  const avant = await elements.count();

  await acte1.getByRole('button', { name: /Modifier cet élément \(2\)/ }).click();
  await acte1.getByRole('button', { name: 'Insérer après' }).click();
  await expect(elements).toHaveCount(avant + 1);

  // L'élément inséré est en position 3 ; on le déplace puis on le supprime.
  await acte1.getByRole('button', { name: /Modifier cet élément \(3\)/ }).click();
  await acte1.getByRole('button', { name: 'Déplacer vers le bas' }).click();
  await acte1.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(elements).toHaveCount(avant);
});

test('le titre du spectacle se modifie sur place', async ({ page }) => {
  await ouvrirUnScript(page);

  await page.getByLabel('Titre du spectacle').fill('Le grand mystère');
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByLabel('Titre du spectacle')).toHaveValue('Le grand mystère');
});

test('le tableau porte la préparation, et rien d’autre', async ({ page }) => {
  await ouvrirUnScript(page);

  const tableau = page.getByRole('button', { name: /Tableau 1 : La clairière/ });
  // Les actes concernés sont annoncés dès le titre replié.
  await expect(tableau).toContainText('Acte 1');

  await tableau.click();
  await expect(page.getByText('Un buisson vert et de l’herbe haute.')).toBeVisible();
  await expect(page.getByText('une carotte en carton')).toBeVisible();

  // Le prompt d'image et la liste de préparation séparée ont été retirés :
  // on va à l'essentiel, et rien n'est dit deux fois.
  await expect(page.getByText('A cozy forest clearing')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copier' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Liste de préparation' })).toHaveCount(0);
});

test('ni morale ni « Points à vérifier » à l’écran', async ({ page }) => {
  await ouvrirUnScript(page);

  // Retirés pour alléger l'écran : la morale reste implicite (CDC §6).
  await expect(page.getByText('Points à vérifier')).toHaveCount(0);
  await expect(page.getByText('Partager vaut mieux que posséder.')).toHaveCount(0);
});

test('régénérer un acte garde l’ancienne version le temps de comparer', async ({ page }) => {
  await ouvrirUnScript(page);

  const acte1 = page.locator('.acte').first();
  await acte1.getByRole('button', { name: /Régénérer cet acte/ }).click();
  await acte1.getByLabel('Consigne (facultatif)').fill('plus drôle');
  await acte1.getByRole('button', { name: 'Lancer' }).click();

  // Les deux boutons de comparaison apparaissent (CDC §8).
  await expect(acte1.getByRole('button', { name: 'Garder la nouvelle' }))
    .toBeVisible({ timeout: 15000 });
  await expect(acte1.getByRole('button', { name: 'Revenir à l’ancienne' })).toBeVisible();

  await acte1.getByRole('button', { name: 'Garder la nouvelle' }).click();
  await expect(acte1.getByRole('button', { name: 'Garder la nouvelle' })).toHaveCount(0);
});

test('l’écran de script ne fait aucun appel réseau au chargement', async ({ page }) => {
  await ouvrirUnScript(page);

  const externes: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('data:')) {
      externes.push(r.url());
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  expect(externes).toEqual([]);
});

test('l’impression masque l’interface et garde le script', async ({ page }) => {
  await ouvrirUnScript(page);
  await page.emulateMedia({ media: 'print' });

  // Les commandes disparaissent.
  await expect(page.getByRole('button', { name: 'Jouer' })).toBeHidden();
  await expect(page.getByRole('button', { name: /Régénérer cet acte/ }).first()).toBeHidden();

  // Le script reste, et la préparation des décors s'imprime entière, même
  // repliée à l'écran.
  await expect(page.getByRole('heading', { name: /Acte 1/ })).toBeVisible();
  await expect(page.getByText(/ENTRÉE : DOUDOU LAPIN/)).toBeVisible();
  await expect(page.getByText('une carotte en carton')).toBeVisible();

  await page.emulateMedia({ media: 'screen' });
});

test('le bouton Jouer mène au mode spectacle', async ({ page }) => {
  await ouvrirUnScript(page);
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page).toHaveURL(/\/jouer$/);
});
