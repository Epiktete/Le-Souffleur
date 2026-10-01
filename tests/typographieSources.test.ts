import { describe, expect, it } from 'vitest';
import { nettoyerTypographie, recollerLettrines } from '../tools/nettoyer-typographie.mjs';

const texte = (html: string) => recollerLettrines(nettoyerTypographie(html).replace(/<[^>]+>/g, ''));

describe('la typographie des sources illustrées', () => {
  it('retire le vers invisible et ses spans imbriqués sans perdre le vers suivant', () => {
    const html = '<span>On se quitta.</span><br><span style="visibility:hidden; color:transparent">'
      + '<span style="width:2em"> </span>On se quitta.</span><span>J’ai maints chapitres vus,</span>';
    expect(texte(html)).toBe('On se quitta.J’ai maints chapitres vus,');
  });

  it('rétablit une lettrine illustrée séparée du mot par la mise en page', () => {
    expect(texte('<span><img alt="P" src="lettre.jpg"></span><div>\n\n</div>hilosophes hardis'))
      .toBe('Philosophes hardis');
  });

  it('ignore les légendes des illustrations et conserve le texte visible', () => {
    expect(texte('<img alt="Un chat devant un miroir" src="chat.jpg"><span>Le Chat</span>'))
      .toBe('Le Chat');
  });

  it('ne supprime pas un passage visible entre deux éléments masqués', () => {
    expect(texte('<span style="visibility: hidden">caché</span>La fable'
      + '<span><span style="visibility:hidden">doublon</span> et sa morale</span>'))
      .toBe('La fable et sa morale');
  });
});
