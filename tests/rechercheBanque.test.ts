import { describe, expect, it } from 'vitest';
import { signatures } from '../src/services/banque';
import { construireCatalogue, rechercherCatalogue } from '../src/services/rechercheBanque';

const catalogue = construireCatalogue(signatures());
const chercher = (texte = '', type: '' | 'conte' | 'fable' | 'theatre' = '', origine = '') =>
  rechercherCatalogue(catalogue, { texte, type, origine });

describe('recherche dans la Contothèque', () => {
  it('conserve tout le fonds et son ordre sans critère, avec des métadonnées reconnues', () => {
    expect(chercher()).toEqual(catalogue);
    expect(catalogue.every(e => e.type !== 'autre' && e.origine)).toBe(true);
  });

  it('trouve un titre sans accents, casse ni ponctuation exacte', () => {
    expect(chercher('  BOEUF cheval ane ').map(e => e.signature.conteId))
      .toEqual(['fr-florian-boeuf-cheval-ane']);
    expect(chercher('ma-porte-d-allee')[0]?.signature.conteId).toBe('guignol-ma-porte-d-allee');
  });

  it('combine auteur, titre, type et origine, sans perdre la recherche en cas de zéro résultat', () => {
    expect(chercher('florian miroir', 'fable', 'France').map(e => e.signature.conteId))
      .toEqual(['fr-florian-chat-miroir']);
    expect(chercher('florian miroir', 'conte', 'France')).toEqual([]);
    expect(chercher('florian miroir', 'fable', 'Japon')).toEqual([]);
    expect(chercher('Onofrio', 'theatre', 'France').length).toBeGreaterThan(0);
  });
});
