// Simulation de la scène et contrôles automatiques (CDC §6).
//
// C'est le garde-fou central du projet : un marionnettiste a deux mains, donc
// au plus deux marionnettes. Le modèle l'oublie régulièrement, et une scène
// injouable ne se voit qu'au moment de jouer, devant les enfants.
//
// La simulation est jouée élément par élément, comme le spectacle réel :
// on sait ainsi à tout instant qui est en scène et dans quelle main.
//
// Elle tourne deux fois (CDC §6) :
//   - au découpage, AVANT l'écriture des actes : une conduite injouable est
//     renvoyée au modèle sans avoir payé les répliques ;
//   - sur les actes écrits.

import { BORNES, DUREE } from '../config';
import { dureeElements, dansLaTolerance } from './duree';
import type { Acte, ElementScript, Id, Main, NiveauInteraction } from '../types';

/** Les mains d'un marionnettiste, dans l'ordre. */
const MAINS: Record<1 | 2, Main[]> = {
  1: ['M1G', 'M1D'],
  2: ['M1G', 'M1D', 'M2G', 'M2D'],
};

/** Un problème détecté, localisé aussi précisément que possible. */
export interface Probleme {
  /**
   * Trois degrés, les mêmes que ceux de la revue finale.
   *
   * Bloquant : la scène est injouable, et le découpage est refait.
   * Important : le spectacle se joue, mais quelque chose de central cloche —
   *   l'acte est repris à l'étape de correction.
   * Mineur : à surveiller, affiché en avertissement au parent.
   */
  gravite: 'bloquant' | 'important' | 'mineur';
  /** Numéro de l'acte concerné, si le problème est localisé. */
  acteNumero?: number;
  /** Position de l'élément fautif dans l'acte, à partir de 1. */
  position?: number;
  /** Message en français, affichable tel quel à côté de l'élément. */
  message: string;
}

/** État de la scène à un instant donné : quelle main tient quoi. */
export type EtatScene = Partial<Record<Main, Id>>;

/** Marionnettes présentes sur scène. */
export function enScene(etat: EtatScene): Id[] {
  return Object.values(etat).filter((id): id is Id => id !== undefined);
}

/**
 * Joue les éléments d'un acte et renvoie les problèmes rencontrés.
 *
 * @param etatInitial état laissé par l'acte précédent : une marionnette peut
 *                    rester en scène d'un acte à l'autre.
 */
export function simulerActe(
  elements: ElementScript[],
  nbMarionnettistes: 1 | 2,
  nomDe: (id: Id) => string,
  etatInitial: EtatScene = {},
  acteNumero?: number,
): { problemes: Probleme[]; etatFinal: EtatScene } {
  const etat: EtatScene = { ...etatInitial };
  const problemes: Probleme[] = [];
  const mainsValides = new Set(MAINS[nbMarionnettistes]);

  const signaler = (position: number, message: string, gravite: Probleme['gravite'] = 'bloquant') => {
    problemes.push({ gravite, acteNumero, position, message });
  };

  elements.forEach((e, index) => {
    const position = index + 1;

    switch (e.type) {
      case 'entree': {
        const nom = nomDe(e.marionnetteId);

        // La main doit exister : avec 1 marionnettiste, M2G et M2D n'existent pas.
        if (!mainsValides.has(e.mainMarionnettiste)) {
          signaler(
            position,
            `${nom} entre dans la main ${libelleMain(e.mainMarionnettiste)}, `
            + `mais il n’y a que ${nbMarionnettistes} marionnettiste${nbMarionnettistes > 1 ? 's' : ''}.`,
          );
          return;
        }

        // Une main ne tient qu'une marionnette à la fois.
        const occupantePar = etat[e.mainMarionnettiste];
        if (occupantePar !== undefined) {
          signaler(
            position,
            `${nom} entre dans la main ${libelleMain(e.mainMarionnettiste)}, `
            + `déjà occupée par ${nomDe(occupantePar)}.`,
          );
          return;
        }

        // Une marionnette ne peut pas être en scène deux fois.
        if (enScene(etat).includes(e.marionnetteId)) {
          signaler(position, `${nom} entre alors qu’elle est déjà en scène.`);
          return;
        }

        etat[e.mainMarionnettiste] = e.marionnetteId;
        break;
      }

      case 'sortie': {
        const nom = nomDe(e.marionnetteId);
        const main = (Object.keys(etat) as Main[]).find((m) => etat[m] === e.marionnetteId);
        if (main === undefined) {
          signaler(position, `${nom} sort alors qu’elle n’est pas en scène.`);
          return;
        }
        delete etat[main];
        break;
      }

      case 'replique':
      case 'adresse_public': {
        if (!enScene(etat).includes(e.marionnetteId)) {
          const nom = nomDe(e.marionnetteId);
          const verbe = e.type === 'replique' ? 'parle' : 's’adresse au public';
          signaler(position, `${nom} ${verbe} alors qu’elle n’est pas en scène.`);
        }
        break;
      }

      default:
        break;
    }
  });

  return { problemes, etatFinal: etat };
}

/** « main gauche du marionnettiste 1 », pour les messages. */
export function libelleMain(main: Main): string {
  const marionnettiste = main.startsWith('M1') ? 1 : 2;
  const cote = main.endsWith('G') ? 'gauche' : 'droite';
  return `${cote} du marionnettiste ${marionnettiste}`;
}

/** Ce qu'il faut savoir pour contrôler un spectacle. */
export interface ContexteControle {
  actes: Acte[];
  nbMarionnettistes: 1 | 2;
  /** Identifiants des marionnettes choisies par le parent. */
  marionnetteIds: Id[];
  nomDe: (id: Id) => string;
  interactionPublic: NiveauInteraction;
  /** Durée visée du spectacle entier, en secondes. */
  dureeCibleSecondes: number;
  /**
   * Budget de mots de chaque acte, par numéro, tel que le découpage l'a
   * réparti. Absent (spectacle importé, écran de script) : parts égales.
   */
  budgetsMots?: Record<number, number>;
}

/**
 * Contrôles automatiques des étapes 6 et 8 (CDC §6).
 *
 * 1. simulation de scène, acte après acte, en gardant l'état entre les actes ;
 * 2. toutes les marionnettes choisies apparaissent au moins une fois ;
 * 3. durée estimée dans la tolérance ;
 * 4. si l'interaction n'est pas « aucune », au moins une adresse au public
 *    par acte.
 *
 * Le contrôle du JSON lui-même (point 1 de la liste du CDC) est fait en amont
 * par les schémas zod, au moment de la lecture de la réponse.
 */
/**
 * Marque posée dans le script quand une réplique n'a pas pu être attribuée.
 *
 * Elle reste VISIBLE — rien ne disparaît en silence — mais elle vaut aussi
 * problème bloquant : sans quoi la réplique perdue ne serait jamais réécrite,
 * et le parent lirait la note à la place du texte.
 */
export const MARQUE_A_CORRIGER = 'À corriger :';

export function controler(c: ContexteControle): Probleme[] {
  const problemes: Probleme[] = [];

  // 0. Une réplique qu'on n'a pas su attribuer. C'est le défaut le plus grave
  //    du script : le texte a disparu, remplacé par une note.
  for (const acte of c.actes) {
    for (const [i, e] of acte.elements.entries()) {
      if (e.type !== 'note_marionnettiste') continue;
      if (!e.texte.startsWith(MARQUE_A_CORRIGER)) continue;
      problemes.push({
        gravite: 'bloquant',
        acteNumero: acte.numero,
        position: i + 1,
        message: `${e.texte} Cette note a remplacé une réplique ou un mouvement `
          + 'perdu : rends la parole à la marionnette de la distribution qui tient '
          + 'ce rôle, et supprime la note.',
      });
    }
  }

  // 1. Simulation de scène, l'état se poursuit d'un acte au suivant.
  let etat: EtatScene = {};
  for (const acte of c.actes) {
    const r = simulerActe(acte.elements, c.nbMarionnettistes, c.nomDe, etat, acte.numero);
    problemes.push(...r.problemes);
    etat = r.etatFinal;
  }

  // 2. Aucune marionnette choisie ne doit rester en coulisse tout le spectacle.
  const vues = new Set<Id>();
  for (const acte of c.actes) {
    for (const e of acte.elements) {
      if ('marionnetteId' in e) vues.add(e.marionnetteId);
    }
  }
  for (const id of c.marionnetteIds) {
    if (!vues.has(id)) {
      problemes.push({
        gravite: 'bloquant',
        message: `${c.nomDe(id)} n’apparaît jamais dans le spectacle.`,
      });
    }
  }

  // 3. Une didascalie ne se déguise pas en réplique. Une réplique qui commence
  // par le nom de celui qui la dit, à la troisième personne (« Doudou Lapin se
  // tourne vers les enfants… »), est une action : le parent ne saurait pas s'il
  // doit la dire ou la jouer.
  for (const acte of c.actes) {
    for (const [i, e] of acte.elements.entries()) {
      if (e.type !== 'replique' && e.type !== 'adresse_public') continue;
      const nom = c.nomDe(e.marionnetteId);
      if (!nom) continue;
      if (e.texte.trimStart().startsWith(nom)) {
        problemes.push({
          gravite: 'important',
          acteNumero: acte.numero,
          position: i + 1,
          message: `${nom} dit une phrase qui commence par son propre nom : `
            + `« ${e.texte.slice(0, 60)}… ». C’est une didascalie écrite comme une `
            + 'réplique — le parent ne saura pas s’il doit la dire ou la jouer.',
        });
      }
    }
  }

  // 4. Changer de peluche sur la même main demande une respiration. Une sortie
  // suivie immédiatement d'une entrée sur LA MÊME main, sans rien entre les
  // deux, oblige le parent à changer de peluche en une fraction de seconde
  // pendant que l'autre personnage attend, figé : ça se voit.
  for (const acte of c.actes) {
    for (let i = 0; i < acte.elements.length - 1; i++) {
      const sortie = acte.elements[i];
      const entree = acte.elements[i + 1];
      if (sortie.type !== 'sortie' || entree.type !== 'entree') continue;
      if (sortie.mainMarionnettiste !== entree.mainMarionnettiste) continue;
      problemes.push({
        gravite: 'important',
        acteNumero: acte.numero,
        position: i + 1,
        message: `${c.nomDe(entree.marionnetteId)} enfile la main `
          + `${entree.mainMarionnettiste} à l’instant même où `
          + `${c.nomDe(sortie.marionnetteId)} la quitte. Le parent n’a pas le temps `
          + 'de changer de peluche : intercale une réplique ou une didascalie.',
      });
    }
  }

  // 5. Un ton n'est pas une didascalie. Chaque réplique porte un champ « ton » ;
  // une didascalie de manière (« Voix traînante, impatient. ») placée APRÈS la
  // réplique fait découvrir le ton une fois la phrase déjà dite. Un parent lit
  // en jouant, il ne relit pas.
  const debutsDeTon = ['voix ', 'ton ', 'd’un ton', 'sur un ton', 'd’une voix'];
  for (const acte of c.actes) {
    for (const [i, e] of acte.elements.entries()) {
      if (e.type !== 'didascalie') continue;
      const t = e.texte.trim().toLowerCase();
      if (debutsDeTon.some((d) => t.startsWith(d))) {
        problemes.push({
          gravite: 'important',
          acteNumero: acte.numero,
          position: i + 1,
          message: `« ${e.texte} » décrit une manière de parler, pas une action. `
            + 'Cela va dans le champ « ton » de la réplique concernée, sinon le '
            + 'parent découvre le ton après avoir dit la phrase.',
        });
      }
    }
  }

  // 6. Une note ne redécrit jamais le décor : la liste de préparation le décrit
  // déjà, et deux descriptions du même décor finissent par se contredire.
  const motsDeDecor = ['décor', 'accessoire', 'drap', 'carton', 'coussin', 'nappe', 'torchon'];
  for (const acte of c.actes) {
    for (const [i, e] of acte.elements.entries()) {
      if (e.type !== 'note_marionnettiste') continue;
      const t = e.texte.toLowerCase();
      if (motsDeDecor.some((m) => t.includes(m))) {
        problemes.push({
          gravite: 'important',
          acteNumero: acte.numero,
          position: i + 1,
          message: `La note « ${e.texte.slice(0, 60)}… » décrit le décor, que la `
            + 'liste de préparation décrit déjà. Deux descriptions du même décor se '
            + 'contredisent toujours, et c’est le parent qui se retrouve devant sa '
            + 'table sans savoir quoi poser.',
        });
      }
    }
  }

  // 6 bis. Pas de question d'opinion ni d'idée à trouver à la place du
  // personnage (CDC §6). La consigne est dans tous les prompts, et la revue
  // l'a pourtant laissée passer au banc : « Qui pourrait être plus fort que le
  // Mur, à votre avis ? ». Un motif se vérifie mieux qu'une consigne.
  const QUESTION_INTERDITE = /(?<![\p{L}])(à (votre|ton) avis|selon (vous|toi)|qu['’]en pensez-vous|que feriez-vous|vous croyez qu|qui pourrait|qu['’]est-ce qu['’](il|elle|on|je) (doit|devrait|pourrait|peut) faire|c['’]est bien de)/iu;
  for (const acte of c.actes) {
    for (const [i, e] of acte.elements.entries()) {
      if (e.type !== 'adresse_public' || !e.texte.includes('?')) continue;
      if (!QUESTION_INTERDITE.test(e.texte)) continue;
      problemes.push({
        gravite: 'important',
        acteNumero: acte.numero,
        position: i + 1,
        message: `« ${e.texte.slice(0, 80)} » demande aux enfants leur avis, ou de `
          + 'trouver l’idée à la place du personnage. On leur demande d’agir — crier, '
          + 'compter, répéter une formule —, jamais de décider ni de deviner la suite.',
      });
    }
  }

  // 6 ter. La narration du conte ne va pas dans la bouche d'une marionnette
  // (CDC §6). Le passé simple à la troisième personne la trahit : « Les deux
  // amis vécurent heureux… », dit au public par le père. Les terminaisons en
  // « -èrent » ne sont que du passé simple ; les autres formes retenues ne se
  // confondent avec aucun présent.
  const NARRATION = /(\p{L}+èrent|(?<![\p{L}])(vécurent|devinrent|devint|furent|prirent|firent|eurent|vinrent|revinrent|partirent|sortirent))(?![\p{L}])/iu;
  // Le PRÉSENT des verbes en « -érer » finit aussi en « -èrent » : ils
  // préfèrent, ils espèrent. Ce ne sont pas des passés simples.
  const PRESENTS_EN_ERENT = /^(pr[ée]f|esp|d[ée]sesp|exag|dig|g|consid|tol|op|coop|r[ée]cup|lib|acc[ée]l|[ée]num|sugg|g[ée]n|r[ée]g[ée]n|ins|alt|diff|transf|conf|r[ée]f|d[ée]f|inf|prof|sid|adh|a|lac|mod|v[ée]n|temp|obtemp|r[ée]it|ing|ulc|incarc|pond|l[ée]gif|mac)èrent$/i;
  const estNarration = (texte: string) => (texte.match(new RegExp(NARRATION, 'giu')) ?? [])
    .some((mot) => !PRESENTS_EN_ERENT.test(mot));
  for (const acte of c.actes) {
    for (const [i, e] of acte.elements.entries()) {
      if (e.type !== 'replique' && e.type !== 'adresse_public') continue;
      if (!estNarration(e.texte)) continue;
      problemes.push({
        gravite: 'important',
        acteNumero: acte.numero,
        position: i + 1,
        message: `${c.nomDe(e.marionnetteId)} récite la narration du conte : `
          + `« ${e.texte.slice(0, 80)} ». Ce que raconte le conteur se montre en `
          + 'didascalie, ou se dit à la première personne, comme on parle.',
      });
    }
  }

  // 6 quater. Une peluche ne change pas de costume (CDC §6, contraintes
  // matérielles). Au banc : « Pilou arrive fièrement, un petit chapeau sur la
  // tête et un beau nœud autour du cou » — le parent n'a pas de troisième main
  // pour l'habiller entre deux répliques.
  const COSTUME = /(?<![\p{L}])(chapeau|nœud|noeud|écharpe|foulard|cravate|lunettes|couronne|costume|robe|cape|masque|perruque|collier|tablier|bonnet|casquette|déguis\p{L}*|habill\p{L}*|coiff[ée]\p{L}*)(?![\p{L}])/iu;
  for (const acte of c.actes) {
    for (const [i, e] of acte.elements.entries()) {
      if (e.type !== 'didascalie') continue;
      const trouve = COSTUME.exec(e.texte);
      if (!trouve) continue;
      problemes.push({
        gravite: 'important',
        acteNumero: acte.numero,
        position: i + 1,
        message: `« ${e.texte.slice(0, 80)} » habille la marionnette (« ${trouve[1]} »). `
          + 'Une peluche ne change pas de costume en cours de spectacle : le parent a '
          + 'les deux mains prises. Montre-le par l’attitude, ou fais-le dire.',
      });
    }
  }

  // 7. Durée dans la tolérance.
  //
  // Le problème d'ensemble ne porte aucun numéro d'acte : il ne pouvait donc
  // déclencher aucune réécriture, et un spectacle à moitié trop court était
  // simplement signalé au parent. On désigne maintenant AUSSI les actes qui
  // s'écartent de leur part, avec le nombre de mots à gagner ou à perdre :
  // c'est ce qui rend l'écart corrigible.
  const secondes = c.actes.reduce((t, a) => t + dureeElements(a.elements).secondes, 0);
  if (!dansLaTolerance(secondes, c.dureeCibleSecondes)) {
    const tropCourt = secondes < c.dureeCibleSecondes;
    problemes.push({
      gravite: 'important',
      message: tropCourt
        ? `Le spectacle est trop court : ${Math.round(secondes / 60)} min au lieu de `
          + `${Math.round(c.dureeCibleSecondes / 60)} min visées.`
        : `Le spectacle est trop long : ${Math.round(secondes / 60)} min au lieu de `
          + `${Math.round(c.dureeCibleSecondes / 60)} min visées.`,
    });

    // Plus large que la tolérance du spectacle entier (±20 %) : les actes
    // sont inégaux par nature, et une correction demandée pour dix secondes
    // d'écart coûte un appel entier pour revenir, le plus souvent, inchangée.
    //
    // La part de chaque acte est celle que le DÉCOUPAGE lui a donnée (son
    // budget de mots), pas une part égale : le dénouement reçoit souvent plus,
    // et c'est voulu. Avec une part égale, le dernier acte se voyait demander
    // des coupes qu'on interdit par ailleurs.
    const sommeBudgets = c.actes.reduce((t, a) => t + (c.budgetsMots?.[a.numero] ?? 0), 0);
    const partDe = (numero: number) => (sommeBudgets > 0 && c.budgetsMots?.[numero]
      ? c.dureeCibleSecondes * (c.budgetsMots[numero] / sommeBudgets)
      : c.dureeCibleSecondes / Math.max(1, c.actes.length));
    const dernier = Math.max(...c.actes.map((a) => a.numero));
    for (const acte of c.actes) {
      const partParActe = partDe(acte.numero);
      const sienne = dureeElements(acte.elements).secondes;
      if (Math.abs(sienne - partParActe) <= partParActe * DUREE.toleranceParActe) continue;
      // La fin ne se coupe jamais (CDC §6) : un dernier acte trop long n'est
      // pas un défaut à corriger.
      if (acte.numero === dernier && sienne > partParActe) continue;
      const motsAGagner = Math.round(((partParActe - sienne) / 60) * DUREE.motsParMinute);
      problemes.push({
        gravite: 'important',
        acteNumero: acte.numero,
        message: motsAGagner > 0
          ? `L'acte ${acte.numero} est un peu court : ${Math.round(sienne)} s au lieu `
            + `des ${Math.round(partParActe)} s de sa part, soit environ ${motsAGagner} mots. `
            + 'Joue plus longuement ce que le conte raconte DÉJÀ, sans inventer '
            + 'd’épisode : développe ses répliques, laisse les personnages se '
            + 'répondre, étire les répétitions qu’il porte. Si le passage est de la '
            + 'pure narration, sans une réplique à développer, LAISSE L’ACTE COURT : '
            + 'inventer tout un dialogue pour tenir la jauge est exactement ce qu’on '
            + 'ne veut pas.'
          : `L'acte ${acte.numero} est un peu long : ${Math.round(sienne)} s au lieu `
            + `des ${Math.round(partParActe)} s de sa part, soit environ ${-motsAGagner} mots. `
            + 'Resserre ce qui ne vient pas du conte — didascalies bavardes, '
            + 'répliques ajoutées. C’est une jauge, pas un quota : ne coupe jamais '
            + 'une réplique du conte ni une information dont le parent a besoin.',
      });
    }
  }

  // 8. Interaction avec le public promise mais absente.
  //
  // La dose N'EST PAS la même selon le réglage, et le contrôle s'était aligné
  // sur le mauvais. « Quelques moments » veut dire deux ou trois adresses
  // dans TOUT le spectacle : en exiger une par acte contredisait la consigne
  // donnée au modèle, et la correction d'un acte réclamait une adresse de plus
  // alors que le spectacle avait déjà son compte.
  if (c.interactionPublic === 'beaucoup') {
    for (const acte of c.actes) {
      if (acte.elements.some((e) => e.type === 'adresse_public')) continue;
      problemes.push({
        gravite: 'mineur',
        acteNumero: acte.numero,
        message: `L’acte ${acte.numero} ne s’adresse jamais au public.`,
      });
    }
  } else if (c.interactionPublic === 'quelques') {
    const total = c.actes.reduce(
      (n, a) => n + a.elements.filter((e) => e.type === 'adresse_public').length,
      0,
    );
    if (total === 0) {
      problemes.push({
        gravite: 'mineur',
        message: 'Le spectacle ne s’adresse jamais au public, alors que le parent '
          + 'a demandé quelques moments avec lui.',
      });
    }
  }

  return problemes;
}

/** Vrai si rien n'empêche d'enregistrer le spectacle. */
export function sansBlocage(problemes: Probleme[]): boolean {
  return !problemes.some((p) => p.gravite === 'bloquant');
}

/**
 * Réattribue les mains, en jouant la scène du début à la fin.
 *
 * La main n'est pas une information que le modèle détient : c'est une
 * conséquence mécanique de qui entre et qui sort, et l'application est seule à
 * pouvoir la calculer juste. Une main mal écrite ne doit jamais coûter un
 * spectacle.
 *
 * Ce que le modèle dit reste une PRÉFÉRENCE : si la main qu'il indique est
 * valide et libre, on la garde — la mise en scène qu'il avait en tête est
 * respectée. Sinon on prend la première main libre, et une sortie reprend
 * toujours la main qui tient réellement la marionnette.
 *
 * Quand aucune main n'est libre, on ne corrige rien : c'est un vrai problème
 * de scène, et c'est à la simulation de le dire.
 */
export function attribuerMains(
  elements: ElementScript[],
  nbMarionnettistes: 1 | 2,
  etatInitial: EtatScene = {},
): ElementScript[] {
  const mains = MAINS[nbMarionnettistes];
  const etat: EtatScene = { ...etatInitial };

  return elements.map((e) => {
    if (e.type === 'entree') {
      if (enScene(etat).includes(e.marionnetteId)) return e; // déjà en scène
      const voulue = e.mainMarionnettiste;
      const main = mains.includes(voulue) && etat[voulue] === undefined
        ? voulue
        : mains.find((m) => etat[m] === undefined);
      if (!main) return e; // plus de main libre : la simulation le signalera
      etat[main] = e.marionnetteId;
      return { ...e, mainMarionnettiste: main };
    }

    if (e.type === 'sortie') {
      const tenue = mains.find((m) => etat[m] === e.marionnetteId);
      if (!tenue) return e; // elle n'est pas en scène : la simulation le dira
      etat[tenue] = undefined;
      return { ...e, mainMarionnettiste: tenue };
    }

    return e;
  });
}

/** Mains disponibles pour un nombre de marionnettistes donné. */
export function mainsDe(nbMarionnettistes: 1 | 2): Main[] {
  return [...MAINS[nbMarionnettistes]];
}

/** Nombre maximal de marionnettes simultanément en scène. */
export function maxSimultanees(nbMarionnettistes: 1 | 2): number {
  return nbMarionnettistes * BORNES.mainsParMarionnettiste;
}
