// La banque de spectacles : l'aller-retour noms ↔ variables.
//
// Le test central est un ALLER-RETOUR sur de vrais spectacles produits par le
// relais : variabiliser puis repeupler avec la troupe d'origine doit rendre le
// spectacle de départ, à l'identifiant et aux dates près. Si l'égalité tient
// sur des spectacles réels — dont un à quatre marionnettes et un à une seule —,
// la mécanique est sûre.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  chargerModele,
  cleRole,
  NomResiduel,
  peupler,
  signatureDe,
  signatures,
  variabiliser,
  variable,
  type SpectacleModele,
} from '../src/services/banque';
import type { Marionnette, Spectacle } from '../src/types';

/* ---------------------------------------------------------------- */
/* De vrais spectacles, produits par le relais                       */
/* ---------------------------------------------------------------- */

/**
 * Les spectacles du relais portent leur bible dans `coulisses.json` et leur
 * troupe dans le spectacle lui-même. On les relit tels quels : un test sur des
 * données fabriquées à la main ne prouverait rien sur un texte réel, où les
 * noms se comptent par dizaines.
 */
function spectaclesDuRelais(): { cas: string; spectacle: Spectacle }[] {
  const racine = 'banc/relais';
  if (!existsSync(racine)) return [];
  const trouves: { cas: string; spectacle: Spectacle }[] = [];
  for (const cas of readdirSync(racine).filter((d) => d.startsWith('cas'))) {
    const f = `${racine}/${cas}/spectacle.json`;
    if (!existsSync(f)) continue;
    trouves.push({ cas, spectacle: JSON.parse(readFileSync(f, 'utf8')) as Spectacle });
  }
  return trouves;
}

/** Un spectacle minimal mais complet, pour les cas que le relais ne couvre pas. */
function spectacleFactice(): Spectacle {
  const peluche = (id: string, nom: string, description: string): Marionnette => ({
    id, nom, description, traits: ['gentil'], creeLe: '2026-01-01', modifieLe: '2026-01-01',
  });
  const troupe = [
    peluche('a', 'Ourse Gourmande', 'Une grosse ourse en peluche marron.'),
    // « Ours » est un PRÉFIXE d'« Ourse Gourmande » : c'est le piège que la
    // substitution du plus long au plus court doit désamorcer.
    peluche('b', 'Ours', 'Un ours brun.'),
  ];
  return {
    id: 'spectacle-essai',
    titre: 'Le Conte d’essai',
    pitch: 'Ourse Gourmande rencontre Ours, et Ours n’en revient pas.',
    parametres: {
      dureeMinutes: 5, ageAuditoire: 6, nbMarionnettistes: 1,
      interactionPublic: 'quelques', marionnetteIds: ['a', 'b'], modele: 'essai',
    },
    distribution: [{ ...troupe[0], voix: 'la voix grave d’Ourse Gourmande' }, { ...troupe[1] }],
    tableaux: [{
      id: 't1', titre: 'Le pré d’Ours', description: 'Un drap vert. Le panier d’Ourse Gourmande.',
      accessoires: ['le panier d’Ourse Gourmande'], promptImage: '',
    }],
    actes: [{
      id: 'ac1', numero: 1, titre: 'Ours et Ourse Gourmande', tableauId: 't1',
      resume: 'Ourse Gourmande arrive ; Ours la salue.',
      elements: [
        { id: 'e1', type: 'entree', marionnetteId: 'a', mainMarionnettiste: 'M1G' },
        { id: 'e2', type: 'replique', marionnetteId: 'a', texte: 'Bonjour, Ours !', ton: 'gaie' },
        { id: 'e3', type: 'didascalie', texte: 'Ours recule devant Ourse Gourmande.' },
        { id: 'e4', type: 'note_marionnettiste', texte: 'Voix d’Ours, en coulisse : « Oh ! »' },
        { id: 'e5', type: 'adresse_public', marionnetteId: 'b', texte: 'Vous avez vu Ourse Gourmande ?', attenteReponse: true },
        { id: 'e6', type: 'sortie', marionnetteId: 'a', mainMarionnettiste: 'M1G' },
      ],
    }],
    dureeEstimeeSecondes: 42,
    statut: 'complet',
    bible: {
      conteId: 'en-essai',
      dossier: { marionnettes: [{ nom: 'Ourse Gourmande', description: 'grosse', traits: [] }] },
      transposition: { texte: 'Ours dit à Ourse Gourmande qu’elle exagère.', changements: [] },
    },
    creeLe: '2026-01-01', modifieLe: '2026-01-01',
  };
}

/** Tout le texte d'un objet, mis bout à bout : pour y chercher un nom. */
function toutLeTexte(valeur: unknown): string {
  if (typeof valeur === 'string') return valeur;
  if (Array.isArray(valeur)) return valeur.map(toutLeTexte).join('\n');
  if (valeur && typeof valeur === 'object') return Object.values(valeur).map(toutLeTexte).join('\n');
  return '';
}

/* ---------------------------------------------------------------- */

describe('variabiliser : plus aucun nom dans le modèle', () => {
  it('remplace le nom le plus long d’abord', () => {
    // Sans cet ordre, « Ours » mangerait le début d'« Ourse Gourmande » et
    // laisserait « {{r2}}e Gourmande » au milieu du texte.
    const m = variabiliser(spectacleFactice(), 'en-essai--1');
    const texte = toutLeTexte(m);
    expect(texte).not.toContain('Ourse Gourmande');
    expect(texte).not.toMatch(/\bOurs\b/);
    expect(texte).toContain(variable(cleRole(1)));
    expect(texte).toContain(variable(cleRole(2)));
  });

  it('remplace aussi les identifiants, et retire le dossier', () => {
    const m = variabiliser(spectacleFactice(), 'en-essai--1');
    const entree = m.actes[0].elements[0];
    expect('marionnetteId' in entree && entree.marionnetteId).toBe('r1');
    // Le dossier ne décrit que les peluches d'origine : il se reconstruit.
    expect(m.bible.dossier).toBeUndefined();
    expect(m.bible.transposition).toBeDefined();
  });

  it('garde l’espèce et les traits de chaque rôle, pour l’appariement', () => {
    const m = variabiliser(spectacleFactice(), 'en-essai--1');
    expect(m.roles[0]).toMatchObject({ cle: 'r1', espece: 'ourse', famille: 'gros' });
    expect(m.roles[0].traits).toEqual(['gentil']);
    // La voix est celle du spectacle, donc variabilisée elle aussi.
    expect(m.roles[0].voix).toBe(`la voix grave d’${variable('r1')}`);
  });

  it('échoue bruyamment si un nom subsiste', () => {
    // Un nom écrit d'une autre façon — « ourse gourmande » en minuscules —
    // échappe à la substitution exacte. Le garde-fou, lui, cherche sous forme
    // normalisée : le versement doit échouer plutôt que de passer inaperçu.
    const s = spectacleFactice();
    s.actes[0].elements.push({
      id: 'e7', type: 'didascalie', texte: 'ourse gourmande sort par la gauche.',
    });
    expect(() => variabiliser(s, 'en-essai--1')).toThrow(NomResiduel);
  });
});

describe('peupler : le spectacle redevient jouable', () => {
  const autres: Marionnette[] = [
    { id: 'x', nom: 'Petite Souris', description: 'Une souris grise.', traits: ['peureux'], creeLe: '', modifieLe: '' },
    { id: 'y', nom: 'Gros Loup', description: 'Un loup gris.', traits: ['méchant'], creeLe: '', modifieLe: '' },
  ];

  it('substitue les noms d’une AUTRE troupe, sans trace de l’ancienne', () => {
    const m = variabiliser(spectacleFactice(), 'en-essai--1');
    const s = peupler(m, autres);
    const texte = toutLeTexte({ ...s, distribution: [] });
    expect(texte).toContain('Petite Souris');
    expect(texte).toContain('Gros Loup');
    expect(texte).not.toContain('Ourse Gourmande');
    expect(texte).not.toMatch(/\bOurs\b/);
    expect(texte).not.toContain('{{');
  });

  it('rebranche les identifiants et reconstruit le dossier', () => {
    const s = peupler(variabiliser(spectacleFactice(), 'en-essai--1'), autres);
    expect(s.parametres.marionnetteIds).toEqual(['x', 'y']);
    const entree = s.actes[0].elements[0];
    expect('marionnetteId' in entree && entree.marionnetteId).toBe('x');
    // Le dossier décrit les peluches d'AUJOURD'HUI.
    expect(JSON.stringify(s.bible.dossier)).toContain('Petite Souris');
    expect(JSON.stringify(s.bible.dossier)).not.toContain('Ourse');
  });

  it('donne la voix du rôle à la marionnette qui le reprend', () => {
    const s = peupler(variabiliser(spectacleFactice(), 'en-essai--1'), autres);
    expect(s.distribution[0].voix).toBe('la voix grave de Petite Souris');
    expect(s.distribution[1].voix).toBeUndefined();
  });

  it('répare l’élision, dans les deux sens', () => {
    // « la voix grave d’Ourse » → « de Petite Souris » devant une consonne,
    // et « le panier de Gros Loup » → « d’Ourse » devant une voyelle.
    const m = variabiliser(spectacleFactice(), 'en-essai--1');
    const consonne = peupler(m, autres);
    expect(consonne.distribution[0].voix).toBe('la voix grave de Petite Souris');

    const voyelle = peupler(m, [
      { ...autres[0], nom: 'Aglaé' },
      { ...autres[1], nom: 'Ernest' },
    ]);
    expect(voyelle.distribution[0].voix).toBe('la voix grave d’Aglaé');

    // Et « de » devant une voyelle se contracte aussi.
    const avecDe: SpectacleModele = {
      ...m,
      pitch: `le panier de ${variable('r1')} et la maison d’${variable('r2')}`,
    };
    expect(peupler(avecDe, [{ ...autres[0], nom: 'Aglaé' }, { ...autres[1], nom: 'Gros Loup' }]).pitch)
      .toBe('le panier d’Aglaé et la maison de Gros Loup');
  });

  it('refuse une troupe qui n’a pas le bon nombre de marionnettes', () => {
    const m = variabiliser(spectacleFactice(), 'en-essai--1');
    expect(() => peupler(m, autres.slice(0, 1))).toThrow(/1 fournie/);
  });
});

describe('l’aller-retour rend le spectacle de départ', () => {
  /** Ce qui change forcément : les identifiants et les dates. */
  const comparable = (s: Spectacle) => ({
    ...s,
    id: '',
    creeLe: '', modifieLe: '',
    parametres: { ...s.parametres, modele: '' },
    tableaux: s.tableaux.map((t) => ({ ...t, id: '' })),
    actes: s.actes.map((a) => ({
      ...a, id: '', tableauId: '', elements: a.elements.map((e) => ({ ...e, id: '' })),
    })),
    // Le dossier est reconstruit plutôt que transporté, et les notes de
    // délibération ne sont pas emportées : elles se comparent à part.
    bible: {
      ...s.bible,
      dossier: undefined,
      contesPresentes: undefined, jouables: undefined, synopsisProposes: undefined,
    },
  });

  it('sur un spectacle factice', () => {
    const depart = spectacleFactice();
    const retour = peupler(variabiliser(depart, 'en-essai--1'), depart.distribution);
    expect(comparable(retour)).toEqual(comparable(depart));
  });

  const reels = spectaclesDuRelais();
  it.runIf(reels.length > 0)('sur les spectacles réels du relais', () => {
    for (const { cas, spectacle } of reels) {
      const modele = variabiliser(spectacle, `${spectacle.bible.conteId}--1`);
      const retour = peupler(modele, spectacle.distribution);
      expect(comparable(retour), cas).toEqual(comparable(spectacle));
    }
  });
});

describe('le fonds versé dans le dépôt', () => {
  const fichiers = existsSync('banque/spectacles')
    ? readdirSync('banque/spectacles').filter((f) => f.endsWith('.json'))
    : [];

  it('l’index est à jour avec les fichiers', () => {
    expect(Object.keys(signatures().map((s) => s.id)).length).toBe(fichiers.length);
    for (const f of fichiers) {
      const m = JSON.parse(readFileSync(`banque/spectacles/${f}`, 'utf8')) as SpectacleModele;
      const attendue = signatures().find((s) => s.id === m.id);
      expect(attendue, `${m.id} : relancez node tools/indexer-banque.mjs`).toBeDefined();
      expect(attendue).toEqual(signatureDe(m));
    }
  });

  it.runIf(fichiers.length > 0)('aucun modèle ne contient d’accolade orpheline', () => {
    for (const f of fichiers) {
      const brut = readFileSync(`banque/spectacles/${f}`, 'utf8');
      // Toute accolade double doit être une variable de rôle bien formée.
      const orphelines = brut.match(/\{\{(?!r\d+\}\})/g) ?? [];
      expect(orphelines, f).toEqual([]);
    }
  });

  it.runIf(fichiers.length > 0)('chaque modèle se charge et se peuple', async () => {
    const m = await chargerModele(signatures()[0].id);
    expect(m).not.toBeNull();
    const troupe: Marionnette[] = m!.roles.map((r, i) => ({
      id: `p${i}`, nom: `Peluche ${i + 1}`, description: r.espece ?? '',
      traits: r.traits, creeLe: '', modifieLe: '',
    }));
    const s = peupler(m!, troupe);
    expect(s.actes.length).toBeGreaterThan(0);
    expect(toutLeTexte(s)).not.toContain('{{');
  });
});
