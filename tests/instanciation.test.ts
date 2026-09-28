// L'instanciation : d'un modèle du fonds à un spectacle de la famille (CDC §7).
// Sur un VRAI modèle du fonds, pour que l'ordre distribution → rôles soit
// éprouvé sur ce que l'application servira.
import { describe, expect, it } from 'vitest';
import { instancier, ErreurInstanciation } from '../src/services/instanciation';
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

const MARIONNETHEQUE = [
  peluche('poupee', 'Câline', 'Une poupée de chiffon en robe rouge.'),
  peluche('loup', 'Croc-Blanc', 'Un loup en peluche grise.'),
  peluche('mamie', 'Nona', 'Une marionnette de grand-mère en tissu.'),
];

describe('instancier', () => {
  it('peuple un modèle du fonds dans l’ordre des rôles, sans variable restante', async () => {
    const spectacle = await instancier(
      'fr-perrault-chaperon-rouge--1',
      [
        { cle: 'r1', marionnetteId: 'poupee' },
        { cle: 'r2', marionnetteId: 'loup' },
        { cle: 'r3', marionnetteId: 'mamie' },
      ],
      MARIONNETHEQUE,
    );

    expect(spectacle.statut).toBe('complet');
    expect(spectacle.distribution.map((m) => m.nom)).toEqual(['Câline', 'Croc-Blanc', 'Nona']);

    const texte = JSON.stringify(spectacle);
    expect(texte).not.toContain('{{');
    expect(texte).toContain('Câline');
    expect(texte).toContain('Croc-Blanc');
  });

  it('refuse proprement un modèle inconnu', async () => {
    await expect(instancier('nexiste-pas--1', [], MARIONNETHEQUE))
      .rejects.toBeInstanceOf(ErreurInstanciation);
  });
});
