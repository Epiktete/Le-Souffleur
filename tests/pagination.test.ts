// Découpage en rangées et en pages du mode lecture (CDC §9).
//
// C'est la logique qui permet au marionnettiste de tourner la page du pied
// plutôt que de faire défiler avec des peluches sur les mains : elle mérite
// d'être vérifiée sans navigateur.
import { describe, expect, it } from 'vitest';
import {
  construireRangees,
  couperEnPhrases,
  decouperTropLongues,
  pageDeLaRangee,
  paginer,
} from '../src/services/pagination';
import type { Acte, ElementScript, Main } from '../src/types';

let n = 0;
const id = () => `e${++n}`;

const replique = (texte = 'Bonjour.'): ElementScript =>
  ({ id: id(), type: 'replique', marionnetteId: 'lapin', texte });
const adresse = (texte = 'Et vous ?'): ElementScript =>
  ({ id: id(), type: 'adresse_public', marionnetteId: 'lapin', texte, attenteReponse: true });
const didascalie = (texte = 'Il saute.'): ElementScript =>
  ({ id: id(), type: 'didascalie', texte });
const note = (texte = 'Attendre.'): ElementScript =>
  ({ id: id(), type: 'note_marionnettiste', texte });
const entree = (main: Main = 'M1G'): ElementScript =>
  ({ id: id(), type: 'entree', marionnetteId: 'lapin', mainMarionnettiste: main });
const sortie = (main: Main = 'M1G'): ElementScript =>
  ({ id: id(), type: 'sortie', marionnetteId: 'lapin', mainMarionnettiste: main });

function acte(numero: number, elements: ElementScript[], tableauId = 't1'): Acte {
  return { id: `a${numero}`, numero, titre: `Acte ${numero}`, tableauId, resume: '', elements };
}

describe('construireRangees : un seul fil', () => {
  it('garde chaque élément à sa place, dans l’ordre du script', () => {
    const r = construireRangees([acte(1, [
      entree(),
      replique('Ma carotte !'),
      didascalie('Il cherche.'),
      note('Laisser répondre.'),
      adresse(),
      sortie(),
    ])]);

    expect(r.map((x) => (x.dialogue ?? x.scene)!.type)).toEqual([
      'entree', 'replique', 'didascalie', 'note_marionnettiste', 'adresse_public', 'sortie',
    ]);
    // Les dialogues d'un côté, les indications de l'autre : jamais les deux.
    for (const x of r) expect(Boolean(x.dialogue) !== Boolean(x.scene)).toBe(true);
    expect(r[1].dialogue?.type).toBe('replique');
    expect(r[4].dialogue?.type).toBe('adresse_public');
  });

  it('marque la première rangée de chaque acte', () => {
    const r = construireRangees([
      acte(1, [entree(), replique()]),
      acte(2, [replique()]),
    ]);
    expect(r.map((x) => x.debutActe)).toEqual([true, false, true]);
  });

  it('porte l’acte et le tableau sur chaque rangée', () => {
    const r = construireRangees([acte(2, [replique()], 't7')]);
    expect(r[0].acteNumero).toBe(2);
    expect(r[0].tableauId).toBe('t7');
  });

  it('ne plante pas sur un acte vide', () => {
    expect(construireRangees([acte(1, [])])).toEqual([]);
  });
});

describe('paginer : ce qui tient à l’écran', () => {
  /** Quatre rangées de 100 px dans un seul acte. */
  function quatreRangees() {
    const r = construireRangees([acte(1, [
      replique('un'), replique('deux'), replique('trois'), replique('quatre'),
    ])]);
    const hauteurs = new Map(r.map((x) => [x.id, 100]));
    return { r, hauteurs };
  }

  it('remplit une page puis passe à la suivante', () => {
    const { r, hauteurs } = quatreRangees();
    const pages = paginer(r, hauteurs, 250);
    // 2 rangées par page : la troisième dépasserait 250 px.
    expect(pages.map((p) => p.rangees.length)).toEqual([2, 2]);
  });

  it('ne coupe jamais une rangée en deux', () => {
    const { r, hauteurs } = quatreRangees();
    const pages = paginer(r, hauteurs, 250);
    const total = pages.reduce((t, p) => t + p.rangees.length, 0);
    expect(total).toBe(4);
    // Aucune rangée n'apparaît deux fois.
    const ids = pages.flatMap((p) => p.rangees.map((x) => x.id));
    expect(new Set(ids).size).toBe(4);
  });

  it('laisse seule une rangée plus haute que la page', () => {
    const r = construireRangees([acte(1, [replique('court'), replique('immense'), replique('court')])]);
    const hauteurs = new Map([[r[0].id, 50], [r[1].id, 900], [r[2].id, 50]]);
    const pages = paginer(r, hauteurs, 300);
    // La tirade occupe sa page, sans être tronquée.
    expect(pages.map((p) => p.rangees.length)).toEqual([1, 1, 1]);
  });

  it('commence une nouvelle page à chaque acte', () => {
    const r = construireRangees([
      acte(1, [replique('un')]),
      acte(2, [replique('deux')]),
    ]);
    const hauteurs = new Map(r.map((x) => [x.id, 10]));
    // Les deux tiendraient largement ensemble, mais l'acte change.
    const pages = paginer(r, hauteurs, 1000);
    expect(pages).toHaveLength(2);
  });

  it('commence une nouvelle page à chaque changement de tableau', () => {
    const r = construireRangees([
      acte(1, [replique('un')], 't1'),
      acte(2, [replique('deux')], 't2'),
    ]);
    const hauteurs = new Map(r.map((x) => [x.id, 10]));
    const pages = paginer(r, hauteurs, 1000);
    expect(pages[1].changementTableau).toBe(true);
    // La première page n'annonce aucun changement : c'est le décor de départ.
    expect(pages[0].changementTableau).toBe(false);
  });

  it('ne signale pas de changement quand deux actes partagent le tableau', () => {
    const r = construireRangees([
      acte(1, [replique('un')], 't1'),
      acte(2, [replique('deux')], 't1'),
    ]);
    const hauteurs = new Map(r.map((x) => [x.id, 10]));
    expect(paginer(r, hauteurs, 1000)[1].changementTableau).toBe(false);
  });

  it('traite une hauteur inconnue comme nulle plutôt que de planter', () => {
    const { r } = quatreRangees();
    const pages = paginer(r, new Map(), 500);
    expect(pages).toHaveLength(1);
    expect(pages[0].rangees).toHaveLength(4);
  });

  it('renvoie une liste vide sans rangée ou sans hauteur de page', () => {
    const { r, hauteurs } = quatreRangees();
    expect(paginer([], hauteurs, 500)).toEqual([]);
    expect(paginer(r, hauteurs, 0)).toEqual([]);
  });
});

describe('pageDeLaRangee : retrouver sa place après redécoupage', () => {
  it('retrouve la page d’une rangée', () => {
    const r = construireRangees([acte(1, [
      replique('un'), replique('deux'), replique('trois'), replique('quatre'),
    ])]);
    const pages = paginer(r, new Map(r.map((x) => [x.id, 100])), 250);
    expect(pageDeLaRangee(pages, r[2].id)).toBe(1);
  });

  it('retombe sur la première page si la rangée a disparu', () => {
    const r = construireRangees([acte(1, [replique()])]);
    const pages = paginer(r, new Map(r.map((x) => [x.id, 10])), 500);
    expect(pageDeLaRangee(pages, 'inexistante')).toBe(0);
    expect(pageDeLaRangee(pages, null)).toBe(0);
  });
});

describe('decouperTropLongues : ne jamais perdre la fin d’une tirade', () => {
  function rangeeAvec(texte: string) {
    const r = construireRangees([acte(1, [replique(texte)])]);
    return r;
  }

  it('laisse intacte une rangée qui tient sur la page', () => {
    const r = rangeeAvec('Court.');
    const d = decouperTropLongues(r, new Map([[r[0].id, 100]]), 500);
    expect(d).toHaveLength(1);
    expect(d[0].suite).toBeUndefined();
  });

  it('coupe une tirade plus haute que la page', () => {
    const texte = 'Première phrase. Deuxième phrase. Troisième phrase. Quatrième phrase.';
    const r = rangeeAvec(texte);
    // Mesurée à trois fois la hauteur de page.
    const d = decouperTropLongues(r, new Map([[r[0].id, 900]]), 300);
    expect(d.length).toBeGreaterThan(1);
    // Rien n'est perdu : tout le texte se retrouve dans les morceaux.
    const recompose = d.map((x) => ('texte' in x.dialogue! ? x.dialogue.texte : '')).join(' ');
    for (const phrase of ['Première', 'Deuxième', 'Troisième', 'Quatrième']) {
      expect(recompose).toContain(phrase);
    }
  });

  it('marque les morceaux suivants comme une suite', () => {
    const r = rangeeAvec('Une. Deux. Trois. Quatre. Cinq. Six.');
    const d = decouperTropLongues(r, new Map([[r[0].id, 900]]), 300);
    // Le premier morceau n'est pas une suite ; tous les autres le sont.
    expect(d[0].suite).toBeFalsy();
    expect(d.slice(1).every((x) => x.suite === true)).toBe(true);
  });

  it('laisse la didascalie qui suit après le dernier morceau', () => {
    const r = construireRangees([acte(1, [replique('Une. Deux. Trois. Quatre.'), didascalie()])]);
    const d = decouperTropLongues(r, new Map([[r[0].id, 900]]), 300);
    expect(d.length).toBeGreaterThan(2);
    expect(d.at(-1)!.scene?.type).toBe('didascalie');
    expect(d.slice(0, -1).every((x) => x.dialogue)).toBe(true);
  });

  it('n’annonce le début d’acte qu’une fois', () => {
    const r = rangeeAvec('Une. Deux. Trois. Quatre.');
    const d = decouperTropLongues(r, new Map([[r[0].id, 900]]), 300);
    expect(d[0].debutActe).toBe(true);
    expect(d.slice(1).every((x) => x.debutActe === false)).toBe(true);
  });

  it('donne un identifiant distinct à chaque morceau', () => {
    const r = rangeeAvec('Une. Deux. Trois. Quatre.');
    const d = decouperTropLongues(r, new Map([[r[0].id, 900]]), 300);
    expect(new Set(d.map((x) => x.id)).size).toBe(d.length);
  });

  it('coupe entre deux mots quand il n’y a pas assez de phrases', () => {
    const texte = Array.from({ length: 200 }, () => 'mot').join(' ');
    const r = rangeeAvec(texte);
    const d = decouperTropLongues(r, new Map([[r[0].id, 900]]), 300);
    expect(d.length).toBeGreaterThan(1);
    // Aucun morceau ne commence ni ne finit au milieu d'un mot.
    for (const x of d) {
      const morceau = 'texte' in x.dialogue! ? x.dialogue.texte : '';
      expect(morceau.split(/\s+/).every((mot) => mot === 'mot')).toBe(true);
    }
  });

  it('ne plante pas sur une rangée sans dialogue', () => {
    const r = construireRangees([acte(1, [sortie()])]);
    expect(decouperTropLongues(r, new Map([[r[0].id, 900]]), 300)).toHaveLength(1);
  });
});

describe('couperEnPhrases', () => {
  it('rend le texte entier quand un seul morceau est demandé', () => {
    expect(couperEnPhrases('Bonjour. Au revoir.', 1)).toEqual(['Bonjour. Au revoir.']);
  });

  it('coupe aux frontières de phrase', () => {
    const parts = couperEnPhrases('Une phrase. Deux phrases. Trois phrases. Quatre phrases.', 2);
    expect(parts).toHaveLength(2);
    // Chaque morceau se termine par une ponctuation de fin de phrase.
    for (const p of parts) expect(p).toMatch(/[.!?…]$/);
  });

  it('garde la ponctuation avec sa phrase', () => {
    const parts = couperEnPhrases('Attention ! Il arrive. Vraiment ? Oui.', 2);
    expect(parts.join(' ')).toContain('Attention !');
    expect(parts.join(' ')).toContain('Vraiment ?');
  });

  it('ne coupe jamais au milieu d’un mot', () => {
    const parts = couperEnPhrases('alpha bravo charlie delta echo foxtrot', 3);
    for (const p of parts) {
      for (const mot of p.split(/\s+/)) {
        expect(['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']).toContain(mot);
      }
    }
  });
});
