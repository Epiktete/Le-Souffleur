// Le choix des contes : trouver, dans la contothèque, ceux qui vont aux
// marionnettes choisies.
//
// D'abord trois BARRIÈRES, qu'aucune note ne rachète :
//   - l'âge du public ;
//   - la durée : un conte qu'il faudrait étirer plus de quatre fois pour tenir
//     le spectacle demandé n'est plus adapté, il est inventé ;
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
//   5. LE CASTELET : ce que le conte vaut sur une table, avec des peluches au
//      bout des mains. Une pièce de Guignol est écrite pour ça ; un mythe des
//      origines ne l'est pas.
//   6. L'ESPÈCE, sans être trop regardant : un lapin peut jouer un chevreuil,
//      un ours un lion. Elle interdit dans un seul cas : une petite bête douce
//      ne joue pas un prédateur ni un ogre. Un lapin n'est pas un loup.
//
// Le tout est fait par l'application : il ne coûte rien, il est toujours le
// même pour les mêmes marionnettes, et il se teste. Le modèle ne reçoit que
// les huit meilleurs, en retient trois et les raconte au parent.

import INDEX_BRUT from '../../wiki/index.json?raw';
import { BORNES } from '../config';
import { budgetMots } from './duree';
import { motsSignifiants } from './mots';
import { CONTES, type Conte, type RoleConte } from './repertoire';
import type { Marionnette } from '../types';

/**
 * Longueur et mots-clés de chaque conte, tirés de son texte intégral par
 * tools/indexer-contes.mjs.
 */
const INDEX = JSON.parse(INDEX_BRUT) as Record<string, { mots: number; cles: string[] }>;

/** Six marionnettes au plus dans un spectacle (CDC §4). */
const MAX_EN_SCENE = BORNES.marionnettesParSpectacle.max;

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
  poids: { nombre: 3, traits: 0.25, ebauche: 2.5, duree: 2, espece: 1, castelet: 1 },
  /**
   * Poids quand le parent n'a posé aucune marionnette sur la scène et laisse
   * l'outil puiser dans la Marionnethèque.
   *
   * Le nombre ne vaut plus rien : on prend exactement autant de marionnettes
   * qu'il y a de rôles, donc tous les contes sont à égalité. Ce qui décide,
   * c'est LA DEMANDE ÉCRITE du parent quand il y en a une (poids 4), et sinon
   * CE QUE LE CONTE VAUT AU CASTELET (poids 3) — Guignol et Perrault d'abord,
   * ce pour quoi le castelet a été inventé.
   */
  poidsVivier: { nombre: 0, traits: 0.25, ebauche: 4, duree: 2, espece: 1, castelet: 3 },
  /** Poids de l'espèce face aux traits, dans le choix des rôles. */
  poidsEspece: 0.3,
  /** Tolérance d'âge : un conte « 5-10 ans » reste possible à 4 ans. */
  margeAge: 1,
  /**
   * Barrière de durée : part minimale du spectacle que le conte doit déjà
   * raconter. À 0,25, un conte qu'il faudrait étirer plus de quatre fois est
   * écarté — au-delà on n'adapte plus, on invente.
   *
   * Elle dépend de la durée demandée, et c'est tout l'intérêt : « Le Corbeau
   * et le Renard », 138 mots, est parfait pour trois minutes et impossible
   * pour vingt. Le même conte n'est pas trop court dans l'absolu, il l'est
   * pour CE spectacle.
   */
  plancherDuree: 0.25,
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
  const reconnus = (texte: string) => mots(texte)
    .map((mot) => ({ mot, famille: FAMILLE_DU_MOT.get(mot) }))
    .filter((t): t is { mot: string; famille: Famille } =>
      t.famille !== undefined && (t.famille !== 'objet' || jouets.includes(t.mot)));

  // Le nom l'emporte sur la description, SAUF quand la description précise le
  // même mot : « Petit Chat », décrit « un chaton roux tout doux », est un
  // chaton — une petite bête douce — et non un chat, qui est un prédateur.
  // Sans cela, le relais a vu ce chaton distribué trois fois dans un rôle de
  // renard.
  const duNom = reconnus(m.nom);
  const deLaDescription = reconnus(m.description);
  const precise = duNom.length > 0 && deLaDescription.find(
    (d) => duNom.some((n) => d.mot !== n.mot && d.mot.startsWith(n.mot)),
  );

  for (const trouves of precise ? [[precise]] : [duNom, deLaDescription]) {
    if (trouves.length === 0) continue;
    const texte = trouves === duNom ? m.nom : m.description;
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
/** Familles trop douces pour tenir un rôle de prédateur ou d'ogre. */
const DOUCES: Famille[] = ['petit', 'eau', 'bestiole'];

export function compatibiliteEspece(
  marionnette: { mot: string; famille: Famille } | null,
  role: { mot: string; famille: Famille | null },
): number | typeof INTERDIT {
  if (!marionnette || !role.famille) return 0.5;
  if (marionnette.mot === role.mot) return 1;
  const p = marionnette.famille;
  const r = role.famille;
  if (p === r) return 0.8;

  // Une petite bête douce ne joue ni un prédateur ni un ogre. « petit » ne
  // suffisait pas : une tortue est rangée dans « eau », une fourmi dans
  // « bestiole », et le relais a vu l'application distribuer Mémé Tortue dans
  // le rôle du Loup du Petit Chaperon rouge. Les oiseaux restent permis : la
  // famille contient l'aigle, le faucon et le hibou, qui sont des prédateurs.
  if (DOUCES.includes(p) && (r === 'predateur' || r === 'monstre')) return INTERDIT;
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
  /** Ce que le conte vaut au castelet, indépendamment des marionnettes. */
  castelet: number;
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
 * 0,8 et 1,8 fois, c'est parfait : on joue ce que le conte raconte, ou l'on
 * coupe un épisode. En dessous, il faudrait étirer, et un conte de soixante
 * mots étiré sur cinq minutes pousse à inventer : la note tombe vite.
 * Au-dessus, il faut couper, et la note baisse doucement.
 *
 * La bande haute allait jusqu'à 3. Mesuré au relais : un conte de 816 mots
 * pour un spectacle de 500 était noté parfait, puis joué fidèlement — et le
 * spectacle durait sept minutes au lieu de cinq. Depuis que la fidélité au
 * texte passe avant la longueur, il ne suffit plus d'espérer que le découpage
 * coupera : il faut CHOISIR des contes qui n'ont pas besoin d'être coupés.
 */
export function noteDuree(motsConte: number, motsSpectacle: number): number {
  const r = motsConte / Math.max(1, motsSpectacle);
  if (r >= 0.8 && r <= 1.8) return 1;
  if (r < 0.8) return Math.pow(r / 0.8, 1.5);
  return 1 / (1 + Math.log(r / 1.8));
}


/**
 * Ce que le conte vaut AU CASTELET, de 0 à 1.
 *
 * Tous les contes ne se jouent pas également bien sur une table avec des
 * peluches au bout des mains. Une pièce de Guignol est écrite pour ça ; un
 * mythe des origines, où un héros solitaire traverse le monde et se change en
 * montagne, ne l'est pas — même bien raconté, il ne donne rien à jouer.
 *
 * Tout se lit dans la fiche, déjà écrite à la main :
 *
 *   - LE GENRE mène. Le vocabulaire est fermé (dix valeurs, vérifiées par
 *     tools/verifier-fiches.mjs), ce qui en fait un signal fiable.
 *   - LA RÉPÉTITION est le moteur du castelet : trois tentatives, une
 *     randonnée, deux visites en miroir. L'enfant anticipe, et c'est là qu'il
 *     rit.
 *   - LES LIEUX ne comptent qu'au-delà de trois : l'application sait faire
 *     plusieurs tableaux, mais quatre décors à préparer pèsent sur le parent.
 *   - LE NOMBRE : deux à quatre personnages qui se répondent. Un personnage
 *     seul n'a personne à qui parler ; au-delà de quatre, ça se bouscule.
 *
 * Une note calculée plutôt qu'un champ de plus à tenir dans 163 fiches :
 * elle se relit ici en entier, et se corrige en changeant un chiffre.
 */
const CASTELET_GENRE: Record<string, number> = {
  'pièce de marionnettes': 1,
  'conte facétieux': 0.85,
  'conte en randonnée': 0.85,
  'conte en chaîne': 0.85,
  'conte merveilleux': 0.75,
  "conte d'animaux": 0.75,
  fable: 0.5,
  légende: 0.3,
  'conte des origines': 0.3,
  'conte philosophique': 0.3,
};

/** Structures qui reposent sur la répétition, celle qui fait rire au castelet. */
const STRUCTURE_REPETEE = /trois|deux |double|randonn|chaîne|accumulation|miroir|répét|successi|série|cumulat/i;

export function noteCastelet(
  c: Pick<Conte, 'genre' | 'lieux' | 'structure' | 'personnages'>,
): number {
  let note = CASTELET_GENRE[c.genre] ?? 0.5;
  if (STRUCTURE_REPETEE.test(c.structure)) note += 0.1;
  if (c.lieux.split(',').filter((l) => l.trim()).length >= 4) note -= 0.15;
  note += c.personnages >= 2 && c.personnages <= 4 ? 0.1 : -0.15;
  return Math.max(0, Math.min(1, note));
}

/**
 * Ce que le conte pèse VRAIMENT, une fois les rôles sans marionnette retirés.
 *
 * Le nombre de mots d'un conte compte tout ce qu'il raconte. Mais un rôle
 * qu'aucune marionnette ne tient est supprimé, fondu ou relégué en coulisse :
 * son texte ne se dit pas. « L'Hiver des bêtes » fait 909 mots pour un
 * spectacle de 1 000 — le ratio idéal — mais quatre de ses huit rôles n'ont
 * pas de peluche. Mesuré au relais : le spectacle a duré quatre minutes au
 * lieu de dix.
 *
 * On ne retire pas leur part entière : la narration et les rôles principaux
 * portent plus que leur poids, et un figurant supprimé se fond souvent dans un
 * autre plutôt que de disparaître. La moitié est une approximation honnête.
 */
export function motsJouables(
  mots: number,
  conte: Pick<Conte, 'roles'>,
  distribution: Attribution[],
): number {
  const total = conte.roles.length;
  if (total === 0) return mots;
  const tenus = new Set(distribution.map((a) => a.role));
  const perdus = conte.roles.filter((r) => !tenus.has(r)).length;
  return Math.round(mots * (1 - 0.5 * (perdus / total)));
}

/**
 * LES SOSIES, quand l'histoire repose sur eux.
 *
 * « Le Lièvre et le Hérisson » tient tout entier dans une ruse : la femme du
 * hérisson lui ressemble trait pour trait, et le lièvre s'y trompe. Le conte
 * donne donc la MÊME espèce aux deux rôles. Distribuer une tortue et un
 * pingouin ne casse aucune règle de scène, mais supprime la ruse — le lièvre
 * n'a plus aucune raison de se tromper.
 *
 * Quand deux rôles ou plus partagent une espèce dans la fiche, on regarde si
 * les marionnettes qui les tiennent la partagent aussi. Sinon la note
 * d'espèce baisse : le conte n'est pas interdit — le parent peut très bien
 * vouloir le jouer —, il recule simplement derrière un conte qui n'a pas ce
 * problème.
 */
export function sosiesRompus(distribution: Attribution[]): Attribution[][] {
  const parEspece = new Map<string, Attribution[]>();
  for (const a of distribution) {
    const cle = normaliser(a.role.espece);
    parEspece.set(cle, [...(parEspece.get(cle) ?? []), a]);
  }
  const rompus: Attribution[][] = [];
  for (const groupe of parEspece.values()) {
    if (groupe.length < 2) continue;
    const familles = new Set(groupe.map((a) => familleRole(a.role).famille));
    // Les marionnettes de ce groupe partagent-elles une famille ?
    const tenues = new Set(groupe.map((a) => a.espece >= 0.8));
    if (familles.size === 1 && !tenues.has(false)) continue;
    rompus.push(groupe);
  }
  return rompus;
}

/**
 * Le facteur appliqué à la NOTE TOTALE d'un conte dont les sosies sont
 * rompus. Il ne portait d'abord que sur la note d'espèce, qui pèse un
 * dixième du total : au banc, « Le Mariage de la souris » — où tout repose
 * sur ce que le père et sa fille sont des souris — est arrivé premier avec un
 * pingouin pour père, et le modèle a dû inventer « je suis leur papa depuis
 * toujours ». Deux rôles PRINCIPAUX rompus pèsent plus lourd que des figurants.
 *
 * Le facteur reste modéré (0,85) : deux rôles de même espèce ne sont pas
 * toujours des sosies — M. et Mme Crocodile se jouent très bien avec un
 * renard et une ourse. Il suffit à faire reculer le conte hors des huit
 * présentés quand d'autres vont aussi bien ; s'il est présenté malgré tout, la
 * fiche montrée au modèle le signale, et c'est lui qui juge en lisant le conte.
 */
export function facteurJumelles(distribution: Attribution[]): number {
  return sosiesRompus(distribution).reduce(
    (f, groupe) => f * (groupe.filter((a) => !a.role.figurant).length >= 2 ? 0.85 : 0.95),
    1,
  );
}

/**
 * La TAILLE, quand elle fait l'histoire.
 *
 * « Le Renard, le Lièvre et le Coq » tient tout entier dans une idée : les
 * chiens reculent, l'ours recule, le taureau recule — et c'est le petit coq
 * qui fait fuir la renarde. Distribuer une grosse ourse dans le rôle du coq
 * ne casse aucune règle de scène, mais supprime la blague : un gros animal
 * triomphe là où d'autres gros animaux ont fui.
 *
 * Les fiches portent déjà l'information, dans les traits du rôle :
 * `minuscule` sur quarante-deux rôles du répertoire, `fort` sur d'autres. On
 * s'en sert comme d'un interdit d'espèce, symétrique de celui qui existe
 * déjà : un lapin n'est pas un loup, une ourse n'est pas un moineau.
 *
 * Seul le cas franc est interdit : une grosse bête ou un monstre dans un rôle
 * dit minuscule. Une petite marionnette dans un rôle « fort » reste permise —
 * le petit qui se montre fort est un ressort de conte, pas une erreur.
 */
export function tailleIncompatible(
  marionnette: { famille: Famille } | null,
  role: Pick<RoleConte, 'traits'>,
): boolean {
  if (!marionnette) return false;
  const grosse = marionnette.famille === 'gros' || marionnette.famille === 'monstre';
  return grosse && role.traits.some((t) => racineTrait(t) === 'minuscule');
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
  o: {
    /**
     * Vrai quand on puise dans la Marionnethèque entière au lieu d'une scène
     * déjà garnie : toutes les marionnettes ne jouent pas, on retient les
     * meilleures et on laisse les autres au placard. Tous les rôles
     * principaux, eux, doivent être tenus.
     */
    facultatives?: boolean;
  } = {},
): Attribution[] | null {
  const n = marionnettes.length;
  const principaux = conte.roles.filter((r) => !r.figurant);
  const roles = o.facultatives
    ? principaux
    : n >= principaux.length ? conte.roles : principaux;
  const exiges = o.facultatives
    ? roles.reduce((m, _r, i) => m | (1 << i), 0)
    : n >= principaux.length
      ? roles.reduce((m, r, i) => (r.figurant ? m : m | (1 << i)), 0)
      : 0;

  const especes = marionnettes.map(especeMarionnette);
  const famillesRoles = roles.map(familleRole);

  // Valeur de chaque paire, calculée une fois.
  const paires = marionnettes.map((m, i) =>
    roles.map((r, j) => {
      const e = compatibiliteEspece(especes[i], famillesRoles[j]);
      if (e === INTERDIT) return null;
      if (tailleIncompatible(especes[i], r)) return null;
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
    // Laisser cette marionnette au placard : seulement quand on puise dans la
    // Marionnethèque, où elles sont plus nombreuses que les rôles.
    if (o.facultatives) {
      const suite = chercher(i + 1, pris);
      if (suite) meilleur = { valeur: suite.valeur, choix: [-1, ...suite.choix] };
    }
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
  return r.choix.flatMap((j, i) => {
    if (j < 0) return []; // restée au placard
    const p = paires[i][j]!;
    return [{
      marionnetteId: marionnettes[i].id,
      marionnetteNom: marionnettes[i].nom,
      role: roles[j],
      traits: p.traits,
      espece: p.espece,
      communs: p.communs,
    }];
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
  /**
   * Forme brève, pour les huit contes candidats : la règle y est déjà dite
   * une fois en tête, et la répéter vingt fois coûtait près d'un millier de
   * jetons par génération sans rien apprendre au modèle.
   */
  bref = false,
): string | null {
  const p = especeMarionnette(m);
  if (!p || HUMAINS.includes(p.famille)) return null;
  if (!role) {
    return `${m.nom} est un·e ${p.libelle} : si son personnage est un animal dans le conte, `
      + `il devient un·e ${p.libelle} dans tout le texte.`;
  }
  const r = familleRole(role as RoleConte);
  if (r.mot === p.mot) return null;
  const metier = role.categorie === 'humain' || (r.famille && HUMAINS.includes(r.famille));
  if (bref) {
    return metier
      ? `reste un·e ${p.libelle} qui fait le métier de ${role.espece}`
      : `${role.espece} → ${p.libelle}`;
  }
  if (metier) {
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
  /**
   * La Marionnethèque entière, quand la scène est vide : l'outil choisit
   * lui-même qui joue. Le conte est alors choisi d'abord, la distribution
   * ensuite — et elle diffère d'un candidat à l'autre.
   */
  vivier?: Pick<Marionnette, 'id' | 'nom' | 'description' | 'traits'>[];
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
  // Mode automatique : la scène est vide, on puise dans la Marionnethèque.
  const vivier = o.vivier;
  const troupe = vivier ?? marionnettes;
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

  const P = vivier ? CHOIX.poidsVivier : CHOIX.poids;
  const somme = P.nombre + P.traits + P.duree + P.espece + P.castelet
    + (avecEbauche ? P.ebauche : 0);

  const evaluer = (plancher: number) => {
    const evalues: Candidat[] = [];
    for (const conte of possibles) {
      // La barrière de durée : un conte qu'il faudrait étirer plus de quatre
      // fois n'est plus adapté, il est inventé. Un conte dont on ignore la
      // longueur passe : on ne l'écarte pas sur une donnée manquante.
      const mots = INDEX[conte.id]?.mots ?? 0;
      if (mots && mots < motsSpectacle * plancher) continue;
      // Le nombre. Sur une scène garnie, c'est une barrière : le conte doit
      // aller aux marionnettes présentes. Avec le vivier, c'est l'inverse —
      // on prend exactement autant de marionnettes qu'il y a de rôles —, et
      // la seule limite est ce que la Marionnethèque peut fournir.
      const nombre = vivier
        ? (conte.personnages <= Math.min(vivier.length, MAX_EN_SCENE) ? 1 : null)
        : noteNombre(n, conte, mains);
      if (nombre === null) continue;
      const distribution = meilleureDistribution(troupe, conte, { facultatives: Boolean(vivier) });
      if (!distribution) continue;

      const moyenne = (f: (a: Attribution) => number) =>
        distribution.reduce((s, a) => s + f(a), 0) / Math.max(1, distribution.length);
      const infos = INDEX[conte.id] ?? { mots: 0, cles: [] };
      const notes = {
        nombre,
        // Les traits vont de -1 à 1 : on les ramène entre 0 et 1.
        traits: (moyenne((a) => a.traits) + 1) / 2,
        duree: infos.mots ? noteDuree(motsJouables(infos.mots, conte, distribution), motsSpectacle) : 0.5,
        ebauche: avecEbauche ? noteEbauche(o.ebauche!, conte, infos.cles) : 0,
        espece: moyenne((a) => a.espece),
        castelet: noteCastelet(conte),
      };
      const total = (P.nombre * notes.nombre + P.traits * notes.traits + P.duree * notes.duree
        + P.espece * notes.espece + P.castelet * notes.castelet
        + (avecEbauche ? P.ebauche * notes.ebauche : 0)) / somme
        * (o.malus?.[conte.id] ?? 1)
        * facteurJumelles(distribution);

      const tenus = new Set(distribution.map((a) => a.role));
      evalues.push({
        conte,
        notes: { ...notes, total },
        mots: infos.mots,
        distribution,
        sansMarionnette: conte.roles.filter((r) => !tenus.has(r)),
      });
    }

    return evalues;
  };

  // On relâche le plancher plutôt que de rendre une liste vide : mieux vaut
  // proposer un conte qu'il faudra étirer que n'en proposer aucun.
  let evalues = evaluer(CHOIX.plancherDuree);
  if (evalues.length < CHOIX.presentes) evalues = evaluer(CHOIX.plancherDuree / 2);
  if (evalues.length < 3) evalues = evaluer(0);

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
