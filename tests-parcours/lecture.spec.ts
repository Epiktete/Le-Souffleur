// Parcours du mode lecture (CDC §9), étape 5.
//
// Critère d'acceptation du §13 : « un spectacle se joue du début à la fin
// uniquement avec la barre Espace, sans défilement parasite ».
import { expect, type Page, test } from '@playwright/test';
import { creerMarionnette } from './aides';
import { installerFauxModele, TROIS_MARIONNETTES } from './faux-modele';

/** Génère un spectacle et ouvre le mode lecture. */
async function ouvrirLaLecture(page: Page) {
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
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.getByRole('application', { name: 'Lecture' })).toBeVisible();
}

/** Numéro de page affiché dans le bandeau, et total. */
async function position(page: Page): Promise<[number, number]> {
  const texte = await page.locator('.place').textContent() ?? '';
  const m = /(\d+)\s*\/\s*(\d+)/.exec(texte);
  return [Number(m?.[1] ?? 0), Number(m?.[2] ?? 0)];
}

test('les dialogues sont à gauche, le reste à droite', async ({ page }) => {
  await ouvrirLaLecture(page);

  const premiere = page.locator('.page .rangee').first();
  // À gauche, une réplique et son nom.
  await expect(premiere.locator('.dialogue .nom')).toContainText('Doudou Lapin');
  await expect(premiere.locator('.dialogue .dit')).toBeVisible();
  // À droite, l'entrée qui l'annonce — jamais dans la colonne des dialogues.
  await expect(premiere.locator('.scene')).toContainText('Doudou Lapin');
  await expect(premiere.locator('.scene .mouvement')).toBeVisible();
});

test('critère d’acceptation : tout le spectacle à la barre Espace', async ({ page }) => {
  await ouvrirLaLecture(page);

  expect((await position(page))[1]).toBeGreaterThan(1);

  // On traverse le spectacle entier sans jamais toucher autre chose que la
  // barre Espace. Un écran de changement de décor consomme un appui sans
  // faire avancer : on boucle donc jusqu'à la dernière page.
  //
  // Le TOTAL est relu à chaque tour, et non figé au départ : la pagination se
  // stabilise après le premier rendu, le temps que toutes les rangées soient
  // mesurées. Figé, il valait 6 alors que le spectacle en faisait 8, et la
  // boucle s'arrêtait avant la fin.
  //
  // 450 ms et non 320 : l'anti-rebond des pédales est de 300 ms, et vingt
  // millisecondes de marge ne tiennent pas sous charge.
  let garde = 0;
  let [courante, total] = await position(page);
  while (courante < total && garde++ < total * 4) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(450);
    [courante, total] = await position(page);
  }

  expect(courante).toBe(total);
});

test('aucun défilement parasite : la page ne bouge pas', async ({ page }) => {
  await ouvrirLaLecture(page);

  const avant = await page.evaluate(() => window.scrollY);
  for (const touche of ['Space', 'ArrowDown', 'PageDown', 'ArrowUp']) {
    await page.keyboard.press(touche);
    await page.waitForTimeout(320);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(avant);
});

test('toutes les touches des pédales du commerce tournent la page', async ({ page }) => {
  await ouvrirLaLecture(page);

  for (const touche of ['Space', 'ArrowRight', 'ArrowDown', 'PageDown']) {
    const [avant] = await position(page);
    await page.keyboard.press(touche);
    await page.waitForTimeout(320);
    const [apres] = await position(page);
    // Soit on a avancé, soit on était déjà à la fin.
    expect(apres).toBeGreaterThanOrEqual(avant);
  }

  // Et les touches de retour ramènent en arrière.
  const [avant] = await position(page);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(320);
  const [apres] = await position(page);
  expect(apres).toBeLessThanOrEqual(avant);
});

test('un appui trop rapproché est ignoré : rebond de pédale', async ({ page }) => {
  await ouvrirLaLecture(page);

  await page.keyboard.press('Space');
  await page.waitForTimeout(320);
  const [apresPremier] = await position(page);

  // Deux appuis dans la foulée : le second doit être absorbé.
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const [apresRafale] = await position(page);
  expect(apresRafale - apresPremier).toBeLessThanOrEqual(1);
});

test('la taille du texte se règle et se mémorise', async ({ page }) => {
  await ouvrirLaLecture(page);

  const taille = () => page.locator('.lecture').evaluate(
    (el) => getComputedStyle(el).getPropertyValue('--taille'),
  );
  const depart = await taille();

  await page.keyboard.press('+');
  await expect.poll(taille).not.toBe(depart);
  const agrandie = await taille();

  // La taille survit à un rechargement : elle est mémorisée par appareil.
  const adresse = page.url();
  await page.reload();
  await page.goto(adresse);
  const reprise = page.getByRole('button', { name: /Reprendre|Recommencer/ }).first();
  if (await reprise.isVisible()) await reprise.click();
  await expect(page.getByRole('application', { name: 'Lecture' })).toBeVisible();
  await expect.poll(taille).toBe(agrandie);
});

test('le changement de décor s’annonce et attend un appui', async ({ page }) => {
  await ouvrirLaLecture(page);

  const [, total] = await position(page);
  let vu = false;
  for (let i = 1; i < total; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(320);
    if (await page.locator('.decor').isVisible()) {
      vu = true;
      await expect(page.locator('.decor')).toContainText('Changement de décor');
      await expect(page.locator('.decor')).toContainText('Le terrier');
      await page.keyboard.press('Space');
      await page.waitForTimeout(320);
      break;
    }
  }
  // Le spectacle simulé a deux tableaux : l'écran doit apparaître.
  expect(vu).toBe(true);
});

test('le nombre de pages ne bouge pas pendant l’annonce d’un décor', async ({ page }) => {
  // Le spectacle tournait en rond sur un changement de décor. Pendant que
  // l'annonce est affichée, la zone de page n'est plus disposée et sa hauteur
  // vaut zéro ; la pagination repliait alors tout le spectacle sur une seule
  // page, la position était ramenée en arrière, l'annonce se rejouait — et on
  // n'avançait plus jamais. Le parent, lui, serait resté bloqué en pleine
  // représentation.
  await ouvrirLaLecture(page);

  const [, total] = await position(page);
  expect(total).toBeGreaterThan(1);

  for (let i = 1; i < total * 2; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(450);
    if (await page.locator('.decor').isVisible()) {
      // C'est ici que tout se jouait : le spectacle se repliait sur UNE page.
      // Le total peut encore bouger d'un cran — la pagination se stabilise
      // après le premier rendu — mais il ne doit jamais s'effondrer.
      expect((await position(page))[1]).toBeGreaterThan(1);
      await page.keyboard.press('Space');
      await page.waitForTimeout(450);
      expect((await position(page))[1]).toBeGreaterThan(1);
      // Et l'annonce se referme : on ne revient pas dessus indéfiniment.
      await expect(page.locator('.decor')).toBeHidden();
      return;
    }
  }
  throw new Error('aucun changement de décor rencontré : le test ne prouve rien');
});

test('Échap et la croix quittent le spectacle', async ({ page }) => {
  await ouvrirLaLecture(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Spectacles' })).toBeVisible();

  await page.getByRole('button', { name: /La carotte disparue/ }).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  const reprise = page.getByRole('button', { name: /Recommencer/ });
  if (await reprise.isVisible()) await reprise.click();
  await page.getByRole('button', { name: 'Quitter' }).first().click();
  await expect(page.getByRole('region', { name: 'Spectacles' })).toBeVisible();
});

test('le menu permet de basculer en mode édition', async ({ page }) => {
  await ouvrirLaLecture(page);

  await page.keyboard.press('m');
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Édition', exact: true }).click();

  await expect(page.getByRole('heading', { name: /Acte 1/ })).toBeVisible();
  await expect(page).toHaveURL(/#\/spectacle\/[^/]+$/);
});

test('la page de test des touches affiche la touche reçue', async ({ page }) => {
  await ouvrirLaLecture(page);

  await page.keyboard.press('m');
  await page.getByRole('button', { name: 'Tester ma pédale' }).click();
  const dialogue = page.getByRole('dialog', { name: 'Test de la pédale' });
  await expect(dialogue).toBeVisible();

  await page.keyboard.press('Space');
  await expect(dialogue).toContainText('Espace');
  await expect(dialogue).toContainText('Page suivante');

  // L'anti-rebond vaut aussi ici : sans attendre, l'appui serait ignoré,
  // exactement comme il le serait pendant le spectacle.
  await page.waitForTimeout(320);
  await page.keyboard.press('ArrowLeft');
  await expect(dialogue).toContainText('Page précédente');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Test de la pédale' })).toHaveCount(0);
});

test('la position est mémorisée et la reprise proposée', async ({ page }) => {
  await ouvrirLaLecture(page);

  await page.keyboard.press('Space');
  await page.waitForTimeout(320);
  const [avant] = await position(page);
  expect(avant).toBeGreaterThan(1);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /La carotte disparue/ }).click();
  await page.getByRole('button', { name: 'Jouer' }).click();

  await expect(page.getByRole('button', { name: /Reprendre à la page/ })).toBeVisible();
  await page.getByRole('button', { name: /Reprendre à la page/ }).click();
  const [reprise] = await position(page);
  expect(reprise).toBe(avant);
});

test('« Recommencer » repart de la première page', async ({ page }) => {
  await ouvrirLaLecture(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(320);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /La carotte disparue/ }).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await page.getByRole('button', { name: 'Recommencer depuis le début' }).click();
  expect((await position(page))[0]).toBe(1);
});

test('aucune note au marionnettiste n’apparaît dans la colonne des dialogues', async ({ page }) => {
  await ouvrirLaLecture(page);

  // Exigence du §9 : les notes ne doivent jamais être lues à voix haute.
  const [, total] = await position(page);
  for (let i = 0; i < total; i++) {
    const notesAGauche = await page.locator('.dialogue .note').count();
    expect(notesAGauche).toBe(0);
    await page.keyboard.press('Space');
    if (await page.locator('.decor').isVisible()) await page.keyboard.press('Space');
    await page.waitForTimeout(320);
  }
});

test('aucune réplique n’est coupée en bas de page', async ({ page }) => {
  // Trois défauts se cumulaient ici : une mesure simplifiée, l'oubli de la
  // marge entre rangées, et clientHeight qui comprend le rembourrage. La
  // dernière réplique d'une page se retrouvait rognée — en représentation, on
  // perdrait du texte.
  await ouvrirLaLecture(page);

  // La hauteur d'écran change tout : on en éprouve plusieurs.
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.waitForTimeout(600);

  const [, total] = await position(page);
  for (let i = 0; i < total; i++) {
    if (!(await page.locator('.decor').isVisible())) {
      const depassement = await page.locator('.page').evaluate((zone) => {
        const bas = zone.getBoundingClientRect().bottom;
        let pire = 0;
        for (const rangee of zone.querySelectorAll('.rangee')) {
          pire = Math.max(pire, rangee.getBoundingClientRect().bottom - bas);
        }
        return pire;
      });
      // Une tolérance de 2 px absorbe les arrondis du navigateur.
      expect(depassement).toBeLessThanOrEqual(2);
    }
    await page.keyboard.press('Space');
    await page.waitForTimeout(320);
  }
});

test('une tirade plus haute que l’écran est coupée, jamais tronquée', async ({ page }) => {
  await ouvrirLaLecture(page);

  // Le faux modèle produit une longue tirade : elle doit apparaître en
  // plusieurs morceaux, le second marqué « (suite) ».
  const [, total] = await position(page);
  let suiteVue = false;
  for (let i = 0; i < total; i++) {
    if (await page.locator('.suite').count() > 0) { suiteVue = true; break; }
    await page.keyboard.press('Space');
    await page.waitForTimeout(320);
  }
  expect(suiteVue).toBe(true);
});

test('chaque marionnette a sa couleur, et le nom reste écrit', async ({ page }) => {
  // En représentation, le marionnettiste doit voir que la réplique change de
  // bouche sans avoir le temps de lire le nom (CDC §9).
  //
  // On lit la zone de mesure, qui rend TOUTES les rangées du spectacle avec le
  // même balisage et la même feuille de style que la page affichée. Parcourir
  // le spectacle au clavier pour la même vérification rendait ce test lent et
  // sensible à la charge de la machine.
  await ouvrirLaLecture(page);

  const releves = await page.evaluate(() =>
    [...document.querySelectorAll('.mesure .bulle')].map((el) => ({
      classe: [...el.classList].find((c) => /^c\d$/.test(c)) ?? '',
      couleur: getComputedStyle(el).borderLeftColor,
      nom: (el.querySelector('.nom')?.textContent ?? '').trim(),
    })));

  expect(releves.length).toBeGreaterThan(3);

  const couleurs = new Map<string, string>();
  for (const r of releves) {
    // Le nom est toujours écrit : la couleur ne fait que le doubler, elle ne
    // porte jamais seule l'information (CDC §12).
    expect(r.nom.length).toBeGreaterThan(0);
    expect(r.classe).not.toBe('');
    // Une même marionnette garde sa couleur d'un bout à l'autre.
    if (couleurs.has(r.classe)) expect(couleurs.get(r.classe)).toBe(r.couleur);
    else couleurs.set(r.classe, r.couleur);
  }

  // Les trois marionnettes du spectacle de test portent trois couleurs distinctes.
  expect(couleurs.size).toBe(3);
  expect(new Set(couleurs.values()).size).toBe(3);

  // Et la page réellement affichée porte bien ces classes, pas seulement la
  // zone de mesure.
  await expect(page.locator('.page .bulle').first()).toHaveClass(/c\d/);
});

test('ce qui suit une réplique se lit sous elle, pas à côté de son nom', async ({ page }) => {
  // La colonne de droite mêlait ce qui précède la réplique et ce qui la suit,
  // tout empilé en haut : elle semblait désynchronisée du texte.
  await ouvrirLaLecture(page);

  // Même raison que ci-dessus : la zone de mesure porte toutes les rangées,
  // avec la même grille. On y cherche celle qui a les deux blocs.
  const mesures = await page.evaluate(() => {
    for (const rangee of document.querySelectorAll('.mesure .rangee')) {
      const avant = rangee.querySelector('.scene .avant .mouvement');
      const apres = rangee.querySelector('.scene .apres .didascalie');
      const nom = rangee.querySelector('.dialogue .nom');
      const dit = rangee.querySelector('.dialogue .dit');
      if (avant && apres && nom && dit) {
        return {
          avant: avant.getBoundingClientRect().toJSON(),
          apres: apres.getBoundingClientRect().toJSON(),
          nom: nom.getBoundingClientRect().toJSON(),
          dit: dit.getBoundingClientRect().toJSON(),
        };
      }
    }
    return null;
  });

  expect(mesures, 'aucune rangée ne porte les deux blocs').not.toBeNull();
  // Ce qui prépare la réplique reste à hauteur du nom, en haut.
  expect(mesures!.avant.top).toBeLessThan(mesures!.dit.top + 8);
  // Ce qui la suit descend sous le nom, au pied de la tirade.
  expect(mesures!.apres.top).toBeGreaterThan(mesures!.avant.bottom);
  expect(mesures!.apres.top).toBeGreaterThan(mesures!.nom.bottom);
});
