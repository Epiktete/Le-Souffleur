// L'instanciation : d'un modèle du fonds à un spectacle de la famille (CDC §7).
// Sur un VRAI modèle du fonds, pour que l'ordre distribution → rôles et la
// détection des divergences soient éprouvés sur ce que l'application servira.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appliquerRemplacements,
  divergences,
  instancier,
  lignesJouees,
  ErreurInstanciation,
  type LigneJouee,
} from '../src/services/instanciation';
import { chargerModele, peupler } from '../src/services/banque';
import type { Acces } from '../src/services/connecteurIa';
import type { Marionnette } from '../src/types';

function peluche(id: string, nom: string, description: string): Marionnette {
  return {
    id,
    nom,
    description,
    traits: [],
    creeLe: '2026-01-01T00:00:00.000Z',
    modifieLe: '2026-01-01T00:00:00.000Z',
  };
}

/** La même distribution que l'original du fonds : rien ne diverge. */
const FIDELES = [
  peluche('poupee', 'Câline', 'Une poupée de chiffon en robe rouge.'),
  peluche('loup', 'Croc-Blanc', 'Un loup en peluche grise.'),
  peluche('mamie', 'Nona', 'Une marionnette de grand-mère en tissu.'),
];

const CHAPERON = 'fr-perrault-chaperon-rouge--1';
const DISTRIBUTION = [
  { cle: 'r1', marionnetteId: 'poupee' },
  { cle: 'r2', marionnetteId: 'loup' },
  { cle: 'r3', marionnetteId: 'mamie' },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe('instancier', () => {
  it('peuple un modèle du fonds dans l’ordre des rôles, sans variable restante ni appel', async () => {
    const { spectacle, retouche } = await instancier(CHAPERON, DISTRIBUTION, FIDELES);

    expect(retouche).toBe('aucune');
    expect(spectacle.statut).toBe('complet');
    expect(spectacle.distribution.map((m) => m.nom)).toEqual(['Câline', 'Croc-Blanc', 'Nona']);

    const texte = JSON.stringify(spectacle);
    expect(texte).not.toContain('{{');
    expect(texte).toContain('Câline');
    expect(texte).toContain('Croc-Blanc');
  });

  it('sans clé, une divergence de genre donne « sansCle » : créable, mais dit', async () => {
    // Une louve sur le rôle écrit pour un loup : le genre diverge.
    const troupe = [
      FIDELES[0],
      peluche('louve', 'Louna', 'Une louve en peluche grise.'),
      FIDELES[2],
    ];
    const distribution = [...DISTRIBUTION];
    distribution[1] = { cle: 'r2', marionnetteId: 'louve' };

    const { retouche } = await instancier(CHAPERON, distribution, troupe);
    expect(retouche).toBe('sansCle');
  });

  it('avec un accès, la retouche appelle le modèle une fois et s’applique', async () => {
    const appels: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      appels.push(JSON.parse(init.body));
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"remplacements": []}' }, finish_reason: 'stop' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const troupe = [
      FIDELES[0],
      peluche('louve', 'Louna', 'Une louve en peluche grise.'),
      FIDELES[2],
    ];
    const distribution = [...DISTRIBUTION];
    distribution[1] = { cle: 'r2', marionnetteId: 'louve' };
    const acces: Acces = {
      baseUrl: 'https://openrouter.test/v1', cle: 'x', modele: 'grand', fournisseurId: 'openrouter',
    };

    const { retouche } = await instancier(CHAPERON, distribution, troupe, { acces });
    expect(retouche).toBe('faite');
    expect(appels).toHaveLength(1);
    // Chez OpenRouter, c'est le petit modèle de retouche qui est appelé.
    expect((appels[0] as { model: string }).model).toContain('mistral');
  });

  it('une correction qui ne correspond pas au texte refuse toute la retouche', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      choices: [{
        message: { content: '{"remplacements": [{"id": "L1", "avant": "texte qui n’existe pas", "apres": "x"}]}' },
        finish_reason: 'stop',
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const troupe = [
      FIDELES[0],
      peluche('louve', 'Louna', 'Une louve en peluche grise.'),
      FIDELES[2],
    ];
    const distribution = [...DISTRIBUTION];
    distribution[1] = { cle: 'r2', marionnetteId: 'louve' };
    const acces: Acces = {
      baseUrl: 'https://openrouter.test/v1', cle: 'x', modele: 'grand', fournisseurId: 'openrouter',
    };

    const { retouche, spectacle } = await instancier(CHAPERON, distribution, troupe, { acces });
    expect(retouche).toBe('refusee');
    // Le spectacle est rendu tel quel, jamais à moitié accordé.
    expect(JSON.stringify(spectacle)).toContain('Louna');
  });

  it('refuse proprement un modèle inconnu', async () => {
    await expect(instancier('nexiste-pas--1', [], FIDELES))
      .rejects.toBeInstanceOf(ErreurInstanciation);
  });
});

describe('divergences', () => {
  it('ne signale rien quand genre et espèce correspondent', async () => {
    const modele = (await chargerModele(CHAPERON))!;
    const spectacle = peupler(modele, FIDELES);
    const texte = lignesJouees(spectacle).map((l) => l.lire()).join('\n');
    expect(divergences(modele, FIDELES, texte)).toEqual([]);
  });

  it('signale un genre qui change, et un genre inconnu répondu à l’écran', async () => {
    const modele = (await chargerModele(CHAPERON))!;
    const troupe = [
      FIDELES[0],
      // Rien ne dit le genre de « Gribouille » : c'est le choix « il / elle »
      // de l'écran qui tranche.
      peluche('gribouille', 'Gribouille', 'Une peluche grise toute simple.'),
      FIDELES[2],
    ];
    const spectacle = peupler(modele, troupe);
    const texte = lignesJouees(spectacle).map((l) => l.lire()).join('\n');

    // Sans réponse : accords d'origine pour ce rôle, rien à retoucher…
    // sauf l'espèce : le loup est nommé dans le texte, Gribouille n'en est pas un.
    const sansReponse = divergences(modele, troupe, texte);
    expect(sansReponse.join(' ')).toContain('Gribouille');
    // Avec la réponse « elle », le genre s'ajoute à la divergence.
    const avecReponse = divergences(modele, troupe, texte, { r2: 'feminin' });
    expect(avecReponse.join(' ')).toContain('féminin');
  });
});

describe('appliquerRemplacements', () => {
  function ligne(id: string, texte: string): LigneJouee & { valeur: () => string } {
    let v = texte;
    return { id, lire: () => v, ecrire: (t) => { v = t; }, valeur: () => v };
  }

  it('applique tout, ou rien : un introuvable annule même ce qui précède', () => {
    const a = ligne('L1', 'Le grand loup gris.');
    const b = ligne('L2', 'Il entre.');
    const ok = appliquerRemplacements([a, b], [
      { id: 'L1', avant: 'grand loup', apres: 'grande louve' },
      { id: 'L2', avant: 'Elle sort.', apres: 'x' },
    ]);
    expect(ok).toBe(false);
    expect(a.valeur()).toBe('Le grand loup gris.');
  });

  it('remplace dans la bonne ligne, toutes les occurrences de l’extrait', () => {
    const a = ligne('L1', 'Il dort. Il ronfle.');
    const ok = appliquerRemplacements([a], [{ id: 'L1', avant: 'Il ', apres: 'Elle ' }]);
    expect(ok).toBe(true);
    expect(a.valeur()).toBe('Elle dort. Elle ronfle.');
  });
});
