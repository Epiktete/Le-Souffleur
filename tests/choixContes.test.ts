// Le choix des contes : deux barrières, l'âge et le
// nombre, puis une note pondérée — nombre, ébauche, durée, espèce, traits.
import { describe, expect, it } from 'vitest';
import INDEX_BRUT from '../wiki/index.json?raw';
import {
  choisirContes,
  compatibiliteEspece,
  especeDansLeTexte,
  especeMarionnette,
  familleRole,
  INTERDIT,
  meilleureDistribution,
  noteCastelet,
  noteDuree,
  noteEbauche,
  noteNombre,
  racineTrait,
  ressemblanceTraits,
  roleParNom,
} from '../src/services/choixContes';
import { compterMots } from '../src/services/mots';
import { MALUS, malusDe, type Rencontre } from '../src/services/historiqueContes';
import { CONTES, conteParId, lireFiche, texteDuConte } from '../src/services/repertoire';

const INDEX = JSON.parse(INDEX_BRUT) as Record<string, { mots: number; cles: string[] }>;
const options = { ageAuditoire: 5, dureeMinutes: 5, nbMarionnettistes: 1 as const };

const m = (id: string, nom: string, traits: string[], description = '') =>
  ({ id, nom, description, traits });

/** Une fiche minimale, pour les cas qu'on veut maîtriser. */
function fiche(roles: string, personnages: number, figurants = 0) {
  return lireFiche(`---
id: essai
titre: Essai
culture: Nulle part
source: "Personne, 2026"
genre: fable
age: [3, 8]
personnages: ${personnages}
figurants: ${figurants}
roles:
${roles}
lieux: [un pré]
ressorts: [défi]
structure: course
---
**Essence.** Rien.`)!;
}

describe('le répertoire', () => {
  it('lit les 156 fiches, sans en perdre une', () => {
    expect(CONTES.length).toBe(156);
    for (const c of CONTES) {
      expect(c.titre, c.id).not.toBe('');
      expect(c.source, c.id).not.toBe('');
      expect(c.roles.filter((r) => !r.figurant).length, c.id).toBe(c.personnages);
      expect(c.corps, c.id).toContain('**Essence.**');
    }
  });

  it('lit les rôles, figurants compris', () => {
    const c = fiche(
      '  - {nom: le Lièvre, espece: lièvre, categorie: animal, traits: [vantard, rusé], fonction: héros}\n'
      + '  - {nom: la Foule, espece: foule, categorie: humain, traits: [bavard], fonction: juge, figurant: true}',
      1, 1,
    );
    expect(c.roles[0]).toMatchObject({ nom: 'le Lièvre', traits: ['vantard', 'rusé'], figurant: false });
    expect(c.roles[1].figurant).toBe(true);
    expect(c.source).toBe('Personne, 2026');
  });

  it('charge le texte intégral d’un conte, sans son en-tête', async () => {
    const texte = await texteDuConte('ru-kolobok');
    expect(texte.length).toBeGreaterThan(500);
    expect(texte.startsWith('#')).toBe(false);
    expect(texte.startsWith('*')).toBe(false);
    expect(await texteDuConte('conte-qui-n-existe-pas')).toBe('');
  });
});

describe('les espèces', () => {
  it('reconnaît une marionnette à son nom, puis à sa description', () => {
    expect(especeMarionnette({ nom: 'Doudou Lapin', description: '' })?.mot).toBe('lapin');
    expect(especeMarionnette({ nom: 'Pompon', description: 'Une vieille ourse en peluche' })?.mot).toBe('ourse');
    expect(especeMarionnette({ nom: 'Titi', description: 'Offert par papa, un petit renard roux' })?.famille)
      .toBe('predateur');
    expect(especeMarionnette({ nom: 'Titi', description: 'Il a peur du feu' })).toBeNull();
  });

  it('un lapin peut jouer un chevreuil, mais pas un loup', () => {
    const lapin = especeMarionnette({ nom: 'Lapin', description: '' });
    const role = (espece: string) => familleRole({
      nom: '', espece, categorie: 'animal', traits: [], fonction: '', figurant: false,
    });
    expect(compatibiliteEspece(lapin, role('chevreuil'))).toBeGreaterThan(0.7);
    expect(compatibiliteEspece(lapin, role('loup'))).toBe(INTERDIT);
    expect(compatibiliteEspece(lapin, role('ogre'))).toBe(INTERDIT);
    // Le loup en agneau est seulement peu probable.
    const loup = especeMarionnette({ nom: 'Loup', description: '' });
    expect(compatibiliteEspece(loup, role('agneau'))).not.toBe(INTERDIT);
  });

  it('une marionnette qu’on ne reconnaît pas n’est pas pénalisée', () => {
    expect(compatibiliteEspece(null, { mot: 'loup', famille: 'predateur' })).toBe(0.5);
  });
});

describe('les traits', () => {
  it('ramène un trait écrit librement à la liste', () => {
    expect(racineTrait('Coquine')).toBe('coquin');
    expect(racineTrait('très gourmande')).toBe('gourmand');
    expect(racineTrait('rusée')).toBe('ruse');
    expect(racineTrait('peureuse')).toBe('peureux');
    expect(racineTrait('rêveuse')).toBe('reveur');
  });

  it('un trait retrouvé vaut plus qu’un voisin, un contraire fait perdre', () => {
    const exact = ressemblanceTraits(['rusé'], ['rusé']).score;
    const voisin = ressemblanceTraits(['rusé'], ['farceur']).score;
    const contraire = ressemblanceTraits(['peureux'], ['courageux']).score;
    expect(exact).toBeGreaterThan(voisin);
    expect(voisin).toBeGreaterThan(0);
    expect(contraire).toBeLessThan(0);
  });

  it('une marionnette sans trait ne casse rien et ne vaut pas moins qu’un contraire', () => {
    // Les traits sont facultatifs depuis qu'ils ne sont plus exigés à la
    // création : l'absence de trait doit valoir « on ne sait pas » (0), pas
    // « ça ne va pas du tout » (négatif), et surtout jamais NaN.
    const sans = ressemblanceTraits([], ['rusé', 'méchant']).score;
    expect(sans).toBe(0);
    expect(Number.isNaN(sans)).toBe(false);
    expect(sans).toBeGreaterThan(ressemblanceTraits(['peureux'], ['courageux']).score);
    // Des deux côtés vides : pas de division par zéro.
    expect(ressemblanceTraits([], []).score).toBe(0);
  });
});

describe('le nombre, une barrière', () => {
  it('jamais plus de rôles principaux que de marionnettes invitées', () => {
    expect(noteNombre(3, { personnages: 3, figurants: 0 })).toBe(1);
    expect(noteNombre(4, { personnages: 3, figurants: 2 })).toBe(0.7);
    expect(noteNombre(2, { personnages: 3, figurants: 0 })).toBeNull();
    // Une marionnette en trop qui ne trouve aucun petit rôle : hors jeu.
    expect(noteNombre(5, { personnages: 3, figurants: 1 })).toBeNull();
  });

  it('une seule marionnette : un conte à deux se joue, le second à la voix, mais un conte seul passe devant', () => {
    const aDeux = noteNombre(1, { personnages: 2, figurants: 0 })!;
    expect(aDeux).toBeGreaterThan(0);
    expect(aDeux).toBeLessThan(noteNombre(1, { personnages: 1, figurants: 0 })!);
    // L'exception ne vaut que pour une marionnette seule.
    expect(noteNombre(2, { personnages: 3, figurants: 0 })).toBeNull();
    expect(noteNombre(1, { personnages: 3, figurants: 0 })).toBeNull();
  });

  it('un conte à plus de rôles que de mains reste jouable, en relais, un peu moins bien', () => {
    expect(noteNombre(3, { personnages: 3, figurants: 0 }, 2)).toBeLessThan(1);
    expect(noteNombre(3, { personnages: 3, figurants: 0 }, 4)).toBe(1);
  });
});

describe('la durée', () => {
  it('un conte de la bonne taille est parfait', () => {
    expect(noteDuree(500, 500)).toBe(1);
    expect(noteDuree(1400, 500)).toBe(1);
  });

  it('étirer une fable minuscule coûte plus que couper un conte long', () => {
    const minuscule = noteDuree(60, 500);
    const long = noteDuree(6000, 500);
    expect(minuscule).toBeLessThan(0.2);
    expect(long).toBeGreaterThan(minuscule);
    expect(long).toBeLessThan(1);
  });

  it('l’index du répertoire est à jour avec les textes', async () => {
    expect(Object.keys(INDEX).sort()).toEqual(CONTES.map((c) => c.id).sort());
    for (const id of ['ru-kolobok', 'ar-ali-baba', 'zh-tirer-les-pousses']) {
      expect(INDEX[id].mots, `${id} : relancez node tools/indexer-contes.mjs`)
        .toBe(compterMots(await texteDuConte(id)));
    }
  });
});

describe('le castelet', () => {
  const c = (
    genre: string,
    personnages = 3,
    structure = 'situation, visite, fuite',
    lieux = 'la maison, le pré',
  ) => ({ genre, personnages, structure, lieux });

  it('une pièce de Guignol vaut plus qu’un mythe des origines', () => {
    expect(noteCastelet(c('pièce de marionnettes')))
      .toBeGreaterThan(noteCastelet(c('conte des origines')));
    expect(noteCastelet(c('conte merveilleux')))
      .toBeGreaterThan(noteCastelet(c('fable')));
  });

  it('la répétition monte la note, quatre décors la baissent', () => {
    const base = noteCastelet(c('fable'));
    expect(noteCastelet(c('fable', 3, 'trois tentatives'))).toBeGreaterThan(base);
    expect(noteCastelet(c('fable', 3, 'situation, visite, fuite', 'a, b, c, d')))
      .toBeLessThan(base);
  });

  it('deux à quatre personnages qui se répondent valent mieux qu’un seul', () => {
    expect(noteCastelet(c('fable', 3))).toBeGreaterThan(noteCastelet(c('fable', 1)));
    expect(noteCastelet(c('fable', 3))).toBeGreaterThan(noteCastelet(c('fable', 6)));
  });

  it('reste toujours entre 0 et 1', () => {
    for (const conte of CONTES) {
      const n = noteCastelet(conte);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('sur le vrai répertoire, Guignol et Perrault passent devant les fables', () => {
    const moyenne = (prefixe: string) => {
      const liste = CONTES.filter((x) => x.id.startsWith(prefixe));
      expect(liste.length).toBeGreaterThan(0);
      return liste.reduce((s2, x) => s2 + noteCastelet(x), 0) / liste.length;
    };
    expect(moyenne('guignol')).toBeGreaterThan(moyenne('fr-perrault'));
    expect(moyenne('fr-perrault')).toBeGreaterThan(moyenne('fr-fontaine'));
  });
});

describe('la durée, une barrière', () => {
  const trois = [
    m('1', 'Doudou Lapin', ['peureux'], 'un lapin'),
    m('2', 'Renard', ['rusé'], 'un renard'),
    m('3', 'Ourse', ['gourmand'], 'une ourse'),
  ];
  const pour = (dureeMinutes: number) =>
    choisirContes(trois, { ageAuditoire: 6, dureeMinutes, nbMarionnettistes: 1 as const });

  it('un conte court est proposé pour un spectacle court, pas pour un long', () => {
    // « Le Corbeau et le Renard » fait 138 mots : parfait pour trois minutes,
    // impossible pour trente. Le conte n'est pas trop court dans l'absolu.
    const plusCourt = (d: number) => Math.min(...pour(d).candidats.map((c) => c.mots));
    expect(plusCourt(2)).toBeLessThan(plusCourt(30));
    expect(plusCourt(30)).toBeGreaterThan(1000);
  });

  it('écarte ce qu’il faudrait étirer plus de quatre fois', () => {
    for (const d of [2, 5, 10, 20, 30]) {
      const mots = d * 100;
      for (const c of pour(d).candidats) {
        expect(c.mots).toBeGreaterThanOrEqual(mots * 0.25);
      }
    }
  });

  it('le répertoire se resserre avec la durée, sans jamais se vider', () => {
    const jouables = [2, 5, 10, 20, 30].map((d) => pour(d).jouables);
    // Strictement décroissant : plus le spectacle est long, moins de contes
    // sont assez fournis pour le tenir.
    for (let i = 1; i < jouables.length; i++) expect(jouables[i]).toBeLessThan(jouables[i - 1]);
    // Et il reste toujours de quoi proposer huit contes.
    for (const d of [2, 5, 10, 20, 30]) expect(pour(d).candidats).toHaveLength(8);
  });
});

describe('l’ébauche', () => {
  it('fait remonter le conte dont elle parle', () => {
    const singe = conteParId('in-crocodile-et-singe')!;
    const autre = conteParId('ru-kolobok')!;
    const ebauche = 'une histoire de singe au bord de la rivière';
    expect(noteEbauche(ebauche, singe, INDEX[singe.id].cles))
      .toBeGreaterThan(noteEbauche(ebauche, autre, INDEX[autre.id].cles));
  });

  it('ne compte pas quand le parent n’a rien écrit', () => {
    expect(noteEbauche('', CONTES[0], [])).toBe(0);
  });
});

describe('l’espèce dans le texte', () => {
  const role = (nom: string, espece: string, categorie: 'animal' | 'humain' = 'animal') =>
    ({ nom, espece, categorie });

  it('une marionnette animale impose son espèce à l’animal du conte', () => {
    const consigne = especeDansLeTexte({ nom: 'Petit Dragon', description: '' }, role('le Renard', 'renard'));
    expect(consigne).toContain('dragon');
    expect(consigne).toContain('pas un·e renard');
  });

  it('reprend le mot tel que le parent l’a écrit, avec ses accents', () => {
    expect(especeDansLeTexte({ nom: 'Babar', description: 'Un éléphant bleu' }, role('le Lion', 'lion')))
      .toContain('éléphant');
  });

  it('une marionnette animale qui joue un humain garde son espèce et prend le métier', () => {
    expect(especeDansLeTexte({ nom: 'Doudou Lapin', description: '' }, role('le Meunier', 'meunier', 'humain')))
      .toContain('fait le métier de meunier');
  });

  it('rien à dire pour une personne, une marionnette inconnue, ou une espèce déjà juste', () => {
    expect(especeDansLeTexte({ nom: 'Guignol', description: '' }, role('le Renard', 'renard'))).toBeNull();
    expect(especeDansLeTexte({ nom: 'Titi', description: '' }, role('le Renard', 'renard'))).toBeNull();
    expect(especeDansLeTexte({ nom: 'Renard Rusé', description: '' }, role('le Renard', 'renard'))).toBeNull();
  });

  it('retrouve un rôle par le nom que le modèle a écrit', () => {
    const singe = conteParId('in-crocodile-et-singe')!;
    expect(roleParNom(singe, 'le crocodile')?.espece).toMatch(/crocodile/);
    expect(roleParNom(singe, 'Personne')).toBeNull();
  });
});

describe('la distribution', () => {
  it('donne à chaque marionnette le rôle qui lui ressemble', () => {
    const c = fiche(
      '  - {nom: le Lièvre, espece: lièvre, categorie: animal, traits: [vantard, paresseux], fonction: héros}\n'
      + '  - {nom: la Tortue, espece: tortue, categorie: animal, traits: [têtu, travailleur], fonction: héros}',
      2,
    );
    const d = meilleureDistribution([
      m('a', 'Lente', ['têtu', 'travailleur'], 'une tortue'),
      m('b', 'Filou', ['vantard', 'paresseux'], 'un lapin'),
    ], c)!;
    expect(d.find((x) => x.marionnetteId === 'b')?.role.espece).toBe('lièvre');
    expect(d.find((x) => x.marionnetteId === 'a')?.role.espece).toBe('tortue');
  });

  it('écarte un conte où un lapin devrait jouer le loup', () => {
    const c = fiche(
      '  - {nom: le Loup, espece: loup, categorie: animal, traits: [méchant], fonction: adversaire}\n'
      + '  - {nom: l\'Ogre, espece: ogre, categorie: merveilleux, traits: [méchant], fonction: adversaire}',
      2,
    );
    expect(meilleureDistribution([m('a', 'Lapin', ['gentil']), m('b', 'Lapine', ['gentil'])], c)).toBeNull();
  });

  it('sans aucun trait, distribue sur la seule espèce', () => {
    const c = fiche(
      '  - {nom: le Lièvre, espece: lièvre, categorie: animal, traits: [vantard, paresseux], fonction: héros}\n'
      + '  - {nom: la Tortue, espece: tortue, categorie: animal, traits: [têtu, travailleur], fonction: héros}',
      2,
    );
    const d = meilleureDistribution([
      m('a', 'Carapace', [], 'une tortue verte'),
      m('b', 'Bond', [], 'un lièvre gris'),
    ], c)!;
    expect(d).not.toBeNull();
    expect(d.find((x) => x.marionnetteId === 'a')?.role.espece).toBe('tortue');
    expect(d.find((x) => x.marionnetteId === 'b')?.role.espece).toBe('lièvre');
    // L'interdit d'espèce reste absolu, traits ou pas.
    expect(d.every((x) => !Number.isNaN(x.traits))).toBe(true);
  });
});

describe('le choix des contes', () => {
  const trois = [
    m('1', 'Doudou Lapin', ['gentil', 'peureux']),
    m('2', 'Renard Rusé', ['rusé', 'menteur']),
    m('3', 'Ourse Gourmande', ['gourmand', 'naïf']),
  ];

  it('ne présente que des contes jouables par ces marionnettes', () => {
    const r = choisirContes(trois, options);
    expect(r.candidats.length).toBe(8);
    for (const c of r.candidats) {
      expect(c.conte.personnages).toBeLessThanOrEqual(3);
      expect(c.conte.personnages + c.conte.figurants).toBeGreaterThanOrEqual(3);
    }
    // Le bon nombre compte le plus : la majorité ont exactement trois rôles.
    expect(r.candidats.filter((c) => c.conte.personnages === 3).length).toBeGreaterThanOrEqual(5);
  });

  it('la durée demandée change les contes proposés', () => {
    const moyenne = (l: number[]) => l.reduce((s, x) => s + x, 0) / l.length;
    const court = choisirContes(trois, { ...options, ageAuditoire: 8, dureeMinutes: 2 }).candidats.map((c) => c.mots);
    const long = choisirContes(trois, { ...options, ageAuditoire: 8, dureeMinutes: 20 }).candidats.map((c) => c.mots);
    expect(moyenne(long)).toBeGreaterThan(moyenne(court));
  });

  it('l’ébauche fait remonter le conte dont elle parle', () => {
    const sans = choisirContes(trois, options).candidats.map((c) => c.conte.id);
    const avec = choisirContes(trois, {
      ...options,
      ebauche: 'un singe, un crocodile et un figuier au bord de la rivière',
    }).candidats.map((c) => c.conte.id);
    expect(avec[0]).toBe('in-crocodile-et-singe');
    expect(avec).not.toEqual(sans);
  });

  it('ne met jamais le lapin dans un rôle de prédateur', () => {
    for (const age of [3, 6, 9]) {
      for (const c of choisirContes(trois, { ...options, ageAuditoire: age }).candidats) {
        const lapin = c.distribution.find((a) => a.marionnetteId === '1')!;
        expect(familleRole(lapin.role).famille, `${c.conte.id} : ${lapin.role.nom}`).not.toBe('predateur');
      }
    }
  });

  it('respecte l’âge, varie les origines, et exclut ce qui a déjà été montré', () => {
    const r = choisirContes(trois, { ...options, ageAuditoire: 3 });
    for (const c of r.candidats) expect(c.conte.ageMin).toBeLessThanOrEqual(4);
    const origines = new Map<string, number>();
    for (const c of r.candidats) {
      const o = c.conte.id.split('-')[0];
      origines.set(o, (origines.get(o) ?? 0) + 1);
    }
    for (const n of origines.values()) expect(n).toBeLessThanOrEqual(3);

    const deja = r.candidats.map((c) => c.conte.id);
    const r2 = choisirContes(trois, { ...options, ageAuditoire: 3, exclus: deja });
    expect(r2.candidats.length).toBeGreaterThanOrEqual(3);
    for (const c of r2.candidats) expect(deja).not.toContain(c.conte.id);
  });

  it('trouve des contes même pour une seule marionnette ou pour six', () => {
    const seul = choisirContes([m('1', 'Lapin', ['peureux', 'rêveur'])], { ...options, ageAuditoire: 6 }).candidats;
    expect(seul.length).toBe(8);
    // Les contes à un seul personnage passent en tête…
    expect(seul[0].conte.personnages).toBe(1);
    expect(seul.filter((c) => c.conte.personnages === 1).length).toBeGreaterThanOrEqual(4);
    // … et le lapin peureux trouve le lièvre peureux de La Fontaine.
    expect(seul.map((c) => c.conte.id)).toContain('fr-fontaine-lievre-grenouilles');
    const six = ['Lapin', 'Renard', 'Ourse', 'Chat', 'Poule', 'Roi'].map((n, i) => m(String(i), n, ['gentil']));
    expect(choisirContes(six, { ...options, nbMarionnettistes: 2, ageAuditoire: 7 }).candidats.length)
      .toBeGreaterThanOrEqual(3);
  });
});

describe('le vivier : générer sans avoir garni la scène', () => {
  const vivier = [
    m('1', 'Doudou Lapin', ['peureux'], 'un lapin gris'),
    m('2', 'Renard Rusé', ['rusé'], 'un renard roux'),
    m('3', 'Ourse Gourmande', ['gourmand'], 'une ourse brune'),
    m('4', 'Pilou le Pingouin', ['curieux'], 'un pingouin'),
    m('5', 'Mémé Tortue', ['sage'], 'une tortue'),
    m('6', 'Zigzag la Souris', ['peureux'], 'une souris grise'),
    m('7', 'Gros Loup', ['méchant'], 'un loup'),
    m('8', 'Roi Corbeau', ['vantard'], 'un corbeau'),
  ];
  const pour = (extra: Record<string, unknown> = {}) =>
    choisirContes([], { ageAuditoire: 6, dureeMinutes: 15, nbMarionnettistes: 1 as const, vivier, ...extra });

  it('prend exactement autant de marionnettes que le conte a de rôles principaux', () => {
    for (const c of pour().candidats) {
      expect(c.distribution).toHaveLength(c.conte.personnages);
      // Chacune ne joue qu'un rôle, et chaque rôle n'est tenu qu'une fois.
      const ids = c.distribution.map((a) => a.marionnetteId);
      expect(new Set(ids).size).toBe(ids.length);
      const roles = c.distribution.map((a) => a.role.nom);
      expect(new Set(roles).size).toBe(roles.length);
      // Tous les rôles principaux sont tenus.
      expect(c.sansMarionnette.filter((r) => !r.figurant)).toHaveLength(0);
    }
  });

  it('la distribution change d’un conte à l’autre', () => {
    const troupes = pour().candidats.map((c) =>
      c.distribution.map((a) => a.marionnetteId).sort().join(','));
    expect(new Set(troupes).size).toBeGreaterThan(1);
  });

  it('sans ébauche, ce qui se joue le mieux au castelet passe devant', () => {
    const moyenne = (l: { notes: { castelet: number } }[]) =>
      l.reduce((s2, c) => s2 + c.notes.castelet, 0) / l.length;
    // Repère : la moyenne de tout le répertoire.
    const fond = CONTES.reduce((s2, c) => s2 + noteCastelet(c), 0) / CONTES.length;
    expect(moyenne(pour().candidats)).toBeGreaterThan(fond);
    expect(moyenne(pour().candidats)).toBeGreaterThan(0.85);
  });

  it('avec une ébauche, c’est la demande écrite qui décide', () => {
    const sans = pour().candidats.map((c) => c.conte.id);
    const avec = pour({ ebauche: 'une histoire de loup dans la forêt' });
    expect(avec.candidats.map((c) => c.conte.id)).not.toEqual(sans);
    // Les contes remontés parlent du loup : leur note d'ébauche n'est pas nulle.
    expect(avec.candidats[0].notes.ebauche).toBeGreaterThan(0);
  });

  it('un vivier de deux marionnettes écarte les contes à trois rôles', () => {
    const r = choisirContes([], {
      ageAuditoire: 6, dureeMinutes: 5, nbMarionnettistes: 1 as const,
      vivier: vivier.slice(0, 2),
    });
    expect(r.candidats.length).toBeGreaterThan(0);
    for (const c of r.candidats) expect(c.conte.personnages).toBeLessThanOrEqual(2);
  });

  it('une seule marionnette dans la marionnethèque reste jouable', () => {
    const r = choisirContes([], {
      ageAuditoire: 6, dureeMinutes: 5, nbMarionnettistes: 1 as const,
      vivier: vivier.slice(0, 1),
    });
    expect(r.candidats.length).toBeGreaterThan(0);
    for (const c of r.candidats) expect(c.distribution).toHaveLength(1);
  });
});

describe('la mémoire des contes rencontrés varie les propositions', () => {
  const trois = [
    m('1', 'Doudou Lapin', ['gentil', 'peureux']),
    m('2', 'Renard Rusé', ['rusé', 'menteur']),
    m('3', 'Ourse Gourmande', ['gourmand', 'naïf']),
  ];

  it('un conte joué pèse moins qu’un conte seulement montré, et le cumul a un plancher', () => {
    const f = malusDe([
      { conte: 'a', type: 'propose' },
      { conte: 'b', type: 'joue' },
      { conte: 'b', type: 'propose' },
      ...Array.from({ length: 10 }, () => ({ conte: 'c', type: 'propose' as const })),
    ]);
    expect(f.a).toBe(MALUS.propose);
    // Montré puis joué : seul le malus du conte joué compte.
    expect(f.b).toBe(MALUS.joue);
    expect(f.c).toBe(MALUS.plancher);
    expect(f.d).toBeUndefined();
  });

  it('avec les mêmes peluches, les séances successives proposent d’autres contes', () => {
    // Sans mémoire, le classement est le même à chaque fois.
    const sansMemoire = choisirContes(trois, options).candidats.slice(0, 3).map((c) => c.conte.id);
    expect(choisirContes(trois, options).candidats.slice(0, 3).map((c) => c.conte.id)).toEqual(sansMemoire);

    // Cinq séances : les trois premiers sont montrés, le premier est joué.
    const historique: Rencontre[] = [];
    const vus = new Set<string>();
    const joues: string[] = [];
    for (let seance = 0; seance < 5; seance++) {
      const top = choisirContes(trois, { ...options, malus: malusDe(historique) })
        .candidats.slice(0, 3).map((c) => c.conte.id);
      // Un conte joué ne revient pas en tête la séance suivante.
      expect(top).not.toContain(joues.at(-1));
      top.forEach((id) => vus.add(id));
      historique.push(...top.map((conte) => ({ conte, type: 'propose' as const })));
      historique.push({ conte: top[0], type: 'joue' });
      joues.push(top[0]);
    }
    expect(vus.size).toBeGreaterThanOrEqual(10);
    expect(new Set(joues).size).toBe(5);
  });
});
