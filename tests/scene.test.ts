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
  actesCourts,
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

  it('compte la voix en coulisse, que le parent dit bel et bien', () => {
    // Avec une seule marionnette, tout un rôle du conte passe par là
    // (CDC §6). Ne pas le compter faisait tomber la durée estimée sous la
    // moitié du réel : deux minutes annoncées pour un spectacle de cinq.
    const dix = Array.from({ length: 10 }, () => 'mot').join(' ');
    expect(dureeElements([note(`Voix du Bœuf, en coulisse : « ${dix} »`)]).secondes).toBe(6);

    // Une note ordinaire ne se dit pas, et ne compte donc pour rien.
    expect(dureeElements([note(`Préparer le drap avant l'acte : ${dix}`)]).secondes).toBe(0);

    // La consigne de jeu qui suit la citation ne se dit pas non plus : seuls
    // les mots entre guillemets comptent.
    expect(
      dureeElements([note(`Voix du Bœuf, en coulisse : « ${dix} » — dit lentement, sans montrer la marionnette`)]).secondes,
    ).toBe(6);
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

describe('actesCourts : l’application compte, le directeur complète', () => {
  const acte = (n: number, elements: ElementScript[]): Acte =>
    ({ id: `a${n}`, numero: n, titre: `Acte ${n}`, tableauId: 't1', resume: '', elements });
  const mots = (n: number) => Array.from({ length: n }, () => 'mot').join(' ');

  it('désigne l’acte qui dit moins de 80 % de ses mots prévus, avec ce qui manque', () => {
    const actes = [
      acte(1, [replique('lapin', mots(170))]),
      acte(2, [replique('lapin', mots(64))]),
      acte(3, [replique('renard', mots(120))]),
    ];
    expect(actesCourts(actes, { 1: 200, 2: 150, 3: 150 }))
      .toEqual([{ numero: 2, dits: 64, prevus: 150, manque: 86 }]);
  });

  it('compte les mots dits, pas les secondes : les didascalies ne rallongent rien', () => {
    const actes = [acte(1, [
      replique('lapin', mots(50)),
      ...Array.from({ length: 12 }, () => didascalie('Le lapin sautille.')),
    ])];
    // 50 mots et 12 didascalies font 66 s, la part d'un acte de 100 mots :
    // la durée ne voyait rien, le compte des mots voit l'acte à moitié vide.
    expect(dureeElements(actes[0].elements).secondes).toBe(66);
    expect(actesCourts(actes, { 1: 100 })).toHaveLength(1);
  });

  it('compte le conteur comme des mots dits', () => {
    const actes = [acte(1, [
      { id: id(), type: 'conteur', texte: mots(60) },
      replique('lapin', mots(25)),
    ])];
    expect(actesCourts(actes, { 1: 100 })).toEqual([]);
  });

  it('ignore un acte sans budget', () => {
    expect(actesCourts([acte(1, [replique('lapin', 'Bonjour.')])], {})).toEqual([]);
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

  it('un spectacle trop court n’envoie aucun acte en correction : le directeur le complète', () => {
    const c = spectacleCorrect();
    c.dureeCibleSecondes = 600; // on vise 10 min pour un spectacle de ~5 min
    const p = controler(c);

    // Le constat d'ensemble, pour le parent, marqué comme un écart de durée…
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ gravite: 'important', duree: true });
    expect(p[0].message).toContain('trop court');
    // …et aucun acte désigné : les actes courts sont comptés en mots avant la
    // revue, et donnés au directeur éditorial (actesCourts).
    expect(p[0].acteNumero).toBeUndefined();
    expect(sansBlocage(p)).toBe(true);
  });

  it('désigne les actes à resserrer quand le spectacle est trop long, jamais le dernier', () => {
    const c = spectacleCorrect();
    c.dureeCibleSecondes = 150; // on vise 2 min 30 pour un spectacle de ~5 min
    const p = controler(c);

    expect(p.filter((x) => x.acteNumero === undefined)[0].message).toContain('trop long');
    const parActe = p.filter((x) => x.acteNumero !== undefined);
    expect(parActe.map((x) => x.acteNumero)).toEqual([1]);
    expect(parActe[0]).toMatchObject({ gravite: 'important', duree: true });
    expect(parActe[0].message).toMatch(/un peu long.*environ \d+ mots/);
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

  it('avec « beaucoup », signale un acte sans adresse au public', () => {
    const c = spectacleCorrect();
    c.interactionPublic = 'beaucoup';
    c.actes[1].elements = [replique('renard', 'Juste un mot.')];
    c.dureeCibleSecondes = 120;
    const p = controler(c);
    expect(p.some((x) => x.message === 'L’acte 2 ne s’adresse jamais au public.')).toBe(true);
  });

  it('avec « quelques », la dose se compte sur TOUT le spectacle', () => {
    // La consigne donnée au modèle dit « deux ou trois adresses dans tout le
    // spectacle » : en exiger une par acte la contredisait, et la correction
    // d'un acte en réclamait une de plus alors que le compte y était déjà.
    const c = spectacleCorrect();
    c.interactionPublic = 'quelques';
    c.actes[1].elements = [replique('renard', 'Juste un mot.')];
    c.dureeCibleSecondes = 120;
    const p = controler(c);
    expect(p.some((x) => /ne s’adresse jamais au public/.test(x.message))).toBe(false);

    // Aucune adresse nulle part, en revanche, se signale.
    for (const acte of c.actes) {
      acte.elements = acte.elements.filter((e) => e.type !== 'adresse_public');
    }
    expect(controler(c).some((x) => /ne s’adresse jamais au public/.test(x.message))).toBe(true);
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

describe('controler : ce que la revue laissait passer au banc', () => {
  const acte = (n: number, elements: ElementScript[]): Acte =>
    ({ id: `a${n}`, numero: n, titre: `Acte ${n}`, tableauId: 't1', resume: '', elements });
  const contexte = (actes: Acte[]) => ({
    actes,
    nbMarionnettistes: 1 as const,
    marionnetteIds: ['lapin'],
    nomDe,
    interactionPublic: 'quelques' as const,
    dureeCibleSecondes: 10,
  });
  const messages = (actes: Acte[]) => controler(contexte(actes)).map((p) => p.message);

  it('refuse une question d’opinion ou une idée à trouver, et désigne l’élément', () => {
    const p = controler(contexte([acte(1, [
      entree('lapin', 'M1G'),
      adresse('lapin', 'Qui pourrait être plus fort que le Mur, à votre avis ?', true),
    ])])).filter((x) => /leur avis/.test(x.message));
    expect(p).toHaveLength(1);
    expect(p[0].position).toBe(2);
  });

  it('laisse passer ce qu’on demande de faire aux enfants', () => {
    expect(messages([acte(1, [
      entree('lapin', 'M1G'),
      adresse('lapin', 'Vous m’aidez à crier très fort ?', true),
    ])]).filter((m) => /leur avis/.test(m))).toEqual([]);
  });

  it('repère la narration du conteur dans une réplique', () => {
    const m = messages([acte(1, [
      entree('lapin', 'M1G'),
      adresse('lapin', 'Les deux amis vécurent heureux, et partagèrent tout.'),
    ])]);
    expect(m.some((x) => /récite la narration/.test(x))).toBe(true);
  });

  it('ne prend pas le présent des verbes en -érer pour du passé simple', () => {
    const m = messages([acte(1, [
      entree('lapin', 'M1G'),
      replique('lapin', 'Ils préfèrent les carottes, et ils espèrent en trouver.'),
    ])]);
    expect(m.some((x) => /récite la narration/.test(x))).toBe(false);
  });

  it('juge chaque acte sur le budget du découpage, et ne coupe jamais le dernier', () => {
    const mots = (n: number) => Array.from({ length: n }, () => 'mot').join(' ');
    // 5 min : l'acte 1 a 100 mots de budget, l'acte 2 (le dénouement) 400.
    const c = {
      ...contexte([
        acte(1, [entree('lapin', 'M1G'), replique('lapin', mots(100))]),
        acte(2, [replique('lapin', mots(700))]),
      ]),
      dureeCibleSecondes: 300,
      budgetsMots: { 1: 100, 2: 400 },
    };
    const p = controler(c);
    // Le spectacle est trop long dans son ensemble…
    expect(p.some((x) => /trop long/.test(x.message))).toBe(true);
    // … mais l'acte 1 tient sa part, et le dernier n'est pas à couper.
    expect(p.filter((x) => x.acteNumero !== undefined && /un peu/.test(x.message))).toEqual([]);
  });
});

describe('controler : une peluche ne change pas de costume', () => {
  const acte = (elements: ElementScript[]): Acte =>
    ({ id: 'a1', numero: 1, titre: 'Acte 1', tableauId: 't1', resume: '', elements });
  const costumes = (texte: string) => controler({
    actes: [acte([entree('lapin', 'M1G'), didascalie(texte)])],
    nbMarionnettistes: 1, marionnetteIds: ['lapin'], nomDe,
    interactionPublic: 'aucune', dureeCibleSecondes: 10,
  }).filter((p) => /costume/.test(p.message));

  it('signale un chapeau ou un déguisement, et désigne l’élément', () => {
    const p = costumes('Pilou arrive fièrement, un petit chapeau sur la tête et un beau nœud.');
    expect(p).toHaveLength(1);
    expect(p[0].position).toBe(2);
    expect(costumes('Il se déguise en loup.')).toHaveLength(1);
  });

  it('ne confond pas un mot qui contient « robe » ou « cape »', () => {
    expect(costumes('Il dérobe le grain et s’échappe.')).toEqual([]);
  });
});

describe('controler : ce qui mérite une seconde passe', () => {
  it('marque la peluche changée sur la même main sans pause', () => {
    const p = controler({
      actes: [{
        id: 'a1', numero: 1, titre: 'Acte 1', tableauId: 't1', resume: '',
        elements: [
          entree('lapin', 'M1G'), replique('lapin', 'Bonjour.'),
          sortie('lapin', 'M1G'), entree('renard', 'M1G'), replique('renard', 'Me voici.'),
        ],
      }],
      nbMarionnettistes: 1, marionnetteIds: ['lapin', 'renard'], nomDe,
      interactionPublic: 'aucune', dureeCibleSecondes: 10,
    }).filter((x) => /enfile la main/.test(x.message));
    expect(p).toHaveLength(1);
    expect(p[0].aReprendre).toBe(true);
  });
});
