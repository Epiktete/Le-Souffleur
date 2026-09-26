// La contothèque (wiki/), telle que l'application la lit.
//
// Le générateur part d'un conte du domaine public, choisi pour les
// marionnettes de la famille, et l'adapte. La contothèque a trois dossiers
// (voir wiki/README.md) ; l'application en lit deux :
//
//   - wiki/fiches/ : les fiches synthétiques, CHARGÉES AVEC L'APPLICATION. Elles
//     sont petites (163 fiches, une centaine de kilo-octets) et servent à
//     choisir : on ne peut pas trier ce qu'on n'a pas sous la main.
//   - wiki/fr/ : les textes français intégraux, CHARGÉS À LA DEMANDE. Ils pèsent
//     un mégaoctet et demi ; seul celui du conte retenu est utile, et seulement
//     au moment d'écrire.
//   - wiki/retouches/ : ce qui change dans chaque texte selon l'âge du public
//     (voir retouches.ts), chargé à la demande comme le texte lui-même.
//
// Le dossier wiki/raw/ (textes dans leur langue d'origine) ne sert qu'à nous,
// pour vérifier une traduction : il n'est jamais empaqueté.

import { corpsDuTexte } from './mots';
import { lireFicheRetouches, type FicheRetouches } from './retouches';

/** Un rôle du conte, tel que la fiche le décrit. */
export interface RoleConte {
  nom: string;
  /** Le mot simple qu'on mettrait sur la marionnette : lièvre, roi, sorcière. */
  espece: string;
  categorie: 'animal' | 'humain' | 'merveilleux' | 'objet';
  traits: string[];
  /** héros, trompeur, dupe, adversaire, aide, juge, meneur, compagnon, victime, donneur. */
  fonction: string;
  /** Rôle qu'on peut jouer à la voix, faire passer en coulisse ou supprimer. */
  figurant: boolean;
}

export interface Conte {
  id: string;
  titre: string;
  culture: string;
  /** Auteur ou collecteur, recueil, date : ce qu'on cite sous « D'après ». */
  source: string;
  genre: string;
  ageMin: number;
  ageMax: number;
  /** Nombre de rôles qui portent l'histoire. */
  personnages: number;
  figurants: number;
  roles: RoleConte[];
  lieux: string;
  ressorts: string;
  structure: string;
  /** Essence, trame et « à adapter » ou « à jouer », tels qu'écrits dans la fiche. */
  corps: string;
}

/* ------------------------------------------------------------------ */
/* Lecture d'une fiche                                                 */
/* ------------------------------------------------------------------ */

/**
 * Lit une fiche. Le format est celui que décrit wiki/README.md et que
 * tools/verifier-fiches.mjs contrôle : un en-tête YAML très régulier, une
 * valeur par ligne, puis le corps.
 *
 * On ne tire pas une bibliothèque YAML pour cela : l'en-tête est écrit par nous,
 * toujours de la même façon, et une fiche mal formée est refusée par le
 * vérificateur avant d'arriver ici. Une fiche illisible est simplement
 * ignorée (null) plutôt que de casser toute l'application.
 */
export function lireFiche(texte: string): Conte | null {
  const m = texte.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const [, entete, corps] = m;

  const champ = (cle: string): string =>
    (entete.match(new RegExp(`^${cle}: (.*)$`, 'm'))?.[1] ?? '').trim();
  const sansGuillemets = (v: string) => v.replace(/^"(.*)"$/, '$1');

  const age = champ('age').match(/^\[(\d+), (\d+)\]$/);
  const roles = [...entete.matchAll(/^ {2}- \{(.*)\}$/gm)].map((r) => lireRole(r[1]));
  const id = champ('id');
  if (!id || !age || roles.length === 0) return null;

  return {
    id,
    titre: champ('titre'),
    culture: champ('culture'),
    source: sansGuillemets(champ('source')),
    genre: champ('genre'),
    ageMin: Number(age[1]),
    ageMax: Number(age[2]),
    personnages: Number(champ('personnages')) || roles.filter((r) => !r.figurant).length,
    figurants: Number(champ('figurants')) || 0,
    roles,
    lieux: enlever(champ('lieux')),
    ressorts: enlever(champ('ressorts')),
    structure: champ('structure'),
    corps: corps.trim(),
  };
}

/** Retire les crochets d'une liste YAML en ligne, qu'on garde comme texte. */
function enlever(liste: string): string {
  return liste.replace(/^\[(.*)\]$/, '$1');
}

/**
 * Un rôle écrit en ligne : {nom: …, espece: …, categorie: …, traits: […], …}.
 * On lit chaque clé par sa position plutôt qu'en coupant aux virgules : les
 * traits en contiennent.
 */
function lireRole(ligne: string): RoleConte {
  const valeur = (cle: string): string => {
    const i = ligne.indexOf(`${cle}: `);
    if (i < 0) return '';
    const reste = ligne.slice(i + cle.length + 2);
    if (reste.startsWith('[')) return reste.slice(0, reste.indexOf(']') + 1);
    return reste.split(',')[0].trim();
  };
  const traits = valeur('traits').replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
  const categorie = valeur('categorie');
  return {
    nom: valeur('nom'),
    espece: valeur('espece'),
    categorie: (['animal', 'humain', 'merveilleux', 'objet'].includes(categorie)
      ? categorie
      : 'humain') as RoleConte['categorie'],
    traits,
    fonction: valeur('fonction'),
    figurant: /figurant: true/.test(ligne),
  };
}

/* ------------------------------------------------------------------ */
/* Le répertoire chargé                                                */
/* ------------------------------------------------------------------ */

const FICHES = import.meta.glob('../../wiki/fiches/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Les textes intégraux, chacun dans son propre morceau chargé à la demande. */
const TEXTES = import.meta.glob('../../wiki/fr/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

/** Les fiches de retouches selon l'âge, de même. */
const RETOUCHES = import.meta.glob('../../wiki/retouches/*.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const idDuChemin = (chemin: string) => chemin.replace(/^.*\/([^/]+)\.(md|json)$/, '$1');

/** Tous les contes du répertoire, dans l'ordre des identifiants. */
export const CONTES: Conte[] = Object.entries(FICHES)
  .map(([, texte]) => lireFiche(texte))
  .filter((c): c is Conte => c !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

const PAR_ID = new Map(CONTES.map((c) => [c.id, c]));

export function conteParId(id: string): Conte | undefined {
  return PAR_ID.get(id);
}

/**
 * Le texte français intégral d'un conte, sans son en-tête (titre et ligne de
 * source, déjà connus par la fiche). Renvoie une chaîne vide si le texte
 * manque : l'écriture se fera alors sur la seule fiche, ce qui vaut mieux que
 * pas de spectacle du tout.
 */
export async function texteDuConte(id: string): Promise<string> {
  const chemin = Object.keys(TEXTES).find((c) => idDuChemin(c) === id);
  if (!chemin) return '';
  return corpsDuTexte(await TEXTES[chemin]());
}

/**
 * La fiche de retouches d'un conte, ou null s'il n'en a pas encore (ou si elle
 * est illisible : tools/verifier-retouches.mjs dit pourquoi). Le conte garde
 * alors l'ancien comportement.
 */
export async function retouchesDuConte(id: string): Promise<FicheRetouches | null> {
  const chemin = Object.keys(RETOUCHES).find((c) => idDuChemin(c) === id);
  if (!chemin) return null;
  return lireFicheRetouches(await RETOUCHES[chemin]());
}

/** « D'après … » : la ligne qui cite le conte original, pour le parent. */
export function reference(c: Conte): string {
  return `${c.titre} — ${c.culture}, ${c.source}`;
}
