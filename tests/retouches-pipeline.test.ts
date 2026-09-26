// Les retouches de l'âge dans le pipeline (CDC §6, « Les retouches selon
// l'âge ») : le modèle reçoit un texte déjà à la mesure de l'âge, et plus
// aucune consigne d'adoucissement. On intercepte le premier appel au modèle
// et on lit ce qu'il aurait reçu.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consignesAge,
  consignesAgeRetouche,
  promptRelecture,
  promptTransposition,
} from '../src/prompts';
import { construireDossier } from '../src/services/dossier';
import { ecrireScript, proposerHistoires } from '../src/services/pipeline';
import { reference, conteParId } from '../src/services/repertoire';
import type { Acces } from '../src/services/connecteurIa';
import type { Synopsis } from '../src/services/schemas';
import type { Marionnette, ParametresGeneration } from '../src/types';

const peluche = (id: string, nom: string, description: string, traits: string[]): Marionnette => {
  const maintenant = new Date().toISOString();
  return { id, nom, description, traits, creeLe: maintenant, modifieLe: maintenant };
};

const TROUPE = [
  peluche('rosette', 'Rosette', 'Une poupée de chiffon en robe rouge.', ['curieux', 'gentil']),
  peluche('loup', 'Loup Gris', 'Un loup gris en peluche.', ['méchant', 'gourmand']),
  peluche('mamie', 'Mamie Rose', 'Une marionnette de grand-mère en tissu.', ['sage', 'gentil']),
];

const parametres = (ageAuditoire: number): ParametresGeneration => ({
  dureeMinutes: 5,
  ageAuditoire,
  nbMarionnettistes: 1,
  interactionPublic: 'quelques',
  ebauche: 'le Petit Chaperon rouge',
  marionnetteIds: TROUPE.map((m) => m.id),
  modele: 'essai',
});

const acces: Acces = { baseUrl: 'http://essai.local/v1', cle: 'sans-cle', modele: 'essai', fournisseurId: 'openrouter' };

/** Le synopsis du Chaperon, tel que l'étape 1 l'aurait rendu. */
function synopsisChaperon(annonces?: string[]): Synopsis {
  const conte = conteParId('fr-perrault-chaperon-rouge')!;
  return {
    id: conte.id,
    conte: conte.id,
    titre: conte.titre,
    reference: reference(conte),
    accroche: 'Une fillette porte une galette à sa grand-mère.',
    resume: ['Rosette part chez Mamie Rose.', 'Loup Gris la devance.'],
    distribution: [
      { marionnette: 'Rosette', role: 'le Petit Chaperon rouge', note: '' },
      { marionnette: 'Loup Gris', role: 'le Loup', note: '' },
      { marionnette: 'Mamie Rose', role: 'la Mère-grand', note: '' },
    ],
    changements: [],
    ...(annonces ? { annonces } : {}),
  };
}

/**
 * Le premier appel au modèle, intercepté : on garde ses messages et on
 * l'annule, comme le relais. Le pipeline s'arrête là.
 */
async function premierAppel(lancer: (o: Parameters<typeof ecrireScript>[4]) => Promise<unknown>) {
  let requete: { messages: { role: string; content: string }[] } | undefined;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    requete = JSON.parse(String(init.body));
    throw Object.assign(new Error('intercepté'), { name: 'AbortError' });
  }));
  await lancer({
    acces,
    signal: new AbortController().signal,
    surAvancement: () => {},
  }).catch(() => {});
  if (!requete) throw new Error('aucun appel au modèle');
  return {
    system: requete.messages.find((m) => m.role === 'system')!.content,
    user: requete.messages.find((m) => m.role === 'user')!.content,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('les consignes d’âge, quand le texte est déjà retouché', () => {
  const d = construireDossier(TROUPE, parametres(4));

  it('ne demandent plus d’adoucir : le texte l’est déjà', () => {
    const c = consignesAgeRetouche(4);
    expect(c).toMatch(/DÉJÀ/);
    expect(c).not.toMatch(/s’enfuit|adouci comme/);
    expect(consignesAge(4)).toMatch(/s’enfuit/);
  });

  it('la transposition ne retouche plus ni l’âge ni ce qui a mal vieilli', () => {
    const avec = promptTransposition(d, true).system;
    expect(avec).not.toMatch(/trop cruel|caricature d’un peuple/);
    expect(avec).toMatch(/DÉJÀ été retouché/);
    expect(promptTransposition(d).system).toMatch(/trop cruel/);
  });

  it('la revue juge l’écart dans les deux sens', () => {
    const avec = promptRelecture(d, '', '', '', '', '', true).system;
    expect(avec).toMatch(/DANS UN SENS COMME DANS L’AUTRE/);
    expect(avec).not.toMatch(/une cruauté que l’âge ne supporte pas/);
    expect(promptRelecture(d, '', '', '', '', '').system).toMatch(/une cruauté que l’âge ne supporte pas/);
  });
});

describe('la transposition reçoit le texte du conte pour cet âge', () => {
  const transposer = (age: number) => premierAppel((o) => {
    const dossier = construireDossier(TROUPE, parametres(age));
    return ecrireScript(dossier, TROUPE, synopsisChaperon(), '', o);
  });

  it('à 4 ans, la mère-grand s’enferme dans l’armoire', async () => {
    const { system, user } = await transposer(4);
    expect(user).toContain('DÉJÀ RETOUCHÉ POUR 4 ANS');
    expect(user).toContain('s’enfermer dans l’armoire');
    expect(user).toContain('Elle habite bien loin ?');
    expect(user).not.toMatch(/et la mangea\./);
    // Les annonces viennent de la fiche, présentées comme déjà faites.
    expect(user).toMatch(/Retouches de l’âge, DÉJÀ faites[\s\S]*s’enferme dans l’armoire/);
    expect(system).toContain(consignesAgeRetouche(4));
  });

  it('à 9 ans, la fin de Perrault, et la langue ancienne modernisée', async () => {
    const { user } = await transposer(9);
    expect(user).toMatch(/et la mangea\./);
    expect(user).not.toContain('armoire');
    expect(user).toContain('Demeure-t-elle bien loin ?');
    expect(user).not.toContain('seyait');
    expect(user).not.toContain('Retouches de l’âge, DÉJÀ faites');
  });
});

describe('les synopsis savent ce que l’âge change déjà', () => {
  it('le Chaperon est marqué « déjà adapté », avec ce qui change à 4 ans', async () => {
    const { system, user } = await premierAppel((o) =>
      proposerHistoires(TROUPE, parametres(4), o));
    expect(user).toMatch(/fr-perrault-chaperon-rouge[\s\S]*Déjà adapté pour 4 ans : La mère-grand s’enferme/);
    expect(system).not.toMatch(/une\s+fois adouci/);
  });
});
