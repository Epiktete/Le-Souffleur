// RELAIS LOCAL — outillage de développement, jamais livré.
//
// Fait tourner le pipeline SANS aucun appel réseau et sans aucune clé : c'est
// un humain (ou un agent) qui joue le modèle, à la main, étape par étape.
//
// À quoi ça sert : le banc ordinaire dit SI le texte produit est bon. Le
// relais dit POURQUOI. En lisant le prompt exact reçu à chaque étape, on voit
// ce qui manque, ce qui se contredit, ce qui se comprend de travers. Si l'on
// n'arrive pas soi-même à écrire une bonne réponse à partir d'un prompt,
// aucun modèle n'y arrivera.
//
// COMMENT ÇA MARCHE — rejeu déterministe, une étape par exécution :
//   1. `npm run relais` lance le pipeline. À chaque appel au modèle, le relais
//      cherche la réponse déjà écrite pour cette étape.
//   2. Si elle existe, il la rend instantanément et le pipeline continue.
//   3. Sinon, il écrit le prompt dans banc/relais/NNN-demande.md et s'arrête.
//   4. On écrit sa réponse dans banc/relais/NNN-reponse.json, on relance.
//
// Rien n'est jamais rejoué « à peu près » : les étapes déjà répondues sont
// relues telles quelles, donc la suite est toujours la même.
//
// Lancement :  npm run relais
// Repartir de zéro :  effacer banc/relais/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'vitest';

import type { Acces } from '../src/services/connecteurIa';
import type { Marionnette, ParametresGeneration } from '../src/types';
import { assemblerSpectacle, ecrireScript, proposerHistoires } from '../src/services/pipeline';
import { coulisses, scriptPourLeParent } from './rendre';

const DOSSIER = resolve(process.env.RELAIS_SORTIE || `banc/relais/cas${process.env.RELAIS_CAS || 1}`);
mkdirSync(DOSSIER, { recursive: true });

const numero = (n: number) => String(n).padStart(3, '0');

/* ---------------------------------------------------------------- */
/* Le relais : on remplace fetch, il n'y a donc aucun réseau         */
/* ---------------------------------------------------------------- */

let compteur = 0;

globalThis.fetch = (async (_url: string, init: { body: string }) => {
  const n = ++compteur;
  const requete = JSON.parse(init.body) as {
    messages: { role: string; content: string }[];
    temperature: number;
    max_tokens: number;
  };

  const fichierReponse = join(DOSSIER, `${numero(n)}-reponse.json`);
  if (existsSync(fichierReponse)) {
    const texte = readFileSync(fichierReponse, 'utf8');
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: texte }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  const system = requete.messages.find((m) => m.role === 'system')?.content ?? '';
  const user = requete.messages.find((m) => m.role === 'user')?.content ?? '';
  const mots = (s: string) => s.split(/\s+/).filter(Boolean).length;

  // Le système et l'utilisateur sont écrits BRUTS, chacun dans son fichier.
  // C'est ce qui permet de les donner tels quels à celui qui joue le modèle :
  // enrobés dans une consigne à nous, ce ne serait plus le prompt réel qu'on
  // éprouve, mais notre paraphrase.
  writeFileSync(join(DOSSIER, `${numero(n)}-systeme.txt`), system);
  writeFileSync(join(DOSSIER, `${numero(n)}-utilisateur.txt`), user);
  writeFileSync(
    join(DOSSIER, `${numero(n)}-demande.md`),
    `# Étape ${numero(n)}\n\n`
      + `température ${requete.temperature} · budget de sortie ${requete.max_tokens} jetons\n`
      + `système ${mots(system)} mots · utilisateur ${mots(user)} mots\n\n`
      + `Prompt réel : ${numero(n)}-systeme.txt et ${numero(n)}-utilisateur.txt\n`
      + `Réponse attendue (le JSON seul) : ${numero(n)}-reponse.json\n`,
  );
  // Un état lisible d'un coup d'œil, pour piloter la boucle sans lire vitest.
  writeFileSync(
    join(DOSSIER, 'etat.json'),
    JSON.stringify({
      attente: n,
      temperature: requete.temperature,
      budgetSortie: requete.max_tokens,
      motsSysteme: mots(system),
      motsUtilisateur: mots(user),
    }, null, 2),
  );
  // On se fait passer pour une ANNULATION, et pas pour une panne : le
  // pipeline rattrape défensivement les échecs de la revue finale et des
  // corrections (« un garde-fou, pas une condition »), si bien qu'un simple
  // échec y serait avalé en silence et le spectacle livré sans elles. Seule
  // l'annulation traverse ces rattrapages.
  throw Object.assign(new Error('relais en attente'), { name: 'AbortError' });
}) as unknown as typeof fetch;

/* ---------------------------------------------------------------- */
/* Le cas joué                                                       */
/* ---------------------------------------------------------------- */

const peluche = (nom: string, description: string, traits: string[]): Marionnette => {
  const maintenant = new Date().toISOString();
  return {
    id: nom.toLowerCase().replace(/\s+/g, '-'),
    nom, description, traits, creeLe: maintenant, modifieLe: maintenant,
  };
};

/**
 * Cinq cas, volontairement dissemblables : c'est en variant l'âge, la durée,
 * l'espèce des peluches et la présence d'une ébauche qu'on fait sortir les
 * défauts. RELAIS_CAS choisit lequel ; chacun a son dossier.
 */
const CAS = {
  1: {
    troupe: [
      peluche('Doudou Lapin', 'Un lapin en tissu beige, une oreille recousue et qui retombe.', ['inquiet', 'serviable']),
      peluche('Renard Rusé', 'Un renard roux au museau pointu, la queue un peu pelée.', ['malin', 'vaniteux']),
      peluche('Ourse Gourmande', 'Une grosse ourse en peluche marron, très douce, assez lourde.', ['gourmande', 'franche']),
    ],
    dureeMinutes: 5, ageAuditoire: 6, nbMarionnettistes: 1 as const,
    interactionPublic: 'quelques' as const, ebauche: '',
  },
  2: {
    // Deux marionnettes seulement, public très jeune, beaucoup d'interaction.
    troupe: [
      peluche('Petite Souris', 'Une souris grise minuscule, en feutrine.', ['peureux', 'curieux']),
      peluche('Gros Loup', 'Un loup gris au museau râpé, assez grand.', ['méchant', 'gourmand']),
    ],
    dureeMinutes: 5, ageAuditoire: 4, nbMarionnettistes: 1 as const,
    interactionPublic: 'beaucoup' as const, ebauche: '',
  },
  3: {
    // Une ébauche écrite : elle doit mener le choix.
    troupe: [
      peluche('Mémé Tortue', 'Une tortue verte à la carapace molle.', ['sage', 'têtu']),
      peluche('Pilou le Pingouin', 'Un pingouin noir et blanc, le bec cousu de travers.', ['curieux', 'bavard']),
      peluche('Roi Corbeau', 'Un corbeau noir au bec luisant.', ['vantard', 'orgueilleux']),
    ],
    dureeMinutes: 8, ageAuditoire: 7, nbMarionnettistes: 1 as const,
    interactionPublic: 'quelques' as const,
    ebauche: 'une histoire de course ou de pari, où le plus lent gagne',
  },
  4: {
    // Deux marionnettistes, quatre peluches, public grand.
    troupe: [
      peluche('Jean le Paysan', 'Une marionnette de tissu en salopette, chapeau de paille.', ['travailleur', 'rusé']),
      peluche('Dame Chèvre', 'Une chèvre blanche à longue barbe.', ['têtu', 'grognon']),
      peluche('Petit Chat', 'Un chaton roux tout doux.', ['coquin', 'farceur']),
      peluche('Vieux Hibou', 'Un hibou brun aux grands yeux ronds.', ['sage', 'savant']),
    ],
    dureeMinutes: 10, ageAuditoire: 9, nbMarionnettistes: 2 as const,
    interactionPublic: 'aucune' as const, ebauche: '',
  },
  5: {
    // Une seule marionnette : le cas limite du CDC §6.
    troupe: [
      peluche('Grand Ours', 'Un ours brun massif, en peluche épaisse.', ['fort', 'naïf']),
    ],
    dureeMinutes: 5, ageAuditoire: 5, nbMarionnettistes: 1 as const,
    interactionPublic: 'beaucoup' as const, ebauche: '',
  },
} as const;

const NUM = Number(process.env.RELAIS_CAS || 1) as keyof typeof CAS;
const cas = CAS[NUM];
if (!cas) throw new Error('RELAIS_CAS doit valoir 1 à 5.');

const DISTRIBUTION = [...cas.troupe];

const PARAMETRES: ParametresGeneration = {
  dureeMinutes: cas.dureeMinutes,
  ageAuditoire: cas.ageAuditoire,
  nbMarionnettistes: cas.nbMarionnettistes,
  interactionPublic: cas.interactionPublic,
  ebauche: cas.ebauche || undefined,
  marionnetteIds: DISTRIBUTION.map((m) => m.id),
  modele: 'relais-local',
};

// Aucune clé : le relais ne sort jamais de la machine.
const acces: Acces = {
  baseUrl: 'http://relais.local/v1',
  cle: 'sans-cle',
  modele: 'relais-local',
  fournisseurId: 'openrouter',
};

/** L'étape qui attend sa réponse, lue dans l'état écrit par le relais. */
function attenteEnCours(): { n: number } | null {
  const f = join(DOSSIER, 'etat.json');
  if (!existsSync(f)) return null;
  const etat = JSON.parse(readFileSync(f, 'utf8')) as { attente?: number };
  return etat.attente ? { n: etat.attente } : null;
}

/* ---------------------------------------------------------------- */

test(`relais local — cas ${NUM}`, async () => {
  const options = {
    acces,
    signal: new AbortController().signal,
    surAvancement: (a: { etape: string }) => console.log(`  — ${a.etape}`),
    surReprise: (raison: string) => console.warn(`  reprise : ${raison}`),
  };

  try {
    const propositions = await proposerHistoires(DISTRIBUTION, PARAMETRES, options);
    const choisie = propositions.retenues[0];
    const script = await ecrireScript(propositions.dossier, DISTRIBUTION, choisie, '', options);
    const spectacle = assemblerSpectacle(script, DISTRIBUTION, PARAMETRES, {
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

    writeFileSync(join(DOSSIER, 'etat.json'), JSON.stringify({
      termine: true,
      etapes: compteur,
      conte: script.conteId,
      titre: spectacle.titre,
      dureeEstimeeSecondes: spectacle.dureeEstimeeSecondes,
      dureeCibleSecondes: PARAMETRES.dureeMinutes * 60,
      problemesRestants: script.problemes,
    }, null, 2));
    writeFileSync(join(DOSSIER, 'script.md'), scriptPourLeParent(spectacle));
    writeFileSync(join(DOSSIER, 'coulisses.json'), coulisses(spectacle, { etapes: compteur }));
    console.log(`\n  TERMINÉ — ${compteur} étapes. Script dans ${DOSSIER}/script.md`);
  } catch (e) {
    // L'arrêt se lit dans l'état, pas dans l'erreur : celle-ci a pu être
    // retraduite plusieurs fois en remontant le pipeline.
    const attente = attenteEnCours();
    if (attente) {
      console.log(
        `\n  EN ATTENTE de l'étape ${numero(attente.n)}.\n`
        + `  Lire  : banc/relais/${numero(attente.n)}-demande.md\n`
        + `  Écrire: banc/relais/${numero(attente.n)}-reponse.json\n`
        + '  Puis relancer : npm run relais',
      );
      return;
    }
    throw e;
  }
});
