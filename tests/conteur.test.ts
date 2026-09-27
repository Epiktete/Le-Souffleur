// Le conteur et les trois voies de la parole (CDC §6) : le parent dit, de sa
// propre voix et sans marionnette, la narration que la scène ne peut pas
// montrer. L'application vérifie que ce qu'il dit vient du conte (contrôle 9).
import { describe, expect, it } from 'vitest';
import { LE_TEXTE_DU_CONTE, promptCorrectionActe, promptEcrireActe, promptRelecture } from '../src/prompts';
import { construireDossier } from '../src/services/dossier';
import { dureeElements, partDuConteur } from '../src/services/duree';
import { construireRangees } from '../src/services/pagination';
import { controlerParole, motsInventes } from '../src/services/parole';
import { convertirElements } from '../src/services/pipeline';
import { controler, simulerActe } from '../src/services/scene';
import { schemaElementEcrit, valider } from '../src/services/schemas';
import type { Acte, ElementScript, Marionnette } from '../src/types';

const peluche = (id: string, nom: string): Marionnette => {
  const maintenant = new Date().toISOString();
  return { id, nom, description: '', traits: [], creeLe: maintenant, modifieLe: maintenant };
};
const TROUPE = [peluche('rosette', 'Rosette'), peluche('loup', 'Loup Gris')];
const nomDe = (id: string) => TROUPE.find((m) => m.id === id)?.nom ?? id;

const REFERENCE = 'Il était une fois une petite fille de village. En passant dans un bois, elle '
  + 'rencontra Loup Gris, qui eut bien envie de la manger ; mais il n’osa, à cause de quelques '
  + 'bûcherons qui étaient dans la forêt. — Où vas-tu ? lui dit Loup Gris. — Je vais voir ma '
  + 'mère-grand. Les bûcherons, qui passaient devant la maison, l’entendirent ronfler.';

let n = 0;
const id = () => `e${++n}`;
const conteur = (texte: string): ElementScript => ({ id: id(), type: 'conteur', texte });
const replique = (qui: string, texte: string): ElementScript =>
  ({ id: id(), type: 'replique', marionnetteId: qui, texte });
const entree = (qui: string): ElementScript =>
  ({ id: id(), type: 'entree', marionnetteId: qui, mainMarionnettiste: 'M1G' });

const acte = (elements: ElementScript[], numero = 1): Acte =>
  ({ id: `a${numero}`, numero, titre: 'Au bois', tableauId: 't1', resume: '', elements });

describe('l’élément conteur', () => {
  it('le schéma l’accepte, et la conversion le garde sans marionnette', () => {
    const lu = valider(schemaElementEcrit, { type: 'conteur', texte: '  Il était une fois.  ' });
    expect(lu.ok).toBe(true);
    const [e] = convertirElements([{ type: 'conteur', texte: '  Il était une fois.  ' }], TROUPE);
    expect(e).toMatchObject({ type: 'conteur', texte: 'Il était une fois.' });
  });

  it('ses mots comptent dans la durée, comme des mots dits', () => {
    const d = dureeElements([conteur('Il était une fois une petite fille de village.')]);
    expect(d.mots).toBe(9);
  });

  it('la part du conteur se mesure sur les mots dits', () => {
    const a = acte([conteur('Il était une fois une petite fille.'), entree('rosette'),
      replique('rosette', 'Je vais voir ma mère-grand.')]);
    expect(partDuConteur([a])).toBe(58);
  });

  it('ne prend aucune main : la scène peut être vide', () => {
    const { problemes } = simulerActe([conteur('Il était une fois une petite fille de village.')], 1, nomDe);
    expect(problemes).toEqual([]);
  });

  it('se lit comme une réplique, sous le label du conteur', () => {
    const [rangee] = construireRangees([acte([conteur('Il était une fois.')])]);
    expect(rangee.coulisse).toMatchObject({ conteur: true, dit: 'Il était une fois.' });
    expect(rangee.dialogue).toBeUndefined();
  });
});

describe('le contrôle 9 : la parole vient du conte', () => {
  it('accepte le conteur qui dit le conte mot pour mot', () => {
    const a = acte([conteur('Les bûcherons, qui passaient devant la maison, l’entendirent ronfler.')]);
    expect(controlerParole([a], REFERENCE)).toEqual([]);
  });

  it('accepte un pronom de tête remplacé par le nom qu’il désigne', () => {
    const a = acte([conteur('Loup Gris eut bien envie de la manger ; mais il n’osa, à cause de quelques bûcherons.')]);
    expect(controlerParole([a], REFERENCE.replace('rencontra Loup Gris, qui eut', 'rencontra Loup Gris. Il eut')))
      .toEqual([]);
  });

  it('accepte le remplacement d’un pronom qui suit une conjonction, même par un nom de trois mots', () => {
    // « Et il lui noua son foulard » dit « Et Pilou le Pingouin lui noua son
    // foulard » : quatre mots de tête. Mesuré au relais (cas 3), la tolérance
    // de trois renvoyait l'acte en correction pour un remplacement permis.
    const ref = 'Et il lui noua son foulard, car ça, il savait mieux le faire qu’elle.';
    const a = acte([conteur('Et Pilou le Pingouin lui noua son foulard, car ça, il savait mieux le faire qu’elle.')]);
    // Seule la mesure des mots inventés (mineure) réagit au nom absent de ce
    // texte de référence minuscule : la phrase, elle, doit être reconnue.
    expect(controlerParole([a], ref).filter((p) => p.gravite === 'important')).toEqual([]);
  });

  it('ignore guillemets et tirets : la parole d’un personnage dite sans eux reste le conte', () => {
    const a = acte([conteur('Où vas-tu ? lui dit Loup Gris.')]);
    expect(controlerParole([a], REFERENCE)).toEqual([]);
  });

  it('accepte la fin d’une phrase dont le début est montré', () => {
    const a = acte([conteur('mais il n’osa, à cause de quelques bûcherons qui étaient dans la forêt.')]);
    expect(controlerParole([a], REFERENCE)).toEqual([]);
  });

  it('renvoie en correction un conteur qui invente ou résume', () => {
    const a = acte([conteur('Heureusement, les gentils bûcherons veillaient sur la petite fille.')], 2);
    const [p] = controlerParole([a], REFERENCE);
    expect(p).toMatchObject({ gravite: 'important', acteNumero: 2, position: 1 });
    expect(p.message).toMatch(/n’est pas dans le conte/);
  });

  it('mesure les mots inventés, et avertit au-delà du seuil', () => {
    const fidele = acte([entree('rosette'), replique('rosette', 'Je vais voir ma mère-grand.')]);
    expect(motsInventes([fidele], REFERENCE).part).toBe(0);

    const bavard = acte([entree('rosette'),
      replique('rosette', 'Merci infiniment, ma chère petite Rosette adorée, tout va bien maintenant !')]);
    const problemes = controlerParole([bavard], REFERENCE);
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toMatchObject({ gravite: 'mineur' });
    expect(problemes[0].message).toMatch(/ne viennent pas du conte/);
  });

  it('se lance avec les autres contrôles quand le texte de référence est connu', () => {
    const a = acte([conteur('Heureusement, les gentils bûcherons veillaient sur la petite fille.')]);
    const base = {
      actes: [a], nbMarionnettistes: 1 as const, marionnetteIds: [], nomDe,
      interactionPublic: 'aucune' as const, dureeCibleSecondes: 10,
    };
    expect(controler({ ...base, texteReference: REFERENCE }).some((p) => /pas dans le conte/.test(p.message)))
      .toBe(true);
    expect(controler(base).some((p) => /pas dans le conte/.test(p.message))).toBe(false);
  });
});

describe('les consignes parlent des trois voies', () => {
  const d = construireDossier(TROUPE, {
    dureeMinutes: 5, ageAuditoire: 6, nbMarionnettistes: 1, interactionPublic: 'aucune',
    marionnetteIds: TROUPE.map((m) => m.id), modele: 'essai',
  });

  it('la règle d’écriture nomme la réplique, le discours rendu direct et le conteur', () => {
    expect(LE_TEXTE_DU_CONTE).toMatch(/RÉPLIQUE[\s\S]*DISCOURS RENDU DIRECT[\s\S]*CONTEUR/);
    expect(LE_TEXTE_DU_CONTE).not.toMatch(/c’est une didascalie \(« Renard Rusé claque/);
  });

  it('l’écriture et la correction d’un acte connaissent l’élément conteur', () => {
    expect(promptEcrireActe(d, '', '', '', '', '').system).toContain('{"type": "conteur"');
    expect(promptCorrectionActe(d, '', '', '', '', '', '', '').system).toContain('{"type": "conteur"');
  });
});

describe('la revue complète les actes courts avec le conte', () => {
  const d = construireDossier(TROUPE, {
    dureeMinutes: 5, ageAuditoire: 9, nbMarionnettistes: 1, interactionPublic: 'aucune',
    marionnetteIds: TROUPE.map((m) => m.id), modele: 'essai',
  });
  const courts = '- Acte 2 : 64 mots dits pour 150 prévus ; il en manque environ 86.';

  it('reçoit le compte de l’application et la consigne de compléter sans inventer', () => {
    const p = promptRelecture(d, '', '', '', '', '', false, courts);
    expect(p.user).toContain(`Actes plus courts que prévu (comptés par l’application) :\n${courts}`);
    expect(p.system).toMatch(/tu n’as pas à compter/);
    expect(p.system).toMatch(/le conteur dit mot pour mot/);
    expect(p.system).toMatch(/Rien d’inventé pour tenir la\s+jauge/);
    expect(p.system).toMatch(/Ne propose jamais de couper pour gagner du temps/);
  });

  it('sans acte court, ni la liste ni la consigne n’apparaissent', () => {
    const p = promptRelecture(d, '', '', '', '', '');
    expect(p.user).not.toMatch(/plus courts que prévu/);
    expect(p.system).not.toMatch(/plus courts que prévu/);
  });
});
