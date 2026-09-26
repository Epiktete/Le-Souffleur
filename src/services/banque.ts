// LA BANQUE DE SPECTACLES : des modèles, pas des exemplaires.
//
// Écrire un spectacle coûte une dizaine d'appels au fournisseur d'IA. Or deux
// familles qui demandent « un conte de loup, cinq minutes, six ans, trois
// peluches » recevront deux fois le même travail, payé deux fois. La banque est
// un fonds de spectacles DÉJÀ ÉCRITS, rangés sans les noms des marionnettes :
// on y puise, on remplace les noms par ceux de la famille, et c'est joué.
//
// LE REMPLACEMENT SE FAIT PAR DU CODE, JAMAIS PAR L'IA. Mesuré sur les cinq
// spectacles du relais : le nom complet d'une marionnette apparaît de 11 à 51
// fois dans un script, et le mot d'espèce — « lapin », « corbeau » — n'apparaît
// JAMAIS en dehors de ce nom, pas plus que le vocabulaire du corps (oreille,
// terrier, patte). Les prompts font que les personnages sont appelés par leur
// nom, partout, et les contraintes matérielles ont chassé le jeu corporel.
// Remplacer les noms suffit donc, et c'est ce qui rend ce fichier possible.
//
// Deux fonctions, exactement inverses l'une de l'autre :
//   variabiliser(spectacle)          → un modèle, où chaque nom devient {{r1}}
//   peupler(modele, marionnettes)    → un spectacle jouable, noms rétablis
//
// Leur aller-retour est vérifié par les tests sur de vrais spectacles.

import INDEX_BRUT from '../../banque/index.json?raw';
import { especeMarionnette, type Famille } from './choixContes';
import { construireDossier } from './dossier';
import { nouvelId } from './db';
import type {
  Acte,
  Bible,
  ElementScript,
  Marionnette,
  MarionnetteDistribuee,
  ParametresGeneration,
  Spectacle,
  Tableau,
} from '../types';

/* ================================================================== */
/* Ce que la banque conserve                                           */
/* ================================================================== */

/**
 * Un rôle du spectacle, tel que le fonds le garde : ce qu'il faut savoir pour
 * décider, plus tard, si telle peluche peut le reprendre.
 */
export interface RoleModele {
  /** « r1 », « r2 »… dans l'ordre de la distribution d'origine. */
  cle: string;
  /** L'espèce lue sur la marionnette d'origine (« lapin »), ou null. */
  espece: string | null;
  /** Sa famille (« petit », « predateur »…), pour l'appariement à venir. */
  famille: Famille | null;
  traits: string[];
  /** La voix décidée pour CE spectacle, elle aussi variabilisée. */
  voix?: string;
}

/** La signature d'un spectacle : de quoi l'apparier sans ouvrir son fichier. */
export interface SignatureModele {
  id: string;
  conteId: string;
  titre: string;
  dureeMinutes: number;
  ageAuditoire: number;
  nbMarionnettistes: 1 | 2;
  interactionPublic: ParametresGeneration['interactionPublic'];
  dureeEstimeeSecondes: number;
  roles: Pick<RoleModele, 'cle' | 'espece' | 'famille' | 'traits'>[];
}

/** Un spectacle du fonds, sans aucun nom de marionnette. */
export interface SpectacleModele {
  /** « ru-paysan-ours-renard--1 » : lisible dans un `git diff`. */
  id: string;
  conteId: string;
  titre: string;
  pitch: string;
  roles: RoleModele[];
  /**
   * `marionnetteIds` et `modele` ne veulent rien dire dans un modèle : les
   * premiers désignent des peluches d'un autre foyer, le second la traçabilité
   * d'une génération qui n'aura pas lieu deux fois.
   */
  parametres: Omit<ParametresGeneration, 'marionnetteIds' | 'modele'>;
  tableaux: Tableau[];
  actes: Acte[];
  bible: Bible;
  dureeEstimeeSecondes: number;
}

/* ================================================================== */
/* Les variables                                                       */
/* ================================================================== */

/** La clé du rôle de rang n, à partir de 1. */
export function cleRole(n: number): string {
  return `r${n}`;
}

/** La variable telle qu'elle s'écrit dans le texte d'un modèle. */
export function variable(cle: string): string {
  return `{{${cle}}}`;
}

/** Sans accents, sans casse : pour CHERCHER un nom, jamais pour le remplacer. */
function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Applique une table de remplacements à une chaîne.
 *
 * LES CLÉS LES PLUS LONGUES D'ABORD, et c'est capital : « Ours » est un préfixe
 * d'« Ourse Gourmande ». Remplacer le court en premier laisserait « {{r2}}e
 * Gourmande » au milieu du texte.
 */
function remplacer(texte: string, table: [string, string][]): string {
  let resultat = texte;
  // EN MOT ENTIER : une marionnette « Lou » ne doit pas transformer « Loup »
  // en « {{r1}}p ». \b ne connaît pas les lettres accentuées, d'où \p{L}.
  for (const [de, vers] of table) {
    const motif = new RegExp(`(?<![\\p{L}\\p{N}])${echapper(de)}(?![\\p{L}\\p{N}])`, 'gu');
    resultat = resultat.replace(motif, () => vers);
  }
  return resultat;
}

const VOYELLE = /^[aeiouàâäéèêëiîïoôöuùûüyh]/i;

/**
 * Remplace les variables par les noms, EN RÉPARANT L'ÉLISION au passage.
 *
 * La substitution brute la brise immanquablement : « la voix grave d’Ourse »
 * donnerait « la voix grave d’Petite Souris », qui ne se dit pas ; et « le
 * panier de Gros Loup » donnerait « de Ourse ». La règle française est
 * mécanique devant un nom propre — « de » se contracte en « d’ » devant une
 * voyelle, et seulement là.
 *
 * On n'y touche qu'AU POINT DE SUBSTITUTION, jamais ailleurs dans le texte :
 * une réparation globale corrigerait des tournures du conte qu'on n'a pas à
 * toucher. Et on ne traite que « de » : « le/la » demanderait de connaître le
 * genre de la peluche, que rien ne nous dit.
 */
function peuplerTexte(texte: string, noms: Map<string, string>): string {
  // Le « de » doit être un MOT : sans la garde en tête, « regarde {{r1}} »
  // devenait « regard’Ourse Gourmande ».
  return texte.replace(/(?<![\p{L}\p{N}])([Dd])(['’]|e )(\{\{(r\d+)\}\})|\{\{(r\d+)\}\}/gu,
    (tout, d?: string, forme?: string, _avecDe?: string, cle1?: string, cle2?: string) => {
      const cle = cle1 ?? cle2;
      const nom = cle ? noms.get(cle) : undefined;
      if (nom === undefined) return tout;
      if (!d) return nom;
      const elide = VOYELLE.test(nom);
      return `${d}${elide ? '’' : 'e '}${nom}`;
    });
}

/**
 * Parcourt un objet en profondeur et transforme chaque chaîne rencontrée.
 *
 * Les spectacles portent du texte partout — répliques, didascalies, titres
 * d'actes, descriptions de décors, accessoires, et toute la bible, dont le
 * conte entier récrit. Un parcours générique évite d'oublier un champ, et
 * survit à l'ajout d'un champ nouveau.
 */
function transformerChaines<T>(valeur: T, f: (s: string) => string): T {
  if (typeof valeur === 'string') return f(valeur) as unknown as T;
  if (Array.isArray(valeur)) return valeur.map((v) => transformerChaines(v, f)) as unknown as T;
  if (valeur && typeof valeur === 'object') {
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur)) sortie[cle] = transformerChaines(v, f);
    return sortie as unknown as T;
  }
  return valeur;
}

/* ================================================================== */
/* Verser à la banque                                                  */
/* ================================================================== */

/**
 * Un nom de marionnette retrouvé dans un modèle, là où il ne devrait plus y en
 * avoir. C'est une erreur dure : un nom oublié contaminerait tous les
 * spectacles tirés de ce modèle.
 */
export class NomResiduel extends Error {
  constructor(public nom: string, public extrait: string) {
    super(`« ${nom} » subsiste dans le modèle : « ${extrait} »`);
    this.name = 'NomResiduel';
  }
}

/**
 * Transforme un spectacle joué en modèle de banque.
 *
 * `id` est l'identifiant du fichier, choisi par l'appelant (« conte--2 ») :
 * c'est lui qui distingue plusieurs spectacles tirés du même conte.
 */
const idTableau = (n: number) => `t${n}`;

export function variabiliser(spectacle: Spectacle, id: string): SpectacleModele {
  const roles: RoleModele[] = spectacle.distribution.map((m, i) => {
    const e = especeMarionnette(m);
    return {
      cle: cleRole(i + 1),
      espece: e?.mot ?? null,
      famille: e?.famille ?? null,
      traits: [...m.traits],
      voix: m.voix,
    };
  });

  // Noms et identifiants, du plus long au plus court.
  const parNom: [string, string][] = spectacle.distribution
    .map((m, i): [string, string] => [m.nom, variable(cleRole(i + 1))])
    .sort((a, b) => b[0].length - a[0].length);
  const parId = new Map(spectacle.distribution.map((m, i) => [m.id, cleRole(i + 1)]));
  // Les identifiants internes du spectacle sont des UUID tirés au hasard à
  // chaque génération. Un modèle n'en a que faire, et ils rendraient deux
  // versements du MÊME spectacle impossibles à reconnaître comme doublons. On
  // les renumérote : t1, a1, a1e1…
  const parTableau = new Map(spectacle.tableaux.map((t, i) => [t.id, idTableau(i + 1)]));

  const sansNoms = <T>(v: T): T => transformerChaines(v, (s) => remplacer(s, parNom));

  // LES PHRASES DE PRÉSENTATION — le pitch, l'accroche — décrivent souvent la
  // troupe par des noms communs : « une ourse gourmande », « un renard rusé ».
  // Elles ne valent que pour CETTE troupe, et faisaient refuser deux
  // spectacles sur trois au banc, alors que tout le texte joué était propre.
  // On les vide plutôt que de perdre le spectacle ; l'écran de script se
  // passe très bien d'un pitch.
  const presentation = (texte: string | undefined): string => {
    const t = sansNoms(texte ?? '');
    return contientUnNom(t, spectacle.distribution) ? '' : t;
  };
  const bibleAllegee = allegerBible(spectacle.bible);
  const adaptation = bibleAllegee.adaptation as { pitch?: string } | undefined;
  const synopsis = bibleAllegee.synopsis as { accroche?: string } | undefined;
  const bibleNeutre: Bible = {
    ...bibleAllegee,
    ...(adaptation ? { adaptation: { ...adaptation, pitch: presentation(adaptation.pitch) } } : {}),
    ...(synopsis ? { synopsis: { ...synopsis, accroche: presentation(synopsis.accroche) } } : {}),
  };

  const modele: SpectacleModele = {
    id,
    conteId: spectacle.bible.conteId ?? '',
    titre: spectacle.titre,
    pitch: presentation(spectacle.pitch),
    roles: roles.map((r) => (r.voix ? { ...r, voix: sansNoms(r.voix) } : r)),
    parametres: {
      dureeMinutes: spectacle.parametres.dureeMinutes,
      ageAuditoire: spectacle.parametres.ageAuditoire,
      nbMarionnettistes: spectacle.parametres.nbMarionnettistes,
      interactionPublic: spectacle.parametres.interactionPublic,
      ...(spectacle.parametres.ebauche !== undefined
        ? { ebauche: sansNoms(spectacle.parametres.ebauche) }
        : {}),
    },
    tableaux: sansNoms(spectacle.tableaux).map((t, i) => ({ ...t, id: idTableau(i + 1) })),
    actes: sansNoms(spectacle.actes).map((a, i) => ({
      ...a,
      id: `a${i + 1}`,
      tableauId: parTableau.get(a.tableauId) ?? a.tableauId,
      elements: a.elements.map((e, j) => ({
        ...e,
        id: `a${i + 1}e${j + 1}`,
        ...('marionnetteId' in e ? { marionnetteId: parId.get(e.marionnetteId) ?? e.marionnetteId } : {}),
      })),
    })),
    bible: sansNoms(bibleNeutre),
    dureeEstimeeSecondes: spectacle.dureeEstimeeSecondes,
  };

  verifierAucunNom(modele, spectacle.distribution);
  return modele;
}

/**
 * La bible d'un modèle ne garde que ce qui sert à REJOUER : le conte, le
 * synopsis retenu, la transposition, l'adaptation, la relecture. On en retire :
 *
 * - `dossier`, qui n'est que la fiche des peluches d'origine — « un lapin en
 *   tissu beige, une oreille recousue ». `peupler` le reconstruit avec les
 *   peluches d'aujourd'hui.
 * - `contesPresentes`, `jouables` et `synopsisProposes` : les notes de
 *   délibération, qui parlent des contes ÉCARTÉS pour une troupe qui n'est plus
 *   là. Quatre kilo-octets par spectacle, et un piège de plus — une accroche
 *   rejetée peut nommer une marionnette d'une autre façon (« un gros loup »
 *   pour « Gros Loup ») et faire refuser au garde-fou un spectacle dont le
 *   texte joué, lui, est parfaitement propre.
 */
function allegerBible(bible: Bible): Bible {
  const {
    dossier: _d, contesPresentes: _c, jouables: _j, synopsisProposes: _s, ...reste
  } = bible;
  return reste;
}

/**
 * Le garde-fou : plus aucun nom d'origine ne doit subsister, sous quelque
 * graphie que ce soit.
 *
 * Le modèle écrit parfois « doudou lapin » ou « Doudou » là où la fiche dit
 * « Doudou Lapin ». La substitution, elle, reste sur les noms exacts — c'est ce
 * qui rend l'aller-retour réversible. On cherche donc les résidus sous forme
 * normalisée : un écart de graphie fait ÉCHOUER le versement plutôt que de
 * passer inaperçu.
 */
/**
 * Les noms à chercher, sous forme normalisée, EN MOT ENTIER. Sans cette
 * précaution, « Ours » se retrouverait dans « ourse », dans « ourson » et dans
 * « nourrir ».
 */
function nomsCherches(distribution: Pick<Marionnette, 'nom'>[]) {
  return distribution
    .map((m) => normaliser(m.nom))
    .filter((n) => n.length >= 3)
    .map((n) => ({ nom: n, motif: new RegExp(`\\b${echapper(n)}\\b`) }));
}

/** Vrai si un nom de la troupe subsiste dans ce texte, sous quelque graphie. */
function contientUnNom(texte: string, distribution: Pick<Marionnette, 'nom'>[]): boolean {
  const normalise = normaliser(texte);
  return nomsCherches(distribution).some(({ motif }) => motif.test(normalise));
}

export function verifierAucunNom(modele: SpectacleModele, distribution: Marionnette[]): void {
  const cherches = nomsCherches(distribution);
  if (cherches.length === 0) return;

  // Les rôles sont des DONNÉES, pas du texte joué : ils gardent l'espèce et les
  // traits de la marionnette d'origine, et c'est exactement leur travail — sans
  // quoi on ne pourrait plus apparier. On ne les fouille donc pas.
  const { roles: _, ...texteJoue } = modele;

  let fautif: NomResiduel | null = null;
  transformerChaines(texteJoue, (s) => {
    if (fautif) return s;
    const normalise = normaliser(s);
    for (const { nom, motif } of cherches) {
      const trouve = motif.exec(normalise);
      if (!trouve) continue;
      const ou = trouve.index;
      fautif = new NomResiduel(nom, s.slice(Math.max(0, ou - 30), ou + nom.length + 30).trim());
      return s;
    }
    return s;
  });
  if (fautif) throw fautif;
}

/** Échappe les caractères spéciaux d'une expression régulière. */
function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** La signature d'un modèle, telle qu'elle entre dans l'index. */
export function signatureDe(m: SpectacleModele): SignatureModele {
  return {
    id: m.id,
    conteId: m.conteId,
    titre: m.titre,
    dureeMinutes: m.parametres.dureeMinutes,
    ageAuditoire: m.parametres.ageAuditoire,
    nbMarionnettistes: m.parametres.nbMarionnettistes,
    interactionPublic: m.parametres.interactionPublic,
    dureeEstimeeSecondes: m.dureeEstimeeSecondes,
    roles: m.roles.map(({ cle, espece, famille, traits }) => ({ cle, espece, famille, traits })),
  };
}

/* ================================================================== */
/* Le fonds, tel que l'application le lit                              */
/* ================================================================== */

/**
 * L'INDEX est chargé avec l'application : on ne peut pas chercher dans ce
 * qu'on n'a pas sous la main, et il ne pèse que quelques centaines d'octets
 * par spectacle. Les SPECTACLES eux-mêmes, une vingtaine de kilo-octets pièce,
 * attendent qu'on les demande.
 *
 * Même partage que la contothèque : `wiki/index.json` est eager,
 * `wiki/fr/*.md` est chargé à la demande (voir repertoire.ts).
 */
const FICHIERS = import.meta.glob('../../banque/spectacles/*.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const idDuChemin = (chemin: string) => chemin.replace(/^.*\/([^/]+)\.json$/, '$1');

/** La signature de chaque spectacle du fonds, par identifiant. */
export const SIGNATURES: Record<string, Omit<SignatureModele, 'id'>> =
  JSON.parse(INDEX_BRUT) as Record<string, Omit<SignatureModele, 'id'>>;

/** Toutes les signatures, identifiant compris, prêtes à être filtrées. */
export function signatures(): SignatureModele[] {
  return Object.entries(SIGNATURES).map(([id, s]) => ({ id, ...s }));
}

/** Charge un spectacle du fonds. Renvoie null si l'identifiant est inconnu. */
export async function chargerModele(id: string): Promise<SpectacleModele | null> {
  const chemin = Object.keys(FICHIERS).find((c) => idDuChemin(c) === id);
  if (!chemin) return null;
  return JSON.parse(await FICHIERS[chemin]()) as SpectacleModele;
}

/* ================================================================== */
/* Puiser dans la banque                                               */
/* ================================================================== */

/**
 * Rend un spectacle jouable à partir d'un modèle et d'une troupe.
 *
 * Les marionnettes sont prises DANS L'ORDRE : la première tient le rôle « r1 ».
 * C'est à l'appariement, plus tard, de les ranger dans le bon ordre.
 */
export function peupler(
  modele: SpectacleModele,
  marionnettes: Marionnette[],
  modele_ia = 'banque',
): Spectacle {
  if (marionnettes.length !== modele.roles.length) {
    throw new Error(
      `Ce spectacle demande ${modele.roles.length} marionnette(s), `
      + `${marionnettes.length} fournie(s).`,
    );
  }

  const noms = new Map(modele.roles.map((r, i) => [r.cle, marionnettes[i].nom]));
  const parCle = new Map(modele.roles.map((r, i) => [r.cle, marionnettes[i].id]));

  const avecNoms = <T>(v: T): T => transformerChaines(v, (s) => peuplerTexte(s, noms));

  const distribution: MarionnetteDistribuee[] = marionnettes.map((m, i) => {
    const voix = modele.roles[i].voix;
    return voix ? { ...m, voix: peuplerTexte(voix, noms) } : { ...m };
  });

  const parametres: ParametresGeneration = {
    ...modele.parametres,
    marionnetteIds: marionnettes.map((m) => m.id),
    modele: modele_ia,
  };

  // Identifiants neufs : un spectacle peuplé est un exemplaire, pas le modèle.
  const parTableau = new Map(modele.tableaux.map((t) => [t.id, nouvelId()]));

  const maintenant = new Date().toISOString();
  return {
    id: nouvelId(),
    titre: modele.titre,
    pitch: avecNoms(modele.pitch),
    parametres,
    distribution,
    tableaux: avecNoms(modele.tableaux).map((t) => ({ ...t, id: parTableau.get(t.id) ?? t.id })),
    actes: avecNoms(modele.actes).map((a): Acte => ({
      ...a,
      id: nouvelId(),
      tableauId: parTableau.get(a.tableauId) ?? a.tableauId,
      elements: a.elements.map((e): ElementScript => ({
        ...e,
        id: nouvelId(),
        ...('marionnetteId' in e ? { marionnetteId: parCle.get(e.marionnetteId) ?? e.marionnetteId } : {}),
      } as ElementScript)),
    })),
    dureeEstimeeSecondes: modele.dureeEstimeeSecondes,
    statut: 'complet',
    // Le dossier se reconstruit plutôt que de se transporter : c'est la fiche
    // des peluches d'AUJOURD'HUI qu'il doit décrire, pas celle d'hier.
    bible: { ...avecNoms(modele.bible), dossier: construireDossier(marionnettes, parametres) },
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}
