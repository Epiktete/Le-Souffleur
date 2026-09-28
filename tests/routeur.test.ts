// Le routage doit être stable : c'est lui qui fait fonctionner le bouton retour.
import { describe, expect, it } from 'vitest';
import { analyserFragment, fragmentDe, type Route } from '../src/services/routeur';

describe('analyserFragment', () => {
  it('sans fragment, l’accueil est la Contothèque (décision du 2026-09-28)', () => {
    for (const f of ['', '#', '#/', '#/banque', '/banque', 'banque']) {
      expect(analyserFragment(f)).toEqual({ nom: 'accueil', mode: 'banque' });
    }
  });

  it('reconnaît le mode studio de l’accueil', () => {
    for (const f of ['#/studio', '/studio', 'studio', '#/studio/']) {
      expect(analyserFragment(f)).toEqual({ nom: 'accueil', mode: 'studio' });
    }
  });

  it('reconnaît l’écran de script d’un spectacle', () => {
    expect(analyserFragment('#/spectacle/abc-123')).toEqual({
      nom: 'script',
      spectacleId: 'abc-123',
    });
  });

  it('reconnaît le mode spectacle', () => {
    expect(analyserFragment('#/spectacle/abc-123/jouer')).toEqual({
      nom: 'jouer',
      spectacleId: 'abc-123',
    });
  });

  it('reconnaît les paramètres IA', () => {
    expect(analyserFragment('#/parametres')).toEqual({ nom: 'parametres' });
  });

  it('signale une adresse inconnue au lieu de planter', () => {
    expect(analyserFragment('#/nimporte-quoi')).toEqual({
      nom: 'introuvable',
      fragment: 'nimporte-quoi',
    });
    // Un spectacle sans identifiant n'est pas une route valide.
    expect(analyserFragment('#/spectacle').nom).toBe('introuvable');
    // Une action inconnue sur un spectacle non plus.
    expect(analyserFragment('#/spectacle/abc/danser').nom).toBe('introuvable');
  });
});

describe('fragmentDe', () => {
  it('fait l’aller-retour avec analyserFragment', () => {
    const routes: Route[] = [
      { nom: 'accueil', mode: 'studio' },
      { nom: 'accueil', mode: 'banque' },
      { nom: 'parametres' },
      { nom: 'script', spectacleId: 'abc-123' },
      { nom: 'jouer', spectacleId: 'abc-123' },
    ];
    for (const route of routes) {
      expect(analyserFragment(fragmentDe(route))).toEqual(route);
    }
  });
});
