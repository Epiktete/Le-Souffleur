// Parcours du studio : la scène, les réglages, les paramètres IA.
// Étape 3a du plan de livraison.
import { expect, test } from '@playwright/test';
import { carte, creerMarionnette, scene } from './aides';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('la liste des personnages est vide au départ et explique quoi faire', async ({ page }) => {
  await expect(scene(page)).toContainText('Ajoutez des marionnettes depuis la marionnethèque');
  await expect(scene(page)).toContainText('0 / 6');
});

test('la flèche ajoute une marionnette aux personnages, et l’autre la retire', async ({ page }) => {
  await creerMarionnette(page, 'Doudou Lapin');

  // Flèche vers la droite, depuis la boîte de la bibliothèque.
  await page.getByRole('button', { name: 'Ajouter Doudou Lapin aux personnages' }).click();
  await expect(scene(page)).toContainText('Doudou Lapin');
  await expect(scene(page)).toContainText('1 / 6');

  // Une marionnette déjà en scène ne peut pas y être remise.
  await expect(page.getByRole('button', { name: 'Ajouter Doudou Lapin aux personnages' })).toBeDisabled();

  // Flèche vers la gauche, depuis la boîte de la scène.
  await scene(page).getByRole('button', { name: 'Retirer Doudou Lapin des personnages' }).click();
  await expect(scene(page)).toContainText('0 / 6');
  await expect(page.getByRole('button', { name: 'Ajouter Doudou Lapin aux personnages' })).toBeEnabled();
});

test('la liste des personnages refuse la septième marionnette', async ({ page }) => {
  for (let n = 1; n <= 7; n++) await creerMarionnette(page, `Peluche ${n}`);

  for (let n = 1; n <= 6; n++) {
    await page.getByRole('button', { name: `Ajouter Peluche ${n} aux personnages` }).click();
  }
  await expect(scene(page)).toContainText('6 / 6');
  await expect(scene(page)).toContainText('C’est complet');
  // La septième flèche est désactivée plutôt que de produire une erreur.
  await expect(page.getByRole('button', { name: 'Ajouter Peluche 7 aux personnages' })).toBeDisabled();
});

test('le message sur les mains apparaît quand il y a plus de marionnettes que de mains', async ({ page }) => {
  for (let n = 1; n <= 3; n++) await creerMarionnette(page, `Peluche ${n}`);

  // Deux marionnettes, un marionnettiste : deux mains, tout va bien.
  await page.getByRole('button', { name: 'Ajouter Peluche 1 aux personnages' }).click();
  await page.getByRole('button', { name: 'Ajouter Peluche 2 aux personnages' }).click();
  await expect(scene(page)).not.toContainText('jamais plus de');

  // La troisième dépasse les deux mains : le message d'aide s'affiche.
  await page.getByRole('button', { name: 'Ajouter Peluche 3 aux personnages' }).click();
  await expect(scene(page)).toContainText('3 marionnettes pour 1 marionnettiste');
  await expect(scene(page)).toContainText('jamais plus de 2 en scène en même temps');

  // Avec deux marionnettistes, donc quatre mains, le message disparaît.
  await page.getByRole('group', { name: 'Marionnettistes' }).getByRole('button', { name: '2' }).click();
  await expect(scene(page)).not.toContainText('jamais plus de');
});

test('une marionnette supprimée quitte les personnages', async ({ page }) => {
  await creerMarionnette(page, 'Ourse');
  await page.getByRole('button', { name: 'Ajouter Ourse aux personnages' }).click();
  await expect(scene(page)).toContainText('1 / 6');

  // La fiche est déjà dépliée après la création : ses actions sont accessibles.
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();

  await expect(scene(page)).toContainText('0 / 6');
});

test('les curseurs affichent leur valeur et sont conservés au rechargement', async ({ page }) => {
  await expect(page.getByText('5 min')).toBeVisible();
  await expect(page.getByText('5 ans')).toBeVisible();

  await page.getByLabel('Durée').fill('8');
  await expect(page.getByText('8 min')).toBeVisible();

  await page.getByLabel('Âge de l’auditoire').fill('9');
  await expect(page.getByText('9 ans')).toBeVisible();

  // Le CDC §7 demande que les réglages survivent d'une visite à l'autre.
  // L'écriture est différée de 400 ms pour ne pas écrire à chaque pixel.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByText('8 min')).toBeVisible();
  await expect(page.getByText('9 ans')).toBeVisible();
});

test('l’interaction suit l’âge, puis obéit au choix de l’utilisateur', async ({ page }) => {
  const groupe = page.getByRole('group', { name: 'Interaction avec le public' });

  // À 5 ans, l'interaction proposée est « beaucoup ».
  await expect(groupe.getByRole('button', { name: 'Beaucoup' })).toHaveAttribute('aria-pressed', 'true');

  // À 9 ans, elle redescend d'elle-même.
  await page.getByLabel('Âge de l’auditoire').fill('9');
  await expect(groupe.getByRole('button', { name: 'Quelques' })).toHaveAttribute('aria-pressed', 'true');

  // Mais un choix explicite ne doit plus être écrasé par l'âge.
  await groupe.getByRole('button', { name: 'Aucune' }).click();
  await page.getByLabel('Âge de l’auditoire').fill('4');
  await expect(groupe.getByRole('button', { name: 'Aucune' })).toHaveAttribute('aria-pressed', 'true');
});

test('l’ébauche est comptée, bornée et conservée', async ({ page }) => {
  const ebauche = page.getByLabel('Ébauche de scénario');
  await ebauche.fill('Doudou Lapin a perdu sa carotte.');
  await expect(page.getByText('32 / 2000')).toBeVisible();

  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByLabel('Ébauche de scénario')).toHaveValue('Doudou Lapin a perdu sa carotte.');
});

test('l’ébauche ne porte plus de conseil de prudence', async ({ page }) => {
  // L'écran reste léger : ce qui part au fournisseur est dit dans le README.
  await expect(page.getByText(/prénom de vos enfants/)).toHaveCount(0);
});

test('sans marionnette, le bouton de génération est désactivé et dit pourquoi', async ({ page }) => {
  const bouton = page.getByRole('button', { name: /Configurer ma clé IA|Générer le script/ });
  await expect(bouton).toBeDisabled();
  await expect(page.getByText('Ajoutez au moins une marionnette aux personnages')).toBeVisible();
});

test('sans clé, le bouton mène aux paramètres IA', async ({ page }) => {
  await creerMarionnette(page, 'Doudou');
  await page.getByRole('button', { name: 'Ajouter Doudou aux personnages' }).click();

  await page.getByRole('button', { name: 'Configurer ma clé IA' }).click();
  await expect(page).toHaveURL(/#\/parametres$/);
  await expect(page.getByRole('heading', { name: 'Paramètres IA' })).toBeVisible();
});

test('les paramètres IA proposent OpenRouter et le modèle retenu', async ({ page }) => {
  await page.goto('/#/parametres');

  await expect(page.getByRole('button', { name: 'OpenRouter' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Adresse du service')).toHaveValue('https://openrouter.ai/api/v1');
  await expect(page.getByLabel('Modèle')).toHaveValue('openai/gpt-5.6-sol');

  // Les six préréglages du §5 sont proposés.
  for (const nom of ['OpenRouter', 'OpenAI', 'Mistral', 'Google Gemini', 'Anthropic', 'Autre']) {
    await expect(page.getByRole('button', { name: nom, exact: true })).toBeVisible();
  }
});

test('changer de fournisseur change l’adresse et le modèle suggéré', async ({ page }) => {
  await page.goto('/#/parametres');
  await page.getByRole('button', { name: 'Mistral', exact: true }).click();
  await expect(page.getByLabel('Adresse du service')).toHaveValue('https://api.mistral.ai/v1');
  await expect(page.getByLabel('Modèle')).toHaveValue('mistral-large-latest');
});

test('la case de mémorisation est décochée par défaut, avec son avertissement', async ({ page }) => {
  await page.goto('/#/parametres');
  // Exigence du CDC §5 : décoché par défaut.
  await expect(page.getByLabel('Mémoriser la clé sur cet appareil')).not.toBeChecked();
  await expect(page.getByText(/pourra lire une clé mémorisée/)).toBeVisible();
  await expect(page.getByText('La clé est gardée le temps de cette visite seulement.')).toBeVisible();
});

test('la clé n’est pas enregistrée si la case n’est pas cochée', async ({ page }) => {
  await page.goto('/#/parametres');
  await page.getByLabel('Clé API').fill('cle-secrete-de-test');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Enregistré.')).toBeVisible();

  // On lit le stockage directement : la clé ne doit pas y être.
  const stocke = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const r = indexedDB.open('le-souffleur');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const tout = await new Promise<unknown[]>((ok, ko) => {
      const r = db.transaction('reglages').objectStore('reglages').getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    return JSON.stringify(tout);
  });
  expect(stocke).not.toContain('cle-secrete-de-test');

  // Et après rechargement, la clé a bien disparu.
  await page.reload();
  await expect(page.getByLabel('Clé API')).toHaveValue('');
});

test('la clé est enregistrée si la case est cochée, et oubliée sur demande', async ({ page }) => {
  await page.goto('/#/parametres');
  await page.getByLabel('Clé API').fill('cle-a-memoriser');
  await page.getByLabel('Mémoriser la clé sur cet appareil').check();
  await expect(page.getByText('La clé est enregistrée sur cet appareil.')).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  // On attend la confirmation : l'écriture dans IndexedDB est asynchrone, et
  // recharger avant sa validation ferait perdre la clé.
  await expect(page.getByText('Enregistré.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Clé API')).toHaveValue('cle-a-memoriser');
  // L'en-tête reflète l'état de la clé.
  await expect(page.getByText('Clé OK')).toBeVisible();

  // « Oublier la clé » l'efface de la mémoire et du stockage.
  await page.getByRole('button', { name: 'Oublier la clé' }).click();
  await expect(page.getByLabel('Clé API')).toHaveValue('');
  // On attend la confirmation : l'effacement sur disque est asynchrone.
  await expect(page.getByText('Clé effacée de cet appareil.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Clé API')).toHaveValue('');
  await expect(page.getByText('Clé absente')).toBeVisible();
});

test('le test de connexion rend compte en trois points', async ({ page }) => {
  await page.goto('/#/parametres');

  // On intercepte l'appel : aucun appel réel à un fournisseur dans les tests.
  await page.route('**/chat/completions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: '{"ok": true, "couleur": "rouge"}' } }],
        usage: { total_tokens: 58 },
      }),
    });
  });

  await page.getByLabel('Clé API').fill('cle-de-test');
  await page.getByRole('button', { name: 'Tester la connexion' }).click();

  await expect(page.getByText('Tout est bon : vous pouvez générer un spectacle.')).toBeVisible();
  await expect(page.getByText('58 jetons consommés')).toBeVisible();
});

test('le test de connexion traduit une clé refusée en français', async ({ page }) => {
  await page.goto('/#/parametres');
  await page.route('**/chat/completions', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"nope"}' });
  });

  await page.getByLabel('Clé API').fill('mauvaise-cle');
  await page.getByRole('button', { name: 'Tester la connexion' }).click();

  await expect(page.getByText('La clé est refusée. Vérifiez qu’elle est copiée en entier.')).toBeVisible();
});

test('le test de connexion est désactivé sans clé', async ({ page }) => {
  await page.goto('/#/parametres');
  await expect(page.getByRole('button', { name: 'Tester la connexion' })).toBeDisabled();
});

test('aucun appel réseau vers l’extérieur au chargement du studio', async ({ page }) => {
  const externes: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('data:')) {
      externes.push(r.url());
    }
  });
  await page.goto('/#/parametres', { waitUntil: 'networkidle' });
  expect(externes).toEqual([]);
});
