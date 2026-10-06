import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chargerModele, signatures } from '../src/services/banque';
import { CONTES, conteParId, retouchesDuConte, texteDuConte } from '../src/services/repertoire';
import { appliquerRetouches } from '../src/services/retouches';
import { RETRAITS } from '../src/services/retraits';

const RETIRES = [
  'de-roi-grenouille', 'fr-perrault-les-fees', 'guignol-le-pot-de-confitures',
  'no-concours-de-manger', 'ru-chat-coq-renard', 'ru-morozko',
];

describe('relecture enfant validée le 6 octobre 2026', () => {
  it('conserve les six décisions de retrait', () => {
    expect(Object.keys(RETRAITS).sort()).toEqual(RETIRES.toSorted());
  });

  it.each(RETIRES)('%s est absent du fonds et du générateur, avec sa source conservée', async id => {
    expect(signatures().some(s => s.conteId === id)).toBe(false);
    expect(CONTES.some(c => c.id === id)).toBe(false);
    expect(conteParId(id)).toBeUndefined();
    expect(await chargerModele(`${id}--1`)).toBeNull();
    expect(await texteDuConte(id)).toBe('');
    expect(await retouchesDuConte(id)).toBeNull();
    expect(existsSync(`banque/spectacles/${id}--1.json`)).toBe(false);
    expect(existsSync(`wiki/fr/${id}.md`)).toBe(true);
  });

  it('les futures adaptations retirent le suicide simulé et le mariage explicitement enfantin', async () => {
    for (const id of ['ja-bonze-et-novice', 'ja-issun-boshi']) {
      const source = await texteDuConte(id);
      const fiche = await retouchesDuConte(id);
      expect(fiche).not.toBeNull();
      for (let age = 3; age <= 10; age++) {
        const rendu = appliquerRetouches(source, fiche!, age);
        expect(rendu.ok, `${id}, ${age} ans`).toBe(true);
        if (!rendu.ok) continue;
        expect(rendu.avertissements).toEqual([]);
        const texte = rendu.texte;
        if (id === 'ja-bonze-et-novice') {
          expect(texte).not.toMatch(/mourir pour m.excuser|je vais mourir|je serai mort|agonie/i);
          expect(texte).toContain('très mal au ventre');
        } else {
          expect(texte).not.toMatch(/treize ans|tous les deux des enfants|piquer l.œil|derrière les yeux/);
          expect(texte).toContain("et l'épousa.");
        }
      }
    }
  });

  it('conserve la mort classique de Tracassin sans la mutilation, et l’origine de la méduse', async () => {
    const tracassin = (await chargerModele('de-tracassin--1'))!;
    const fin = tracassin.actes.at(-1)!.elements
      .filter(e => 'texte' in e).map(e => e.texte).join(' ');
    expect(fin).toContain('mourut');
    expect(fin).not.toMatch(/déchira|en deux/);
    const meduse = (await chargerModele('ja-meduse-messagere--1'))!;
    const dernierActe = meduse.actes.at(-1)!.elements;
    expect(dernierActe.filter(e => e.type === 'adresse_public')
      .some(e => /Criez avec nous|Bavarde|frappez/i.test(e.texte))).toBe(false);
    expect(dernierActe.filter(e => 'texte' in e).map(e => e.texte).join(' '))
      .toContain("méduse d'aujourd'hui, toute molle et sans un os");
  });
});
