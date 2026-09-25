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

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'vitest';

import type { Acces } from '../src/services/connecteurIa';
import type { Marionnette, ParametresGeneration } from '../src/types';
import {
  assemblerSpectacle,
  ecrireScript,
  proposerHistoires,
} from '../src/services/pipeline';
import { verserALaBanque } from './banque';
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

// Le journal va AUSSI dans un fichier. Vitest ne recopiait aucune ligne de
// console dans la sortie redirigée : impossible de savoir, après coup, si une
// étape avait recommencé, si la revue finale avait échoué ou pourquoi la
// banque refusait un versement. La clé n'y passe jamais : le pipeline ne la
// journalise pas (voir journaliserEchec).
const JOURNAL = join(SORTIE, 'journal.log');
for (const niveau of ['log', 'warn', 'error'] as const) {
  const original = console[niveau].bind(console);
  console[niveau] = (...args: unknown[]) => {
    original(...args);
    const ligne = args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' ');
    appendFileSync(JOURNAL, `${new Date().toISOString().slice(11, 19)} ${niveau === 'log' ? '' : `[${niveau}] `}${ligne}\n`, 'utf8');
  };
}

/* ---------------------------------------------------------------- */
/* La distribution : trois peluches d'une chambre d'enfant           */
/* ---------------------------------------------------------------- */

function peluche(
  nom: string,
  description: string,
  traits: string[],
): Marionnette {
  const maintenant = new Date().toISOString();
  return { id: nom.toLowerCase().replace(/\s+/g, '-'), nom, description, traits, creeLe: maintenant, modifieLe: maintenant };
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
  ),
  peluche(
    'Renard Rusé',
    'Un renard roux au museau pointu, la queue un peu pelée.',
    ['malin', 'vaniteux', 'mauvais perdant'],
  ),
  peluche(
    'Ourse Gourmande',
    'Une grosse ourse en peluche marron, très douce, assez lourde.',
    ['gourmande', 'franche', 'têtue'],
  ),
];

const AUTRE_DISTRIBUTION: Marionnette[] = [
  peluche(
    'Pilou le Pingouin',
    'Un pingouin en peluche noir et blanc, le bec cousu de travers.',
    ['impatient', 'curieux', 'ne tient pas en place'],
  ),
  peluche(
    'Mémé Tortue',
    'Une tortue verte à la carapace molle, presque plate à force d’être serrée.',
    ['lente', 'rassurante', 'ne se presse jamais'],
  ),
  peluche(
    'Zigzag la Souris',
    'Une petite souris grise, une moustache plus longue que l’autre.',
    ['peureuse', 'maligne', 'garde tout pour elle'],
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
    // Le temps passé dans chaque étape : c'est lui qui dit où gagner de
    // l'attente pour le parent (une génération dure plus de dix minutes).
    const etapes: { etape: string; secondes: number }[] = [];
    let etapeEnCours = { nom: '', depuis: debut };
    const cloreEtape = () => {
      if (etapeEnCours.nom) {
        etapes.push({ etape: etapeEnCours.nom, secondes: Math.round((Date.now() - etapeEnCours.depuis) / 1000) });
      }
    };
    const options = {
      acces,
      signal: new AbortController().signal,
      surAvancement: (a: { etape: string; acte?: number }) => {
        const s = Math.round((Date.now() - debut) / 1000);
        const nom = a.acte ? `${a.etape} ${a.acte}` : a.etape;
        console.log(`  [${cas.nom}] ${s}s — ${nom}`);
        cloreEtape();
        etapeEnCours = { nom, depuis: Date.now() };
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

    // Le fonds : un spectacle écrit une fois peut resservir à une autre
    // famille, en y remplaçant les noms des peluches.
    verserALaBanque(spectacle);

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
    cloreEtape();
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
        etapes,
      }),
      'utf8',
    );
    // Le spectacle entier, tel que l'application l'enregistre : de quoi
    // l'ouvrir dans le vrai mode lecture, ce que le Markdown ne permet pas.
    writeFileSync(join(SORTIE, `${cas.nom}-spectacle.json`), JSON.stringify(spectacle, null, 2), 'utf8');

    console.log(
      `  [${cas.nom}] terminé en ${Math.round((Date.now() - debut) / 1000)}s — `
        + `${spectacle.actes.length} actes, ${script.problemes.length} problème(s) restant(s)`,
    );
  });
}
