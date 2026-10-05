// La santé du fonds : chaque modèle de banque/spectacles est vérifié en
// profondeur. C'est le filet sous les spectacles écrits hors ligne — un
// modèle mal formé ne doit jamais atteindre l'application.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lignesModele, rendreMention, type SpectacleModele } from '../src/services/banque';
import { conteParId } from '../src/services/repertoire';
import { dureeSpectacle } from '../src/services/duree';
import { instancierModele } from '../src/services/instanciation';
import type { Marionnette } from '../src/types';

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

  it('joue chaque rôle principal de la fiche par une marionnette', () => {
    // Un héros ne passe jamais en coulisse (2026-09-28, l'ancien Askeladden
    // jouait le garçon à la voix, faute de seconde peluche).
    const conte = conteParId(m.conteId);
    expect(conte, `conte inconnu « ${m.conteId} »`).toBeTruthy();
    expect(m.roles.length).toBeGreaterThanOrEqual(conte!.personnages);
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

  it('a des mentions d’espèce qui se prouvent elles-mêmes', () => {
    // L'invariant : chaque gabarit, rendu avec l'espèce et le genre D'ORIGINE
    // du rôle, redonne exactement l'extrait « avant ». Une annotation fausse
    // ne peut donc pas entrer au fonds.
    const lignes = new Map(lignesModele(m).map((l) => [l.id, l]));
    for (const r of m.roles) {
      expect(
        Boolean(r.especeImposee) && (r.especeMentions?.length ?? 0) > 0,
        `rôle ${r.cle} : imposée ET mobile à la fois`,
      ).toBe(false);
      for (const mention of r.especeMentions ?? []) {
        expect(r.espece, `rôle ${r.cle} : mentions sans espèce d'origine`).toBeTruthy();
        expect(r.genre, `rôle ${r.cle} : mentions sans genre d'origine`).toBeTruthy();
        const ligne = lignes.get(mention.id);
        expect(ligne, `rôle ${r.cle} : ligne inconnue « ${mention.id} »`).toBeTruthy();
        expect(
          ligne!.lire().includes(mention.avant),
          `rôle ${r.cle} : extrait introuvable dans [${mention.id}] : « ${mention.avant} »`,
        ).toBe(true);
        // L'espèce d'origine est stockée sans accents (« lievre ») : la
        // preuve se fait donc à accents près. À la création, c'est l'espèce
        // écrite par le parent, accents compris, qui est rendue.
        const sansAccents = (t: string) =>
          t.normalize('NFD').replace(/[̀-ͯ]/g, '');
        expect(
          sansAccents(rendreMention(mention.gabarit, r.espece!, r.genre!)),
          `rôle ${r.cle} [${mention.id}] : le gabarit ne redonne pas « ${mention.avant} »`,
        ).toBe(sansAccents(mention.avant));
      }
      // Un rôle qui suit l'espèce ne doit plus porter son mot d'espèce dans
      // ses accords de genre : ces mentions-là vivent dans especeMentions.
      if ((r.especeMentions?.length ?? 0) > 0 && r.espece) {
        const mot = new RegExp(`(?<![\\p{L}])${r.espece}s?(?![\\p{L}])`, 'iu');
        for (const remp of r.accords?.remplacements ?? []) {
          expect(
            mot.test(remp.avant) || mot.test(remp.apres),
            `rôle ${r.cle} : l'accord « ${remp.avant} » touche encore l'espèce`,
          ).toBe(false);
        }
      }
    }
  });

  it('se crée sans avertissement avec des peluches d’un autre genre et d’une autre espèce', () => {
    // Les annotations se prouvent une à une, mais elles doivent aussi tenir
    // ENSEMBLE : une mention qui englobe l'extrait d'un accord (« , le tigre
    // le plus » contre « le plus orgueilleux ») cassait la création.
    // Des espèces à voyelle et à h aspiré éprouvent aussi les élisions.
    const autres = { feminin: ['ourse', 'abeille', 'oie', 'hirondelle', 'autruche', 'éléphante'],
      masculin: ['ours', 'écureuil', 'hibou', 'éléphant', 'hérisson', 'âne'] };
    const noms = ['Olive', 'Anatole', 'Ernest', 'Isis', 'Ulysse', 'Émile'];
    const copie = JSON.parse(JSON.stringify(m)) as SpectacleModele;
    const troupe: Marionnette[] = copie.roles.map((r, i) => {
      const genre = r.genre === 'feminin' ? 'masculin' : 'feminin';
      return {
        id: `p${i}`, nom: noms[i % noms.length], description: 'Une peluche.', traits: [],
        espece: r.especeImposee && r.espece ? r.espece : autres[genre][i % 6], genre,
        creeLe: '2026-01-01T00:00:00.000Z', modifieLe: '2026-01-01T00:00:00.000Z',
      };
    });
    const { spectacle, avertissements } = instancierModele(
      copie, copie.roles.map((r, i) => ({ cle: r.cle, marionnetteId: `p${i}` })), troupe);
    expect(avertissements).toEqual([]);
    const joue = JSON.stringify([spectacle.pitch, spectacle.tableaux, spectacle.actes]);
    expect(joue, 'un trou de gabarit est resté').not.toMatch(/\{[\p{L}|]+\}/u);
    expect(joue, 'ma/ta/sa devant voyelle').not.toMatch(
      /(?<![\p{L}])[mtsMTS]a (?!h[ée]risson|hibou|harpe|hauteur|hache|haine|honte|hâte|hurl)[aeiouyéèêâîôûh]/u);
  });

  it('classe exactement ses adresses au public', () => {
    const adresses = m.actes.flatMap((a) =>
      a.elements.filter((e) => e.type === 'adresse_public').map((e) => e.id)).sort();
    const classees = [...(m.interactionsOrdonnees ?? [])].sort();
    expect(classees).toEqual(adresses);
  });

  it('accorde les mentions à espèce inchangée, pour chaque combinaison de genres', () => {
    const sansAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Tester chaque rôle seul puis toutes les combinaisons attrape aussi les
    // annotations qui se chevauchent entre rôles. Au plus 64 cas par conte.
    for (let masque = 0; masque < 2 ** m.roles.length; masque++) {
      const copie = structuredClone(m);
      const troupe: Marionnette[] = m.roles.map((r, i) => ({
        id: `p${i}`, nom: `Zélio${i}`, description: '', traits: [],
        ...(r.espece ? { espece: r.espece } : {}),
        genre: masque & (1 << i)
          ? r.genre === 'feminin' ? 'masculin' : 'feminin'
          : r.genre!,
        creeLe: '2026-01-01T00:00:00.000Z', modifieLe: '2026-01-01T00:00:00.000Z',
      }));
      const { avertissements } = instancierModele(
        copie, copie.roles.map((r, i) => ({ cle: r.cle, marionnetteId: `p${i}` })), troupe);
      expect(avertissements, `genres ${masque}`).toEqual([]);
      const lignes = new Map(lignesModele(copie).map(l => [l.id, l.lire()]));
      for (const [i, role] of m.roles.entries()) {
        for (const mention of role.especeMentions ?? []) {
          const attendu = rendreMention(mention.gabarit, role.espece!, troupe[i].genre!);
          expect(sansAccents(lignes.get(mention.id)!), `${role.cle} ${mention.id}, genres ${masque}`)
            .toContain(sansAccents(attendu));
        }
      }
    }
  });
});
