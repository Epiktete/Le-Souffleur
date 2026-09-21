// Aides partagées par les tests de parcours.
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * La boîte d'une marionnette dans la bibliothèque.
 *
 * Le nom est ancré en début de libellé : sans cela, « Doudou » désignerait aussi
 * le bouton fléché « Mettre Doudou en scène », et Playwright refuserait de
 * choisir entre les deux.
 */
export function carte(page: Page, nom: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^${echapper(nom)}`) });
}

/** La zone de la scène, dans le studio. */
export function scene(page: Page): Locator {
  return page.getByRole('region', { name: 'Personnages' });
}

/** Crée une marionnette depuis la bibliothèque, et attend qu'elle apparaisse. */
export async function creerMarionnette(page: Page, nom: string, trait = 'gentil') {
  await page.getByRole('button', { name: '+ Nouvelle marionnette' }).click();
  await page.getByLabel('Nom').fill(nom);
  await page.getByRole('button', { name: trait, exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carte(page, nom)).toBeVisible();
}

/** Échappe les caractères spéciaux d'une expression régulière. */
function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
