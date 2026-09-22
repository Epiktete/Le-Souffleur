// Parcours de génération complet, avec un fournisseur d'IA simulé.
//
// Il vérifie le critère d'acceptation de l'étape 3 du CDC §13 :
// « un spectacle de 5 min pour 3 marionnettes et 1 marionnettiste est généré
//   sans erreur de mains, durée estimée entre 4 et 6 min ».
import { expect, type Page, test } from '@playwright/test';
import { creerMarionnette, scene } from './aides';
import { installerFauxModele, TROIS_MARIONNETTES } from './faux-modele';

/** Prépare le studio : clé, trois marionnettes, 5 min, 1 marionnettiste. */
async function preparerStudio(page: Page) {
  await page.goto('/#/parametres');
  await page.getByLabel('Clé API').fill('cle-de-test');
  // On mémorise la clé : ces tests rechargent la page, et une clé non
  // mémorisée ne survit pas à un rechargement — c'est justement la garantie
  // du CDC §5, vérifiée par ailleurs dans studio.spec.ts.
  await page.getByLabel('Mémoriser la clé sur cet appareil').check();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Enregistré.')).toBeVisible();

  await page.goto('/');
  for (const nom of TROIS_MARIONNETTES) {
    await creerMarionnette(page, nom);
    await page.getByRole('button', { name: `Ajouter ${nom} aux personnages` }).click();
  }
  await expect(scene(page)).toContainText('3 / 6');

  await page.getByLabel('Durée').fill('5');
  await expect(page.getByText('5 min')).toBeVisible();
}

/** Lance la génération et attend l'écran de choix. */
async function lancerEtAttendreLeChoix(page: Page) {
  await page.getByRole('button', { name: 'Générer le script' }).click();
  await expect(page.getByText('Choisissez une histoire')).toBeVisible({ timeout: 15000 });
}

test.beforeEach(async ({ page }) => {
  await installerFauxModele(page);
});

test('critère d’acceptation : 5 min, 3 marionnettes, 1 marionnettiste', async ({ page }) => {
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);

  // Trois histoires sont proposées.
  await expect(page.getByRole('button', { name: 'Choisir cette histoire' })).toHaveCount(3);

  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();

  // Le spectacle est écrit puis enregistré.
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 20000 });

  // L'écran de fin va à l'essentiel : plus de liste de points à vérifier.
  await expect(page.getByText('Points à vérifier')).toHaveCount(0);

  await expect(page.getByRole('region', { name: 'Spectacles' }))
    .toContainText('La carotte disparue');

  // On relit le spectacle réellement enregistré, plutôt que son affichage :
  // c'est lui qui porte le critère d'acceptation.
  const s = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const r = indexedDB.open('le-souffleur');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const tout = await new Promise<Record<string, unknown>[]>((ok, ko) => {
      const r = db.transaction('spectacles').objectStore('spectacles').getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    return tout[0];
  });

  // Durée estimée entre 4 et 6 minutes.
  const secondes = s.dureeEstimeeSecondes as number;
  expect(secondes).toBeGreaterThanOrEqual(4 * 60);
  expect(secondes).toBeLessThanOrEqual(6 * 60);

  // Trois marionnettes dans la distribution figée, un marionnettiste.
  expect((s.distribution as unknown[]).length).toBe(3);
  expect((s.parametres as { nbMarionnettistes: number }).nbMarionnettistes).toBe(1);

  // Trois actes, deux tableaux, et la bible complète pour l'écran de script.
  expect((s.actes as unknown[]).length).toBe(3);
  expect((s.tableaux as unknown[]).length).toBe(2);
  expect(Object.keys(s.bible as object)).toEqual(
    expect.arrayContaining(['conteId', 'synopsis', 'synopsisProposes', 'adaptation']),
  );
  expect(s.statut).toBe('complet');
});

test('le script enregistré est jouable : jamais plus de deux mains occupées', async ({ page }) => {
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 20000 });

  // On rejoue la scène élément par élément sur les données enregistrées.
  const verdict = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const r = indexedDB.open('le-souffleur');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const tout = await new Promise<any[]>((ok, ko) => {
      const r = db.transaction('spectacles').objectStore('spectacles').getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });

    const mains: Record<string, string | undefined> = {};
    const erreurs: string[] = [];
    let maxSimultanees = 0;

    for (const acte of tout[0].actes) {
      for (const e of acte.elements) {
        if (e.type === 'entree') {
          if (mains[e.mainMarionnettiste]) erreurs.push('main déjà occupée');
          mains[e.mainMarionnettiste] = e.marionnetteId;
        } else if (e.type === 'sortie') {
          const main = Object.keys(mains).find((m) => mains[m] === e.marionnetteId);
          if (!main) erreurs.push('sortie d’une absente');
          else delete mains[main];
        } else if (e.type === 'replique' || e.type === 'adresse_public') {
          if (!Object.values(mains).includes(e.marionnetteId)) erreurs.push('parle sans être en scène');
        }
        const presentes = Object.values(mains).filter(Boolean).length;
        if (presentes > maxSimultanees) maxSimultanees = presentes;
        if (Object.keys(mains).some((m) => m.startsWith('M2'))) erreurs.push('main du marionnettiste 2');
      }
    }
    return { erreurs, maxSimultanees };
  });

  expect(verdict.erreurs).toEqual([]);
  // Un marionnettiste, donc deux mains : jamais plus de deux en scène.
  expect(verdict.maxSimultanees).toBeLessThanOrEqual(2);
});

test('la progression affiche les étapes du pipeline', async ({ page }) => {
  // Le modèle simulé prend son temps, sans quoi la progression disparaîtrait
  // avant d'avoir pu être observée.
  await installerFauxModele(page, { delaiMs: 400 });
  await preparerStudio(page);
  await page.getByRole('button', { name: 'Générer le script' }).click();

  // Première phase : le choix des contes, puis un seul appel (CDC §6).
  const progression = page.getByRole('status', { name: 'Génération en cours' });
  await expect(progression).toContainText('Consulte la contothèque');
  await expect(progression.getByRole('button', { name: 'Annuler' })).toBeVisible();

  await expect(page.getByText('Choisissez une histoire')).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  // Seconde phase : les étapes d'écriture.
  await expect(page.getByRole('status', { name: 'Génération en cours' })).toContainText('Adaptation du conte');
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 20000 });
});

test('chaque carte cite le conte d’origine, raconte, distribue et dit ce qui change', async ({ page }) => {
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);

  const premiere = page.locator('article').filter({ hasText: 'Histoire 1' });

  // D'où vient l'histoire : le titre du conte, son origine et sa source, lus
  // dans la fiche du répertoire et non recopiés par le modèle.
  await expect(premiere.locator('.reference')).toContainText('D’après');
  await expect(premiere.locator('.reference')).toContainText('—');

  await expect(premiere.locator('.accroche')).toContainText('en une ligne');
  await expect(premiere.locator('.resume li')).toHaveCount(3);

  // Qui joue qui : chaque marionnette du parent a son rôle.
  for (const nom of TROIS_MARIONNETTES) await expect(premiere.locator('.distribution')).toContainText(nom);
  await expect(premiere.locator('.changements li')).toHaveCount(1);
});

test('« Proposer 3 autres histoires » renouvelle les propositions', async ({ page }) => {
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);
  await expect(page.getByText('Histoire 1', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Proposer 3 autres histoires' }).click();
  await expect(page.getByText('Histoire 1 bis').first()).toBeVisible({ timeout: 15000 });

  // Trois relances au maximum (CDC §6).
  await expect(page.getByText('2 relances possibles')).toBeVisible();
});

test('la consigne d’ajustement est transmise au modèle', async ({ page }) => {
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);

  const corps: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/chat/completions')) corps.push(r.postData() ?? '');
  });

  await page.getByLabel('Ajuster (facultatif)').first().fill('plus drôle');
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 20000 });

  expect(corps.some((c) => c.includes('plus drôle'))).toBe(true);
});

test('une conduite injouable est corrigée avant l’écriture des dialogues', async ({ page }) => {
  // Le faux modèle renvoie d'abord trois marionnettes pour un marionnettiste.
  const compteurs = await installerFauxModele(page, { conduiteInjouableDabord: true });
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);

  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 20000 });

  // L'étape 6 a été rejouée : deux appels de conduite au lieu d'un.
  expect(compteurs.conduites).toBe(2);
  // Et le spectacle final est sain : aucun avertissement à signaler.
  await expect(page.getByText('Points à vérifier')).toHaveCount(0);
});

test('une réponse non JSON déclenche une relance, sans échouer', async ({ page }) => {
  await installerFauxModele(page, { jsonInvalideDabord: true });
  await preparerStudio(page);
  // Malgré la première réponse bavarde, la génération aboutit.
  await lancerEtAttendreLeChoix(page);
});

test('une clé refusée en cours de route affiche le message du CDC §5', async ({ page }) => {
  await installerFauxModele(page, { echecAuNumero: 1, statutEchec: 401 });
  await preparerStudio(page);
  await page.getByRole('button', { name: 'Générer le script' }).click();

  await expect(page.getByText('La génération s’est arrêtée')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('alert'))
    .toContainText('La clé est refusée. Vérifiez qu’elle est copiée en entier.');
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
});

test('le spectacle généré se retrouve après rechargement, et se renomme', async ({ page }) => {
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 20000 });

  await page.reload();
  const spectacles = page.getByRole('region', { name: 'Spectacles' });
  await expect(spectacles).toContainText('La carotte disparue');

  // Renommage depuis la colonne de droite (CDC §7).
  await spectacles.getByRole('button', { name: 'Renommer' }).first().click();
  await page.getByLabel('Renommer').fill('Mon spectacle à moi');
  await spectacles.getByRole('button', { name: 'Renommer' }).click();
  await expect(spectacles).toContainText('Mon spectacle à moi');

  await page.reload();
  await expect(page.getByRole('region', { name: 'Spectacles' }))
    .toContainText('Mon spectacle à moi');
});

test('le nombre de jetons consommés est affiché', async ({ page }) => {
  // Exigence du CDC §10 : afficher la consommation si l'API la renvoie.
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/jetons consommés pour ce spectacle/)).toBeVisible();
});

test('aucune photo n’est envoyée au fournisseur', async ({ page }) => {
  // Exigence du CDC §12.
  const corps: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/chat/completions')) corps.push(r.postData() ?? '');
  });

  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);

  expect(corps.length).toBeGreaterThan(0);
  for (const c of corps) {
    // On vérifie qu'aucune IMAGE ne part, pas qu'un mot est absent : le mot
    // « photo » peut légitimement apparaître dans une situation de départ
    // (« une photo de groupe à réussir »), et le test échouait alors sans
    // qu'aucune donnée n'ait fuité.
    expect(c).not.toContain('base64');
    expect(c).not.toContain('data:image');
    expect(c).not.toMatch(/"photo"\s*:/);
    expect(c).not.toMatch(/"photoMiniature"\s*:/);
  }
});

test('une réponse coupée faute de jetons est relancée avec un budget doublé', async ({ page }) => {
  // Le cas s'est produit avec « openai/gpt-5.6-sol » : les modèles à
  // raisonnement décomptent leur réflexion du budget de la réponse, et la
  // coupent au milieu du JSON.
  const compteurs = await installerFauxModele(page, { tronquerEcrituresDabord: 1 });
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);

  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  // Malgré la coupure, le spectacle aboutit.
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 25000 });
  expect(compteurs.ecrituresTronquees).toBe(1);
});

test('une coupure qui persiste donne un message qui dit quoi faire', async ({ page }) => {
  await installerFauxModele(page, { tronquerEcrituresDabord: 99 });
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();

  await expect(page.getByText('La génération s’est arrêtée')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('alert')).toContainText('s’est arrêté avant d’avoir fini');

  // Le détail technique nomme l'étape fautive, pour pouvoir le signaler.
  await page.getByText('Détail technique').click();
  await expect(page.getByText(/etape :/)).toBeVisible();
});

test('l’écrivain anime la boîte de progression pendant que le modèle travaille', async ({ page }) => {
  // Le modèle prend son temps : sans cela, la boîte disparaîtrait aussitôt.
  await installerFauxModele(page, { delaiMs: 2000 });
  await preparerStudio(page);
  await page.getByRole('button', { name: 'Générer le script' }).click();

  const plume = page.locator('.plume');
  await expect(plume).toBeVisible();

  // La liste des étapes reste : l'image s'ajoute, elle ne remplace rien.
  await expect(page.getByRole('status', { name: 'Génération en cours' }))
    .toContainText('Consulte la contothèque');

  // Empaquetée avec l'application : aucun appel extérieur (CDC §12).
  await expect(plume).toHaveAttribute('src', /Ecriture-.*\.webp$/);
  // Décorative : muette pour les lecteurs d'écran.
  await expect(plume).toHaveAttribute('alt', '');

  const anime = await plume.evaluate((el) => {
    const s = getComputedStyle(el);
    return { nom: s.animationName, duree: s.animationDuration };
  });
  expect(anime.nom).not.toBe('none');
  expect(parseFloat(anime.duree)).toBeGreaterThan(1);
});

test('l’animation s’arrête si les animations sont réduites', async ({ page }) => {
  // Exigence du CDC §12. La liste des étapes continue de dire où en est le
  // travail : rien n'est perdu pour qui ne supporte pas le mouvement.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installerFauxModele(page, { delaiMs: 2000 });
  await preparerStudio(page);
  await page.getByRole('button', { name: 'Générer le script' }).click();

  const plume = page.locator('.plume');
  await expect(plume).toBeVisible();

  const duree = await plume.evaluate((el) => getComputedStyle(el).animationDuration);
  expect(parseFloat(duree)).toBeLessThan(0.05);

  await expect(page.getByRole('status', { name: 'Génération en cours' }))
    .toContainText('Consulte la contothèque');
});

test('la liste des étapes ne s’éteint jamais pendant la génération', async ({ page }) => {
  // Une étape absente de la liste affichée rendrait l'étape en cours
  // introuvable : toutes les puces s'éteindraient, et la génération paraîtrait
  // avoir planté au moment le plus long.
  await installerFauxModele(page, { delaiMs: 120 });
  await preparerStudio(page);

  await page.getByRole('button', { name: 'Générer le script' }).click();
  await expect(page.getByText('Choisissez une histoire')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();

  const boite = page.getByRole('status', { name: 'Génération en cours' });
  await expect(boite).toBeVisible();

  // On échantillonne pendant toute l'écriture : à aucun instant la liste ne
  // doit se retrouver sans étape courante ni étape faite.
  for (let n = 0; n < 12; n++) {
    const etat = await page.evaluate(() => {
      const liste = document.querySelector('.progression ol');
      if (!liste) return null; // la génération est finie
      return {
        total: liste.querySelectorAll('li').length,
        vivantes: liste.querySelectorAll('li.active, li.faite').length,
      };
    });
    if (etat === null) break;
    // Les deux étapes faites par l'application et qui durent une seconde —
    // vérifications et assemblage — ne sont pas dans la liste : elles
    // clignoteraient sans rien apprendre au parent.
    expect(etat.total).toBeGreaterThanOrEqual(4);
    expect(etat.vivantes).toBeGreaterThan(0);
    await page.waitForTimeout(150);
  }

  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 30000 });
});

test('chaque étape porte une jauge, et l’étape en cours compte les secondes', async ({ page }) => {
  // Une génération dure une à deux minutes sans rien afficher entre deux
  // étapes : il faut une preuve visible que l'application travaille encore.
  await installerFauxModele(page, { delaiMs: 2000 });
  await preparerStudio(page);

  await page.getByRole('button', { name: 'Générer le script' }).click();
  const boite = page.getByRole('status', { name: 'Génération en cours' });
  await expect(boite).toBeVisible();

  await expect(boite.locator('.jauge').first()).toBeVisible();
  await expect(boite.locator('li.active .secondes')).toHaveText(/\d+s/);

  // La jauge de l'étape en cours avance toute seule, sans nouvel appel.
  const largeur = async () => boite.evaluate((el) => {
    const r = el.querySelector('li.active .remplie') as HTMLElement | null;
    return r ? r.getBoundingClientRect().width : -1;
  });
  const avant = await largeur();
  await page.waitForTimeout(1200);
  expect(await largeur()).toBeGreaterThan(avant);
});

test('une étape qui recommence le dit, au lieu de paraître figée', async ({ page }) => {
  // « Découpage en actes » peut enchaîner plusieurs appels sous un seul
  // libellé : la conduite se régénère si la simulation trouve plus de
  // marionnettes que de mains, et chaque appel se relance sur un JSON
  // invalide. Sans compteur, une cascade de reprises est indiscernable d'un
  // modèle lent.
  // Délai généreux : depuis la fusion des étapes, la génération entière tient
  // en six appels. À 300 ms l'appel, la reprise passait trop vite pour être
  // observée — le spectacle était prêt avant la première vérification.
  await installerFauxModele(page, { conduiteInjouableDabord: true, delaiMs: 1200 });
  await preparerStudio(page);

  await page.getByRole('button', { name: 'Générer le script' }).click();
  await expect(page.getByText('Choisissez une histoire')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();

  const boite = page.getByRole('status', { name: 'Génération en cours' });
  await expect(boite.locator('li.active .secondes')).toContainText('essai 2', { timeout: 20000 });

  // Et le spectacle aboutit quand même.
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 40000 });
});

test('après avoir lu et joué le spectacle, le studio est prêt pour une nouvelle génération, réglages gardés', async ({ page }) => {
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 20000 });

  // On ouvre le spectacle depuis la colonne de droite, pas par le bouton.
  await page.getByRole('region', { name: 'Spectacles' }).getByText('La carotte disparue').first().click();
  await expect(page).toHaveURL(/#\/spectacle\//);
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page).toHaveURL(/\/jouer$/);
  // Quitter le mode spectacle ramène à l'accueil.
  await page.getByRole('button', { name: 'Quitter' }).first().click();
  await expect(page).toHaveURL(/#\/studio$/);

  // Le studio propose une nouvelle génération, avec les mêmes marionnettes.
  await expect(page.getByText('Votre spectacle est prêt')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Générer le script' })).toBeVisible();
  await expect(scene(page)).toContainText('3 / 6');
  await expect(page.getByText('5 min')).toBeVisible();
});

test('le directeur éditorial lit les deux histoires, puis réécrit lui-même l’acte qu’il a annoté', async ({ page }) => {
  const appels = await installerFauxModele(page, { remarqueSurActe: 2 });
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 30000 });

  // La revue : le conte d'origine et sa transposition.
  expect(appels.revue).toEqual({ original: true, transpose: true });
  // La réécriture : l'acte 2 seul, même pour une remarque de détail, par le
  // directeur, avec le conte d'origine, le script entier et sa modification.
  expect(appels.reecritures).toEqual([
    { acte: 2, parLeDirecteur: true, original: true, scriptEntier: true, modification: true },
  ]);
});

test('une revue finale qui répond hors format ne fait pas perdre le spectacle', async ({ page }) => {
  await installerFauxModele(page, { relectureInvalide: true });
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);
  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('La génération s’est arrêtée')).toHaveCount(0);
});

test('les contes montrés, puis celui qui est joué, sont retenus pour varier les prochaines propositions', async ({ page }) => {
  await installerFauxModele(page);
  await preparerStudio(page);
  await lancerEtAttendreLeChoix(page);
  const lire = () => page.evaluate(() => JSON.parse(localStorage.getItem('souffleur.contes.historique') ?? '[]'));
  const montres = await lire();
  expect(montres).toHaveLength(3);
  expect(montres.every((r: { type: string }) => r.type === 'propose')).toBe(true);

  await page.getByRole('button', { name: 'Choisir cette histoire' }).first().click();
  await expect(page.getByText('Votre spectacle est prêt')).toBeVisible({ timeout: 30000 });
  const apres = await lire();
  expect(apres).toHaveLength(4);
  expect(apres[3]).toEqual({ conte: montres[0].conte, type: 'joue' });
});
