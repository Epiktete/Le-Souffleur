// L'instanciation : d'un modèle du fonds à un spectacle de la famille, tout
// par le code (CDC §7) — accords annotés d'avance, fraction d'interactions,
// noms remplacés. Un modèle synthétique éprouve la mécanique ; le vrai
// Chaperon du fonds éprouve l'ordre des rôles sur ce que l'application sert.
import { describe, expect, it } from 'vitest';
import {
  adressesGardees,
  instancier,
  instancierModele,
  ErreurInstanciation,
} from '../src/services/instanciation';
import type { SpectacleModele } from '../src/services/banque';
import type { Marionnette } from '../src/types';

function peluche(id: string, nom: string, description: string, genre?: Marionnette['genre']): Marionnette {
  return {
    id,
    nom,
    description,
    traits: [],
    ...(genre ? { genre } : {}),
    creeLe: '2026-01-01T00:00:00.000Z',
    modifieLe: '2026-01-01T00:00:00.000Z',
  };
}

/** Un modèle minimal : un rôle masculin annoté, trois adresses au public. */
function modele(): SpectacleModele {
  return {
    id: 'fr-test--1',
    conteId: 'fr-test',
    titre: 'Le conte d’essai',
    pitch: 'Le loup {{r1}} rôde.',
    roles: [{
      cle: 'r1',
      espece: 'loup',
      famille: 'predateur',
      traits: [],
      genre: 'masculin',
      accords: {
        vers: 'feminin',
        remplacements: [{ id: 'a1e1:texte', avant: 'Il est gourmand', apres: 'Elle est gourmande' }],
      },
      especeMentions: [{ id: 'pitch', avant: 'Le loup', gabarit: '{Le} {espece}' }],
    }],
    parametres: {
      dureeMinutes: 5, ageAuditoire: 5, nbMarionnettistes: 1, interactionPublic: 'beaucoup',
    },
    tableaux: [{ id: 't1', titre: 'Le bois', description: 'Deux coussins.', accessoires: [], promptImage: '' }],
    actes: [{
      id: 'a1',
      numero: 1,
      titre: 'L’acte',
      tableauId: 't1',
      resume: 'Tout arrive.',
      elements: [
        { id: 'a1e1', type: 'conteur', texte: 'Il est gourmand, {{r1}}, et il rôde.' },
        { id: 'a1e2', type: 'adresse_public', marionnetteId: 'r1', texte: 'Vous m’avez vu ?', attenteReponse: true },
        { id: 'a1e3', type: 'adresse_public', marionnetteId: 'r1', texte: 'On crie avec moi ?', attenteReponse: true },
        { id: 'a1e4', type: 'adresse_public', marionnetteId: 'r1', texte: 'Encore plus fort !', attenteReponse: true },
        { id: 'a1e5', type: 'replique', marionnetteId: 'r1', texte: 'Miam.' },
      ],
    }],
    bible: {},
    dureeEstimeeSecondes: 300,
    interactionsOrdonnees: ['a1e2', 'a1e4', 'a1e3'],
  };
}

const TEXTE = (r: { spectacle: unknown }) => JSON.stringify(r.spectacle);

describe('instancierModele — les accords', () => {
  const distribution = [{ cle: 'r1', marionnetteId: 'louve' }];

  it('bascule les accords quand le genre de la peluche diffère du rôle', () => {
    const r = instancierModele(modele(), distribution, [
      peluche('louve', 'Louna', 'Une louve en peluche grise.'),
    ]);
    expect(r.avertissements).toEqual([]);
    expect(TEXTE(r)).toContain('Elle est gourmande, Louna');
    expect(TEXTE(r)).not.toContain('Il est gourmand');
  });

  it('ne touche à rien quand le genre correspond, ni quand il est inconnu', () => {
    const fidele = instancierModele(modele(), distribution, [
      peluche('louve', 'Grognard', 'Un loup en peluche grise.'),
    ]);
    expect(fidele.avertissements).toEqual([]);
    expect(TEXTE(fidele)).toContain('Il est gourmand');

    const muet = instancierModele(modele(), distribution, [
      { ...peluche('louve', 'Zig', ''), espece: 'loup' },
    ]);
    expect(muet.avertissements).toEqual([]);
    expect(TEXTE(muet)).toContain('Il est gourmand');
  });

  it('le choix « il / elle » de l’écran vaut genre, et le genre déclaré l’emporte', () => {
    const parChoix = instancierModele(modele(), distribution, [
      peluche('louve', 'Zig', ''),
    ], { genresChoisis: { r1: 'feminin' } });
    expect(TEXTE(parChoix)).toContain('Elle est gourmande');

    const declare = instancierModele(modele(), distribution, [
      peluche('louve', 'Zig', 'Un doudou tout simple.', 'feminin'),
    ]);
    expect(TEXTE(declare)).toContain('Elle est gourmande');
  });

  it('un modèle sans annotation, ou un extrait périmé : accords d’origine, et on le dit', () => {
    const sansAccords = modele();
    delete sansAccords.roles[0].accords;
    const a = instancierModele(sansAccords, distribution, [
      peluche('louve', 'Louna', 'Une louve en peluche grise.'),
    ]);
    expect(a.avertissements).toHaveLength(1);
    expect(TEXTE(a)).toContain('Il est gourmand');

    const perime = modele();
    perime.roles[0].accords!.remplacements[0].avant = 'texte disparu';
    const b = instancierModele(perime, distribution, [
      peluche('louve', 'Louna', 'Une louve en peluche grise.'),
    ]);
    expect(b.avertissements).toHaveLength(1);
    expect(TEXTE(b)).toContain('Il est gourmand');
  });
});

describe('instancierModele — l’espèce suit la peluche', () => {
  const distribution = [{ cle: 'r1', marionnetteId: 'x' }];

  it('rend la mention avec l’espèce et le genre déclarés', () => {
    const r = instancierModele(modele(), distribution, [
      peluche('x', 'Caramel', 'Toute douce.', 'feminin'),
    ].map((m) => ({ ...m, espece: 'ourse' })));
    expect(r.avertissements).toEqual([]);
    expect(r.spectacle.pitch).toBe('L’ourse Caramel rôde.');
    // Et les accords de genre suivent aussi.
    expect(TEXTE(r)).toContain('Elle est gourmande');
  });

  it('même espèce : rien ne bouge, accents compris', () => {
    const r = instancierModele(modele(), distribution, [
      { ...peluche('x', 'Grognard', 'Un loup gris.'), espece: 'loup' },
    ]);
    expect(r.spectacle.pitch).toBe('Le loup Grognard rôde.');
  });

  it('même espèce, autre genre déclaré : articles, adjectifs et pronoms suivent', () => {
    const m = modele();
    m.pitch = 'Un petit loup {{r1}} rôde.';
    m.roles[0].especeMentions = [{
      id: 'pitch', avant: 'Un petit loup', gabarit: '{Un} {petit|petite} {espece}',
    }];
    const r = instancierModele(m, distribution, [
      { ...peluche('x', 'Louna', '', 'feminin'), espece: 'loup' },
    ]);
    expect(r.avertissements).toEqual([]);
    expect(r.spectacle.pitch).toBe('Une petite loup Louna rôde.');
    expect(TEXTE(r)).toContain('Elle est gourmande, Louna');
  });

  it('emploie aussi le genre choisi pour les mentions, avec priorité au genre déclaré', () => {
    for (const espece of ['floub', 'flib']) {
      for (const declare of [undefined, 'masculin'] as const) {
        const m = modele();
        m.roles[0].espece = 'floub';
        m.pitch = 'Le floub {{r1}} rôde.';
        m.roles[0].especeMentions = [{ id: 'pitch', avant: 'Le floub', gabarit: '{Le} {espece}' }];
        const r = instancierModele(m, distribution, [
          { ...peluche('x', 'Zig', '', declare), espece },
        ], { genresChoisis: { r1: 'feminin' } });
        expect(r.avertissements).toEqual([]);
        expect(r.spectacle.pitch).toBe(`${declare ? 'Le' : 'La'} ${espece} Zig rôde.`);
        expect(TEXTE(r)).toContain(declare ? 'Il est gourmand' : 'Elle est gourmande');
      }
    }
  });

  it('espèce introuvable : le texte garde le mot d’origine, et on le dit', () => {
    const r = instancierModele(modele(), distribution, [
      peluche('x', 'Zig', ''),
    ]);
    expect(r.avertissements.join(' ')).toContain('Zig');
    expect(r.spectacle.pitch).toContain('Le loup');
  });
});

describe('instancierModele — les interactions', () => {
  const distribution = [{ cle: 'r1', marionnetteId: 'loup' }];
  const troupe = [peluche('loup', 'Grognard', 'Un loup en peluche grise.')];
  const adresses = (r: { spectacle: { actes: { elements: { type: string }[] }[] } }) =>
    r.spectacle.actes[0].elements.filter((e) => e.type === 'adresse_public').length;

  it('en garde la fraction du réglage : toutes, la moitié, aucune', () => {
    expect(adresses(instancierModele(modele(), distribution, troupe, { interactionPublic: 'beaucoup' }))).toBe(3);
    const quelques = instancierModele(modele(), distribution, troupe, { interactionPublic: 'quelques' });
    expect(adresses(quelques)).toBe(2);
    // Les plus précieuses restent : le classement dit a1e2 puis a1e4.
    expect(TEXTE(quelques)).toContain('Vous m’avez vu ?');
    expect(TEXTE(quelques)).toContain('Encore plus fort !');
    expect(TEXTE(quelques)).not.toContain('On crie avec moi ?');
    expect(adresses(instancierModele(modele(), distribution, troupe, { interactionPublic: 'aucune' }))).toBe(0);
  });

  it('recalcule la durée quand des adresses partent', () => {
    const toutes = instancierModele(modele(), distribution, troupe, { interactionPublic: 'beaucoup' });
    const aucune = instancierModele(modele(), distribution, troupe, { interactionPublic: 'aucune' });
    expect(aucune.spectacle.dureeEstimeeSecondes).toBeLessThan(toutes.spectacle.dureeEstimeeSecondes);
    expect(aucune.spectacle.parametres.interactionPublic).toBe('aucune');
  });

  it('la moitié, arrondie au-dessus', () => {
    expect(adressesGardees(3, 'quelques')).toBe(2);
    expect(adressesGardees(4, 'quelques')).toBe(2);
    expect(adressesGardees(1, 'quelques')).toBe(1);
    expect(adressesGardees(5, 'aucune')).toBe(0);
    expect(adressesGardees(5, 'beaucoup')).toBe(5);
  });
});

describe('instancier — sur le vrai fonds', () => {
  it('peuple le Chaperon dans l’ordre des rôles, sans variable restante', async () => {
    const { spectacle, avertissements } = await instancier(
      'fr-perrault-chaperon-rouge--1',
      [
        { cle: 'r1', marionnetteId: 'poupee' },
        { cle: 'r2', marionnetteId: 'loup' },
        { cle: 'r3', marionnetteId: 'mamie' },
      ],
      [
        peluche('poupee', 'Câline', 'Une poupée de chiffon en robe rouge.'),
        peluche('loup', 'Croc-Blanc', 'Un loup en peluche grise.'),
        peluche('mamie', 'Nona', 'Une marionnette de grand-mère en tissu.'),
      ],
    );

    expect(avertissements).toEqual([]);
    expect(spectacle.statut).toBe('complet');
    expect(spectacle.distribution.map((m) => m.nom)).toEqual(['Câline', 'Croc-Blanc', 'Nona']);
    const texte = JSON.stringify(spectacle);
    expect(texte).not.toContain('{{');
    expect(texte).toContain('Câline');
  });

  it('bascule les accords sur le vrai fonds : une louve joue le loup', async () => {
    const { spectacle, avertissements } = await instancier(
      'fr-perrault-chaperon-rouge--1',
      [
        { cle: 'r1', marionnetteId: 'poupee' },
        { cle: 'r2', marionnetteId: 'louve' },
        { cle: 'r3', marionnetteId: 'mamie' },
      ],
      [
        peluche('poupee', 'Câline', 'Une poupée de chiffon en robe rouge.'),
        peluche('louve', 'Louna', 'Une louve en peluche grise.'),
        peluche('mamie', 'Nona', 'Une marionnette de grand-mère en tissu.'),
      ],
    );

    expect(avertissements).toEqual([]);
    // L'annotation écrit « à la louve {{r2}} » : le mot d'espèce suit le genre.
    expect(spectacle.pitch).toContain('la louve Louna');
    // Le TEXTE JOUÉ est accordé ; la bible, jamais jouée ni affichée, garde
    // volontairement les accords d'origine — on ne la fouille donc pas.
    const joue = JSON.stringify({ actes: spectacle.actes, distribution: spectacle.distribution });
    expect(joue).not.toContain('au loup Louna');
    expect(joue).not.toContain('compère Louna');
    expect(joue).toContain('commère Louna');
  });

  it('met le conte coréen à l’espèce des peluches : un loup joue le tigre', async () => {
    const { spectacle, avertissements } = await instancier(
      'ko-vieux-moustaches-et-lapin--1',
      [
        { cle: 'r1', marionnetteId: 'souris' },
        { cle: 'r2', marionnetteId: 'loup' },
      ],
      [
        { ...peluche('souris', 'Perle', 'Une petite souris grise.'), espece: 'souris' },
        { ...peluche('loup', 'Grognard', 'Un loup en peluche.'), espece: 'loup' },
      ],
    );
    expect(avertissements).toEqual([]);
    const joue = JSON.stringify({ pitch: spectacle.pitch, actes: spectacle.actes });
    expect(joue).toContain('énorme loup');
    expect(joue).toContain('les autres loups');
    expect(joue).toContain('la petite souris');
    expect(joue).not.toContain('tigre');
    expect(joue).not.toContain('lapin');
  });

  it('refuse proprement un modèle inconnu', async () => {
    await expect(instancier('nexiste-pas--1', [], []))
      .rejects.toBeInstanceOf(ErreurInstanciation);
  });
});
