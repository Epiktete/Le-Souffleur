// Conversions entre ce que renvoie le modèle et le modèle de données.
//
// C'est le point de contact le plus fragile du pipeline : le modèle désigne les
// marionnettes par leur nom, avec sa propre orthographe, et peut inventer.
import { describe, expect, it } from 'vitest';
import { convertirElements, decrireEtatScene, nettoyerReplique, simulerConduite } from '../src/services/pipeline';
import { construireDossier, trouverMarionnetteId } from '../src/services/dossier';
import { attribuerMains, controler, simulerActe } from '../src/services/scene';
import {
  normaliserMain,
  schemaActeEcrit,
  schemaAdaptation,
  schemaRelecture,
  schemaSynopsisPour,
  valider,
} from '../src/services/schemas';
import { construireDossier as faireDossier } from '../src/services/dossier';
import { NOMS_ETAPES } from '../src/services/pipeline';
import { DUREES_ETAPES, ETAPES_ECRITURE, ETAPES_PROPOSITIONS } from '../src/config';
import { tg } from '../src/textes';
import type { ElementEcrit } from '../src/services/schemas';
import type { ElementScript, Main, Marionnette } from '../src/types';

function marionnette(id: string, nom: string): Marionnette {
  const maintenant = new Date().toISOString();
  return { id, nom, description: '', traits: ['gentil'], creeLe: maintenant, modifieLe: maintenant };
}

const distribution = [
  marionnette('id-lapin', 'Doudou Lapin'),
  marionnette('id-renard', 'Renard Rusé'),
  marionnette('id-ourse', 'Ourse'),
];

/** Un synopsis complet, tel que le schéma l'exige. */
function synopsis(conte: string, distribution = [
  { marionnette: 'Doudou Lapin', role: 'le Lièvre' },
  { marionnette: 'Renard Rusé', role: 'le Renard' },
  { marionnette: 'Ourse', role: 'l’Ours' },
]) {
  return {
    conte,
    titre: 'T',
    accroche: 'Une ligne.',
    resume: ['Lapin rencontre Renard.', 'Ourse arrive.'],
    distribution,
    changements: [],
  };
}

describe('trouverMarionnetteId', () => {
  it('retrouve un nom exact', () => {
    expect(trouverMarionnetteId('Doudou Lapin', distribution)).toBe('id-lapin');
  });

  it('ignore la casse, les accents et les espaces en trop', () => {
    expect(trouverMarionnetteId('doudou lapin', distribution)).toBe('id-lapin');
    expect(trouverMarionnetteId('  DOUDOU   LAPIN ', distribution)).toBe('id-lapin');
    expect(trouverMarionnetteId('renard ruse', distribution)).toBe('id-renard');
  });

  it('accepte un prénom seul quand il est sans ambiguïté', () => {
    expect(trouverMarionnetteId('Doudou', distribution)).toBe('id-lapin');
    expect(trouverMarionnetteId('Renard', distribution)).toBe('id-renard');
  });

  it('refuse de deviner quand plusieurs noms correspondent', () => {
    const ambigu = [marionnette('a', 'Loulou Lapin'), marionnette('b', 'Loulou Renard')];
    expect(trouverMarionnetteId('Loulou', ambigu)).toBeUndefined();
  });

  it('renvoie undefined pour un nom inconnu', () => {
    expect(trouverMarionnetteId('Dragon', distribution)).toBeUndefined();
  });
});

describe('convertirElements', () => {
  it('convertit chaque type d’élément', () => {
    const ecrits: ElementEcrit[] = [
      { type: 'entree', marionnette: 'Doudou Lapin', main: 'M1G' },
      { type: 'replique', marionnette: 'Doudou Lapin', texte: 'Bonjour !', ton: 'joyeux' },
      { type: 'didascalie', texte: 'Il saute.' },
      { type: 'adresse_public', marionnette: 'Doudou Lapin', texte: 'Ça va ?', attenteReponse: true },
      { type: 'note_marionnettiste', texte: 'Attendre les enfants.' },
      { type: 'sortie', marionnette: 'Doudou Lapin', main: 'M1G' },
    ];
    const r = convertirElements(ecrits, distribution);

    expect(r.map((e) => e.type)).toEqual([
      'entree', 'replique', 'didascalie', 'adresse_public', 'note_marionnettiste', 'sortie',
    ]);
    expect(r[0]).toMatchObject({ marionnetteId: 'id-lapin', mainMarionnettiste: 'M1G' });
    expect(r[1]).toMatchObject({ texte: 'Bonjour !', ton: 'joyeux' });
    expect(r[3]).toMatchObject({ attenteReponse: true });
  });

  it('donne un identifiant unique à chaque élément', () => {
    const ecrits: ElementEcrit[] = [
      { type: 'didascalie', texte: 'Un.' },
      { type: 'didascalie', texte: 'Deux.' },
    ];
    const r = convertirElements(ecrits, distribution);
    expect(r[0].id).not.toBe(r[1].id);
  });

  it('transforme un nom inconnu en note à corriger, sans perdre l’acte', () => {
    const ecrits: ElementEcrit[] = [
      { type: 'replique', marionnette: 'Doudou Lapin', texte: 'Bonjour.' },
      { type: 'replique', marionnette: 'Dragon', texte: 'Grrr.' },
      { type: 'replique', marionnette: 'Ourse', texte: 'Miam.' },
    ];
    const r = convertirElements(ecrits, distribution);

    // Les trois éléments sont là : rien n'est perdu.
    expect(r).toHaveLength(3);
    expect(r[1].type).toBe('note_marionnettiste');
    expect((r[1] as { texte: string }).texte).toContain('Dragon');
    expect((r[1] as { texte: string }).texte).toContain('À corriger');
    // Les éléments valides restent intacts.
    expect(r[2]).toMatchObject({ type: 'replique', marionnetteId: 'id-ourse' });
  });
});

describe('decrireEtatScene', () => {
  const nomDe = (id: string) => distribution.find((m) => m.id === id)?.nom ?? id;

  it('décrit une scène vide', () => {
    expect(decrireEtatScene({}, nomDe)).toContain('vide');
  });

  it('décrit qui est en scène et dans quelle main', () => {
    const texte = decrireEtatScene({ M1G: 'id-lapin', M1D: 'id-renard' }, nomDe);
    expect(texte).toContain('Doudou Lapin');
    expect(texte).toContain('M1G');
    expect(texte).toContain('Renard Rusé');
  });
});

describe('simulerConduite : le garde-fou de l’étape 6', () => {
  const conduiteDeBase = {
    titre: 'Test',
    pitch: '',
    morale: '',
    tableaux: [{ id: 't1', titre: 'La forêt', description: '', accessoires: [], promptImage: '' }],
    actes: [
      {
        numero: 1,
        titre: 'Acte 1',
        tableauId: 't1',
        resume: '',
        temps: [],
        mouvements: [
          { type: 'entree' as const, marionnette: 'Doudou Lapin', main: 'M1G' as const },
          { type: 'entree' as const, marionnette: 'Renard Rusé', main: 'M1D' as const },
        ],
        momentsPublic: [],
        budgetMots: 200,
      },
    ],
  };

  /** Une distribution de deux : la conduite de base les fait toutes jouer. */
  const duo = [distribution[0], distribution[1]];

  it('accepte une conduite jouable', () => {
    expect(simulerConduite(conduiteDeBase, 1, duo)).toEqual([]);
  });

  it('refuse une conduite qui laisse une marionnette en coulisse', () => {
    // Vérifié AVANT l'écriture : un personnage absent du spectacle entier ne
    // porte aucun numéro d'acte, et aucune correction d'acte ne le rattraperait.
    const p = simulerConduite(conduiteDeBase, 1, distribution);
    expect(p).toHaveLength(1);
    expect(p[0].gravite).toBe('bloquant');
    expect(p[0].message).toContain('Ourse');
    expect(p[0].message).toContain('n’entre jamais en scène');
  });

  it('rejette trois marionnettes pour un marionnettiste, AVANT l’écriture', () => {
    const conduite = structuredClone(conduiteDeBase);
    conduite.actes[0].mouvements.push({ type: 'entree', marionnette: 'Ourse', main: 'M2G' });
    const p = simulerConduite(conduite, 1, distribution);
    expect(p).toHaveLength(1);
    expect(p[0].gravite).toBe('bloquant');
    expect(p[0].message).toContain('Ourse');
  });

  it('accepte la même conduite avec deux marionnettistes', () => {
    const conduite = structuredClone(conduiteDeBase);
    conduite.actes[0].mouvements.push({ type: 'entree', marionnette: 'Ourse', main: 'M2G' });
    expect(simulerConduite(conduite, 2, distribution)).toEqual([]);
  });

  it('refuse une navette : la même marionnette qui entre trois fois', () => {
    // Avec un marionnettiste — deux mains — et trois personnages, un acte
    // prend facilement la forme A-B-A-B : l'un sort pour que l'autre entre.
    // La machine ne juge pas un texte, mais elle compte les entrées.
    const conduite = structuredClone(conduiteDeBase);
    conduite.actes[0].mouvements = [
      { type: 'entree', marionnette: 'Doudou Lapin', main: 'M1G' },
      { type: 'entree', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'sortie', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'entree', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'sortie', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'entree', marionnette: 'Renard Rusé', main: 'M1D' },
    ];
    const p = simulerConduite(conduite, 1, duo);
    expect(p.some((x) => x.message.includes('navette'))).toBe(true);
    expect(p.some((x) => x.gravite === 'bloquant')).toBe(true);
  });

  it('refuse un acte où l’on passe son temps à se relayer', () => {
    const conduite = structuredClone(conduiteDeBase);
    conduite.actes[0].mouvements = [
      { type: 'entree', marionnette: 'Doudou Lapin', main: 'M1G' },
      { type: 'entree', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'sortie', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'sortie', marionnette: 'Doudou Lapin', main: 'M1G' },
      { type: 'entree', marionnette: 'Doudou Lapin', main: 'M1G' },
      { type: 'entree', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'sortie', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'sortie', marionnette: 'Doudou Lapin', main: 'M1G' },
      { type: 'entree', marionnette: 'Renard Rusé', main: 'M1D' },
    ];
    const p = simulerConduite(conduite, 1, duo);
    expect(p.some((x) => x.message.includes('se relayer'))).toBe(true);
  });

  it('signale un nom de marionnette inventé', () => {
    const conduite = structuredClone(conduiteDeBase);
    conduite.actes[0].mouvements.push({ type: 'entree', marionnette: 'Dragon', main: 'M1G' });
    const p = simulerConduite(conduite, 1, distribution);
    expect(p[0].message).toContain('Dragon');
    expect(p[0].message).toContain('distribution');
  });

  it('garde l’état de scène entre les actes', () => {
    const conduite = structuredClone(conduiteDeBase);
    conduite.actes.push({
      numero: 2,
      titre: 'Acte 2',
      tableauId: 't1',
      resume: '',
      temps: [],
      // Le lapin est déjà en scène depuis l'acte 1 : le refaire entrer est une
      // erreur que la simulation doit détecter.
      mouvements: [{ type: 'entree' as const, marionnette: 'Doudou Lapin', main: 'M1G' as const }],
      momentsPublic: [],
      budgetMots: 200,
    });
    const p = simulerConduite(conduite, 1, duo);
    expect(p).toHaveLength(1);
    expect(p[0].acteNumero).toBe(2);
  });
});

describe('l’application attribue les mains, pas le modèle', () => {
  const entree = (id: string, main: string) =>
    ({ id: `e-${id}-${main}`, type: 'entree' as const, marionnetteId: id, mainMarionnettiste: main as Main });
  const sortie = (id: string, main: string) =>
    ({ id: `s-${id}-${main}`, type: 'sortie' as const, marionnetteId: id, mainMarionnettiste: main as Main });

  it('garde la main voulue quand elle est libre', () => {
    // Ce que le modèle indique reste une préférence : la mise en scène qu'il
    // avait en tête est respectée quand elle est jouable.
    const r = attribuerMains([entree('id-lapin', 'M1D')], 1);
    expect((r[0] as { mainMarionnettiste: string }).mainMarionnettiste).toBe('M1D');
  });

  it('corrige une main qui n’existe pas pour ce nombre de marionnettistes', () => {
    // Avec un seul marionnettiste, M2G n'existe pas. Le spectacle ne doit pas
    // en mourir : il y a une main libre, on la prend.
    const r = attribuerMains([entree('id-lapin', 'M2G')], 1);
    expect((r[0] as { mainMarionnettiste: string }).mainMarionnettiste).toBe('M1G');
  });

  it('ne met jamais deux marionnettes sur la même main', () => {
    const r = attribuerMains([entree('id-lapin', 'M1G'), entree('id-renard', 'M1G')], 1);
    const mains = r.map((e) => (e as { mainMarionnettiste: string }).mainMarionnettiste);
    expect(new Set(mains).size).toBe(2);
  });

  it('fait sortir par la main qui tient vraiment la marionnette', () => {
    const r = attribuerMains([entree('id-lapin', 'M1G'), sortie('id-lapin', 'M2D')], 1);
    expect((r[1] as { mainMarionnettiste: string }).mainMarionnettiste).toBe('M1G');
  });

  it('tient compte de l’acte précédent', () => {
    // Une marionnette peut être restée en scène d'un acte au suivant.
    const r = attribuerMains([entree('id-renard', 'M1G')], 1, { M1G: 'id-lapin' });
    expect((r[0] as { mainMarionnettiste: string }).mainMarionnettiste).toBe('M1D');
  });

  it('ne corrige rien quand plus aucune main n’est libre', () => {
    // Trois marionnettes pour deux mains : c'est un vrai problème de scène,
    // et c'est à la simulation de le dire, pas à l'attribution de le masquer.
    const r = attribuerMains(
      [entree('id-lapin', 'M1G'), entree('id-renard', 'M1D'), entree('id-ourse', 'M1G')], 1,
    );
    const p = simulerActe(r, 1, (id) => id);
    expect(p.problemes.some((x) => x.gravite === 'bloquant')).toBe(true);
  });
});

describe('ce que la machine attrape sur le script écrit', () => {
  const contexte = (elements: ElementScript[]) => ({
    actes: [{ id: 'a1', numero: 1, titre: 'Acte 1', tableauId: 't1', resume: '', elements }],
    nbMarionnettistes: 1 as const,
    marionnetteIds: distribution.map((m) => m.id),
    nomDe: (id: string) => distribution.find((m) => m.id === id)?.nom ?? id,
    interactionPublic: 'quelques' as const,
    dureeCibleSecondes: 300,
  });

  it('refuse un changement de peluche sans respiration', () => {
    // Retirer une peluche et en enfiler une autre sur la même main en une
    // fraction de seconde, pendant que l'autre reste figé : ça se voit.
    const p = controler(contexte([
      { id: '1', type: 'sortie', marionnetteId: 'id-renard', mainMarionnettiste: 'M1D' },
      { id: '2', type: 'entree', marionnetteId: 'id-ourse', mainMarionnettiste: 'M1D' },
    ]));
    expect(p.some((x) => x.message.includes('n’a pas le temps'))).toBe(true);
  });

  it('accepte le même échange si une réplique les sépare', () => {
    const p = controler(contexte([
      { id: '1', type: 'entree', marionnetteId: 'id-lapin', mainMarionnettiste: 'M1G' },
      { id: '2', type: 'sortie', marionnetteId: 'id-lapin', mainMarionnettiste: 'M1G' },
      { id: '3', type: 'didascalie', texte: 'Un silence.' },
      { id: '4', type: 'entree', marionnetteId: 'id-ourse', mainMarionnettiste: 'M1G' },
    ]));
    expect(p.some((x) => x.message.includes('n’a pas le temps'))).toBe(false);
  });

  it('refuse un ton écrit comme une didascalie', () => {
    // Le parent lit en jouant : un ton placé après la réplique arrive trop tard.
    const p = controler(contexte([
      { id: '1', type: 'entree', marionnetteId: 'id-lapin', mainMarionnettiste: 'M1G' },
      { id: '2', type: 'replique', marionnetteId: 'id-lapin', texte: 'Alors ?' },
      { id: '3', type: 'didascalie', texte: 'Voix traînante, impatient.' },
    ]));
    expect(p.some((x) => x.message.includes('manière de parler'))).toBe(true);
  });

  it('refuse une note qui redécrit le décor', () => {
    // Trois spectacles sur six portaient une note d'acte qui contredisait la
    // liste de préparation, jusqu'à « Aucun décor ni accessoire ».
    const p = controler(contexte([
      { id: '1', type: 'entree', marionnetteId: 'id-lapin', mainMarionnettiste: 'M1G' },
      { id: '2', type: 'note_marionnettiste', texte: 'Aucun décor : les coussins sont imaginaires.' },
    ]));
    expect(p.some((x) => x.message.includes('décrit le décor'))).toBe(true);
  });

  it('laisse passer une note de jeu ordinaire', () => {
    const p = controler(contexte([
      { id: '1', type: 'entree', marionnetteId: 'id-lapin', mainMarionnettiste: 'M1G' },
      { id: '2', type: 'note_marionnettiste', texte: 'Attendre vraiment la réponse des enfants.' },
    ]));
    expect(p.some((x) => x.message.includes('décrit le décor'))).toBe(false);
  });
});

describe('ce que le schéma de l’adaptation tolère', () => {
  // Tolérant sur ce qui n'est pas vital, strict sur ce qui casserait
  // l'application : c'est la règle du fichier des schémas.
  const base = {
    titre: 'T',
    tableaux: [{ id: 't1', titre: 'Le fond', description: 'Un drap.' }],
    actes: [{ numero: 1, titre: 'A1', tableauId: 't1' }],
  };

  it('accepte une adaptation sans changements ni passage', () => {
    const r = valider(schemaAdaptation, base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valeur.changements).toEqual([]);
      expect(r.valeur.actes[0].passage).toBe('');
    }
  });

  it('accepte un seul acte : une fable courte peut tenir en un', () => {
    expect(valider(schemaAdaptation, base).ok).toBe(true);
  });

  it('reste strict sur ce qui casserait l’application', () => {
    // Un acte sans tableau ne peut pas être affiché : là, on refuse.
    expect(valider(schemaAdaptation, { ...base, actes: [{ numero: 1, titre: 'A1' }] }).ok).toBe(false);
    expect(valider(schemaAdaptation, { ...base, actes: [] }).ok).toBe(false);
  });
});

describe('le schéma des synopsis, construit pour chaque appel', () => {
  const contes = ['a', 'b', 'c', 'd'];
  const noms = ['Doudou Lapin', 'Renard Rusé', 'Ourse'];
  const schema = schemaSynopsisPour(contes, noms);

  it('accepte trois synopsis sur trois contes présentés', () => {
    expect(valider(schema, { synopsis: [synopsis('a'), synopsis('b'), synopsis('c')] }).ok).toBe(true);
  });

  it('refuse un conte qui n’était pas dans la liste, et dit lesquels choisir', () => {
    const r = valider(schema, { synopsis: [synopsis('a'), synopsis('b'), synopsis('z')] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain('a, b, c, d');
  });

  it('refuse deux synopsis sur le même conte', () => {
    expect(valider(schema, { synopsis: [synopsis('a'), synopsis('a'), synopsis('b')] }).ok).toBe(false);
  });

  it('refuse une marionnette oubliée ou inventée, sans se soucier des accents', () => {
    const oubli = [{ marionnette: 'Doudou Lapin', role: 'x' }, { marionnette: 'Renard Rusé', role: 'y' }];
    expect(valider(schema, { synopsis: [synopsis('a', oubli), synopsis('b'), synopsis('c')] }).ok).toBe(false);
    const inventee = [...oubli, { marionnette: 'Ourse', role: 'z' }, { marionnette: 'Loup', role: 'w' }];
    expect(valider(schema, { synopsis: [synopsis('a', inventee), synopsis('b'), synopsis('c')] }).ok).toBe(false);
    const accents = [{ marionnette: 'doudou lapin', role: 'x' }, { marionnette: 'RENARD RUSE', role: 'y' },
      { marionnette: 'Ourse', role: 'z' }];
    expect(valider(schema, { synopsis: [synopsis('a', accents), synopsis('b'), synopsis('c')] }).ok).toBe(true);
  });

  it('refuse un titre qui reprend le nom d’une marionnette au lieu du titre du conte', () => {
    const titre = (s: ReturnType<typeof synopsis>, x: string) => ({ ...s, titre: x });
    const r = valider(schema, { synopsis: [titre(synopsis('a'), 'Doudou Lapin et la Tortue'), synopsis('b'), synopsis('c')] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain('Doudou Lapin');
    // Un nom d'un seul mot peut être l'espèce du titre d'origine.
    expect(valider(schema, { synopsis: [titre(synopsis('a'), 'L’Ourse et les deux amis'), synopsis('b'), synopsis('c')] }).ok).toBe(true);
  });

  it('refuse moins de trois synopsis', () => {
    expect(valider(schema, { synopsis: [synopsis('a'), synopsis('b')] }).ok).toBe(false);
  });
});

describe('construireDossier', () => {
  it('calcule le budget de mots à partir de la durée', () => {
    const d = construireDossier(distribution, {
      dureeMinutes: 5, ageAuditoire: 6, nbMarionnettistes: 1,
      interactionPublic: 'quelques',
    });
    expect(d.budgetMotsTotal).toBe(500); // 5 min à 100 mots/min
  });

  it('ignore une ébauche vide ou faite d’espaces', () => {
    const d = construireDossier(distribution, {
      dureeMinutes: 5, ageAuditoire: 6, nbMarionnettistes: 1,
      interactionPublic: 'quelques', ebauche: '   ',
    });
    expect(d.ebauche).toBeUndefined();
  });
});

describe('schémas zod : ce qui passe et ce qui ne passe pas', () => {
  it('refuse un type d’élément inconnu', () => {
    const r = valider(schemaActeEcrit, {
      elements: [{ type: 'chanson', marionnette: 'Doudou Lapin', texte: 'La la la' }],
    });
    expect(r.ok).toBe(false);
  });

  it('ne perd plus un spectacle pour un code de main mal écrit', () => {
    // Deux générations du parent ont échoué là-dessus, sur une histoire par
    // ailleurs complète : « Invalid option: expected one of M1G|M1D|M2G|M2D ».
    // C'était une exigence mal placée — la main n'est pas une information que
    // le modèle détient, c'est une conséquence de qui entre et qui sort, et
    // l'application la recalcule de toute façon.
    for (const ecrit of ['m1g', 'M1 G', 'main gauche', 'G', 'M1-G', 'M3G']) {
      const r = valider(schemaActeEcrit, {
        elements: [{ type: 'entree', marionnette: 'Doudou Lapin', main: ecrit }],
      });
      expect(r.ok).toBe(true);
    }
  });

  it('remet chaque écriture de la main dans sa forme canonique', () => {
    expect(normaliserMain('m1d')).toBe('M1D');
    expect(normaliserMain('M2 G')).toBe('M2G');
    expect(normaliserMain('main droite')).toBe('M1D');
    expect(normaliserMain('gauche')).toBe('M1G');
    expect(normaliserMain(undefined)).toBe('M1G');
  });

  it('accepte une adresse au public sans attenteReponse, en la mettant à false', () => {
    const r = valider(schemaActeEcrit, {
      elements: [{ type: 'adresse_public', marionnette: 'Doudou Lapin', texte: 'Alors ?' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valeur.elements[0]).toMatchObject({ attenteReponse: false });
  });

  it('donne un message d’erreur exploitable pour relancer le modèle', () => {
    const r = valider(schemaActeEcrit, { elements: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreur).toContain('elements');
      expect(r.erreur.length).toBeGreaterThan(5);
    }
  });
});

describe('les étapes affichées', () => {
  it('couvrent exactement celles que le pipeline peut annoncer', () => {
    // Une étape ajoutée au pipeline sans l'être à la liste affichée rendrait
    // l'étape en cours introuvable : toutes les puces s'éteindraient, et la
    // génération paraîtrait avoir planté.
    const affichees = [...ETAPES_PROPOSITIONS, ...ETAPES_ECRITURE].sort();
    expect(affichees).toEqual([...NOMS_ETAPES].sort());
  });

  it('ne répètent aucune étape dans les deux phases', () => {
    const affichees = [...ETAPES_PROPOSITIONS, ...ETAPES_ECRITURE];
    expect(new Set(affichees).size).toBe(affichees.length);
  });

  it('portent toutes une durée typique et un libellé', () => {
    for (const etape of NOMS_ETAPES) {
      expect(DUREES_ETAPES[etape]).toBeGreaterThan(0);
      expect(tg.etapes[etape]).toBeTruthy();
    }
  });
});

describe('nettoyerReplique', () => {
  it('retire les tirets de dialogue repris du conte', () => {
    expect(nettoyerReplique('— — Eh bien, qu’y a-t-il ?')).toBe('Eh bien, qu’y a-t-il ?');
    expect(nettoyerReplique('- Attends-moi !')).toBe('Attends-moi !');
  });

  it('ne touche pas au reste de la réplique', () => {
    expect(nettoyerReplique('Pas par là — par ici !')).toBe('Pas par là — par ici !');
  });

  it('s’applique aux répliques et aux apartés convertis', () => {
    const r = convertirElements([
      { type: 'entree', marionnette: 'Doudou Lapin', main: 'M1G' },
      { type: 'replique', marionnette: 'Doudou Lapin', texte: '— Bonjour.' },
      { type: 'adresse_public', marionnette: 'Doudou Lapin', texte: '— Vous l’avez vu ?', attenteReponse: false },
    ], distribution);
    expect((r[1] as { texte: string }).texte).toBe('Bonjour.');
    expect((r[2] as { texte: string }).texte).toBe('Vous l’avez vu ?');
  });
});

describe('le schéma de la revue finale tolère les petits modèles', () => {
  it('un acte 0 ou un élément 0 valent « tout le spectacle », au lieu de tout arrêter', () => {
    // Un petit modèle numérote 0 un problème qui concerne tout le spectacle.
    const r = valider(schemaRelecture, {
      problemes: [
        { acte: 0, element: 0, gravite: 'mineur', probleme: 'Un détail général.' },
        { acte: '2', element: 5, gravite: 'important', probleme: 'Un aparté mal placé.' },
        { acte: null, gravite: 'Important', probleme: 'Une réplique inventée.' },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valeur.remarques[0].acte).toBeUndefined();
      expect(r.valeur.remarques[0].element).toBeUndefined();
      expect(r.valeur.remarques[1].acte).toBe(2);
      expect(r.valeur.remarques[2].gravite).toBe('important');
    }
  });

  it('lit les remarques et les modifications proposées, ou les anciens noms de champs', () => {
    const r = valider(schemaRelecture, {
      remarques: [{ acte: 1, gravite: 'important', remarque: 'On ne sait pas qui parle.', modification: 'Nommer le Loup.' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valeur.remarques[0].remarque).toBe('On ne sait pas qui parle.');
      expect(r.valeur.remarques[0].modification).toBe('Nommer le Loup.');
    }
    const ancien = valider(schemaRelecture, { problemes: [{ probleme: 'x', correction: 'y' }] });
    expect(ancien.ok && ancien.valeur.remarques[0].modification).toBe('y');
  });

  it('une gravité inconnue compte comme un détail', () => {
    const r = valider(schemaRelecture, { problemes: [{ gravite: 'moyen', probleme: 'x' }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valeur.remarques[0].gravite).toBe('mineur');
  });
});
