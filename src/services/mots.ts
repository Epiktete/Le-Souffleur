// Les mots d'un texte, ramenés à une forme comparable.
//
// Sert à deux endroits, qui doivent lire les mots EXACTEMENT de la même façon :
// tools/indexer-contes.mjs, qui tire les mots-clés de chaque conte, et
// le choix des contes, qui les compare à l'ébauche du parent. Ce fichier n'utilise que
// du TypeScript que Node sait lire directement, pour que l'outil puisse
// l'importer tel quel.

/** Minuscules, sans accents, sans ponctuation. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim();
}

/**
 * Mots trop courants pour dire de quoi parle un texte. La liste est courte
 * exprès : les mots de trois lettres ou moins sont déjà écartés.
 */
const MOTS_VIDES = new Set(`
  alors aussi autre autres avait avaient avant avec avoir bien cela celle celui
  cent cette ceux chez comme comment dans depuis deux devant dire dit dirent
  disait donc dont elle elles encore entre etait etaient etre fait faire fois
  font jamais jour leur leurs lors lorsque mais meme mieux moins nous parce
  pendant peut plus pour pourquoi puis quand quel quelle quelque quelques rien
  sans sera sont sous suis tout toute toutes tous tres trop vers voici voila
  vous avoir oui non petit petite grand grande bon bonne tant tellement ainsi
  apres aupres voulait voulut voulez veux veut pouvait pourrait allait alla
  aller venir vint vient temps chose choses homme femme histoire conte
  quoi quelqu toujours enfin assez celle-ci celui-ci ceci votre notre
`.split(/\s+/).filter(Boolean));

/**
 * Forme de comparaison d'un mot : sans le pluriel ni le féminin les plus
 * courants. Grossier, mais identique des deux côtés, et c'est tout ce qui
 * compte : « rivières » et « rivière », « rusée » et « rusé » se retrouvent.
 */
export function racine(mot: string): string {
  let m = mot;
  if (m.length > 4 && /[sx]$/.test(m)) m = m.slice(0, -1);
  if (m.length > 4 && m.endsWith('e')) m = m.slice(0, -1);
  return m;
}

/** Les mots qui portent un sens, sous leur forme de comparaison. */
export function motsSignifiants(texte: string): string[] {
  // Les traits d'union sont coupés : « dit-il » ne doit pas devenir un mot-clé,
  // et « grand-mère » se retrouve par « mere ».
  return normaliser(texte)
    .split(/[\s-]+/)
    .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m))
    .map(racine);
}

/**
 * Longueur d'un texte en mots, comme on la compte pour la durée.
 *
 * LE SEUL compteur du projet : l'index des contes, le choix, les verdicts de
 * coupe du pipeline et la durée estimée doivent compter pareil, sans quoi un
 * conte « de la bonne taille » à l'index reçoit « couper un épisode » au
 * découpage. La typographie française met une espace avant « ? », « ! »,
 * « : » et « ; » : un découpage naïf sur les espaces comptait chaque point
 * d'interrogation comme un mot — et les dialogues en sont pleins. On ne garde
 * que les fragments contenant au moins une lettre ou un chiffre ; les tirets
 * et apostrophes ne séparent pas : « l'arc-en-ciel » est un mot.
 */
export function compterMots(texte: string): number {
  return texte
    .trim()
    .split(/\s+/)
    .filter((fragment) => /[\p{L}\p{N}]/u.test(fragment))
    .length;
}

/**
 * Le corps d'un texte de wiki/fr/, sans son titre ni sa ligne de source.
 * Le même découpage que celui du répertoire, pour que la longueur mesurée
 * soit celle du texte que le modèle recevra.
 */
export function corpsDuTexte(brut: string): string {
  return brut.replace(/\r\n/g, '\n').replace(/^# .*\n+\*[^\n]*\*\n+/, '').trim();
}
