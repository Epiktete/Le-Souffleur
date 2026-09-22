// Découpage du script en pages, pour le mode lecture (CDC §9).
//
// Le marionnettiste a une peluche sur chaque main : il ne peut pas faire
// défiler. Il tourne la page entière d'un appui de pied. Une page contient
// donc ce qui tient à l'écran, sans jamais couper un élément en deux.

import type { Acte, ElementScript, Id } from '../types';

/**
 * Une rangée : un élément du script, dans l'ordre où il se joue.
 *
 * Tout se lit dans un seul fil — répliques, entrées et sorties, didascalies,
 * notes — pour qu'on suive l'enchaînement des actions sans chercher d'un côté
 * à l'autre. Seule la façon de dire une réplique (son « ton ») s'affiche à
 * côté d'elle.
 */
export interface Rangee {
  id: Id;
  /** Réplique ou adresse au public. */
  dialogue?: ElementScript;
  /** Tout le reste : entrée, sortie, didascalie, note au marionnettiste. */
  scene?: ElementScript;
  /** Numéro de l'acte dont vient cette rangée. */
  acteNumero: number;
  acteId: Id;
  acteTitre: string;
  tableauId: Id;
  /** Vrai si cette rangée ouvre un acte. */
  debutActe: boolean;
  /** Vrai si cette rangée continue une réplique coupée à la page précédente. */
  suite?: boolean;
}

function estDialogue(e: ElementScript): boolean {
  return e.type === 'replique' || e.type === 'adresse_public';
}

/** Transforme les actes en rangées : une par élément, dans l'ordre du script. */
export function construireRangees(actes: Acte[]): Rangee[] {
  return actes.flatMap((acte) => acte.elements.map((e, index): Rangee => ({
    id: e.id,
    ...(estDialogue(e) ? { dialogue: e } : { scene: e }),
    acteNumero: acte.numero,
    acteId: acte.id,
    acteTitre: acte.titre,
    tableauId: acte.tableauId,
    debutActe: index === 0,
  })));
}

/** Une page de lecture : une suite de rangées qui tiennent à l'écran. */
export interface Page {
  rangees: Rangee[];
  /** Acte auquel appartient la première rangée, pour le bandeau. */
  acteNumero: number;
  tableauId: Id;
  /** Vrai si cette page ouvre un nouveau tableau : changement de décor. */
  changementTableau: boolean;
}

/**
 * Répartit les rangées en pages, d'après la hauteur mesurée de chacune.
 *
 * Trois règles :
 *   - une rangée n'est jamais coupée entre deux pages ;
 *   - une rangée plus haute que la page occupe une page entière, seule ;
 *   - un changement d'acte ou de tableau commence une nouvelle page, parce
 *     que le marionnettiste doit changer de décor ou de rythme.
 *
 * Fonction pure : les hauteurs sont mesurées par le composant, la répartition
 * se teste sans navigateur.
 */
export function paginer(
  rangees: Rangee[],
  hauteurs: Map<Id, number>,
  hauteurPage: number,
): Page[] {
  const pages: Page[] = [];
  if (rangees.length === 0 || hauteurPage <= 0) return pages;

  let courante: Rangee[] = [];
  let cumul = 0;
  let acteCourant = rangees[0].acteNumero;
  let tableauCourant = rangees[0].tableauId;
  let tableauPrecedent: Id | null = null;

  const fermer = () => {
    if (courante.length === 0) return;
    pages.push({
      rangees: courante,
      acteNumero: acteCourant,
      tableauId: tableauCourant,
      changementTableau: tableauPrecedent !== null && tableauPrecedent !== tableauCourant,
    });
    tableauPrecedent = tableauCourant;
    courante = [];
    cumul = 0;
  };

  for (const rangee of rangees) {
    const hauteur = hauteurs.get(rangee.id) ?? 0;
    const changeActe = rangee.acteNumero !== acteCourant;
    const changeTableau = rangee.tableauId !== tableauCourant;

    if (changeActe || changeTableau) {
      fermer();
      acteCourant = rangee.acteNumero;
      tableauCourant = rangee.tableauId;
    }

    // La rangée ne tient pas sur ce qu'il reste : on tourne la page. Une
    // rangée seule plus haute que la page reste seule, on ne la coupe pas.
    if (courante.length > 0 && cumul + hauteur > hauteurPage) fermer();

    courante.push(rangee);
    cumul += hauteur;
  }

  fermer();
  return pages;
}

/** Retrouve la page où se trouve une rangée donnée, après un redécoupage. */
export function pageDeLaRangee(pages: Page[], rangeeId: Id | null): number {
  if (!rangeeId) return 0;
  const index = pages.findIndex((p) => p.rangees.some((r) => r.id === rangeeId));
  return index < 0 ? 0 : index;
}

/**
 * Découpe les rangées plus hautes qu'une page.
 *
 * Une tirade peut dépasser la hauteur de l'écran. Ne pas la couper reviendrait
 * à en perdre la fin : en pleine représentation, le marionnettiste se
 * retrouverait sans texte. On la coupe donc, mais à la phrase, jamais au
 * milieu d'un mot, et les morceaux suivants sont marqués comme une suite.
 *
 * La hauteur des morceaux est estimée à partir de la hauteur mesurée du tout :
 * la mesure exacte demanderait un second rendu, et l'approximation suffit
 * puisqu'on se garde une marge.
 */
export function decouperTropLongues(
  rangees: Rangee[],
  hauteurs: Map<Id, number>,
  hauteurPage: number,
): Rangee[] {
  if (hauteurPage <= 0) return rangees;
  const resultat: Rangee[] = [];

  for (const rangee of rangees) {
    const hauteur = hauteurs.get(rangee.id) ?? 0;
    const texte = rangee.dialogue && 'texte' in rangee.dialogue ? rangee.dialogue.texte : '';

    if (hauteur <= hauteurPage || !rangee.dialogue || texte.length === 0) {
      resultat.push(rangee);
      continue;
    }

    // Marge de 15 % : l'estimation est proportionnelle, pas exacte.
    const morceaux = Math.ceil(hauteur / (hauteurPage * 0.85));
    const parts = couperEnPhrases(texte, morceaux);

    parts.forEach((part, index) => {
      resultat.push({
        ...rangee,
        // Même le premier morceau change d'identifiant : sinon sa hauteur
        // remplacerait celle de la tirade entière, le découpage se croirait
        // inutile et se déferait, pour se refaire aussitôt.
        id: `${rangee.id}#${index}`,
        dialogue: { ...rangee.dialogue!, texte: part } as ElementScript,
        debutActe: index === 0 ? rangee.debutActe : false,
        suite: index > 0,
      });
    });
  }

  return resultat;
}

/**
 * Coupe un texte en `nombre` morceaux d'à peu près même longueur, aux
 * frontières de phrase. Si le texte ne contient pas assez de phrases, on
 * retombe sur une coupure entre deux mots.
 */
export function couperEnPhrases(texte: string, nombre: number): string[] {
  if (nombre <= 1) return [texte];

  // On garde la ponctuation avec la phrase qu'elle termine.
  const phrases = texte.match(/[^.!?…]+[.!?…]+[\s]*|[^.!?…]+$/g) ?? [texte];
  const unites = phrases.length >= nombre ? phrases : texte.split(/(\s+)/);

  const cible = Math.ceil(texte.length / nombre);
  const morceaux: string[] = [];
  let courant = '';

  for (const unite of unites) {
    if (courant.length > 0 && courant.length + unite.length > cible
        && morceaux.length < nombre - 1) {
      morceaux.push(courant.trim());
      courant = '';
    }
    courant += unite;
  }
  if (courant.trim().length > 0) morceaux.push(courant.trim());

  return morceaux.length > 0 ? morceaux : [texte];
}
