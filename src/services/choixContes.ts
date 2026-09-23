// Le choix des contes : trouver, dans la contothèque, ceux qui vont aux
// marionnettes choisies.
//
// D'abord deux BARRIÈRES, qu'aucune note ne rachète :
//   - l'âge du public ;
//   - le nombre : pas plus de rôles principaux que de marionnettes invitées
//     au studio, et chaque marionnette en trop doit trouver un petit rôle.
//
// Puis une NOTE PONDÉRÉE, pour qu'un conte parfait sur un critère mais
// impossible sur un autre ne passe pas devant un conte bon partout. Dans
// l'ordre d'importance :
//
//   1. LE NOMBRE : autant de marionnettes que de rôles vaut mieux que des
//      marionnettes reléguées dans des petits rôles.
//   2. LES TRAITS, facultatifs et légers dans le choix du conte : leur vrai
//      métier est de donner à chaque marionnette le rôle qui lui ressemble.
//   3. L'ÉBAUCHE du parent, s'il en a écrit une : les contes qui en parlent
//      passent devant.
//   4. LA DURÉE : un conte de soixante mots ne s'étire pas sur dix minutes sans
//      inventer, et un conte de quinze mille mots ne tient pas en cinq sans
//      être mutilé.
//   5. L'ESPÈCE, sans être trop regardant : un lapin peut jouer un chevreuil,
//      un ours un lion. Elle interdit dans un seul cas : une petite bête douce
//      ne joue pas un prédateur ni un ogre. Un lapin n'est pas un loup.
//
// Le tout est fait par l'application : il ne coûte rien, il est toujours le
// même pour les mêmes marionnettes, et il se teste. Le modèle ne reçoit que
// les huit meilleurs, en retient trois et les raconte au parent.

import INDEX_BRUT from '../../wiki/index.json?raw';
import { budgetMots } from './duree';
import { motsSignifiants } from './mots';
import { CONTES, type Conte, type RoleConte } from './repertoire';
import type { Marionnette } from '../types';

/**
 * Longueur et mots-clés de chaque conte, tirés de son texte intégral par
 * tools/indexer-contes.mjs.
 */
const INDEX = JSON.parse(INDEX_BRUT) as Record<string, { mots: number; cles: string[] }>;

/* ================================================================== */
/* Réglages                                                            */
/* ================================================================== */

export const CHOIX = {
  /** Contes montrés au modèle, qui en retient trois. */
  presentes: 8,
  /** Pas plus de ce nombre de contes d'une même origine dans la sélection. */
  parOrigine: 3,
  /**
   * Poids des notes dans le total. Ce qui compte le plus : le nombre de
   * rôles, puis l'ébauche du parent, puis la durée. L'espèce et les traits
   * des marionnettes ne font que départager : une peluche « gourmande » ne
   * doit pas ramener sans cesse les mêmes contes de gourmands.
   *
   * Les traits pesaient 0,5 ; ils sont tombés à 0,25 le jour où ils sont
   * devenus facultatifs. Leur vrai métier est ailleurs : distribuer les rôles
   * une fois le conte choisi (`meilleureDistribution`).
   */
  poids: { nombre: 3, traits: 0.25, ebauche: 2.5, duree: 2, espece: 1 },
  /** Poids de l'espèce face aux traits, dans le choix des rôles. */
  poidsEspece: 0.3,
  /** Tolérance d'âge : un conte « 5-10 ans » reste possible à 4 ans. */
  margeAge: 1,
} as const;

/* ================================================================== */
/* Les espèces                                                         */
/* ================================================================== */

/**
 * Familles d'espèces. Deux espèces de la même famille se remplacent sans
 * difficulté ; entre familles, `compatibiliteEspece` dit ce qui passe.
 */
export type Famille =
  | 'petit' // petites bêtes douces, proies : lapin, souris, chevreuil, agneau
  | 'predateur' // loup, renard, tigre, crocodile, chat
  | 'gros' // grosses bêtes : ours, éléphant, vache, cheval
  | 'oiseau'
  | 'bestiole' // insectes, araignées, crabes, escargots
  | 'eau' // poissons, grenouilles, tortues
  | 'enfant' // enfants et jeunes gens
  | 'adulte'
  | 'vieux'
  | 'noble' // rois, reines, princes
  | 'monstre' // ogre, géant, dragon, sorcière
  | 'feerique' // fée, génie, lutin, licorne
  | 'objet';

/**
 * Les mots qui désignent une espèce, sans accents et au singulier. Une
 * marionnette est reconnue à son nom ou à sa description (« Doudou Lapin »,
 * « un vieux lapin gris en peluche ») ; un rôle, au champ `espece` de la fiche.
 */
const LEXIQUE: Record<Famille, string[]> = {
  petit: [
    'lapin', 'lapine', 'lievre', 'souris', 'mulot', 'hamster', 'ecureuil', 'herisson',
    'chevreuil', 'biche', 'faon', 'daim', 'cerf', 'gazelle', 'antilope', 'agneau',
    'mouton', 'brebis', 'chevre', 'chevreau', 'bouc', 'marmotte', 'taupe', 'loir',
    'cochon', 'cochonnet', 'porcelet', 'koala', 'panda', 'raton', 'belette', 'blaireau',
    'rat', 'chaton', 'poussin', 'caneton', 'poney', 'zebre', 'lama', 'kangourou', 'loutre',
    'tanuki', 'singe', 'babouin', 'macaque', 'suricate', 'chinchilla',
  ],
  predateur: [
    'loup', 'louve', 'renard', 'renarde', 'tigre', 'lion', 'lionne', 'leopard', 'panthere',
    'jaguar', 'guepard', 'lynx', 'hyene', 'chacal', 'crocodile', 'alligator', 'serpent',
    'requin', 'chat', 'chatte', 'fouine', 'coyote', 'puma',
  ],
  gros: [
    'ours', 'ourse', 'ourson', 'elephant', 'hippopotame', 'rhinoceros', 'buffle', 'bison',
    'taureau', 'boeuf', 'vache', 'veau', 'cheval', 'jument', 'ane', 'anesse', 'mulet',
    'girafe', 'chameau', 'dromadaire', 'gorille', 'orang', 'sanglier', 'elan', 'morse',
    'chien', 'chienne', 'chiot', 'dinosaure', 'mammouth', 'baleine',
  ],
  oiseau: [
    'oiseau', 'coq', 'poule', 'poulet', 'oie', 'canard', 'cane', 'cygne', 'dindon', 'pie',
    'corbeau', 'corneille', 'moineau', 'merle', 'caille', 'perdrix', 'pigeon', 'colombe',
    'hibou', 'chouette', 'faucon', 'aigle', 'perroquet', 'pingouin', 'manchot', 'autruche',
    'cigogne', 'heron', 'rouge-gorge', 'mesange', 'pelican', 'flamant', 'toucan', 'paon',
  ],
  bestiole: [
    'araignee', 'fourmi', 'abeille', 'mouche', 'moustique', 'frelon', 'guepe', 'cigale',
    'grillon', 'sauterelle', 'coccinelle', 'papillon', 'chenille', 'escargot', 'limace',
    'ver', 'crabe', 'ecrevisse', 'scarabee', 'libellule', 'puce', 'insecte', 'lezard',
    'cameleon', 'gecko',
  ],
  eau: [
    'poisson', 'grenouille', 'crapaud', 'tortue', 'pieuvre', 'meduse', 'dauphin', 'phoque',
    'otarie', 'hippocampe', 'coquillage', 'algue', 'poulpe', 'triton',
  ],
  enfant: [
    'enfant', 'garcon', 'fille', 'fillette', 'bebe', 'eleve', 'petit-fils', 'petite-fille',
    'jeune', 'adolescent', 'ecolier', 'ecoliere', 'gamin', 'gamine', 'poucet',
  ],
  adulte: [
    'homme', 'femme', 'mere', 'pere', 'maman', 'papa', 'paysan', 'paysanne', 'marchand',
    'marchande', 'valet', 'domestique', 'serviteur', 'servante', 'soldat', 'meunier',
    'bucheron', 'pecheur', 'tailleur', 'cordonnier', 'savetier', 'fermier', 'fermiere',
    'chasseur', 'berger', 'bergere', 'aubergiste', 'notaire', 'medecin', 'docteur', 'juge',
    'gendarme', 'policier', 'voleur', 'brigand', 'pirate', 'boucher', 'boulanger',
    'forgeron', 'jardinier', 'tisserand', 'moine', 'mendiant', 'voisin', 'voisine',
    'voyageur', 'cuisinier', 'cuisiniere', 'frere', 'soeur', 'oncle', 'tante', 'cousin',
    'epouse', 'mari', 'fiance', 'fiancee', 'clown', 'guignol', 'gnafron', 'madelon',
    'polichinelle', 'chevalier', 'cavalier', 'maitre', 'maitresse', 'professeur',
    'facteur', 'pompier', 'cocher', 'mitron', 'bourgeois', 'rentier', 'artisan', 'danseuse',
    'danseur', 'montreur', 'canut', 'ministre', 'courtisan', 'magistrat',
  ],
  vieux: [
    'vieux', 'vieille', 'vieillard', 'grand-mere', 'grand-pere', 'grand-parent', 'mamie',
    'papi', 'aieul', 'veuve', 'ermite',
  ],
  noble: [
    'roi', 'reine', 'prince', 'princesse', 'seigneur', 'empereur', 'imperatrice', 'comte',
    'comtesse', 'marquis', 'baron', 'baronne', 'duc', 'duchesse', 'sultan', 'dame',
    'chatelain', 'chatelaine', 'pharaon', 'calife', 'emir',
  ],
  monstre: [
    'ogre', 'ogresse', 'geant', 'geante', 'troll', 'dragon', 'diable', 'demon', 'sorciere',
    'sorcier', 'loup-garou', 'fantome', 'monstre', 'vampire', 'croquemitaine',
  ],
  feerique: [
    'fee', 'genie', 'lutin', 'elfe', 'licorne', 'magicien', 'magicienne', 'esprit', 'ange',
    'sirene', 'farfadet', 'gnome', 'nain', 'naine', 'enchanteur', 'enchanteresse',
  ],
  objet: [
    'pain', 'galette', 'pot', 'marmite', 'navet', 'citrouille', 'courge', 'chataigne',
    'baton', 'harpe', 'manteau', 'habit', 'statue', 'mur', 'souche', 'plante', 'houe',
    'mortier', 'soleil', 'vent', 'nuage', 'feu', 'eau', 'mer', 'fleuve', 'poupee', 'pantin',
    'robot', 'jouet',
  ],
};

/** Mot normalisé -> famille. Construit une fois pour toutes. */
const FAMILLE_DU_MOT = new Map<string, Famille>();
for (const [famille, mots] of Object.entries(LEXIQUE) as [Famille, string[]][]) {
  for (const mot of mots) if (!FAMILLE_DU_MOT.has(mot)) FAMILLE_DU_MOT.set(mot, famille);
}
// « poupée » et « pantin » sont rangés parmi les objets pour les rôles (un
// pantin qu'on anime), mais une marionnette-poupée joue un humain : voir
// `especeMarionnette`.

export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim();
}

/** Les mots d'un texte, avec leur forme sans « s » ou « x » final. */
function mots(texte: string): string[] {
  const tous = normaliser(texte).split(/\s+/).filter(Boolean);
  const resultat: string[] = [];
  for (const m of tous) {
    resultat.push(m);
    if (m.length > 3 && /[sx]$/.test(m)) resultat.push(m.slice(0, -1));
  }
  return resultat;
}

/** Le premier mot d'espèce reconnu dans un texte, et sa famille. */
function reconnaitre(texte: string): { mot: string; famille: Famille } | null {
  for (const m of mots(texte)) {
    const famille = FAMILLE_DU_MOT.get(m);
    if (famille) return { mot: m, famille };
  }
  return null;
}

/**
 * Le mot tel que le parent l'a écrit (« éléphant », « souris »), au singulier,
 * pour le donner au modèle avec ses accents.
 */
function libelleDans(texte: string, mot: string): string {
  const brut = texte.toLowerCase().split(/[^\p{L}0-9-]+/u).find((x) => {
    const n = normaliser(x);
    return n === mot || n === `${mot}s` || n === `${mot}x`;
  });
  return brut && normaliser(brut) === mot ? brut : (brut?.replace(/[sx]$/, '') ?? mot);
}

/**
 * L'espèce d'une marionnette, lue dans son nom puis dans sa description.
 *
 * La fiche d'une marionnette n'a pas de champ « espèce » : le CDC §4 la range
 * dans la description (« Apparence, espèce »). On lit donc ce que le parent a
 * écrit. Une marionnette qu'on ne reconnaît pas n'est pas pénalisée : elle
 * reçoit une compatibilité moyenne avec tous les rôles, et c'est le modèle,
 * qui lit la description, qui juge.
 */
export function especeMarionnette(m: Pick<Marionnette, 'nom' | 'description'>):
  { mot: string; famille: Famille; libelle: string } | null {
  const jouets = ['poupee', 'pantin', 'robot', 'jouet'];
  // Dans une description, une bête l'emporte sur une personne, et une personne
  // sur une chose : « un lapin offert par papa » est un lapin, et « il a peur
  // du feu » ne fait pas de lui un feu.
  const rang = (f: Famille) => (HUMAINS.includes(f) ? 1 : f === 'objet' ? 2 : 0);
  for (const texte of [m.nom, m.description]) {
    const trouves = mots(texte)
      .map((mot) => ({ mot, famille: FAMILLE_DU_MOT.get(mot) }))
      .filter((t): t is { mot: string; famille: Famille } =>
        t.famille !== undefined && (t.famille !== 'objet' || jouets.includes(t.mot)));
    if (trouves.length === 0) continue;
    const t = trouves.sort((a, b) => rang(a.famille) - rang(b.famille))[0];
    const libelle = libelleDans(texte, t.mot);
    // Une poupée ou un pantin joue un humain.
    return t.famille === 'objet' ? { ...t, famille: 'adulte', libelle } : { ...t, libelle };
  }
  return null;
}

/** La famille d'un rôle : son espèce si on la reconnaît, sinon sa catégorie. */
export function familleRole(r: RoleConte): { mot: string; famille: Famille | null } {
  const trouve = reconnaitre(r.espece);
  if (trouve) return trouve;
  const parCategorie: Record<RoleConte['categorie'], Famille | null> = {
    humain: 'adulte',
    merveilleux: 'feerique',
    objet: 'objet',
    animal: null,
  };
  return { mot: normaliser(r.espece), famille: parCategorie[r.categorie] };
}

const ANIMAUX: Famille[] = ['petit', 'predateur', 'gros', 'oiseau', 'bestiole', 'eau'];
const HUMAINS: Famille[] = ['enfant', 'adulte', 'vieux', 'noble'];

/** Ce qui ne se joue pas : une petite bête douce en prédateur ou en ogre. */
export const INTERDIT = 'interdit' as const;

/**
 * Peut-on faire jouer ce rôle à cette marionnette ? De 0 à 1, ou INTERDIT.
 *
 * La table est volontairement indulgente : au théâtre de salon, une peluche
 * joue ce qu'on lui donne, et un ours en roi fait très bien l'affaire. Elle ne
 * dit non qu'une fois : un lapin peut être un chevreuil, mais pas un loup. Le rôle du prédateur repose sur la menace, et
 * une petite bête douce ne la porte pas ; l'inverse — le loup qui joue
 * l'agneau — est seulement peu probable, et il peut faire rire.
 */
export function compatibiliteEspece(
  marionnette: { mot: string; famille: Famille } | null,
  role: { mot: string; famille: Famille | null },
): number | typeof INTERDIT {
  if (!marionnette || !role.famille) return 0.5;
  if (marionnette.mot === role.mot) return 1;
  const p = marionnette.famille;
  const r = role.famille;
  if (p === r) return 0.8;

  if (p === 'petit' && (r === 'predateur' || r === 'monstre')) return INTERDIT;
  if ((p === 'predateur' || p === 'monstre') && r === 'petit') return 0.2;
  if (r === 'objet' || p === 'objet') return 0.3;

  const paire = (a: Famille[], b: Famille[]) =>
    (a.includes(p) && b.includes(r)) || (a.includes(r) && b.includes(p));

  if (paire(['predateur'], ['monstre'])) return 0.7;
  if (paire(['gros'], ['monstre'])) return 0.6;
  if (paire(['gros'], ['predateur'])) return 0.5;
  if (paire(['petit'], ['oiseau', 'bestiole', 'eau'])) return 0.6;
  if (paire(['oiseau', 'bestiole', 'eau'], ['oiseau', 'bestiole', 'eau'])) return 0.5;
  if (paire(['petit'], ['gros'])) return 0.4;
  if (paire(['noble', 'vieux'], ['adulte'])) return 0.7;
  if (paire(['noble'], ['vieux'])) return 0.6;
  if (paire(['enfant'], ['adulte', 'noble'])) return 0.55;
  if (paire(['enfant'], ['vieux'])) return 0.4;
  if (paire(['feerique'], HUMAINS)) return 0.55;
  if (paire(['monstre'], HUMAINS)) return 0.5;
  if (paire(['feerique'], ['monstre'])) return 0.5;
  // Une peluche animale qui joue un humain, ou l'inverse : c'est courant, et
  // cela se joue très bien — mais un rôle de même nature vaut mieux.
  if (paire(ANIMAUX, HUMAINS)) return 0.35;
  return 0.4;
}

/* ================================================================== */
/* Les traits                                                          */
/* ================================================================== */

/**
 * Traits voisins : ils ne sont pas identiques, mais une marionnette qui porte
 * l'un tient sans effort un rôle qui porte l'autre.
 */
const VOISINS: string[][] = [
  ['ruse', 'farceur', 'coquin', 'menteur'],
  ['gentil', 'genereux'],
  ['sage', 'savant'],
  ['peureux', 'timide'],
  ['courageux', 'fort'],
  ['bavard', 'vantard'],
  ['vantard', 'orgueilleux'],
  ['naif', 'reveur', 'maladroit'],
  ['paresseux', 'reveur'],
  ['grognon', 'tetu'],
  ['avare', 'jaloux'],
  ['mechant', 'jaloux'],
  ['curieux', 'bavard'],
  ['gourmand', 'paresseux'],
];

/** Traits contraires : ils s'excluent, et le rôle jouerait contre la marionnette. */
const CONTRAIRES: [string, string][] = [
  ['gentil', 'mechant'],
  ['peureux', 'courageux'],
  ['timide', 'bavard'],
  ['timide', 'vantard'],
  ['travailleur', 'paresseux'],
  ['genereux', 'avare'],
  ['naif', 'ruse'],
  ['sage', 'farceur'],
  ['sage', 'coquin'],
  ['minuscule', 'fort'],
];

/**
 * Ramène un trait écrit librement à sa forme de la liste : sans accents, au
 * masculin. Le parent peut écrire « coquine », « très gourmande », « Rusée ».
 */
export function racineTrait(trait: string): string {
  const mot = normaliser(trait).split(' ').filter((m) => !['tres', 'un', 'peu', 'trop', 'si'].includes(m)).join(' ');
  const connus = new Set([
    'gentil', 'mechant', 'coquin', 'ruse', 'peureux', 'courageux', 'gourmand', 'grognon',
    'reveur', 'bavard', 'maladroit', 'savant', 'farceur', 'timide', 'vantard', 'naif',
    'paresseux', 'sage', 'avare', 'orgueilleux', 'curieux', 'tetu', 'travailleur',
    'genereux', 'jaloux', 'menteur', 'fort', 'minuscule',
  ]);
  if (connus.has(mot)) return mot;
  const essais = [
    mot.replace(/euse$/, 'eux'),
    mot.replace(/euse$/, 'eur'),
    mot.replace(/ive$/, 'if'),
    mot.replace(/onne$/, 'on'),
    mot.replace(/ine$/, 'in'),
    mot.replace(/lle$/, 'l'),
    mot.replace(/ee$/, 'e'),
    mot.replace(/e$/, ''),
  ];
  // « têtu » s'écrit sans accent ici ; la table des voisins le connaît sous
  // cette forme.
  return essais.find((e) => connus.has(e)) ?? mot;
}

function voisins(a: string, b: string): boolean {
  return VOISINS.some((g) => g.includes(a) && g.includes(b));
}

function contraires(a: string, b: string): boolean {
  return CONTRAIRES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * Ressemblance entre les traits d'une marionnette et ceux d'un rôle, de -1 à 1.
 *
 * Chaque trait de la marionnette compte : retrouvé dans le rôle, il vaut 1 ;
 * voisin d'un trait du rôle, 0,5 ; contraire, -1. La somme est rapportée à la
 * moyenne des deux longueurs, pour qu'une marionnette à six traits ne gagne
 * pas tout par le nombre.
 */
export function ressemblanceTraits(marionnette: string[], role: string[]): {
  score: number;
  communs: string[];
} {
  const p = [...new Set(marionnette.map(racineTrait))];
  const r = [...new Set(role.map(racineTrait))];
  if (p.length === 0 || r.length === 0) return { score: 0, communs: [] };

  let somme = 0;
  const communs: string[] = [];
  for (const t of p) {
    if (r.includes(t)) {
      somme += 1;
      communs.push(t);
    } else if (r.some((x) => voisins(t, x))) {
      somme += 0.5;
    } else if (r.some((x) => contraires(t, x))) {
      somme -= 1;
    }
  }
  return { score: somme / ((p.length + r.length) / 2), communs };
}

/* ================================================================== */
/* La distribution : qui joue quoi                                     */
/* ================================================================== */

export interface Attribution {
  marionnetteId: string;
  marionnetteNom: string;
  role: RoleConte;
  traits: number;
  espece: number;
  /** Les traits que la marionnette et le rôle ont en commun. */
  communs: string[];
}

/** Les notes d'un conte, chacune de 0 à 1, et leur moyenne pondérée. */
export interface Notes {
  nombre: number;
  traits: number;
  duree: number;
  /** 0 quand le parent n'a pas écrit d'ébauche : elle ne compte alors pas. */
  ebauche: number;
  espece: number;
  total: number;
}

export interface Candidat {
  conte: Conte;
  notes: Notes;
  /** Longueur du texte intégral du conte, en mots. */
  mots: number;
  distribution: Attribution[];
  /** Les rôles du conte qu'aucune marionnette ne tient. */
  sansMarionnette: RoleConte[];
}

/**
 * La barrière du nombre : un conte n'est jouable que
 * s'il n'a PAS PLUS de rôles principaux que de marionnettes invitées au studio,
 * et que les marionnettes en trop trouvent chacune un petit rôle.
 *
 * Renvoie la note de nombre, ou null si le conte est hors jeu :
 *   - 1 : autant de marionnettes que de rôles principaux ;
 *   - 0,7 : les marionnettes en trop prennent des figurants ;
 *   - 0,55 : une seule marionnette pour un conte à deux rôles, le second
 *     joué à la voix depuis la coulisse (seule exception à la barrière).
 * Un conte qui a plus de rôles principaux que de mains est jouable en relais,
 * mais un peu moins bien : sa note est réduite.
 */
export function noteNombre(
  n: number,
  c: Pick<Conte, 'personnages' | 'figurants'>,
  mains = 4,
): number | null {
  let note: number;
  if (n === c.personnages) note = 1;
  else if (n > c.personnages && n <= c.personnages + c.figurants) note = 0.7;
  // Une seule marionnette : un conte à deux rôles
  // reste jouable, le second se faisant entendre depuis la coulisse — c'est
  // le parent qui lui prête sa voix. Un conte vraiment seul passe devant.
  else if (n === 1 && c.personnages === 2) note = 0.55;
  else return null;
  return c.personnages > mains ? note * 0.85 : note;
}

/**
 * La note de durée : le conte a-t-il à peu près la longueur du spectacle ?
 *
 * On compare le nombre de mots du conte à celui que le spectacle dira. Entre
 * 0,7 et 3 fois, c'est parfait : on joue ce que le conte raconte, ou l'on coupe
 * un épisode. En dessous, il faudrait étirer, et un conte de soixante mots
 * étiré sur cinq minutes pousse à inventer : la note tombe vite. Au-dessus, il
 * faut couper, ce qui se fait mieux, et la note baisse doucement.
 */
export function noteDuree(motsConte: number, motsSpectacle: number): number {
  const r = motsConte / Math.max(1, motsSpectacle);
  if (r >= 0.7 && r <= 3) return 1;
  if (r < 0.7) return Math.pow(r / 0.7, 1.5);
  return 1 / (1 + Math.log(r / 3));
}


/**
 * La meilleure distribution possible : chaque marionnette reçoit un rôle
 * différent, et la somme des ressemblances est la plus haute possible.
 *
 * Tous les rôles principaux doivent être tenus quand il y a assez de
 * marionnettes ; s'il en manque une (écart 2), elles ne tiennent que des rôles
 * principaux. Une attribution INTERDITE par l'espèce n'est jamais faite ; si
 * aucune distribution n'est possible sans elle, le conte est écarté.
 *
 * On énumère avec mémoire (marionnette, rôles déjà pris) : au plus six
 * marionnettes et une douzaine de rôles, soit quelques dizaines de milliers
 * d'états — instantané.
 */
export function meilleureDistribution(
  marionnettes: Pick<Marionnette, 'id' | 'nom' | 'description' | 'traits'>[],
  conte: Conte,
): Attribution[] | null {
  const n = marionnettes.length;
  const principaux = conte.roles.filter((r) => !r.figurant);
  const roles = n >= principaux.length ? conte.roles : principaux;
  const exiges = n >= principaux.length
    ? roles.reduce((m, r, i) => (r.figurant ? m : m | (1 << i)), 0)
    : 0;

  const especes = marionnettes.map(especeMarionnette);
  const famillesRoles = roles.map(familleRole);

  // Valeur de chaque paire, calculée une fois.
  const paires = marionnettes.map((m, i) =>
    roles.map((r, j) => {
      const e = compatibiliteEspece(especes[i], famillesRoles[j]);
      if (e === INTERDIT) return null;
      const t = ressemblanceTraits(m.traits, r.traits);
      return { traits: t.score, espece: e, communs: t.communs, total: t.score + CHOIX.poidsEspece * e };
    }),
  );

  const memo = new Map<string, { valeur: number; choix: number[] } | null>();
  const chercher = (i: number, pris: number): { valeur: number; choix: number[] } | null => {
    if (i === n) return (pris & exiges) === exiges ? { valeur: 0, choix: [] } : null;
    const cle = `${i}:${pris}`;
    if (memo.has(cle)) return memo.get(cle)!;
    let meilleur: { valeur: number; choix: number[] } | null = null;
    for (let j = 0; j < roles.length; j++) {
      if (pris & (1 << j)) continue;
      const p = paires[i][j];
      if (!p) continue;
      const suite = chercher(i + 1, pris | (1 << j));
      if (!suite) continue;
      const valeur = p.total + suite.valeur;
      if (!meilleur || valeur > meilleur.valeur) meilleur = { valeur, choix: [j, ...suite.choix] };
    }
    memo.set(cle, meilleur);
    return meilleur;
  };

  const r = chercher(0, 0);
  if (!r) return null;
  return r.choix.map((j, i) => {
    const p = paires[i][j]!;
    return {
      marionnetteId: marionnettes[i].id,
      marionnetteNom: marionnettes[i].nom,
      role: roles[j],
      traits: p.traits,
      espece: p.espece,
      communs: p.communs,
    };
  });
}

/* ================================================================== */
/* L'espèce dans le texte                                              */
/* ================================================================== */

/**
 * Ce que devient, dans le texte, le personnage que joue une marionnette : on
 * ne peut pas avoir « Petit Dragon le renard ».
 *
 * - Une marionnette animale (ou une créature : dragon, licorne) qui joue un
 *   animal du conte lui impose son espèce : le Crocodile joué par un renard
 *   devient un renard, et seuls les détails qui l'exigent changent.
 * - Une marionnette animale qui joue un humain garde son espèce et prend le
 *   métier : le lapin meunier.
 * - Une marionnette qu'on ne reconnaît pas, ou qui est une personne, joue le
 *   rôle tel quel.
 *
 * Renvoie la consigne à donner au modèle, ou null s'il n'y a rien à changer.
 */
export function especeDansLeTexte(
  m: Pick<Marionnette, 'nom' | 'description'>,
  role: Pick<RoleConte, 'nom' | 'espece' | 'categorie'> | null,
): string | null {
  const p = especeMarionnette(m);
  if (!p || HUMAINS.includes(p.famille)) return null;
  if (!role) {
    return `${m.nom} est un·e ${p.libelle} : si son personnage est un animal dans le conte, `
      + `il devient un·e ${p.libelle} dans tout le texte.`;
  }
  const r = familleRole(role as RoleConte);
  if (r.mot === p.mot) return null;
  if (role.categorie === 'humain' || (r.famille && HUMAINS.includes(r.famille))) {
    return `${m.nom} joue ${role.nom} et reste un·e ${p.libelle} : c'est un·e ${p.libelle} `
      + `qui fait le métier de ${role.espece}.`;
  }
  return `${m.nom} joue ${role.nom} : dans tout le texte, ce personnage est un·e ${p.libelle}, `
    + `pas un·e ${role.espece}. On l'appelle ainsi, et seuls les détails qui l'exigent changent.`;
}

/** Retrouve, dans un conte, le rôle dont le modèle a écrit le nom. */
export function roleParNom(conte: Conte, nom: string): RoleConte | null {
  const n = normaliser(nom);
  return conte.roles.find((r) => normaliser(r.nom) === n)
    ?? conte.roles.find((r) => normaliser(r.nom).includes(n) || n.includes(normaliser(r.nom)))
    ?? null;
}

/* ================================================================== */
/* Le score                                                            */
/* ================================================================== */

export interface OptionsChoix {
  ageAuditoire: number;
  dureeMinutes: number;
  nbMarionnettistes: 1 | 2;
  /** Contes déjà proposés au parent, à ne pas reproposer. */
  exclus?: string[];
  ebauche?: string;
  /**
   * Facteur par conte, entre 0 et 1, qui multiplie sa note : les contes déjà
   * joués ou déjà montrés sur cet appareil cèdent la place (historiqueContes).
   */
  malus?: Record<string, number>;
  /** Pour les tests : un autre répertoire que le vrai. */
  contes?: Conte[];
}

export interface ResultatChoix {
  /** Les contes montrés au modèle, du meilleur au moins bon. */
  candidats: Candidat[];
  /** Combien de contes passaient les barrières. */
  jouables: number;
}

/** L'origine d'un conte, lue dans le préfixe de son identifiant. */
export function origine(id: string): string {
  return id.split('-')[0];
}

/**
 * Ressemblance entre l'ébauche du parent et un conte, de 0 à 1.
 *
 * Chaque mot qui compte dans l'ébauche est cherché d'abord dans la fiche
 * (titre, rôles, lieux, essence, trame), où il pèse 1, puis dans les
 * mots-clés tirés du texte intégral, où il pèse 0,7. C'est volontairement
 * simple : l'ébauche fait remonter des contes, et c'est le modèle, qui lit la
 * fiche entière et l'ébauche, qui juge ensuite de la ressemblance réelle.
 */
export function noteEbauche(ebauche: string, conte: Conte, cles: string[]): number {
  const demandes = [...new Set(motsSignifiants(ebauche))];
  if (demandes.length === 0) return 0;
  const fiche = new Set(motsSignifiants([
    conte.titre, conte.lieux, conte.ressorts, conte.corps,
    ...conte.roles.map((r) => `${r.nom} ${r.espece}`),
  ].join(' ')));
  const texte = new Set(cles);
  const trouve = demandes.reduce((s, m) => s + (fiche.has(m) ? 1 : texte.has(m) ? 0.7 : 0), 0);
  return Math.min(1, trouve / Math.max(2, demandes.length));
}

/**
 * Choisit les contes à montrer au modèle.
 *
 * Deux barrières, qu'aucune note ne rachète : l'âge du public, et le nombre
 * (pas plus de rôles principaux que de marionnettes). Puis une note
 * pondérée, dans l'ordre d'importance : le nombre, les traits, l'ébauche, la
 * durée, l'espèce.
 */
export function choisirContes(
  marionnettes: Pick<Marionnette, 'id' | 'nom' | 'description' | 'traits'>[],
  o: OptionsChoix,
): ResultatChoix {
  const n = marionnettes.length;
  const mains = o.nbMarionnettistes * 2;
  const exclus = new Set(o.exclus ?? []);
  const repertoire = (o.contes ?? CONTES).filter((c) => !exclus.has(c.id));
  const motsSpectacle = budgetMots(o.dureeMinutes * 60);
  const avecEbauche = Boolean(o.ebauche?.trim());

  // L'âge est un garde-fou : une pièce pour les 7-10 ans n'a rien à faire
  // devant des enfants de trois ans. On relâche la marge s'il ne reste presque
  // rien.
  const pourAge = (marge: number) => repertoire.filter(
    (c) => o.ageAuditoire >= c.ageMin - marge && o.ageAuditoire <= c.ageMax + marge,
  );
  let possibles = pourAge(CHOIX.margeAge);
  if (possibles.length < CHOIX.presentes * 2) possibles = pourAge(CHOIX.margeAge + 2);

  const P = CHOIX.poids;
  const somme = P.nombre + P.traits + P.duree + P.espece + (avecEbauche ? P.ebauche : 0);

  const evalues: Candidat[] = [];
  for (const conte of possibles) {
    const nombre = noteNombre(n, conte, mains);
    if (nombre === null) continue;
    const distribution = meilleureDistribution(marionnettes, conte);
    if (!distribution) continue;

    const moyenne = (f: (a: Attribution) => number) =>
      distribution.reduce((s, a) => s + f(a), 0) / Math.max(1, distribution.length);
    const infos = INDEX[conte.id] ?? { mots: 0, cles: [] };
    const notes = {
      nombre,
      // Les traits vont de -1 à 1 : on les ramène entre 0 et 1.
      traits: (moyenne((a) => a.traits) + 1) / 2,
      duree: infos.mots ? noteDuree(infos.mots, motsSpectacle) : 0.5,
      ebauche: avecEbauche ? noteEbauche(o.ebauche!, conte, infos.cles) : 0,
      espece: moyenne((a) => a.espece),
    };
    const total = (P.nombre * notes.nombre + P.traits * notes.traits + P.duree * notes.duree
      + P.espece * notes.espece + (avecEbauche ? P.ebauche * notes.ebauche : 0)) / somme
      * (o.malus?.[conte.id] ?? 1);

    const tenus = new Set(distribution.map((a) => a.role));
    evalues.push({
      conte,
      notes: { ...notes, total },
      mots: infos.mots,
      distribution,
      sansMarionnette: conte.roles.filter((r) => !tenus.has(r)),
    });
  }

  evalues.sort((a, b) => b.notes.total - a.notes.total || a.conte.id.localeCompare(b.conte.id));

  // Pas plus de trois contes d'une même origine : douze pièces de Guignol à
  // quatre personnages ne doivent pas occuper toute la sélection.
  const parOrigine = new Map<string, number>();
  const candidats: Candidat[] = [];
  for (const c of evalues) {
    const o2 = origine(c.conte.id);
    if ((parOrigine.get(o2) ?? 0) >= CHOIX.parOrigine) continue;
    parOrigine.set(o2, (parOrigine.get(o2) ?? 0) + 1);
    candidats.push(c);
    if (candidats.length === CHOIX.presentes) break;
  }

  return { candidats, jouables: evalues.length };
}
