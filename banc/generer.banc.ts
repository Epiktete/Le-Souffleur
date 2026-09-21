// BANC D'ESSAI — outillage de développement, jamais livré.
//
// Génère de VRAIS spectacles, avec une vraie clé, en réutilisant exactement le
// code de production. Sert à juger la qualité d'écriture et à la corriger en
// boucle. Il n'existe rien de tel dans l'application : les tests de `tests/` et
// `tests-parcours/` vérifient la mécanique contre un faux modèle, jamais le
// texte produit.
//
// Lancement :  npm run banc
//
// LA CLÉ : lue dans la variable d'environnement OPENROUTER_API_KEY. Elle n'est
// jamais écrite dans un fichier, jamais affichée, jamais journalisée. On teste
// seulement qu'elle existe, et on s'arrête net sinon.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'vitest';

import type { Acces } from '../src/services/connecteurIa';
import type { Marionnette, ParametresGeneration } from '../src/types';
import {
  assemblerSpectacle,
  ecrireScript,
  proposerHistoires,
} from '../src/services/pipeline';
import { coulisses, scriptPourLeParent } from './rendre';

/* ---------------------------------------------------------------- */
/* La clé                                                            */
/* ---------------------------------------------------------------- */

const CLE = process.env.OPENROUTER_API_KEY;
if (!CLE) {
  throw new Error(
    'Le banc a besoin de la variable d’environnement OPENROUTER_API_KEY.\n'
      + 'Elle est absente de ce terminal. Définissez-la, puis relancez :\n'
      + '  npm run banc\n'
      + '(le banc ne lit que sa présence ; il n’écrit et n’affiche jamais sa valeur)',
  );
}

const MODELE = process.env.BANC_MODELE || 'openai/gpt-5.6-sol';

const acces: Acces = {
  baseUrl: 'https://openrouter.ai/api/v1',
  cle: CLE,
  modele: MODELE,
  fournisseurId: 'openrouter',
};

/* ---------------------------------------------------------------- */
/* Où l'on écrit                                                     */
/* ---------------------------------------------------------------- */

const SORTIE = resolve(process.env.BANC_SORTIE || 'banc/sorties');
mkdirSync(SORTIE, { recursive: true });

/* ---------------------------------------------------------------- */
/* La distribution : trois peluches d'une chambre d'enfant           */
/* ---------------------------------------------------------------- */

function peluche(
  nom: string,
  description: string,
  traits: string[],
  voix: string,
): Marionnette {
  const maintenant = new Date().toISOString();
  return { id: nom.toLowerCase().replace(/\s+/g, '-'), nom, description, traits, voix, creeLe: maintenant, modifieLe: maintenant };
}

/**
 * Deux distributions de caractères très différents, pour que le choix des
 * contes et leur adaptation soient éprouvés sur plus d'un cas.
 */
const DISTRIBUTION: Marionnette[] = [
  peluche(
    'Doudou Lapin',
    'Un lapin en tissu beige, une oreille recousue et qui retombe.',
    ['inquiet', 'serviable', 'ne sait pas dire non'],
    'voix fluette, parle vite, recommence ses phrases quand il est gêné',
  ),
  peluche(
    'Renard Rusé',
    'Un renard roux au museau pointu, la queue un peu pelée.',
    ['malin', 'vaniteux', 'mauvais perdant'],
    'voix traînante, marque un silence avant les mots importants',
  ),
  peluche(
    'Ourse Gourmande',
    'Une grosse ourse en peluche marron, très douce, assez lourde.',
    ['gourmande', 'franche', 'têtue'],
    'voix grave et lente, soupire beaucoup, dit « bon » pour commencer',
  ),
];

const AUTRE_DISTRIBUTION: Marionnette[] = [
  peluche(
    'Pilou le Pingouin',
    'Un pingouin en peluche noir et blanc, le bec cousu de travers.',
    ['impatient', 'curieux', 'ne tient pas en place'],
    'voix haute et saccadée, pose trois questions à la suite sans attendre',
  ),
  peluche(
    'Mémé Tortue',
    'Une tortue verte à la carapace molle, presque plate à force d’être serrée.',
    ['lente', 'rassurante', 'ne se presse jamais'],
    'voix basse et posée, laisse un long silence avant de répondre',
  ),
  peluche(
    'Zigzag la Souris',
    'Une petite souris grise, une moustache plus longue que l’autre.',
    ['peureuse', 'maligne', 'garde tout pour elle'],
    'chuchote presque tout le temps, et crie d’un coup quand elle a peur',
  ),
];

/* ---------------------------------------------------------------- */
/* Les cas d'essai                                                   */
/* ---------------------------------------------------------------- */

interface Cas {
  nom: string;
  distribution: Marionnette[];
  parametres: ParametresGeneration;
}

const CAS: Cas[] = [
  {
    nom: '4ans',
    distribution: DISTRIBUTION,
    parametres: {
      dureeMinutes: 5,
      ageAuditoire: 4,
      nbMarionnettistes: 1,
      interactionPublic: 'beaucoup',
      marionnetteIds: DISTRIBUTION.map((m) => m.id),
      modele: MODELE,
    },
  },
  {
    nom: '8ans',
    distribution: DISTRIBUTION,
    parametres: {
      dureeMinutes: 5,
      ageAuditoire: 8,
      nbMarionnettistes: 1,
      interactionPublic: 'quelques',
      marionnetteIds: DISTRIBUTION.map((m) => m.id),
      modele: MODELE,
    },
  },
  {
    nom: '6ans-autres-peluches',
    distribution: AUTRE_DISTRIBUTION,
    parametres: {
      dureeMinutes: 5,
      ageAuditoire: 6,
      nbMarionnettistes: 1,
      interactionPublic: 'quelques',
      marionnetteIds: AUTRE_DISTRIBUTION.map((m) => m.id),
      modele: MODELE,
    },
  },
];

/* ---------------------------------------------------------------- */
/* La génération                                                     */
/* ---------------------------------------------------------------- */

// BANC_CAS=4ans ne génère que ce cas-là : chaque spectacle coûte des appels.
const FILTRE = process.env.BANC_CAS;

for (const cas of CAS.filter((c) => !FILTRE || c.nom === FILTRE)) {
  test(`spectacle ${cas.nom}`, async () => {
    const debut = Date.now();
    const options = {
      acces,
      signal: new AbortController().signal,
      surAvancement: (a: { etape: string }) => {
        const s = Math.round((Date.now() - debut) / 1000);
        console.log(`  [${cas.nom}] ${s}s — ${a.etape}`);
      },
      surReprise: (raison: string) => console.warn(`  [${cas.nom}] reprise : ${raison}`),
    };

    const propositions = await proposerHistoires(cas.distribution, cas.parametres, options);

    // Le banc joue le parent le plus ordinaire : il prend la première des
    // trois propositions. Choisir la « meilleure » fausserait le jugement,
    // puisque c'est justement la qualité moyenne qu'on mesure.
    const choisie = propositions.retenues[0];

    const script = await ecrireScript(
      propositions.dossier,
      cas.distribution,
      choisie,
      '',
      options,
    );

    const spectacle = assemblerSpectacle(script, cas.distribution, cas.parametres, {
      dossier: propositions.dossier,
      contesPresentes: propositions.presentes,
      jouables: propositions.jouables,
      synopsisProposes: propositions.retenues,
      synopsis: choisie,
      conteId: script.conteId,
      adaptation: script.bibleAdaptation,
      transposition: script.bibleTransposition,
      relecture: script.bibleRelecture,
    });

    // Les trois cartes, telles que le parent les a lues pour choisir.
    writeFileSync(
      join(SORTIE, `${cas.nom}-synopsis.md`),
      propositions.retenues.map((s) => [
        `## ${s.titre}`,
        `*D’après ${s.reference}*`,
        '',
        `**${s.accroche}**`,
        '',
        ...s.resume.map((x) => `- ${x}`),
        '',
        ...s.distribution.map((d) => `- **${d.marionnette}** — ${d.role}${d.note ? ` : ${d.note}` : ''}`),
        '',
        ...s.changements.map((x) => `- ${x}`),
      ].join('\n')).join('\n\n'),
      'utf8',
    );

    writeFileSync(
      join(SORTIE, `${cas.nom}-script.md`),
      scriptPourLeParent(spectacle),
      'utf8',
    );
    writeFileSync(
      join(SORTIE, `${cas.nom}-coulisses.json`),
      coulisses(spectacle, {
        contesPresentes: propositions.presentes,
        problemesRestants: script.problemes,
        jetons: {
          propositions: propositions.jetons,
          ecriture: script.jetons,
        },
        secondes: Math.round((Date.now() - debut) / 1000),
      }),
      'utf8',
    );

    console.log(
      `  [${cas.nom}] terminé en ${Math.round((Date.now() - debut) / 1000)}s — `
        + `${spectacle.actes.length} actes, ${script.problemes.length} problème(s) restant(s)`,
    );
  });
}
