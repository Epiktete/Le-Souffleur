// Commandes du mode lecture (CDC §9).
//
// Le critère d'acceptation de l'étape 5 est qu'un spectacle se joue du début à
// la fin avec la seule barre Espace, sans défilement parasite : ces fonctions
// en sont la charnière.
import { describe, expect, it } from 'vitest';
import {
  commandeDe,
  commandeDuToucher,
  empecherDefaut,
  filtrer,
  soumisAuRebond,
} from '../src/services/commandes';
import { PROMPTEUR } from '../src/config';

describe('commandeDe : toutes les touches des pédales du commerce', () => {
  it('fait avancer sur les touches « page suivante » connues', () => {
    // Les pédales envoient, selon les modèles, l'une ou l'autre de ces touches.
    for (const touche of [' ', 'Spacebar', 'ArrowRight', 'ArrowDown', 'PageDown', 'Enter']) {
      expect(commandeDe(touche)).toBe('suivant');
    }
  });

  it('fait reculer sur les touches « page précédente » connues', () => {
    for (const touche of ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']) {
      expect(commandeDe(touche)).toBe('precedent');
    }
  });

  it('reconnaît les commandes du menu', () => {
    expect(commandeDe('Home')).toBe('debut');
    expect(commandeDe('Escape')).toBe('quitter');
    expect(commandeDe('m')).toBe('menu');
    expect(commandeDe('M')).toBe('menu');
    expect(commandeDe('+')).toBe('plusGrand');
    expect(commandeDe('-')).toBe('plusPetit');
  });

  it('ignore les touches sans effet', () => {
    for (const touche of ['a', 'F5', 'Tab', 'Shift']) {
      expect(commandeDe(touche)).toBeNull();
    }
  });
});

describe('filtrer : les deux pièges d’une représentation', () => {
  it('ignore une touche maintenue enfoncée', () => {
    // Sans cela, poser le pied sur la pédale ferait défiler tout le spectacle.
    expect(filtrer(true, 1000, null)).toBe('repetition');
    expect(filtrer(true, 1000, 0)).toBe('repetition');
  });

  it('ignore un appui trop rapproché du précédent', () => {
    // Rebond mécanique des pédales.
    expect(filtrer(false, 1000, 1000 - (PROMPTEUR.antiRebondMs - 1))).toBe('rebond');
  });

  it('accepte un appui espacé du seuil', () => {
    expect(filtrer(false, 1000, 1000 - PROMPTEUR.antiRebondMs)).toBeNull();
    expect(filtrer(false, 5000, 1000)).toBeNull();
  });

  it('accepte le tout premier appui', () => {
    expect(filtrer(false, 0, null)).toBeNull();
  });
});

describe('empecherDefaut : pas de défilement parasite', () => {
  it('bloque le défilement sur Espace et les flèches', () => {
    for (const touche of [' ', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'PageUp', 'PageDown', 'Home']) {
      expect(empecherDefaut(touche)).toBe(true);
    }
  });

  it('laisse passer le reste', () => {
    for (const touche of ['m', 'Escape', 'F5', 'a']) {
      expect(empecherDefaut(touche)).toBe(false);
    }
  });
});

describe('commandeDuToucher : tablette', () => {
  it('fait reculer sur le tiers gauche', () => {
    expect(commandeDuToucher(50, 900)).toBe('precedent');
    expect(commandeDuToucher(299, 900)).toBe('precedent');
  });

  it('fait avancer sur les deux tiers droits', () => {
    expect(commandeDuToucher(300, 900)).toBe('suivant');
    expect(commandeDuToucher(880, 900)).toBe('suivant');
  });

  it('ne plante pas sur une largeur nulle', () => {
    expect(commandeDuToucher(10, 0)).toBeNull();
  });
});

describe('soumisAuRebond : Échap répond toujours', () => {
  it('applique l’anti-rebond aux tours de page', () => {
    expect(soumisAuRebond('suivant')).toBe(true);
    expect(soumisAuRebond('precedent')).toBe(true);
  });

  it('ne l’applique pas aux autres commandes', () => {
    // Appuyer sur Échap juste après un tour de page doit sortir du spectacle,
    // sans quoi on croirait la touche cassée.
    for (const c of ['quitter', 'menu', 'debut', 'plusGrand', 'plusPetit', null] as const) {
      expect(soumisAuRebond(c)).toBe(false);
    }
  });
});
