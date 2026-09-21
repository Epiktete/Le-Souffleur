// Règles métier de la bibliothèque : validation, duplication, recherche.
// Ces fonctions serviront aussi à contrôler les données importées (CDC §12),
// d'où l'intérêt de les tester seules.
import { describe, expect, it } from 'vitest';
import {
  dupliquerMarionnette,
  filtrerMarionnettes,
  initiales,
  nomDeCopie,
  saisieValide,
  validerSaisie,
} from '../src/services/marionnettes';
import { BORNES } from '../src/config';
import type { Marionnette } from '../src/types';

const saisieCorrecte = {
  nom: 'Doudou Lapin',
  description: 'Petit lapin beige aux oreilles tombantes.',
  traits: ['gentil', 'peureux'],
  voix: 'voix douce',
};

function marionnette(nom: string, extra: Partial<Marionnette> = {}): Marionnette {
  const maintenant = new Date().toISOString();
  return {
    id: nom,
    nom,
    description: '',
    traits: [],
    creeLe: maintenant,
    modifieLe: maintenant,
    ...extra,
  };
}

describe('validerSaisie', () => {
  it('accepte une saisie correcte', () => {
    expect(validerSaisie(saisieCorrecte)).toEqual({});
    expect(saisieValide(saisieCorrecte)).toBe(true);
  });

  it('refuse un nom vide ou fait d’espaces', () => {
    expect(validerSaisie({ ...saisieCorrecte, nom: '' }).nom).toBeDefined();
    expect(validerSaisie({ ...saisieCorrecte, nom: '   ' }).nom).toBeDefined();
  });

  it('refuse un nom de plus de 40 caractères', () => {
    const trop = 'a'.repeat(BORNES.nomMarionnette.max + 1);
    expect(validerSaisie({ ...saisieCorrecte, nom: trop }).nom).toBeDefined();
    // Exactement 40 doit passer : la borne est inclusive.
    const pile = 'a'.repeat(BORNES.nomMarionnette.max);
    expect(validerSaisie({ ...saisieCorrecte, nom: pile }).nom).toBeUndefined();
  });

  it('refuse une description de plus de 500 caractères', () => {
    const trop = 'a'.repeat(BORNES.descriptionMarionnette.max + 1);
    expect(validerSaisie({ ...saisieCorrecte, description: trop }).description).toBeDefined();
  });

  it('exige au moins un trait et en refuse plus de six', () => {
    expect(validerSaisie({ ...saisieCorrecte, traits: [] }).traits).toBeDefined();
    const sept = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(validerSaisie({ ...saisieCorrecte, traits: sept }).traits).toBeDefined();
    const six = sept.slice(0, 6);
    expect(validerSaisie({ ...saisieCorrecte, traits: six }).traits).toBeUndefined();
  });

  it('donne un seul message par champ, en français', () => {
    const erreurs = validerSaisie({ nom: '', description: '', traits: [], voix: '' });
    expect(erreurs.nom).toBe('Donnez un nom à la marionnette.');
    expect(erreurs.traits).toBe('Choisissez au moins un trait de caractère.');
  });
});

describe('nomDeCopie', () => {
  it('ajoute « (copie) » au premier doublon', () => {
    expect(nomDeCopie('Loulou', ['Loulou'])).toBe('Loulou (copie)');
  });

  it('numérote les copies suivantes', () => {
    expect(nomDeCopie('Loulou', ['Loulou', 'Loulou (copie)'])).toBe('Loulou (copie 2)');
    expect(nomDeCopie('Loulou', ['Loulou', 'Loulou (copie)', 'Loulou (copie 2)']))
      .toBe('Loulou (copie 3)');
  });

  it('ignore la casse pour détecter un nom déjà pris', () => {
    expect(nomDeCopie('Loulou', ['LOULOU (COPIE)'])).toBe('Loulou (copie 2)');
  });

  it('ne dépasse jamais la longueur maximale du nom', () => {
    const long = 'x'.repeat(BORNES.nomMarionnette.max);
    const copie = nomDeCopie(long, [long]);
    expect(copie.length).toBeLessThanOrEqual(BORNES.nomMarionnette.max);
    expect(copie).toContain('(copie)');
  });
});

describe('dupliquerMarionnette', () => {
  it('change l’identifiant et le nom, garde le reste', () => {
    const source = marionnette('Renard', {
      description: 'Rusé et roux.',
      traits: ['rusé'],
      voix: 'voix mielleuse',
    });
    const copie = dupliquerMarionnette(source, ['Renard']);
    expect(copie.id).not.toBe(source.id);
    expect(copie.nom).toBe('Renard (copie)');
    expect(copie.description).toBe(source.description);
    expect(copie.traits).toEqual(source.traits);
    expect(copie.voix).toBe(source.voix);
  });
});

describe('initiales', () => {
  it('prend les deux premières lettres d’un nom simple', () => {
    expect(initiales('Loulou')).toBe('LO');
  });

  it('prend l’initiale de chacun des deux premiers mots', () => {
    expect(initiales('Doudou Lapin')).toBe('DL');
    expect(initiales('  ourse   gourmande  ')).toBe('OG');
  });

  it('ne plante pas sur un nom vide', () => {
    expect(initiales('')).toBe('?');
    expect(initiales('   ')).toBe('?');
  });
});

describe('filtrerMarionnettes', () => {
  const liste = [
    marionnette('Doudou Lapin', { traits: ['gentil', 'peureux'] }),
    marionnette('Renard', { description: 'Très rusé.', traits: ['rusé'] }),
    marionnette('Hibou', { voix: 'parle lentement' }),
  ];

  it('renvoie tout quand la recherche est vide', () => {
    expect(filtrerMarionnettes(liste, '')).toHaveLength(3);
    expect(filtrerMarionnettes(liste, '   ')).toHaveLength(3);
  });

  it('cherche dans le nom, sans tenir compte de la casse', () => {
    expect(filtrerMarionnettes(liste, 'LAPIN').map((m) => m.nom)).toEqual(['Doudou Lapin']);
  });

  it('cherche aussi dans la description, les traits et la voix', () => {
    expect(filtrerMarionnettes(liste, 'peureux')).toHaveLength(1);
    expect(filtrerMarionnettes(liste, 'lentement')).toHaveLength(1);
  });

  it('ignore les accents : « ruse » trouve « rusé »', () => {
    expect(filtrerMarionnettes(liste, 'ruse').map((m) => m.nom)).toEqual(['Renard']);
    expect(filtrerMarionnettes(liste, 'RUSÉ').map((m) => m.nom)).toEqual(['Renard']);
  });

  it('ne renvoie rien quand rien ne correspond', () => {
    expect(filtrerMarionnettes(liste, 'dragon')).toHaveLength(0);
  });
});
