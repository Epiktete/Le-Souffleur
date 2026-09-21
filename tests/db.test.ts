// Le critère d'acceptation de l'étape 2 est « une marionnette créée est toujours
// là après rechargement ». Ces tests vérifient la couche qui le garantit :
// écriture, relecture, et persistance après fermeture puis réouverture.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ecrireReglage,
  enregistrerMarionnette,
  fermerBase,
  lireMarionnette,
  lireReglage,
  listerMarionnettes,
  nouvelId,
  oublierReglage,
  supprimerMarionnette,
} from '../src/services/db';
import type { Marionnette } from '../src/types';

function marionnetteDeTest(nom: string): Marionnette {
  const maintenant = new Date().toISOString();
  return {
    id: nouvelId(),
    nom,
    description: 'Une peluche de test.',
    traits: ['gentil'],
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}

beforeEach(async () => {
  await fermerBase();
  indexedDB.deleteDatabase('le-souffleur');
});

describe('marionnettes', () => {
  it('enregistre puis relit une marionnette', async () => {
    const m = await enregistrerMarionnette(marionnetteDeTest('Doudou Lapin'));
    const relue = await lireMarionnette(m.id);
    expect(relue?.nom).toBe('Doudou Lapin');
    expect(relue?.traits).toEqual(['gentil']);
  });

  it('survit à la fermeture de la base, comme à un rechargement de page', async () => {
    const m = await enregistrerMarionnette(marionnetteDeTest('Renard Rusé'));
    await fermerBase();
    const relue = await lireMarionnette(m.id);
    expect(relue?.nom).toBe('Renard Rusé');
  });

  it('met à jour la date de modification à chaque enregistrement', async () => {
    const m = marionnetteDeTest('Ourse Gourmande');
    m.modifieLe = '2020-01-01T00:00:00.000Z';
    const enregistree = await enregistrerMarionnette(m);
    expect(enregistree.modifieLe).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('liste les marionnettes de la plus récemment modifiée à la plus ancienne', async () => {
    await enregistrerMarionnette(marionnetteDeTest('Première'));
    await new Promise((r) => setTimeout(r, 2)); // horodatages distincts
    await enregistrerMarionnette(marionnetteDeTest('Seconde'));
    const noms = (await listerMarionnettes()).map((m) => m.nom);
    expect(noms).toEqual(['Seconde', 'Première']);
  });

  it('supprime une marionnette', async () => {
    const m = await enregistrerMarionnette(marionnetteDeTest('À supprimer'));
    await supprimerMarionnette(m.id);
    expect(await lireMarionnette(m.id)).toBeUndefined();
  });
});

describe('réglages', () => {
  it('écrit puis relit les réglages du studio', async () => {
    await ecrireReglage('studio', {
      dureeMinutes: 5,
      ageAuditoire: 6,
      nbMarionnettistes: 1,
      interactionPublic: 'beaucoup',
      marionnetteIds: [],
      ebauche: '',
    });
    const relus = await lireReglage('studio');
    expect(relus?.dureeMinutes).toBe(5);
    expect(relus?.interactionPublic).toBe('beaucoup');
  });

  it('renvoie undefined pour un réglage absent', async () => {
    expect(await lireReglage('ia')).toBeUndefined();
  });

  it('oublie un réglage sur demande, ce qui sert au bouton « Oublier la clé »', async () => {
    await ecrireReglage('ia', {
      fournisseurId: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      modele: 'openai/gpt-4o-mini',
    });
    await oublierReglage('ia');
    expect(await lireReglage('ia')).toBeUndefined();
  });
});
