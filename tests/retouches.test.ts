// Les retouches selon l'âge (CDC §6) : une fiche par conte, appliquée au texte
// par le code, sans IA. Le fond change par moments entiers ou pas du tout ; la
// langue écarte seulement ce qu'elle ne trouve pas.
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  appliquerRetouches,
  lireFicheRetouches,
  motsChanges,
  niveauPour,
  trouverExtrait,
  validerFicheRetouches,
  versionsDistinctes,
  type FicheRetouches,
  type ResultatRetouches,
} from '../src/services/retouches';
import { conteParId, retouchesDuConte, texteDuConte } from '../src/services/repertoire';

/** Une fiche minimale, complétée par ce que chaque test précise. */
const fiche = (f: Partial<FicheRetouches>): FicheRetouches => ({ id: 'essai', langue: [], moments: [], ...f });

/** Le texte obtenu, en échouant clairement si la fiche ne s'applique pas. */
function texte(r: ResultatRetouches): string {
  if (!r.ok) throw new Error(r.erreurs.join(' ; '));
  return r.texte;
}

const CONTE = 'Le Loup heurte à la porte. La mère-grand lui ouvre, et le Loup la dévora. '
  + 'Plus tard, le Loup mangea la fillette. Fin.';

/** Un moment à deux niveaux, jusqu'à 4 et jusqu'à 8 ans. */
const devoration = fiche({
  moments: [{
    id: 'le-loup-mange',
    type: 'mort-gentil',
    niveaux: [
      {
        jusqua: 4,
        annonce: 'La mère-grand se cache.',
        retouches: [
          { avant: 'et le Loup la dévora.', apres: 'et elle court se cacher.' },
          { avant: 'le Loup mangea la fillette.', apres: 'la fillette appela les bûcherons.' },
        ],
      },
      {
        jusqua: 8,
        annonce: 'Les bûcherons délivrent tout le monde.',
        retouches: [{ avant: 'le Loup mangea la fillette.', apres: 'le Loup mangea la fillette, et les bûcherons la délivrèrent.' }],
      },
    ],
  }],
});

describe('retrouver un extrait', () => {
  it('ne tient compte ni de l’apostrophe, ni des espaces, ni des retours à la ligne', () => {
    const t = 'Il n’osa, à cause de quelques\nbûcherons  qui étaient là.';
    expect(trouverExtrait(t, "Il n'osa, à cause de quelques bûcherons qui")).toHaveLength(1);
    expect(trouverExtrait("Il n'osa pas", 'Il n’osa pas')).toHaveLength(1);
  });

  it('ni de l’espace avant « ? » et après « « »', () => {
    expect(trouverExtrait('Demeure-t-elle bien loin ?', 'Demeure-t-elle bien loin?')).toHaveLength(1);
    expect(trouverExtrait('Demeure-t-elle bien loin?', 'Demeure-t-elle bien loin ?')).toHaveLength(1);
    expect(trouverExtrait('« Va voir ta mère-grand »', '«Va voir ta mère-grand»')).toHaveLength(1);
  });

  it('cherche en mot entier, première lettre sans tenir compte de la majuscule', () => {
    expect(trouverExtrait('Il vint heurter à la porte.', 'heurte')).toHaveLength(0);
    expect(trouverExtrait('Seyait-il ? Il lui seyait.', 'seyait')).toHaveLength(2);
  });
});

describe('la langue', () => {
  it('remplace un extrait unique, et « partout » chaque occurrence en gardant la majuscule', () => {
    const f = fiche({
      langue: [
        { avant: 'heurte', apres: 'frappe', nature: 'mot-disparu' },
        { avant: 'bonne femme', apres: 'bonne vieille', nature: 'faux-ami', partout: true },
      ],
    });
    const r = appliquerRetouches('Il heurte. Bonne femme, dit-il à la bonne femme.', f, 5);
    expect(texte(r)).toBe('Il frappe. Bonne vieille, dit-il à la bonne vieille.');
  });

  it('écarte un extrait ambigu sans « partout », avec un avertissement', () => {
    const f = fiche({ langue: [{ avant: 'toc', apres: 'pan', nature: 'mot-disparu' }] });
    const r = appliquerRetouches('Toc, toc.', f, 5);
    expect(texte(r)).toBe('Toc, toc.');
    expect(r.ok && r.avertissements[0]).toMatch(/trouvé 2 fois/);
  });

  it('écarte un extrait introuvable sans empêcher le reste', () => {
    const f = fiche({
      langue: [
        { avant: 'n’existe pas', apres: 'rien', nature: 'tournure' },
        { avant: 'heurte', apres: 'frappe', nature: 'mot-disparu' },
      ],
    });
    const r = appliquerRetouches(CONTE, f, 5);
    expect(texte(r)).toContain('Le Loup frappe à la porte.');
    expect(r.ok && r.avertissements).toHaveLength(1);
  });

  it('une retouche avec un âge limite ne vaut que jusqu’à cet âge, et entre dans le profil', () => {
    const f = fiche({ langue: [{ avant: 'la dévora', apres: 'l’avala', nature: 'mot-cle', jusqua: 5 }] });
    expect(texte(appliquerRetouches(CONTE, f, 5))).toContain('l’avala');
    expect(texte(appliquerRetouches(CONTE, f, 6))).toContain('la dévora');
    const r = appliquerRetouches(CONTE, f, 4);
    expect(r.ok && r.profil).toEqual(['langue#0']);
  });

  it('un extrait retiré ne laisse pas deux espaces', () => {
    const f = fiche({ langue: [{ avant: 'Plus tard,', apres: '', nature: 'tournure' }] });
    expect(texte(appliquerRetouches(CONTE, f, 5))).toContain('dévora. le Loup mangea');
  });
});

describe('le fond', () => {
  it('choisit un niveau par moment : la plus petite limite qui couvre l’âge', () => {
    const moment = devoration.moments[0];
    const limites = [3, 4, 5, 8, 9, 10].map((age) => niveauPour(moment, age)?.jusqua ?? null);
    expect(limites).toEqual([4, 4, 8, 8, null, null]);
  });

  it('applique toutes les retouches du niveau, pour que le moment reste cohérent', () => {
    const t3 = texte(appliquerRetouches(CONTE, devoration, 3));
    expect(t3).toContain('et elle court se cacher.');
    expect(t3).toContain('la fillette appela les bûcherons.');
    expect(t3).not.toContain('dévora');

    const t7 = texte(appliquerRetouches(CONTE, devoration, 7));
    expect(t7).toContain('et le Loup la dévora.');
    expect(t7).toContain('les bûcherons la délivrèrent.');

    expect(texte(appliquerRetouches(CONTE, devoration, 10))).toBe(CONTE);
  });

  it('donne les annonces du niveau retenu, et rien au-dessus', () => {
    const r4 = appliquerRetouches(CONTE, devoration, 4);
    expect(r4.ok && r4.annonces).toEqual(['La mère-grand se cache.']);
    const r9 = appliquerRetouches(CONTE, devoration, 9);
    expect(r9.ok && r9.annonces).toEqual([]);
  });

  it('refuse tout le conte si un extrait de fond est introuvable : pas de texte à moitié adouci', () => {
    const f = fiche({
      moments: [{
        id: 'm',
        type: 'mort-gentil',
        niveaux: [{
          jusqua: 6,
          retouches: [
            { avant: 'et le Loup la dévora.', apres: 'et elle court se cacher.' },
            { avant: 'une phrase absente', apres: '…' },
          ],
        }],
      }],
    });
    const r = appliquerRetouches(CONTE, f, 5);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erreurs[0]).toMatch(/introuvable/);
  });

  it('refuse un extrait de fond trouvé deux fois', () => {
    const f = fiche({
      moments: [{ id: 'm', type: 'punition', niveaux: [{ jusqua: 6, retouches: [{ avant: 'le Loup', apres: 'le chien' }] }] }],
    });
    const r = appliquerRetouches(CONTE, f, 5);
    expect(!r.ok && r.erreurs[0]).toMatch(/trouvé 3 fois/);
  });

  it('refuse deux retouches de fond qui se chevauchent', () => {
    const f = fiche({
      moments: [
        { id: 'a', type: 'mort-gentil', niveaux: [{ jusqua: 6, retouches: [{ avant: 'lui ouvre, et le Loup', apres: 'x' }] }] },
        { id: 'b', type: 'mort-gentil', niveaux: [{ jusqua: 6, retouches: [{ avant: 'et le Loup la dévora', apres: 'y' }] }] },
      ],
    });
    const r = appliquerRetouches(CONTE, f, 5);
    expect(!r.ok && r.erreurs[0]).toMatch(/se chevauchent/);
  });
});

describe('la langue et le fond ensemble', () => {
  const f = fiche({
    langue: [
      { avant: 'dévora', apres: 'avala', nature: 'mot-cle' },
      { avant: 'mère-grand lui ouvre, et le', apres: 'grand-mère lui ouvre, et le', nature: 'mot-disparu' },
    ],
    moments: devoration.moments,
  });

  it('une retouche de langue dans un passage de fond retouché est ignorée, et vaut au-dessus', () => {
    expect(texte(appliquerRetouches(CONTE, f, 4))).not.toContain('avala');
    expect(texte(appliquerRetouches(CONTE, f, 9))).toContain('et le Loup la avala.');
  });

  it('une retouche de langue à cheval sur un passage de fond est écartée, avec un avertissement', () => {
    const r = appliquerRetouches(CONTE, f, 4);
    expect(texte(r)).toContain('La mère-grand lui ouvre');
    expect(r.ok && r.avertissements.join()).toMatch(/à cheval/);
  });
});

describe('les versions d’un conte', () => {
  it('deux âges de même profil donnent le même texte', () => {
    expect(texte(appliquerRetouches(CONTE, devoration, 5))).toBe(texte(appliquerRetouches(CONTE, devoration, 8)));
    const versions = versionsDistinctes(CONTE, devoration);
    expect(versions.map((v) => v.ages)).toEqual([[3, 4], [5, 6, 7, 8], [9, 10]]);
  });

  it('compte les mots vraiment changés, pas la longueur de l’extrait', () => {
    expect(motsChanges('sa mère en était folle', 'sa mère l’aimait à la folie')).toBe(5);
    expect(motsChanges('qui lui seyait si bien', 'qui lui allait si bien')).toBe(1);
  });
});

describe('le format d’une fiche', () => {
  it('refuse des niveaux qui ne vont pas du plus bas au plus haut', () => {
    const r = validerFicheRetouches({
      id: 'x',
      moments: [{ id: 'm', type: 'punition', niveaux: [
        { jusqua: 6, retouches: [{ avant: 'a', apres: 'b' }] },
        { jusqua: 4, retouches: [{ avant: 'a', apres: 'c' }] },
      ] }],
    });
    expect(r.ok).toBe(false);
  });

  it('refuse un type ou une nature hors du vocabulaire, et un âge hors du studio', () => {
    expect(validerFicheRetouches({ id: 'x', moments: [{ id: 'm', type: 'horreur', niveaux: [] }] }).ok).toBe(false);
    expect(validerFicheRetouches({ id: 'x', langue: [{ avant: 'a', apres: 'b', nature: 'style' }] }).ok).toBe(false);
    expect(validerFicheRetouches({ id: 'x', langue: [{ avant: 'a', apres: 'b', nature: 'tournure', jusqua: 12 }] }).ok).toBe(false);
  });

  it('une fiche illisible vaut null plutôt que de casser la génération', () => {
    expect(lireFicheRetouches('{ pas du json')).toBeNull();
    expect(lireFicheRetouches('{"id": "x", "langue": [{"avant": ""}]}')).toBeNull();
  });
});

describe('les fiches de la contothèque', () => {
  const ids = readdirSync('wiki/retouches').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

  it('se chargent et s’appliquent à chaque âge, sans extrait perdu', async () => {
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const f = await retouchesDuConte(id);
      expect(f, `${id} : lancez node tools/verifier-retouches.mjs`).not.toBeNull();
      expect(conteParId(id)?.corps, `${id} : la fiche du conte doit passer en « À jouer »`).toContain('**À jouer.**');
      const t = await texteDuConte(id);
      for (let age = 3; age <= 10; age++) {
        const r = appliquerRetouches(t, f!, age);
        expect(r.ok ? r.avertissements : r.erreurs, `${id} à ${age} ans`).toEqual([]);
      }
    }
  });

  it('le Petit Chaperon rouge : la mère-grand cachée à 4 ans, délivrée à 7, mangée à 10', async () => {
    const f = (await retouchesDuConte('fr-perrault-chaperon-rouge'))!;
    const t = await texteDuConte('fr-perrault-chaperon-rouge');
    const [a4, a7, a10] = [4, 7, 10].map((age) => texte(appliquerRetouches(t, f, age)));

    expect(a4).toContain('s’enfermer dans l’armoire');
    expect(a4).not.toMatch(/la dévora|et la mangea/);
    expect(a7).toContain('la dévora en moins de rien');
    expect(a7).toContain('bien vivantes');
    expect(a10).toMatch(/et la mangea\.$/);
    for (const version of [a4, a7, a10]) {
      expect(version).toContain('Tire la chevillette, la bobinette cherra');
      expect(version).not.toMatch(/seyait|heurte|bonne femme|déshabill/);
    }
  });
});
