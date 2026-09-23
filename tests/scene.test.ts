// Simulation de scène et calcul de durée : les deux garde-fous exigés par le
// CDC §13 dans la liste des tests minimums.
import { describe, expect, it } from 'vitest';
import {
  controler,
  enScene,
  libelleMain,
  maxSimultanees,
  sansBlocage,
  simulerActe,
} from '../src/services/scene';
import {
  budgetMots,
  compterMots,
  dansLaTolerance,
  dureeElements,
  dureeSpectacle,
  formaterDuree,
} from '../src/services/duree';
import type { Acte, ElementScript, Main } from '../src/types';

const NOMS: Record<string, string> = {
  lapin: 'Doudou Lapin',
  renard: 'Renard',
  ourse: 'Ourse',
};
const nomDe = (id: string) => NOMS[id] ?? id;

let compteur = 0;
const id = () => `e${++compteur}`;

const entree = (marionnetteId: string, main: Main): ElementScript =>
  ({ id: id(), type: 'entree', marionnetteId, mainMarionnettiste: main });
const sortie = (marionnetteId: string, main: Main): ElementScript =>
  ({ id: id(), type: 'sortie', marionnetteId, mainMarionnettiste: main });
const replique = (marionnetteId: string, texte: string): ElementScript =>
  ({ id: id(), type: 'replique', marionnetteId, texte });
const didascalie = (texte: string): ElementScript =>
  ({ id: id(), type: 'didascalie', texte });
const adresse = (marionnetteId: string, texte: string, attenteReponse = false): ElementScript =>
  ({ id: id(), type: 'adresse_public', marionnetteId, texte, attenteReponse });
const note = (texte: string): ElementScript =>
  ({ id: id(), type: 'note_marionnettiste', texte });

describe('simulerActe : cas valides', () => {
  it('accepte deux marionnettes pour un marionnettiste', () => {
    const r = simulerActe([
      entree('lapin', 'M1G'),
      entree('renard', 'M1D'),
      replique('lapin', 'Bonjour !'),
      replique('renard', 'Tiens donc.'),
    ], 1, nomDe);
    expect(r.problemes).toEqual([]);
    expect(enScene(r.etatFinal).sort()).toEqual(['lapin', 'renard']);
  });

  it('accepte une rotation : une sortie libère la main', () => {
    const r = simulerActe([
      entree('lapin', 'M1G'),
      entree('renard', 'M1D'),
      sortie('renard', 'M1D'),
      entree('ourse', 'M1D'),
      replique('ourse', 'Miam.'),
    ], 1, nomDe);
    expect(r.problemes).toEqual([]);
    expect(enScene(r.etatFinal).sort()).toEqual(['lapin', 'ourse']);
  });

  it('accepte quatre marionnettes avec deux marionnettistes', () => {
    const r = simulerActe([
      entree('lapin', 'M1G'),
      entree('renard', 'M1D'),
      entree('ourse', 'M2G'),
      entree('hibou', 'M2D'),
    ], 2, nomDe);
    expect(r.problemes).toEqual([]);
  });

  it('poursuit l’état d’un acte à l’autre', () => {
    const premier = simulerActe([entree('lapin', 'M1G')], 1, nomDe);
    // L'acte suivant commence avec le lapin déjà en scène : il peut parler.
    const second = simulerActe([replique('lapin', 'Me revoilà.')], 1, nomDe, premier.etatFinal);
    expect(second.problemes).toEqual([]);
  });
});

describe('simulerActe : cas invalides', () => {
  it('refuse une troisième marionnette pour un seul marionnettiste', () => {
    const r = simulerActe([
      entree('lapin', 'M1G'),
      entree('renard', 'M1D'),
      entree('ourse', 'M2G'),
    ], 1, nomDe);
    expect(r.problemes).toHaveLength(1);
    expect(r.problemes[0].gravite).toBe('bloquant');
    expect(r.problemes[0].message).toContain('Ourse');
    expect(r.problemes[0].message).toContain('1 marionnettiste');
    expect(r.problemes[0].position).toBe(3);
  });

  it('refuse deux marionnettes dans la même main', () => {
    const r = simulerActe([
      entree('lapin', 'M1G'),
      entree('renard', 'M1G'),
    ], 1, nomDe);
    expect(r.problemes).toHaveLength(1);
    expect(r.problemes[0].message).toContain('déjà occupée par Doudou Lapin');
  });

  it('refuse une réplique d’une marionnette absente', () => {
    const r = simulerActe([
      entree('lapin', 'M1G'),
      replique('renard', 'Coucou.'),
    ], 1, nomDe);
    expect(r.problemes).toHaveLength(1);
    expect(r.problemes[0].message).toBe('Renard parle alors qu’elle n’est pas en scène.');
    expect(r.problemes[0].position).toBe(2);
  });

  it('refuse une adresse au public d’une marionnette absente', () => {
    const r = simulerActe([adresse('renard', 'Et vous ?')], 1, nomDe);
    expect(r.problemes[0].message).toContain('s’adresse au public');
  });

  it('refuse la sortie d’une marionnette absente', () => {
    const r = simulerActe([sortie('renard', 'M1D')], 1, nomDe);
    expect(r.problemes).toHaveLength(1);
    expect(r.problemes[0].message).toBe('Renard sort alors qu’elle n’est pas en scène.');
  });

  it('refuse une marionnette qui entre deux fois', () => {
    const r = simulerActe([
      entree('lapin', 'M1G'),
      entree('lapin', 'M1D'),
    ], 1, nomDe);
    expect(r.problemes[0].message).toContain('déjà en scène');
  });

  it('signale chaque problème séparément, sans s’arrêter au premier', () => {
    const r = simulerActe([
      replique('lapin', 'Un.'),
      replique('renard', 'Deux.'),
    ], 1, nomDe);
    expect(r.problemes).toHaveLength(2);
    expect(r.problemes.map((p) => p.position)).toEqual([1, 2]);
  });

  it('nomme la main en français', () => {
    expect(libelleMain('M1G')).toBe('gauche du marionnettiste 1');
    expect(libelleMain('M2D')).toBe('droite du marionnettiste 2');
  });

  it('donne le nombre de marionnettes simultanées possibles', () => {
    expect(maxSimultanees(1)).toBe(2);
    expect(maxSimultanees(2)).toBe(4);
  });
});

describe('compterMots', () => {
  it('compte les mots séparés par des espaces', () => {
    expect(compterMots('Bonjour les enfants')).toBe(3);
  });

  it('ne compte pas les espaces multiples ni les bords', () => {
    expect(compterMots('  Bonjour   les  enfants  ')).toBe(3);
  });

  it('renvoie zéro pour un texte vide', () => {
    expect(compterMots('')).toBe(0);
    expect(compterMots('   ')).toBe(0);
  });

  it('ne coupe pas sur les apostrophes ni les traits d’union', () => {
    expect(compterMots('l’arc-en-ciel')).toBe(1);
  });

  it('ne compte pas la ponctuation détachée de la typographie française', () => {
    // « ? », « ! », « : » et « ; » sont précédés d'une espace en français :
    // sans précaution, chacun serait compté comme un mot prononcé.
    expect(compterMots('Vous venez ?')).toBe(2);
    expect(compterMots('Attention !')).toBe(1);
    expect(compterMots('Écoutez : il arrive !')).toBe(3);
    expect(compterMots('— Bonjour, dit-il.')).toBe(2);
  });
});

describe('dureeElements', () => {
  it('applique la vitesse de 100 mots par minute', () => {
    // 100 mots = 60 secondes.
    const cent = Array.from({ length: 100 }, () => 'mot').join(' ');
    expect(dureeElements([replique('lapin', cent)]).secondes).toBe(60);
  });

  it('ajoute 3 secondes par didascalie', () => {
    const d = dureeElements([didascalie('Le lapin saute.'), didascalie('Il retombe.')]);
    expect(d.secondes).toBe(6);
    expect(d.didascalies).toBe(2);
  });

  it('ajoute 8 secondes pour une adresse qui attend une réponse', () => {
    // 10 mots = 6 s, plus 8 s d'attente.
    const dix = Array.from({ length: 10 }, () => 'mot').join(' ');
    expect(dureeElements([adresse('lapin', dix, true)]).secondes).toBe(14);
  });

  it('n’ajoute pas l’attente si l’adresse n’attend pas de réponse', () => {
    const dix = Array.from({ length: 10 }, () => 'mot').join(' ');
    expect(dureeElements([adresse('lapin', dix, false)]).secondes).toBe(6);
  });

  it('ne compte ni les notes au marionnettiste ni les entrées et sorties', () => {
    const d = dureeElements([
      note('Préparer la carotte en carton.'),
      entree('lapin', 'M1G'),
      sortie('lapin', 'M1G'),
    ]);
    expect(d.secondes).toBe(0);
    expect(d.mots).toBe(0);
  });

  it('additionne mots, didascalies et attentes', () => {
    const cinquante = Array.from({ length: 50 }, () => 'mot').join(' ');
    // 50 mots = 30 s, + 3 s de didascalie, + 8 s d'attente (le texte de
    // l'adresse compte aussi : 2 mots = 1,2 s).
    const d = dureeElements([
      replique('lapin', cinquante),
      didascalie('Il saute.'),
      adresse('lapin', 'Vous venez ?', true),
    ]);
    expect(d.mots).toBe(52);
    expect(d.secondes).toBe(Math.round((52 / 100) * 60 + 3 + 8));
  });
});

describe('dureeSpectacle et formatage', () => {
  it('additionne les actes', () => {
    const acte = (n: number, elements: ElementScript[]): Acte =>
      ({ id: `a${n}`, numero: n, titre: `Acte ${n}`, tableauId: 't1', resume: '', elements });
    const cent = Array.from({ length: 100 }, () => 'mot').join(' ');
    expect(dureeSpectacle([
      acte(1, [replique('lapin', cent)]),
      acte(2, [replique('lapin', cent)]),
    ])).toBe(120);
  });

  it('formate en minutes et secondes', () => {
    expect(formaterDuree(45)).toBe('45 s');
    expect(formaterDuree(120)).toBe('2 min');
    expect(formaterDuree(270)).toBe('4 min 30 s');
  });
});

describe('dansLaTolerance', () => {
  it('accepte un écart de 20 % au plus', () => {
    expect(dansLaTolerance(300, 300)).toBe(true);
    expect(dansLaTolerance(240, 300)).toBe(true); // -20 %
    expect(dansLaTolerance(360, 300)).toBe(true); // +20 %
  });

  it('refuse au-delà', () => {
    expect(dansLaTolerance(239, 300)).toBe(false);
    expect(dansLaTolerance(361, 300)).toBe(false);
  });
});

describe('budgetMots', () => {
  it('convertit une durée visée en nombre de mots', () => {
    expect(budgetMots(300)).toBe(500); // 5 min à 100 mots/min
  });
});

describe('controler : les contrôles automatiques du CDC §6', () => {
  const acte = (n: number, elements: ElementScript[]): Acte =>
    ({ id: `a${n}`, numero: n, titre: `Acte ${n}`, tableauId: 't1', resume: '', elements });

  /** Un spectacle correct de 5 min, 2 marionnettes, 1 marionnettiste. */
  function spectacleCorrect() {
    // 5 min visées = 500 mots, moins le forfait des deux attentes (16 s, soit
    // ~27 mots) : deux répliques de 235 mots tombent dans la cible.
    const longue = Array.from({ length: 235 }, () => 'mot').join(' ');
    return {
      actes: [
        acte(1, [
          entree('lapin', 'M1G'),
          entree('renard', 'M1D'),
          replique('lapin', longue),
          adresse('lapin', 'Vous l’avez vu ?', true),
        ]),
        acte(2, [
          replique('renard', longue),
          adresse('renard', 'Et maintenant ?', true),
        ]),
      ],
      nbMarionnettistes: 1 as const,
      marionnetteIds: ['lapin', 'renard'],
      nomDe,
      interactionPublic: 'quelques' as const,
      dureeCibleSecondes: 300,
    };
  }

  it('ne signale rien sur un spectacle correct', () => {
    const p = controler(spectacleCorrect());
    expect(p).toEqual([]);
    expect(sansBlocage(p)).toBe(true);
  });

  it('signale une marionnette choisie qui n’apparaît jamais', () => {
    const c = spectacleCorrect();
    c.marionnetteIds = ['lapin', 'renard', 'ourse'];
    const p = controler(c);
    expect(p).toHaveLength(1);
    expect(p[0].message).toBe('Ourse n’apparaît jamais dans le spectacle.');
    expect(p[0].gravite).toBe('bloquant');
  });

  it('désigne les actes à rallonger quand le spectacle est trop court', () => {
    const c = spectacleCorrect();
    c.dureeCibleSecondes = 600; // on vise 10 min pour un spectacle de ~4 min
    const p = controler(c);

    // Le constat d'ensemble, sans numéro d'acte…
    const ensemble = p.filter((x) => x.acteNumero === undefined);
    expect(ensemble).toHaveLength(1);
    expect(ensemble[0].message).toContain('trop court');

    // …et les actes désignés, qui seuls peuvent déclencher une réécriture.
    const parActe = p.filter((x) => x.acteNumero !== undefined);
    expect(parActe.length).toBeGreaterThan(0);
    for (const x of parActe) {
      expect(x.gravite).toBe('important');
      expect(x.message).toMatch(/environ \d+ mots/);
    }

    // Rien de tout cela n'empêche d'enregistrer (CDC §6).
    expect(sansBlocage(p)).toBe(true);
  });

  it('ne dit rien de la durée quand elle est dans la tolérance', () => {
    const c = spectacleCorrect();
    const p = controler(c).filter((x) => /trop court|trop long/.test(x.message));
    expect(p).toHaveLength(0);
  });

  it('une réplique non attribuée est un problème bloquant sur son acte', () => {
    // Sans cela, la note « À corriger » restait dans le script et la réplique
    // perdue n'était jamais réécrite.
    const c = spectacleCorrect();
    c.actes[0].elements = [
      ...c.actes[0].elements,
      { id: 'n1', type: 'note_marionnettiste', texte: 'À corriger : « Renard Roublard » ne fait pas partie de la distribution.' },
    ];
    const p = controler(c).filter((x) => x.message.includes('Renard Roublard'));
    expect(p).toHaveLength(1);
    expect(p[0].gravite).toBe('bloquant');
    expect(p[0].acteNumero).toBe(c.actes[0].numero);
  });

  it('signale un acte sans adresse au public quand l’interaction est promise', () => {
    const c = spectacleCorrect();
    c.actes[1].elements = [replique('renard', 'Juste un mot.')];
    c.dureeCibleSecondes = 120;
    const p = controler(c);
    expect(p.some((x) => x.message === 'L’acte 2 ne s’adresse jamais au public.')).toBe(true);
  });

  it('ne réclame pas d’adresse au public quand l’interaction est « aucune »', () => {
    const c = spectacleCorrect();
    c.interactionPublic = 'aucune';
    c.actes = [acte(1, [entree('lapin', 'M1G'), replique('lapin', 'Bonjour.')])];
    c.marionnetteIds = ['lapin'];
    c.dureeCibleSecondes = 2;
    const p = controler(c);
    expect(p.filter((x) => x.message.includes('public'))).toHaveLength(0);
  });

  it('garde l’état de scène entre les actes : pas de faux positif', () => {
    const c = spectacleCorrect();
    // L'acte 2 fait parler le renard, entré à l'acte 1. Ce doit être accepté.
    expect(controler(c).filter((p) => p.message.includes('pas en scène'))).toHaveLength(0);
  });

  it('localise le problème sur l’acte et l’élément fautifs', () => {
    const c = spectacleCorrect();
    c.actes[1].elements.unshift(entree('ourse', 'M2G'));
    c.marionnetteIds = ['lapin', 'renard', 'ourse'];
    const p = controler(c);
    const bloquant = p.find((x) => x.gravite === 'bloquant');
    expect(bloquant?.acteNumero).toBe(2);
    expect(bloquant?.position).toBe(1);
  });
});
