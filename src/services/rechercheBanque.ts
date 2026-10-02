// Les critères de découverte précèdent les contraintes pratiques de jeu.
// Ils lisent les fiches existantes, sans dupliquer les métadonnées du fonds.
import type { SignatureModele } from './banque';
import { conteParId } from './repertoire';

export type TypeRecit = 'conte' | 'fable' | 'theatre' | 'autre';
export interface EntreeCatalogue {
  signature: SignatureModele;
  type: TypeRecit;
  origine: string;
  recherche: string;
}

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr').replaceAll('œ', 'oe').replaceAll('æ', 'ae')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function typeRecit(genre: string): TypeRecit {
  const g = normaliser(genre);
  if (g.startsWith('conte')) return 'conte';
  if (g.startsWith('fable')) return 'fable';
  if (/piece|comedie|theatre/.test(g)) return 'theatre';
  return 'autre';
}

export function construireCatalogue(fiches: SignatureModele[]): EntreeCatalogue[] {
  return fiches.map(signature => {
    const conte = conteParId(signature.conteId);
    return {
      signature,
      type: typeRecit(conte?.genre ?? ''),
      // Conserver la culture précise : Wabanaki, Lyon, etc., sans la réduire
      // arbitrairement à un pays ou attribuer un continent aux cas ambigus.
      origine: conte?.culture ?? '',
      recherche: normaliser([signature.titre, conte?.source, conte?.culture].filter(Boolean).join(' ')),
    };
  });
}

export function rechercherCatalogue(
  catalogue: EntreeCatalogue[],
  criteres: { texte: string; type: TypeRecit | ''; origine: string },
): EntreeCatalogue[] {
  const mots = normaliser(criteres.texte).split(' ').filter(Boolean);
  return catalogue.filter(e =>
    (!criteres.type || e.type === criteres.type)
    && (!criteres.origine || e.origine === criteres.origine)
    && mots.every(mot => e.recherche.includes(mot)),
  );
}
