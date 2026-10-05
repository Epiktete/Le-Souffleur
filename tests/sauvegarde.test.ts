// Sauvegarde (CDC §12), et le test minimum du §13 : « aller-retour export
// puis import ». Les données ne vivent que dans le navigateur : ce fichier est
// la seule chose qui les sauve d'un nettoyage de l'historique.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ecrireReglage,
  enregistrerMarionnette,
  enregistrerSpectacle,
  fermerBase,
  lireReglage,
  listerMarionnettes,
  listerSpectacles,
} from '../src/services/db';
import {
  exporterSpectacle,
  exporterTout,
  importer,
  lireSauvegarde,
  nomDeFichier,
} from '../src/services/sauvegarde';
import type { Marionnette, Spectacle } from '../src/types';

const marionnette = (id: string, nom: string): Marionnette =>
  ({ id, nom, description: '', traits: ['gentil'], creeLe: '2026-01-01', modifieLe: '2026-01-01' });

const spectacle = (id: string, titre: string, m: Marionnette): Spectacle => ({
  id,
  titre,
  pitch: '',
  parametres: {
    dureeMinutes: 5, ageAuditoire: 5, nbMarionnettistes: 1,
    interactionPublic: 'quelques', marionnetteIds: [m.id], modele: 'essai',
  },
  distribution: [{ ...m }],
  tableaux: [{ id: 't1', titre: 'La forêt', description: '', accessoires: [], promptImage: '' }],
  actes: [{
    id: 'a1', numero: 1, titre: 'Acte 1', tableauId: 't1', resume: '',
    elements: [{ id: 'e1', type: 'replique', marionnetteId: m.id, texte: 'Bonjour.' }],
  }],
  dureeEstimeeSecondes: 60,
  statut: 'complet',
  bible: {},
  creeLe: '2026-01-01',
  modifieLe: '2026-01-01',
});

beforeEach(async () => {
  await fermerBase();
  indexedDB.deleteDatabase('le-souffleur');
});

/** Remplit la base comme un parent l'aurait fait, clé mémorisée comprise. */
async function remplir() {
  const lapin = await enregistrerMarionnette(marionnette('m1', 'Doudou Lapin'));
  await enregistrerSpectacle(spectacle('s1', 'La Carotte', lapin));
  await ecrireReglage('ia', {
    fournisseurId: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', modele: 'x', cle: 'sk-secret',
  });
  await ecrireReglage('taillePrompteur', 52);
}

describe('export', () => {
  it('contient tout, sauf la clé API', async () => {
    await remplir();
    const s = await exporterTout();
    expect(s.format).toBe('le-souffleur');
    expect(s.marionnettes.map((m) => m.nom)).toEqual(['Doudou Lapin']);
    expect(s.spectacles.map((x) => x.titre)).toEqual(['La Carotte']);
    expect(JSON.stringify(s)).not.toContain('sk-secret');
    expect(s.reglages.find((r) => r.cle === 'ia')?.valeur).toMatchObject({ modele: 'x' });
  });

  it('exporte un seul spectacle, avec sa distribution, sans réglages', () => {
    const m = marionnette('m1', 'Doudou Lapin');
    const s = exporterSpectacle(spectacle('s1', 'La Carotte', m));
    expect(s.spectacles).toHaveLength(1);
    expect(s.spectacles[0].distribution[0].nom).toBe('Doudou Lapin');
    expect(s.marionnettes).toEqual([]);
    expect(s.reglages).toEqual([]);
  });

  it('nomme le fichier de façon reconnaissable', () => {
    expect(nomDeFichier('Le Paysan, l’Ours et le Renard', new Date('2026-09-26T10:00:00Z')))
      .toBe('le-souffleur-le-paysan-l-ours-et-le-renard-2026-09-26.json');
  });
});

describe('aller-retour export puis import', () => {
  it('restitue tout dans un navigateur vierge', async () => {
    await remplir();
    const texte = JSON.stringify(await exporterTout());

    // Un autre navigateur : la base est vide.
    await fermerBase();
    indexedDB.deleteDatabase('le-souffleur');

    const lu = lireSauvegarde(texte);
    expect(lu.ok).toBe(true);
    if (!lu.ok) return;
    expect(lu.apercu).toMatchObject({ marionnettes: 1, spectacles: 1, titres: ['La Carotte'] });

    const bilan = await importer(lu.sauvegarde, 'remplacer');
    expect(bilan).toEqual({ marionnettes: 1, spectacles: 1, ignores: 0 });
    expect((await listerMarionnettes()).map((m) => m.nom)).toEqual(['Doudou Lapin']);
    const [s] = await listerSpectacles();
    expect(s.actes[0].elements[0]).toMatchObject({ texte: 'Bonjour.' });
    expect(await lireReglage('taillePrompteur')).toBe(52);
    // La clé n'a pas voyagé.
    expect((await lireReglage('ia'))?.cle).toBeUndefined();
  });
});

describe('import', () => {
  it('« ajouter » garde ce qui existe et n’ajoute que ce qui manque', async () => {
    await remplir();
    const lu = lireSauvegarde(JSON.stringify({
      ...(await exporterTout()),
      marionnettes: [marionnette('m1', 'Autre nom'), marionnette('m2', 'Renard Rusé')],
    }));
    if (!lu.ok) throw new Error('illisible');
    const bilan = await importer(lu.sauvegarde, 'ajouter');
    expect(bilan).toEqual({ marionnettes: 1, spectacles: 0, ignores: 2 });
    const noms = (await listerMarionnettes()).map((m) => m.nom).sort();
    // « m1 » garde son nom d'ici : un doublon d'identifiant est ignoré.
    expect(noms).toEqual(['Doudou Lapin', 'Renard Rusé']);
    // Ajouter ne touche pas aux réglages, et la clé d'ici reste.
    expect((await lireReglage('ia'))?.cle).toBe('sk-secret');
  });

  it('« remplacer » efface l’ancien, mais garde la clé de ce navigateur', async () => {
    await remplir();
    const lu = lireSauvegarde(JSON.stringify({
      format: 'le-souffleur', versionSchema: 1, exporteLe: '2026-09-26',
      marionnettes: [marionnette('m9', 'Mémé Tortue')], spectacles: [],
      reglages: [{ cle: 'ia', valeur: { fournisseurId: 'openai', baseUrl: 'https://api.openai.com/v1', modele: 'y' } }],
    }));
    if (!lu.ok) throw new Error('illisible');
    await importer(lu.sauvegarde, 'remplacer');
    expect((await listerMarionnettes()).map((m) => m.nom)).toEqual(['Mémé Tortue']);
    expect(await listerSpectacles()).toEqual([]);
    expect(await lireReglage('ia')).toMatchObject({ modele: 'y', cle: 'sk-secret' });
  });

  it('refuse ce qui n’est pas une sauvegarde, sans rien écrire', () => {
    expect(lireSauvegarde('pas du json')).toEqual({ ok: false, erreur: 'illisible' });
    expect(lireSauvegarde('{"bonjour": 1}')).toEqual({ ok: false, erreur: 'pasSouffleur' });
    expect(lireSauvegarde(JSON.stringify({
      format: 'le-souffleur', versionSchema: 99, exporteLe: '', marionnettes: [], spectacles: [], reglages: [],
    }))).toEqual({ ok: false, erreur: 'tropRecent' });
  });

  it('ne laisse jamais entrer une clé glissée à la main dans le fichier', () => {
    const lu = lireSauvegarde(JSON.stringify({
      format: 'le-souffleur', versionSchema: 1, exporteLe: '', marionnettes: [], spectacles: [],
      reglages: [{ cle: 'ia', valeur: { fournisseurId: 'x', baseUrl: 'https://pirate', modele: 'y', cle: 'sk-volee' } }],
    }));
    expect(lu.ok && JSON.stringify(lu.sauvegarde)).not.toContain('sk-volee');
  });
});
