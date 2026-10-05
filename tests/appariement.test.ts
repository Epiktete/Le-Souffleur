// L'appariement du mode Banque : les filtres et le pseudo-conte (CDC §7).
import { describe, expect, it } from 'vitest';
import {
  conteDeSignature,
  evaluerModele,
  genreMarionnette,
  problemeAttribution,
  type ReglagesFiltre,
} from '../src/services/appariement';
import type { SignatureModele } from '../src/services/banque';
import type { Marionnette } from '../src/types';

function peluche(nom: string, description: string, traits: string[] = []): Marionnette {
  return {
    id: nom.toLowerCase().replace(/\s+/g, '-'),
    nom,
    description,
    traits,
    creeLe: '2026-01-01T00:00:00.000Z',
    modifieLe: '2026-01-01T00:00:00.000Z',
  };
}

/** Une signature comme celle du Chaperon : poupée, loup, grand-mère. */
function signature(surcharge: Partial<SignatureModele> = {}): SignatureModele {
  return {
    id: 'fr-test--1',
    conteId: 'fr-test',
    titre: 'Le conte d’essai',
    dureeMinutes: 6,
    ageAuditoire: 5,
    nbMarionnettistes: 1,
    interactionPublic: 'quelques',
    dureeEstimeeSecondes: 6 * 60,
    roles: [
      { cle: 'r1', espece: 'poupee', famille: 'enfant', traits: ['curieux', 'gentil'] },
      { cle: 'r2', espece: 'loup', famille: 'predateur', traits: ['méchant', 'gourmand'] },
      { cle: 'r3', espece: 'mamie', famille: 'vieux', traits: ['sage', 'gentil'] },
    ],
    ...surcharge,
  };
}

const TROUPE = [
  peluche('Rosette', 'Une poupée de chiffon en robe rouge.', ['curieux', 'gentil']),
  peluche('Grognard', 'Un loup en peluche grise.', ['méchant', 'gourmand']),
  peluche('Mamie Rose', 'Une marionnette de grand-mère en tissu.', ['sage', 'gentil']),
];

const REGLAGES: ReglagesFiltre = { dureeMinutes: 6, ageAuditoire: 5, nbMarionnettistes: 1 };
const OPTIONS = { facultatives: false };

describe('evaluerModele', () => {
  it('accepte un spectacle qui passe tout, avec sa distribution dans l’ordre des rôles', () => {
    const e = evaluerModele(signature(), TROUPE, REGLAGES, OPTIONS);
    expect(e.ecarts).toEqual([]);
    expect(e.distribution).not.toBeNull();
    // Chaque peluche sur le rôle qui lui ressemble, dans l'ordre r1, r2, r3.
    expect(e.distribution).toEqual([
      { cle: 'r1', marionnetteId: 'rosette' },
      { cle: 'r2', marionnetteId: 'grognard' },
      { cle: 'r3', marionnetteId: 'mamie-rose' },
    ]);
  });

  it('écarte un spectacle plus long que la cible : « un temps inférieur ou égal »', () => {
    const juste = evaluerModele(
      signature({ dureeEstimeeSecondes: 360 }), TROUPE, REGLAGES, OPTIONS,
    );
    expect(juste.ecarts).toEqual([]);
    const trop = evaluerModele(
      signature({ dureeEstimeeSecondes: 361 }), TROUPE, REGLAGES, OPTIONS,
    );
    expect(trop.ecarts).toContain('duree');
  });

  it('scène garnie de plus de marionnettes que de rôles : le spectacle s’affiche quand même', () => {
    const troupeLarge = [
      ...TROUPE,
      peluche('Pilou le Pingouin', 'Un pingouin noir et blanc.', ['curieux']),
    ];
    // facultatives: false = scène garnie ; la quatrième reste au placard.
    const e = evaluerModele(signature(), troupeLarge, REGLAGES, { facultatives: false });
    expect(e.ecarts).toEqual([]);
    expect(e.distribution).toHaveLength(3);
  });

  it('écarte un spectacle pour plus grands que l’âge réglé', () => {
    const e = evaluerModele(signature({ ageAuditoire: 7 }), TROUPE, REGLAGES, OPTIONS);
    expect(e.ecarts).toContain('age');
    // À 7 ans réglés, il repasse : l'âge du fonds est un minimum conseillé.
    const ok = evaluerModele(
      signature({ ageAuditoire: 7 }), TROUPE, { ...REGLAGES, ageAuditoire: 8 }, OPTIONS,
    );
    expect(ok.ecarts).toEqual([]);
  });

  it('écarte un spectacle à deux marionnettistes quand le réglage n’en donne qu’un', () => {
    const e = evaluerModele(signature({ nbMarionnettistes: 2 }), TROUPE, REGLAGES, OPTIONS);
    expect(e.ecarts).toContain('marionnettistes');
  });

  it('écarte un spectacle qui demande plus de marionnettes que la troupe', () => {
    const e = evaluerModele(signature(), TROUPE.slice(0, 2), REGLAGES, OPTIONS);
    expect(e.ecarts).toContain('nombre');
  });

  it('écarte un spectacle déjà fait par cette famille', () => {
    const e = evaluerModele(signature(), TROUPE, REGLAGES, {
      ...OPTIONS,
      dejaJoues: new Set(['fr-test--1']),
    });
    expect(e.ecarts).toContain('dejaJoue');
  });

  it('écarte un spectacle sans distribution possible : une tortue ne joue pas le loup', () => {
    const douce = [
      peluche('Mémé Tortue', 'Une tortue verte à la carapace molle.', ['sage']),
    ];
    const roleDeLoup = signature({
      roles: [
        { cle: 'r1', espece: 'loup', famille: 'predateur', traits: ['méchant'] },
      ],
    });
    const e = evaluerModele(roleDeLoup, douce, REGLAGES, OPTIONS);
    expect(e.ecarts).toEqual(['distribution']);
    expect(e.distribution).toBeNull();
  });

  it('scène vide : les marionnettes en trop restent au placard', () => {
    const marionnetheque = [
      ...TROUPE,
      peluche('Pilou le Pingouin', 'Un pingouin noir et blanc.', ['curieux']),
    ];
    const e = evaluerModele(signature(), marionnetheque, REGLAGES, { facultatives: true });
    expect(e.ecarts).toEqual([]);
    expect(e.distribution).toHaveLength(3);
  });

  it('cumule les écarts pour que le compte des raisons soit juste', () => {
    const e = evaluerModele(
      signature({ ageAuditoire: 9, dureeEstimeeSecondes: 20 * 60 }),
      TROUPE, REGLAGES, OPTIONS,
    );
    expect(e.ecarts).toContain('age');
    expect(e.ecarts).toContain('duree');
  });
});

describe('problemeAttribution', () => {
  it('refuse la bête douce sur le prédateur, accepte le loup', () => {
    const role = { cle: 'r1', espece: 'loup', famille: 'predateur' as const, traits: ['méchant'] };
    expect(problemeAttribution(
      peluche('Mémé Tortue', 'Une tortue verte à la carapace molle.'), role,
    )).toBe('interdit');
    expect(problemeAttribution(
      peluche('Grognard', 'Un loup en peluche grise.'), role,
    )).toBe(null);
  });

  it('exige la même espèce quand elle est imposée — au genre près', () => {
    const role = {
      cle: 'r1', espece: 'loup', famille: 'predateur' as const, traits: [], especeImposee: true,
    };
    expect(problemeAttribution(
      peluche('Rex', 'Un gros chien en peluche.'), role,
    )).toBe('espece');
    expect(problemeAttribution(
      peluche('Grognard', 'Un loup en peluche grise.'), role,
    )).toBe(null);
    // La louve passe : la création sait écrire « la louve » sur ce rôle.
    expect(problemeAttribution(
      peluche('Louna', 'Une louve en peluche grise.'), role,
    )).toBe(null);
  });
});

describe('l’espèce imposée', () => {
  it('écarte le spectacle quand la troupe n’a pas l’espèce nommée', () => {
    const citee = signature({
      roles: [
        { cle: 'r1', espece: 'poupee', famille: 'enfant', traits: [] },
        { cle: 'r2', espece: 'loup', famille: 'predateur', traits: [], especeImposee: true },
        { cle: 'r3', espece: 'mamie', famille: 'vieux', traits: [] },
      ],
    });
    const sansLoup = [
      TROUPE[0],
      peluche('Rex', 'Un gros chien en peluche.', ['méchant']),
      TROUPE[2],
    ];
    const e = evaluerModele(citee, sansLoup, REGLAGES, OPTIONS);
    expect(e.ecarts).toEqual(['espece']);

    // Avec le loup, tout va bien, et c'est lui qui reçoit le rôle.
    const ok = evaluerModele(citee, TROUPE, REGLAGES, OPTIONS);
    expect(ok.ecarts).toEqual([]);
    expect(ok.distribution![1]).toEqual({ cle: 'r2', marionnetteId: 'grognard' });
  });
});

describe('genreMarionnette', () => {
  it('lit le genre dans le nom, puis la description, puis l’article', () => {
    expect(genreMarionnette(peluche('Ourse Gourmande', 'Très douce.'))).toBe('feminin');
    expect(genreMarionnette(peluche('Grognard', 'Un loup en peluche grise.'))).toBe('masculin');
    // Ni le nom ni un mot sûr : le premier article de la description tranche.
    expect(genreMarionnette(peluche('Zébulon', 'Une peluche rayée toute douce.'))).toBe('feminin');
  });

  it('le mot sûr l’emporte sur l’article', () => {
    expect(genreMarionnette(peluche('Doudou', 'Un doudou en forme de souris grise.'))).toBe('feminin');
  });

  it('répond null quand rien ne le dit, plutôt que de deviner', () => {
    expect(genreMarionnette({ nom: 'Zig', description: '' })).toBe(null);
  });

  it('le genre déclaré à la création l’emporte sur tout', () => {
    // Un ours en peluche dont la famille dit « elle » : la famille a raison.
    expect(genreMarionnette({
      nom: 'Grand Ours', description: 'Un ours brun massif.', genre: 'feminin',
    })).toBe('feminin');
  });

  it('l’espèce déclarée parle aussi pour le genre', () => {
    expect(genreMarionnette({
      nom: 'Caramel', description: 'Toute douce.', espece: 'ourse',
    })).toBe('feminin');
  });
});

describe('conteDeSignature', () => {
  it('rend un rôle neutre pour une espèce inconnue : jouable par tout le monde', () => {
    const dieu = signature({
      roles: [{ cle: 'r1', espece: null, famille: null, traits: ['sage', 'farceur'] }],
    });
    const conte = conteDeSignature(dieu);
    expect(conte.roles[0].categorie).toBe('animal');
    const e = evaluerModele(dieu, [TROUPE[0]], REGLAGES, OPTIONS);
    expect(e.ecarts).toEqual([]);
  });
});
