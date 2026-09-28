# Écrire un spectacle pour le fonds, hors ligne

Consignes pour un agent qui écrit UN spectacle complet destiné à la banque
(mode Contothèque). Le travail est fait une fois pour toutes, sans aucun appel
réseau : le fichier produit est versé, vérifié par le code, puis relu.

## À lire avant d'écrire (dans le dépôt)

1. `wiki/fiches/<id>.md` — la fiche du conte : essence, trame, rôles, « À jouer ».
2. `wiki/fr/<id>.md` — le texte français intégral. **C'est lui la matière : les
   répliques et la narration en sont tirées, pas inventées.**
3. `wiki/retouches/<id>.json` — n'appliquer QUE les retouches universelles :
   celles **sans** champ `jusqua`, et celles avec `jusqua` ≥ 10. Les autres
   sont des adoucissements d'âge : le spectacle du fonds n'en reçoit aucun.
4. `banc/sorties/perrault/chaperon-script.md` — le ton et la mise en scène
   attendus, tels que le parent les lit.
5. `banc/sorties/perrault/chaperon-spectacle.json` — la forme exacte d'un
   spectacle (champ `actes`, types d'éléments…). S'y conformer strictement.
6. `src/prompts.ts` — lire les constantes : `LE_TEXTE_DU_CONTE`,
   `CONTRAINTES_MATERIELLES`, `PLACE_DES_DIDASCALIES`, `PARLER_CLAIR`,
   et les fonctions `consignesAge`, `consignesInteraction`. Elles font loi.

## Les règles qui ne se négocient pas

- **Fidélité.** La narration est celle du conte, dite par le CONTEUR (le
  parent, de sa propre voix) ; les répliques sont celles du conte, ou des
  ajouts simples et parlés. Jamais de formule faussement profonde. La fin du
  conte n'est ni tronquée ni adoucie.
- **Trois voies de la parole** : `conteur` (narration), `replique` (une
  marionnette parle), `adresse_public` (on parle aux enfants). Les didascalies
  décrivent des gestes JOUABLES avec une peluche au bout d'une main : pas de
  doigts, pas d'objets tenus, pas d'expressions du visage.
- **Un marionnettiste, deux mains** : jamais plus de deux marionnettes en
  scène en même temps. Chaque entrée/sortie est un élément `entree`/`sortie`
  avec sa main (`M1G` ou `M1D`), cohérente d'un bout à l'autre. Un personnage
  de plus passe par la voix en coulisse (`note_marionnettiste`).
- **Interaction généreuse** : le spectacle est écrit au niveau « beaucoup » —
  au moins 5 ou 6 `adresse_public` bien réparties (répéter une formule, faire
  un bruit, répondre à une question). **Chacune doit pouvoir être supprimée
  telle quelle sans casser la suite** : rien après elle ne dépend de la
  réponse des enfants.
- **La langue est celle de l'âge cible** : phrases courtes pour les petits,
  mots concrets, refrains répétés tels quels.
- **Durée** : ~100 mots dits par minute (conteur compris), +3 s par
  didascalie, +8 s par adresse qui attend une réponse. Viser la cible donnée,
  sans couper la fin du conte pour y tenir.

## La troupe (les marionnettes d'origine)

Inventer une peluche par rôle principal de la fiche :

- **L'espèce de la peluche = l'espèce du rôle** (le texte la nomme : un rôle
  de lièvre se joue avec un lièvre). Le mot d'espèce apparaît dans la
  description (« Un lièvre en peluche grise… »).
- **Le genre est déductible** : un mot au genre sûr, ou la description qui
  commence par « Un » / « Une ». Le genre de la peluche = le genre du
  personnage dans le texte du conte.
- **Le nom est inventé et n'est AUCUN mot du texte** (ni au singulier ni
  approchant) : un nom comme « Broussaille », « Kimchi », « Plume d'Or » — le
  garde-fou refuse tout nom qui resterait lisible dans le texte une fois les
  noms variabilisés. Vérifier soi-même : le nom, en entier et en mots, ne doit
  apparaître nulle part dans le texte écrit autrement que comme nom.
- 2 ou 3 `traits` par peluche, cohérents avec le rôle ; une `voix` par peluche
  (« voix grave et traînante, dit "hmm" avant de parler »).
- Dans le script, les personnages sont appelés PAR LEUR NOM, partout.

## Le fichier à produire

Écrire UN fichier JSON : `banc/sorties/fable/<id-du-conte>.json` (UTF-8),
de cette forme :

```json
{
  "spectacle": { … un objet Spectacle complet … },
  "accords": [
    { "role": 1, "remplacements": [ { "id": "a1e3:texte", "avant": "…", "apres": "…" } ] },
    { "role": 2, "remplacements": [ … ] }
  ],
  "interactions": ["a1e5", "a2e2", "a3e7"]
}
```

### `spectacle` — les champs, et le schéma d'identifiants

Comme `chaperon-spectacle.json`, avec ces identifiants IMPOSÉS (ils survivent
au versement) :

- tableaux : `"t1"`, `"t2"`… ; actes : `"a1"`, `"a2"`… ;
- éléments de l'acte i : `"a1e1"`, `"a1e2"`… dans l'ordre ;
- marionnettes de la distribution : `"m1"`, `"m2"`… (dans l'ordre des rôles de
  la fiche) ; `marionnetteIds` et les `marionnetteId` des éléments les
  utilisent.

Champs : `id` = `"<id-du-conte>--1"` ; `titre` (celui du conte) ; `pitch`
(1-2 phrases, les noms des peluches autorisés) ; `parametres`
(`dureeMinutes` = cible, `ageAuditoire` = âge cible, `nbMarionnettistes` : 1,
`interactionPublic` : `"beaucoup"`, `marionnetteIds`, `modele` :
`"fable-hors-ligne"`) ; `distribution` (les peluches, avec `creeLe`/`modifieLe`
ISO et leur `voix`) ; `tableaux` (2 à 4 phrases de préparation avec ce qu'on a
dans un salon : coussins, torchons, cartons ; `accessoires` ; `promptImage` :
`""`) ; `actes` (2 à 4, avec `numero`, `titre`, `resume`, `tableauId`,
`elements`) ; `dureeEstimeeSecondes` (estimation, le versement recalcule) ;
`statut` : `"complet"` ; `bible` : `{ "conteId": "<id-du-conte>",
"synopsis": { "accroche": "…", "resume": ["…"] }, "transposition":
{ "texte": "le conte entier, récrit avec les noms des peluches et les
retouches universelles appliquées" } }` ; `creeLe`, `modifieLe`.

### `accords` — la version de l'autre genre, par rôle

Pour CHAQUE rôle (1 = première peluche de la distribution), la liste des
remplacements qui font passer tout ce qui s'accorde avec CE personnage à
l'AUTRE genre que le sien : articles, adjectifs, participes, pronoms, mots
genrés, mot d'espèce s'il a une jumelle (« le lièvre » → « la hase » NON :
garder « lièvre » sauf couple courant comme loup/louve, ours/ourse,
chat/chatte, renard/renarde, lapin/lapine, lion/lionne, chien/chienne).

- `id` : la ligne visée — `"pitch"`, `"voix:r1"` (voix de la peluche du rôle
  1), `"t1:titre"`, `"t1:description"`, `"t1:accessoire:1"`, `"a1:titre"`,
  `"a1:resume"`, `"a1e3:texte"`, `"a1e3:ton"`.
- `avant` : extrait recopié EXACTEMENT (accents, majuscules, ponctuation),
  le plus court possible mais unique dans sa ligne, et **ne contenant aucun
  nom de peluche** (les noms deviennent des variables au versement).
- `apres` : l'extrait corrigé, rien d'autre ne change.
- Un remplacement par correction. N'oublier AUCUNE ligne : relire chaque
  élément en se demandant « si ce personnage était de l'autre genre, ce mot
  changerait-il ? ».

### `interactions` — le classement

TOUTES les ids des éléments `adresse_public`, de la plus précieuse (celle
qu'on garde en dernier) à la plus retranchable. Aucune de plus, aucune de
moins.

## Avant de rendre : l'autocontrôle

1. Le JSON est valide (le relire en entier).
2. Chaque `marionnetteId` existe ; chaque `tableauId` existe ; les ids suivent
   le schéma ; jamais plus de deux marionnettes en scène.
3. Chaque `avant` des accords se retrouve, exact, dans la ligne visée.
4. `interactions` couvre exactement les `adresse_public`.
5. Aucun nom de peluche n'apparaît dans un `avant`/`apres`, ni comme mot
   ordinaire du texte.
6. La fin du conte est jouée entière ; les répliques viennent du texte.
