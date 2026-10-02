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

// Des repères géographiques courts pour parcourir le fonds. La culture
// détaillée reste dans la fiche source et dans la recherche textuelle.
const ORIGINES: Record<string, string[]> = {
  Afrique: [
    'Agni (Côte d’Ivoire)', 'Akan (Ghana)', 'Atakpamé (Togo)',
    'Bilin (Érythrée)', 'Dinka (Soudan du Sud)', 'Égypte ancienne',
    'Éwé (Togo, Ghana)', 'Haoussa (Nigeria, Niger)', 'Konde (Malawi, Tanzanie)',
    'Kongo (Congo)', 'Malinké (Guinée, Mali)', 'Mandé (Mali)',
    'Nubien de Dongola (Soudan)', 'Oromo (Éthiopie)', 'Shambala (Tanzanie)',
    'Téké (Congo, Gabon)', 'Vaï (Liberia)', 'Wolof (Sénégal)',
  ],
  'Amérique du Nord': [
    'Afro-américain (sud des États-Unis)', 'Iroquois (Amérique du Nord)',
    'Karuk (Californie)', 'Sioux (Lakota, Dakota)', 'Wabanaki (Amérique du Nord)',
  ],
  Antilles: ["Afro-antillais (Antilles anglaises), d'origine akan (Ghana)"],
  Allemagne: ['Allemagne (Basse-Saxe)'],
  France: ['Lyon (France)'],
  Inde: ['Inde (Jātaka bouddhiques)'],
  Italie: ['Sicile (Italie)'],
  'Monde arabe': ['Monde arabe (Syrie)'],
};
const ORIGINE_PAR_CULTURE = new Map(
  Object.entries(ORIGINES).flatMap(([origine, cultures]) => cultures.map(culture => [culture, origine] as const)),
);

export function construireCatalogue(fiches: SignatureModele[]): EntreeCatalogue[] {
  return fiches.map(signature => {
    const conte = conteParId(signature.conteId);
    const culture = conte?.culture ?? '';
    const origine = ORIGINE_PAR_CULTURE.get(culture) ?? culture;
    return {
      signature,
      type: typeRecit(conte?.genre ?? ''),
      origine,
      recherche: normaliser([signature.titre, conte?.source, culture, origine].filter(Boolean).join(' ')),
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
