// Parcours de la bibliothèque, dans un vrai navigateur, sur le build réel.
//
// Il vérifie le critère d'acceptation de l'étape 2 du CDC §13 :
// « Une marionnette créée est toujours là après rechargement de la page. »
import { expect, test } from '@playwright/test';
import { carte } from './aides';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('aucun appel réseau vers l’extérieur au chargement', async ({ page }) => {
  // Critère d'acceptation de l'étape 1, revérifié à chaque étape.
  const externes: string[] = [];
  page.on('request', (requete) => {
    const url = requete.url();
    if (!url.startsWith('http://localhost:4173') && !url.startsWith('data:')) {
      externes.push(url);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  expect(externes).toEqual([]);
});

test('les trois colonnes sont présentes', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Le Souffleur' })).toBeVisible();
  for (const libelle of ['Marionnethèque', 'Studio', 'Spectacles']) {
    await expect(page.getByRole('region', { name: libelle })).toBeVisible();
  }
});

test('crée une marionnette, qui survit au rechargement de la page', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();

  await page.getByLabel('Nom').fill('Doudou Lapin');
  await page.getByLabel('Description').fill('Petit lapin beige aux oreilles tombantes.');
  await page.getByRole('button', { name: 'gentil', exact: true }).click();
  await page.getByRole('button', { name: 'peureux', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  // La boîte apparaît dans la colonne de gauche.
  await expect(carte(page, 'Doudou Lapin')).toBeVisible();

  // Le cœur du critère d'acceptation : on recharge et elle est toujours là.
  await page.reload();
  await expect(carte(page, 'Doudou Lapin')).toBeVisible();
  await expect(page.getByText('gentil')).toBeVisible();
});

test('refuse d’enregistrer sans nom, avec un message en français', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByRole('button', { name: 'gentil', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('alert')).toContainText('Donnez un nom à la marionnette.');
  // Le panneau reste ouvert : rien n'a été perdu.
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
});

test('exige au moins un trait de caractère', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByLabel('Nom').fill('Sans Trait');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('alert')).toContainText('Choisissez au moins un trait');
});

test('ne laisse pas choisir plus de six traits', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByLabel('Nom').fill('Six Traits');

  const six = ['gentil', 'méchant', 'coquin', 'rusé', 'peureux', 'courageux'];
  for (const trait of six) {
    await page.getByRole('button', { name: trait, exact: true }).click();
  }
  // Le septième est désactivé : la limite est appliquée avant la validation.
  await expect(page.getByRole('button', { name: 'gourmand', exact: true })).toBeDisabled();
});

test('modifie une marionnette existante', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByLabel('Nom').fill('Renard');
  await page.getByRole('button', { name: 'rusé', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  // La fiche se déplie après l'enregistrement : les actions sont accessibles.
  await page.getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel('Nom').fill('Renard Roux');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(carte(page, 'Renard Roux')).toBeVisible();
  await page.reload();
  await expect(carte(page, 'Renard Roux')).toBeVisible();
});

test('duplique une marionnette en la nommant « (copie) »', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByLabel('Nom').fill('Hibou');
  await page.getByRole('button', { name: 'savant', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await page.getByRole('button', { name: 'Dupliquer' }).click();
  await expect(carte(page, 'Hibou (copie)')).toBeVisible();
  // L'originale est toujours là.
  await expect(carte(page, 'Hibou').first()).toBeVisible();
});

test('supprime une marionnette, après confirmation', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByLabel('Nom').fill('Ourse');
  await page.getByRole('button', { name: 'gourmand', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();

  // Une confirmation est obligatoire (CDC §7).
  const dialogue = page.getByRole('dialog');
  await expect(dialogue).toContainText('Supprimer « Ourse »');

  // On renonce d'abord : la marionnette doit rester.
  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect(carte(page, 'Ourse')).toBeVisible();

  // Puis on confirme.
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();

  await expect(carte(page, 'Ourse')).toHaveCount(0);
  await page.reload();
  await expect(carte(page, 'Ourse')).toHaveCount(0);
});

test('Échap ferme le formulaire sans enregistrer', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByLabel('Nom').fill('Jamais Enregistrée');
  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);
  await expect(carte(page, 'Jamais Enregistrée')).toHaveCount(0);
});

test('le champ de recherche n’apparaît qu’à partir de huit marionnettes', async ({ page }) => {
  const recherche = page.getByRole('searchbox', { name: 'Rechercher une marionnette' });
  await expect(recherche).toHaveCount(0);

  // On en crée huit.
  for (let n = 1; n <= 8; n++) {
    await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
    await page.getByLabel('Nom').fill(`Peluche ${n}`);
    await page.getByRole('button', { name: 'gentil', exact: true }).click();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
  }

  await expect(recherche).toBeVisible();

  // La recherche filtre, et ignore les accents.
  await recherche.fill('Peluche 3');
  await expect(carte(page, 'Peluche 3')).toBeVisible();
  await expect(carte(page, 'Peluche 5')).toHaveCount(0);

  await recherche.fill('dragon');
  await expect(page.getByText('Aucune marionnette ne correspond')).toBeVisible();
});

test('toute la création est faisable au clavier seul', async ({ page }) => {
  // Accessibilité (CDC §12) : le parcours principal sans souris.
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();

  // Le focus part sur le nom.
  await expect(page.getByLabel('Nom')).toBeFocused();
  await page.keyboard.type('Clavier');

  await page.getByRole('button', { name: 'rêveur', exact: true }).focus();
  await page.keyboard.press('Enter');

  await page.getByRole('button', { name: 'Enregistrer' }).focus();
  await page.keyboard.press('Enter');

  await expect(carte(page, 'Clavier')).toBeVisible();
});

test('le bandeau illustré coiffe le menu principal, et lui seul', async ({ page }) => {
  const bandeau = page.locator('.bandeau');
  await expect(bandeau).toBeVisible();
  // L'image est empaquetée avec l'application : aucun appel extérieur.
  await expect(bandeau).toHaveAttribute('src', /Lesouffleur-.*\.webp$/);
  // Décorative : elle ne doit rien dire aux lecteurs d'écran.
  await expect(bandeau).toHaveAttribute('alt', '');

  // Partout ailleurs, la place va au contenu : ni sur les paramètres, ni
  // dans les deux modes plein écran, où l'on joue.
  await page.goto('/#/parametres');
  await expect(page.locator('.bandeau')).toHaveCount(0);

  await page.goto('/#/spectacle/inexistant');
  await expect(page.locator('.bandeau')).toHaveCount(0);
});

test('l’onglet du navigateur porte l’icône du souffleur', async ({ page }) => {
  const icones = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')]
      .map((l) => ({ rel: l.getAttribute('rel'), type: l.getAttribute('type'), href: (l as HTMLLinkElement).href })));

  // Deux formats : Safari ne lit pas les favicons WebP de façon fiable.
  expect(icones.some((i) => i.type === 'image/webp')).toBe(true);
  expect(icones.some((i) => i.type === 'image/png')).toBe(true);
  expect(icones.some((i) => i.rel === 'apple-touch-icon')).toBe(true);

  // Empaquetées avec l'application : aucun appel extérieur (CDC §12).
  for (const i of icones) {
    expect(i.href).toMatch(/^http:\/\/localhost:4173\/assets\/favicon-.*\.(webp|png)$/);
  }

  // Et elles se chargent vraiment.
  for (const i of icones) {
    const reponse = await page.request.get(i.href);
    expect(reponse.status()).toBe(200);
  }
});

test('le nom de l’outil est un dessin, mais reste un titre lisible', async ({ page }) => {
  const titre = page.locator('.titre');
  await expect(titre).toBeVisible();

  // L'alt porte le nom : pour un lecteur d'écran, c'est toujours le titre de
  // la page, pas une image décorative.
  await expect(titre).toHaveAttribute('alt', 'Le Souffleur');
  await expect(page.getByRole('heading', { name: 'Le Souffleur' })).toBeVisible();

  // Empaqueté avec l'application : aucun appel extérieur (CDC §12).
  await expect(titre).toHaveAttribute('src', /Titre-.*\.webp$/);

  // Le carré de 1024 px est recadré sur le mot, sinon celui-ci serait minuscule.
  const forme = await titre.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { rapport: r.width / r.height, hauteur: r.height };
  });
  expect(forme.rapport).toBeGreaterThan(3);
  expect(forme.hauteur).toBeGreaterThan(24);
});
