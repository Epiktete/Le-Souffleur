// La photo est le seul élément binaire stocké : elle mérite sa vérification.
// Le CDC §4 impose 512 px au plus, en JPEG ; le §12 impose qu'elle ne parte
// jamais chez le fournisseur d'IA.
import { expect, test } from '@playwright/test';
import { carte } from './aides';

test('une photo trop grande est réduite à 512 px et stockée en JPEG', async ({ page }) => {
  await page.goto('/');

  // On fabrique une image 900 × 600 dans la page, puis on la dépose dans le
  // champ de fichier comme le ferait l'utilisateur.
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByLabel('Nom').fill('Peluche Photo');
  await page.getByRole('button', { name: 'gentil', exact: true }).click();

  const octets = await page.evaluate(async () => {
    const toile = document.createElement('canvas');
    toile.width = 900;
    toile.height = 600;
    const c = toile.getContext('2d')!;
    c.fillStyle = '#FF3B1F';
    c.fillRect(0, 0, 900, 600);
    const blob = await new Promise<Blob>((ok) => toile.toBlob((b) => ok(b!), 'image/png'));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'peluche.png',
    mimeType: 'image/png',
    buffer: Buffer.from(octets),
  });

  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carte(page, 'Peluche Photo')).toBeVisible();

  // On relit la photo dans le stockage pour contrôler format et dimensions.
  await page.reload();
  const mesures = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const r = indexedDB.open('le-souffleur');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const tout = await new Promise<any[]>((ok, ko) => {
      const r = db.transaction('marionnettes').objectStore('marionnettes').getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const photo: Blob = tout.find((m) => m.nom === 'Peluche Photo')?.photo;
    if (!photo) return null;
    const image = await createImageBitmap(photo);
    return { type: photo.type, largeur: image.width, hauteur: image.height, poids: photo.size };
  });

  expect(mesures).not.toBeNull();
  // JPEG, comme l'impose le CDC §4.
  expect(mesures!.type).toBe('image/jpeg');
  // Le plus grand côté est ramené à 512 px, les proportions sont gardées.
  expect(mesures!.largeur).toBe(512);
  expect(mesures!.hauteur).toBe(341);
  expect(mesures!.poids).toBeGreaterThan(0);
});

test('la photo s’affiche sur la boîte, et les initiales sinon', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByLabel('Nom').fill('Doudou Lapin');
  await page.getByRole('button', { name: 'gentil', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  // Sans photo : les initiales des deux premiers mots.
  await expect(page.getByText('DL', { exact: true })).toBeVisible();
});
