// Faux fournisseur d'IA pour les tests de parcours.
//
// Il répond à /chat/completions comme le ferait un vrai modèle, en choisissant
// sa réponse d'après le prompt système reçu. Aucun appel réel n'est fait : les
// tests doivent tourner sans clé, sans réseau et sans coût.
import type { Page, Route } from '@playwright/test';

/** Les trois marionnettes utilisées par le parcours principal. */
export const TROIS_MARIONNETTES = ['Doudou Lapin', 'Renard Rusé', 'Ourse Gourmande'];

/** Fabrique un texte d'environ `n` mots, pour piloter la durée estimée. */
function mots(n: number): string {
  return Array.from({ length: n }, (_, i) => (i % 5 === 0 ? 'carotte' : 'mot')).join(' ');
}

/**
 * Ce que rend l'appel de la phase 1 : trois synopsis, pris parmi les contes
 * que l'application a retenus. Le faux modèle les lit dans le prompt, comme le
 * vrai : un conte qui n'était pas dans la liste serait refusé par le schéma.
 */
function synopsis(user: string, suffixe = '') {
  const contes = [...user.matchAll(/^### ([a-z0-9-]+) — /gm)].map((m) => m[1]);
  return {
    synopsis: contes.slice(0, 3).map((conte, i) => ({
      conte,
      titre: `Histoire ${i + 1}${suffixe}`,
      accroche: `De quoi parle l’histoire ${i + 1}, en une ligne.`,
      resume: [
        'Doudou Lapin cherche la carotte de son anniversaire.',
        'Renard Rusé l’envoie sur une fausse piste.',
        'Ourse Gourmande finit par avouer.',
      ],
      distribution: TROIS_MARIONNETTES.map((marionnette, j) => ({
        marionnette, role: `le rôle ${j + 1}`, note: 'avec son caractère',
      })),
      changements: ['La fin est adoucie : personne n’est mangé.'],
    })),
  };
}

/**
 * Ce que rend l'appel d'adaptation : ce qui change par rapport au conte, puis
 * le découpage en tableaux et en actes.
 */
const construction = {
  titre: 'La carotte disparue',
  pitch: 'Doudou Lapin cherche la carotte de son anniversaire.',
  changements: ['Le loup du conte devient Renard Rusé, qui ne mange personne.'],
  tableaux: [
    { id: 't1', titre: 'La clairière', description: 'Un buisson vert et de l’herbe haute.', accessoires: ['une carotte en carton'] },
    { id: 't2', titre: 'Le terrier', description: 'Un tunnel de tissu brun.', accessoires: [] },
  ],
  actes: [
    {
      numero: 1, titre: 'La disparition', tableauId: 't1',
      resume: 'Lapin découvre que sa carotte a disparu.',
      passage: 'De « Il était une fois » à « a disparu ».',
      temps: ['Lapin cherche', 'Renard arrive', 'Premier faux indice'],
      mouvements: [
        { type: 'entree', marionnette: 'Doudou Lapin', main: 'M1G' },
        { type: 'entree', marionnette: 'Renard Rusé', main: 'M1D' },
      ],
      momentsPublic: ['Les enfants cherchent avec Lapin'],
      budgetMots: 140,
    },
    {
      numero: 2, titre: 'La fausse piste', tableauId: 't2',
      resume: 'Renard envoie Lapin au mauvais endroit.',
      temps: ['Départ', 'Rencontre d’Ourse', 'Doute'],
      mouvements: [
        { type: 'sortie', marionnette: 'Renard Rusé', main: 'M1D' },
        { type: 'entree', marionnette: 'Ourse Gourmande', main: 'M1D' },
      ],
      momentsPublic: ['Vote des enfants'],
      budgetMots: 140,
    },
    {
      numero: 3, titre: 'L’aveu', tableauId: 't1',
      resume: 'Ourse avoue et tous replantent.',
      temps: ['Aveu', 'Pardon', 'Plantation'],
      mouvements: [],
      momentsPublic: ['Les enfants comptent jusqu’à trois'],
      budgetMots: 140,
    },
  ],
};

/**
 * Les trois actes écrits. Le nombre de mots est calibré pour que la durée
 * estimée tombe dans la fourchette de 4 à 6 minutes exigée par le CDC §13.
 */
const actesEcrits = [
  {
    elements: [
      { type: 'entree', marionnette: 'Doudou Lapin', main: 'M1G' },
      { type: 'replique', marionnette: 'Doudou Lapin', texte: mots(120), ton: 'affolé' },
      { type: 'didascalie', texte: 'Il regarde sous le buisson.' },
      { type: 'entree', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'replique', marionnette: 'Renard Rusé', texte: mots(15) },
      { type: 'adresse_public', marionnette: 'Doudou Lapin', texte: 'Vous l’avez vue, vous ?', attenteReponse: true },
      { type: 'note_marionnettiste', texte: 'Laisser les enfants répondre.' },
    ],
  },
  {
    elements: [
      { type: 'replique', marionnette: 'Renard Rusé', texte: mots(60) },
      { type: 'sortie', marionnette: 'Renard Rusé', main: 'M1D' },
      { type: 'entree', marionnette: 'Ourse Gourmande', main: 'M1D' },
      { type: 'replique', marionnette: 'Ourse Gourmande', texte: mots(70) },
      { type: 'didascalie', texte: 'Ourse détourne le regard.' },
      { type: 'adresse_public', marionnette: 'Ourse Gourmande', texte: 'Je dois tout dire ?', attenteReponse: true },
    ],
  },
  {
    elements: [
      { type: 'replique', marionnette: 'Ourse Gourmande', texte: mots(70) },
      { type: 'replique', marionnette: 'Doudou Lapin', texte: mots(65) },
      { type: 'didascalie', texte: 'Ils creusent ensemble.' },
      { type: 'adresse_public', marionnette: 'Doudou Lapin', texte: 'Vous comptez avec nous ?', attenteReponse: true },
      { type: 'sortie', marionnette: 'Doudou Lapin', main: 'M1G' },
      { type: 'sortie', marionnette: 'Ourse Gourmande', main: 'M1D' },
    ],
  },
];

/** Aucun problème à signaler : la relecture n'a rien trouvé. */
const relectureVide = { problemes: [] };

export interface OptionsFauxModele {
  /** Force une erreur HTTP à l'appel numéro n (à partir de 1). */
  echecAuNumero?: number;
  statutEchec?: number;
  /** Renvoie une conduite injouable au premier appel de l'étape 6. */
  conduiteInjouableDabord?: boolean;
  /** Renvoie du texte non JSON au premier appel, pour tester la relance. */
  jsonInvalideDabord?: boolean;
  /** Temps de réponse simulé, pour rendre la progression observable. */
  delaiMs?: number;
  /**
   * Coupe les réponses des N premiers appels d'écriture, comme le fait un
   * modèle à raisonnement dont le budget de jetons est épuisé.
   */
  tronquerEcrituresDabord?: number;
  /** La revue finale répond toujours hors format : le spectacle doit être livré quand même. */
  relectureInvalide?: boolean;
}

/**
 * Installe le faux fournisseur sur la page.
 * Renvoie un compteur des appels, consultable par le test.
 */
export async function installerFauxModele(page: Page, o: OptionsFauxModele = {}) {
  const compteurs = { total: 0, actes: 0, conduites: 0, ecrituresTronquees: 0 };

  await page.route('**/chat/completions', async (route: Route) => {
    compteurs.total++;

    if (o.echecAuNumero === compteurs.total) {
      await route.fulfill({
        status: o.statutEchec ?? 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'refus simulé' } }),
      });
      return;
    }

    if (o.delaiMs) await new Promise((r) => setTimeout(r, o.delaiMs));

    const corps = JSON.parse(route.request().postData() ?? '{}');
    const system: string = corps.messages?.[0]?.content ?? '';

    let charge: unknown;

    const user: string = corps.messages?.[1]?.content ?? '';

    // L'écriture et la correction d'un acte d'abord : le prompt de correction
    // cite aussi le directeur éditorial, dont il applique les propositions.
    if (system.includes('écrire cet acte en entier')
        || system.includes('réécrire cet acte')) {
      // Même réponse pour l'écriture et la régénération. Une correction rend
      // l'acte qu'on lui a demandé de corriger, tel quel.
      const corrige = system.includes('réécrire cet acte')
        ? Number(user.match(/Conduite de l’acte :\nActe (\d+)/)?.[1] ?? 0)
        : 0;
      charge = corrige
        ? actesEcrits[Math.min(corrige - 1, actesEcrits.length - 1)]
        : actesEcrits[Math.min(compteurs.actes, actesEcrits.length - 1)];
    } else if (system.includes('TROIS SYNOPSIS')) {
      // Phase 1 : trois synopsis. Le suffixe distingue les relances.
      charge = synopsis(user, user.includes('déjà vu') ? ' bis' : '');
    } else if (system.includes('PREMIÈRE PASSE')) {
      // Passe 1 : le conte transposé pour les marionnettes.
      charge = {
        texte: 'Il était une fois Doudou Lapin, qui avait perdu sa carotte. Renard Rusé passa '
          + 'par là. « As-tu vu ma carotte ? » demanda Doudou Lapin. Ourse Gourmande, elle, '
          + 'se tenait le ventre.',
        changements: [],
      };
    } else if (system.includes('LE DÉCOUPAGE SUIT LE CONTE')) {
      compteurs.conduites++;
      if (o.conduiteInjouableDabord && compteurs.conduites === 1) {
        // Trois marionnettes pour un marionnettiste : la simulation doit le
        // détecter AVANT que le moindre dialogue ne soit écrit.
        const injouable = structuredClone(construction);
        injouable.actes[0].mouvements.push({
          type: 'entree', marionnette: 'Ourse Gourmande', main: 'M2G',
        });
        charge = injouable;
      } else {
        charge = construction;
      }
    } else if (system.includes('DIRECTEUR ÉDITORIAL')) {
      charge = o.relectureInvalide ? { problemes: [{ probleme: '' }] } : relectureVide;
    } else {
      charge = { ok: true, couleur: 'rouge' };
    }

    // Le premier appel peut renvoyer du texte libre, pour éprouver la relance.
    let contenu = o.jsonInvalideDabord && compteurs.total === 1
      ? 'Bien sûr ! Voici ce que je propose, mais sans JSON.'
      : `\`\`\`json\n${JSON.stringify(charge)}\n\`\`\``;

    // Troncature simulée : la réponse est coupée au milieu, et le fournisseur
    // l'annonce par finish_reason « length ». C'est ce que fait un modèle à
    // raisonnement dont le budget de jetons est épuisé.
    let motifArret = 'stop';
    const ecriture = system.includes('écrire cet acte en entier');
    if (ecriture
        && o.tronquerEcrituresDabord
        && compteurs.ecrituresTronquees < o.tronquerEcrituresDabord) {
      compteurs.ecrituresTronquees++;
      contenu = contenu.slice(0, Math.floor(contenu.length / 2));
      motifArret = 'length';
    } else if (ecriture) {
      compteurs.actes++;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: contenu }, finish_reason: motifArret }],
        usage: { prompt_tokens: 900, completion_tokens: 400, total_tokens: 1300 },
      }),
    });
  });

  return compteurs;
}
