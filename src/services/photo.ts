// Préparation des photos de peluches (CDC §4 : 512 px au plus, JPEG).
//
// Le redimensionnement se fait dans le navigateur, avant stockage : une photo
// de téléphone fait plusieurs mégaoctets, ce qui remplirait vite IndexedDB et
// ralentirait l'export JSON.
//
// Rappel : ces photos ne sont JAMAIS envoyées au fournisseur d'IA en V1 (§12).

import { BORNES } from '../config';

/** Qualité JPEG. 0,82 est un bon compromis pour une vignette de 512 px. */
const QUALITE = 0.82;

/**
 * Redimensionne une image pour que son plus grand côté ne dépasse pas
 * `BORNES.photoPixels`, et la réencode en JPEG.
 * Les proportions sont conservées ; une image déjà petite n'est pas agrandie.
 *
 * Lève une erreur si le fichier n'est pas une image lisible par le navigateur.
 */
export async function preparerPhoto(fichier: Blob): Promise<Blob> {
  const image = await chargerImage(fichier);
  const max = BORNES.photoPixels;

  const facteur = Math.min(1, max / Math.max(image.width, image.height));
  const largeur = Math.max(1, Math.round(image.width * facteur));
  const hauteur = Math.max(1, Math.round(image.height * facteur));

  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;

  const contexte = toile.getContext('2d');
  if (!contexte) throw new Error('Le navigateur ne fournit pas de contexte de dessin.');
  // Fond blanc : un PNG transparent converti en JPEG donnerait du noir.
  contexte.fillStyle = '#FFFFFF';
  contexte.fillRect(0, 0, largeur, hauteur);
  contexte.drawImage(image, 0, 0, largeur, hauteur);

  if ('close' in image) image.close();

  return await new Promise<Blob>((resoudre, rejeter) => {
    toile.toBlob(
      (blob) => (blob ? resoudre(blob) : rejeter(new Error('Conversion JPEG impossible.'))),
      'image/jpeg',
      QUALITE,
    );
  });
}

/**
 * Charge un fichier en image. `createImageBitmap` est utilisée quand elle
 * existe car elle applique l'orientation EXIF des photos de téléphone ;
 * sinon on retombe sur un chargement classique.
 */
async function chargerImage(fichier: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    } catch {
      // Format refusé par cette voie : on tente l'autre.
    }
  }

  const url = URL.createObjectURL(fichier);
  try {
    return await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const img = new Image();
      img.onload = () => resoudre(img);
      img.onerror = () => rejeter(new Error('Image illisible.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
