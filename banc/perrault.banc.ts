// LE LOT PERRAULT — peuplement de la banque de spectacles.
//
// Quatre classiques de Perrault, générés une fois avec un grand modèle, puis
// versés au fonds pour être resservis à toutes les familles (mode Banque).
//
// L'ÂGE DE GÉNÉRATION EST L'ÂGE MINIMUM CONSEILLÉ du spectacle. La banque ne
// retouche pas l'essence selon l'âge (c'est l'affaire du Studio) : on génère
// chaque conte à l'âge le plus bas de la bande de retouches la plus fidèle de
// sa fiche (`wiki/retouches`), si bien que seules les retouches valables pour
// toute la bande s'appliquent, et que le champ `ageAuditoire` du spectacle dit
// exactement à partir de quel âge il peut être servi.
//
// CE FICHIER NE FAIT RIEN sans la variable BANC_PERRAULT : chaque spectacle
// coûte une dizaine d'appels à un grand modèle. Lancement :
//   BANC_PERRAULT=chaperon npm run banc:perrault     (un seul conte)
//   BANC_PERRAULT=tous npm run banc:perrault         (les quatre)
// Après versement : npm run banque   (réindexe le fonds)
//
// LA CLÉ : lue dans OPENROUTER_API_KEY, jamais écrite, affichée ni journalisée.

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
/* Le déclencheur, la clé, le modèle                                 */
/* ---------------------------------------------------------------- */

const DEMANDES = (process.env.BANC_PERRAULT ?? '').split(',').map((s) => s.trim()).filter(Boolean);

if (DEMANDES.length > 0 && !process.env.OPENROUTER_API_KEY) {
  throw new Error(
    'Le lot Perrault a besoin de la variable d’environnement OPENROUTER_API_KEY.\n'
      + 'Elle est absente de ce terminal. Définissez-la, puis relancez :\n'
      + '  BANC_PERRAULT=tous npm run banc:perrault\n'
      + '(le banc ne lit que sa présence ; il n’écrit et n’affiche jamais sa valeur)',
  );
}

// Un grand modèle, en raisonnement poussé : ces spectacles seront resservis
// tels quels à toutes les familles, ils doivent être meilleurs que la moyenne.
// Identifiant et paramètre `reasoning` vérifiés au catalogue OpenRouter.
const MODELE = process.env.BANC_MODELE || 'anthropic/claude-opus-5.5';
const RAISONNEMENT = (process.env.BANC_RAISONNEMENT || 'high') as 'low' | 'medium' | 'high';

const acces: Acces = {
  baseUrl: 'https://openrouter.ai/api/v1',
  cle: process.env.OPENROUTER_API_KEY ?? '',
  modele: MODELE,
  fournisseurId: 'openrouter',
  raisonnement: RAISONNEMENT,
};

/* ---------------------------------------------------------------- */
/* Où l'on écrit                                                     */
/* ---------------------------------------------------------------- */

const SORTIE = resolve(process.env.BANC_SORTIE || 'banc/sorties/perrault');
mkdirSync(SORTIE, { recursive: true });

// Le journal va aussi dans un fichier (même raison que generer.banc.ts) :
// vitest ne recopie pas la console, et c'est là qu'on lit pourquoi la banque
// refuserait un versement. La clé n'y passe jamais.
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
/* Les troupes                                                       */
/* ---------------------------------------------------------------- */

function peluche(nom: string, description: string, traits: string[]): Marionnette {
  const maintenant = new Date().toISOString();
  return { id: nom.toLowerCase().replace(/\s+/g, '-'), nom, description, traits, creeLe: maintenant, modifieLe: maintenant };
}

// Les noms évitent les mots que le conte lui-même pourrait employer (« loup »,
// « moustache », « tonnerre »…) : un nom qui réapparaît comme mot ordinaire du
// texte ferait refuser le versement par le garde-fou des noms résiduels.
// Chaque troupe épouse les rôles de la fiche, genre grammatical compris : ces
// genres serviront au futur champ `genre` des rôles du fonds (étape F).

interface CasPerrault {
  /** La clé passée à BANC_PERRAULT. */
  cle: string;
  conte: string;
  /** L'ébauche qui fait remonter le conte dans l'entonnoir. */
  ebauche: string;
  troupe: Marionnette[];
  /**
   * L'âge minimum conseillé, et donc l'âge de génération : le plus bas de la
   * bande de retouches la plus fidèle (voir l'en-tête du fichier).
   */
  ageMinimum: number;
  dureeMinutes: number;
  interactionPublic: ParametresGeneration['interactionPublic'];
}

const CAS: CasPerrault[] = [
  {
    // Retouches : armoire jusqu'à 4 ans, bûcherons jusqu'à 8, fin de Perrault
    // à 9-10 — mais la fiche s'arrête à 8 ans. La version la plus fidèle qui
    // reste dans la tranche est donc celle des bûcherons, servable dès 5 ans.
    cle: 'chaperon',
    conte: 'fr-perrault-chaperon-rouge',
    ebauche: 'le Petit Chaperon rouge',
    troupe: [
      peluche('Rosette', 'Une poupée de chiffon en robe rouge, avec un petit bonnet.', ['curieux', 'gentil']),
      peluche('Grognard', 'Un loup en peluche grise, grandes oreilles et gueule rouge.', ['méchant', 'gourmand']),
      peluche('Mamie Rose', 'Une marionnette de grand-mère en tissu, cheveux de laine blanche.', ['sage', 'gentil']),
    ],
    ageMinimum: 5,
    dureeMinutes: 6,
    interactionPublic: 'beaucoup',
  },
  {
    // Retouches jusqu'à 4 et 6 ans : dès 7 ans, le conte passe sans retouche.
    cle: 'chat-botte',
    conte: 'fr-perrault-chat-botte',
    ebauche: 'le Chat botté et le marquis de Carabas',
    troupe: [
      peluche('Griffou', 'Un chat noir en peluche, bottes rouges cousues aux pattes.', ['rusé', 'bavard', 'vantard']),
      peluche('Colin', 'Une marionnette de jeune homme en tissu, gilet de meunier.', ['naïf', 'timide']),
      peluche('Léon', 'Une marionnette de roi en velours, couronne de feutrine dorée.', ['naïf', 'gourmand']),
      peluche('Grommelou', 'Un ogre en peluche verte, grosses dents de feutre.', ['vantard', 'orgueilleux', 'méchant']),
    ],
    ageMinimum: 7,
    dureeMinutes: 8,
    interactionPublic: 'quelques',
  },
  {
    // Retouches jusqu'à 4 et 6 ans : dès 7 ans, le conte passe sans retouche.
    cle: 'fees',
    conte: 'fr-perrault-les-fees',
    ebauche: 'les Fées : la sœur polie et la sœur malpolie à la fontaine',
    troupe: [
      peluche('Lisette', 'Une poupée de chiffon en tablier, sourire cousu.', ['gentil', 'travailleur']),
      peluche('Margot', 'Une poupée de chiffon au ruban bleu, sourcils froncés.', ['orgueilleux', 'grognon']),
      peluche('Plumette', 'Une marionnette de fée aux ailes de tulle, baguette argentée.', ['sage', 'rusé']),
    ],
    ageMinimum: 7,
    dureeMinutes: 5,
    interactionPublic: 'quelques',
  },
  {
    // Une seule retouche, jusqu'à 6 ans : dès 7 ans, le conte passe entier.
    cle: 'souhaits',
    conte: 'fr-perrault-souhaits-ridicules',
    ebauche: 'les trois souhaits gâchés et le boudin au nez',
    troupe: [
      peluche('Gaspard', 'Une marionnette de bûcheron en tissu, chemise à carreaux et hache de feutre.', ['naïf', 'gourmand', 'gentil']),
      peluche('Perrette', 'Une marionnette de femme au fichu rouge, mains sur les hanches.', ['bavard', 'grognon', 'sage']),
      peluche('Olympio', 'Une grande marionnette de dieu du ciel, barbe blanche et éclair doré.', ['sage', 'farceur']),
    ],
    ageMinimum: 7,
    dureeMinutes: 5,
    interactionPublic: 'quelques',
  },
];

/* ---------------------------------------------------------------- */
/* La génération                                                     */
/* ---------------------------------------------------------------- */

const RETENUS = DEMANDES.includes('tous') ? CAS : CAS.filter((c) => DEMANDES.includes(c.cle));
if (DEMANDES.length > 0 && RETENUS.length === 0) {
  throw new Error(`BANC_PERRAULT=${DEMANDES.join(',')} ne désigne aucun cas. `
    + `Cas connus : ${CAS.map((c) => c.cle).join(', ')}, ou « tous ».`);
}

for (const cas of CAS) {
  const retenu = RETENUS.includes(cas);
  // Sans BANC_PERRAULT, tout est sauté : `npm run banc` ne doit jamais lancer
  // ce lot par accident.
  test.skipIf(!retenu)(`perrault ${cas.cle}`, async () => {
    const parametres: ParametresGeneration = {
      dureeMinutes: cas.dureeMinutes,
      ageAuditoire: cas.ageMinimum,
      nbMarionnettistes: 1,
      interactionPublic: cas.interactionPublic,
      ebauche: cas.ebauche,
      marionnetteIds: cas.troupe.map((m) => m.id),
      modele: MODELE,
    };

    const debut = Date.now();
    const options = {
      acces,
      signal: new AbortController().signal,
      surAvancement: (a: { etape: string; acte?: number }) => {
        const s = Math.round((Date.now() - debut) / 1000);
        console.log(`  [${cas.cle}] ${s}s — ${a.acte ? `${a.etape} ${a.acte}` : a.etape}`);
      },
      surReprise: (raison: string) => console.warn(`  [${cas.cle}] reprise : ${raison}`),
    };

    const propositions = await proposerHistoires(cas.troupe, parametres, options);

    // Le conte est imposé : c'est lui qu'on verse au fonds, pas un voisin.
    const choisie = propositions.retenues.find((s) => s.conte === cas.conte);
    if (!choisie) {
      throw new Error(`Le conte imposé « ${cas.conte} » n'est pas parmi les trois synopsis : `
        + `${propositions.retenues.map((s) => s.conte).join(', ')}. Relancer ce cas.`);
    }

    const script = await ecrireScript(propositions.dossier, cas.troupe, choisie, '', options);

    const spectacle = assemblerSpectacle(script, cas.troupe, parametres, {
      dossier: propositions.dossier,
      contesPresentes: propositions.presentes,
      jouables: propositions.jouables,
      synopsisProposes: propositions.retenues,
      synopsis: choisie,
      conteId: script.conteId,
      adaptation: script.bibleAdaptation,
      transposition: script.bibleTransposition,
      retouches: script.bibleRetouches,
      relecture: script.bibleRelecture,
    });

    // De quoi relire avant de commettre : le script comme le parent le lit,
    // et le spectacle entier pour l'ouvrir dans l'application au besoin.
    writeFileSync(join(SORTIE, `${cas.cle}-script.md`), scriptPourLeParent(spectacle), 'utf8');
    writeFileSync(join(SORTIE, `${cas.cle}-spectacle.json`), JSON.stringify(spectacle, null, 2), 'utf8');
    writeFileSync(
      join(SORTIE, `${cas.cle}-coulisses.json`),
      coulisses(spectacle, {
        problemesRestants: script.problemes,
        jetons: { propositions: propositions.jetons, ecriture: script.jetons },
        secondes: Math.round((Date.now() - debut) / 1000),
      }),
      'utf8',
    );

    // Ici le versement est le BUT : un refus (nom résiduel, revue finale en
    // échec) fait échouer le cas, le journal dit pourquoi.
    const chemin = verserALaBanque(spectacle);
    if (!chemin) {
      throw new Error(`« ${cas.cle} » n'a pas été versé à la banque — voir ${JOURNAL}.`);
    }

    console.log(
      `  [${cas.cle}] terminé en ${Math.round((Date.now() - debut) / 1000)}s — versé : ${chemin}\n`
        + '  Penser à réindexer : npm run banque',
    );
  });
}
