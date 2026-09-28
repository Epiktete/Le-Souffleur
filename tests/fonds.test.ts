// La santé du fonds : chaque modèle de banque/spectacles est vérifié en
// profondeur. C'est le filet sous les spectacles écrits hors ligne — un
// modèle mal formé ne doit jamais atteindre l'application.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lignesModele, type SpectacleModele } from '../src/services/banque';
import { dureeSpectacle } from '../src/services/duree';

const DOSSIER = 'banque/spectacles';
const MODELES = readdirSync(DOSSIER).filter((f) => f.endsWith('.json')).map((f) => ({
  fichier: f,
  modele: JSON.parse(readFileSync(join(DOSSIER, f), 'utf8')) as SpectacleModele,
}));

describe.each(MODELES)('le fonds : $fichier', ({ fichier, modele: m }) => {
  it('a des identifiants et des références cohérents', () => {
    expect(m.id).toBe(fichier.replace(/\.json$/, ''));
    expect(m.conteId).toBeTruthy();
    const cles = new Set(m.roles.map((r) => r.cle));
    const tableaux = new Set(m.tableaux.map((t) => t.id));
    const ids = new Set<string>();
    for (const a of m.actes) {
      expect(tableaux.has(a.tableauId), `acte ${a.id} : tableau inconnu`).toBe(true);
      for (const e of a.elements) {
        expect(ids.has(e.id), `élément ${e.id} en double`).toBe(false);
        ids.add(e.id);
        if ('marionnetteId' in e) {
          expect(cles.has(e.marionnetteId), `élément ${e.id} : rôle inconnu « ${e.marionnetteId} »`).toBe(true);
        }
      }
    }
  });

  it('ne garde aucune variable orpheline ni nom de rôle hors schéma', () => {
    const variables = new Set(m.roles.map((r) => `{{${r.cle}}}`));
    for (const l of lignesModele(m)) {
      for (const v of l.lire().matchAll(/\{\{([^}]*)\}\}/g)) {
        expect(
          variables.has(`{{${v[1].toLowerCase()}}}`),
          `${l.id} : variable inconnue « {{${v[1]}}} »`,
        ).toBe(true);
      }
    }
  });

  it('a une durée estimée qui correspond aux actes', () => {
    expect(m.dureeEstimeeSecondes).toBe(dureeSpectacle(m.actes));
  });

  it('a, pour chaque rôle, un genre et des accords applicables tels quels', () => {
    const lignes = new Map(lignesModele(m).map((l) => [l.id, l]));
    for (const r of m.roles) {
      expect(r.genre, `rôle ${r.cle} sans genre`).toBeTruthy();
      expect(r.accords, `rôle ${r.cle} sans accords`).toBeTruthy();
      expect(r.accords!.vers).toBe(r.genre === 'masculin' ? 'feminin' : 'masculin');
      for (const remp of r.accords!.remplacements) {
        const ligne = lignes.get(remp.id);
        expect(ligne, `rôle ${r.cle} : ligne inconnue « ${remp.id} »`).toBeTruthy();
        expect(
          ligne!.lire().includes(remp.avant) || ligne!.lire().includes(remp.apres),
          `rôle ${r.cle} : extrait introuvable dans [${remp.id}] : « ${remp.avant} »`,
        ).toBe(true);
      }
    }
  });

  it('classe exactement ses adresses au public', () => {
    const adresses = m.actes.flatMap((a) =>
      a.elements.filter((e) => e.type === 'adresse_public').map((e) => e.id)).sort();
    const classees = [...(m.interactionsOrdonnees ?? [])].sort();
    expect(classees).toEqual(adresses);
  });
});
