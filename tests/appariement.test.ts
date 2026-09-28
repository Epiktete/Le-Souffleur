// L'appariement du mode Banque : les filtres et le pseudo-conte (CDC §7).
import { describe, expect, it } from 'vitest';
import { evaluerModele, conteDeSignature, type ReglagesFiltre } from '../src/services/appariement';
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
    // La souris… pardon : chaque peluche sur le rôle qui lui ressemble.
    expect(e.distribution!.map((a) => a.marionnetteNom)).toEqual(['Rosette', 'Grognard', 'Mamie Rose']);
  });

  it('écarte un spectacle trop long, la tolérance de 20 % comprise', () => {
    // 6 min de cible : 7 min 12 s passent encore, 7 min 13 s non.
    const juste = evaluerModele(
      signature({ dureeEstimeeSecondes: 432 }), TROUPE, REGLAGES, OPTIONS,
    );
    expect(juste.ecarts).toEqual([]);
    const trop = evaluerModele(
      signature({ dureeEstimeeSecondes: 433 }), TROUPE, REGLAGES, OPTIONS,
    );
    expect(trop.ecarts).toContain('duree');
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
