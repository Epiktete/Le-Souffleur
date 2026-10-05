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

## Le plus de dialogue possible entre marionnettes (règle du 2026-09-28)

C'est la règle qui prime sur les autres choix de mise en scène : **quitte à
avoir beaucoup de marionnettes**, les personnages se parlent.

- **Tout personnage qui a des répliques dans le conte devient une
  marionnette**, jusqu'à 6 par spectacle — y compris ceux que la fiche marque
  « figurant ». Un héros ne passe JAMAIS en coulisse.
- **Tu peux créer un personnage-marionnette si ses répliques sont déjà
  écrites dans le conte** : une réplique collective (« dirent les deux
  aînés ») se partage entre deux marionnettes ; un groupe (« les chiens »)
  s'incarne dans une marionnette (« un chien ») qui dit les répliques du
  groupe.
- **Le discours indirect devient direct** : « son père lui dit qu'il avait
  un cœur de lièvre » → le père dit « Tu as un cœur de lièvre ! ». Sans rien
  ajouter au sens.
- Pas de dialogue inventé au-delà d'ajouts simples et parlés (« Bon… j'y
  vais, j'y vais. ») ; un personnage SANS réplique dans le conte (la mère qui
  fait le fromage) reste dans la narration.
- **Le seuil (règle du 2026-09-29)** : « s'il y a plus que quelques
  répliques, ça vaut toujours le coup de l'incarner ». Dès 3 répliques, un
  personnage est TOUJOURS une marionnette ; avec une ou deux, il peut rester
  une voix en coulisse si la place manque ou si la scène n'y gagne rien.
  Quand la sixième place manque, incarne d'abord ceux qui parlent le plus.
- La voix en coulisse est réservée aux bruits, aux foules, aux personnages
  sans réplique ou d'une ou deux répliques, et à ceux qui dépassent la
  sixième marionnette.
- Deux mains, deux marionnettes en scène : beaucoup de marionnettes veut dire
  beaucoup d'entrées et de sorties. Organise la rotation pour que chaque
  échange se joue entre les deux marionnettes présentes.
- Exemple de référence : `banc/sorties/fable/no-concours-de-manger.json`
  (Askeladden, 5 marionnettes, père et frères remis dans le dialogue).

## La troupe (les marionnettes d'origine)

Inventer une peluche par personnage qui parle (voir la règle ci-dessus),
dans l'ordre : les rôles principaux de la fiche, puis les autres :

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
- Chaque peluche porte aussi, explicitement, son `espece` (le mot simple :
  « troll », « garçon », « poule ») et son `genre` (`"masculin"` ou
  `"feminin"`) : ce sont eux qui disent dans quel sens vont les accords et
  quelles mentions d'espèce suivront la peluche du parent.
- 2 ou 3 `traits` par peluche, cohérents avec le rôle ; une `voix` par peluche
  (« voix grave et traînante, dit "hmm" avant de parler »). Ni la voix ni les
  tons ne nomment l'espèce d'un AUTRE personnage.
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

### `especes` — le texte suit l'espèce de la peluche

Le parent joue avec SES peluches : si son troll est un dragon, le texte doit
dire « un énorme dragon ». Pour chaque rôle, deux cas :

- **`"imposee": true`** quand l'espèce est l'âme du conte (la poule qui
  pond, le chat botté, la fée, les hérissons sosies, le tamia et ses
  rayures). La distribution exigera alors la même espèce.
- Sinon, **`"mentions"`** : chaque endroit du texte joué où l'espèce de CE
  personnage est nommée, avec un gabarit à trous que le code remplira :
  `{le}` `{Le}` `{un}` `{Un}` `{du}` `{au}` `{de}` (articles, élisions
  comprises), `{espece}`, `{especes}` (pluriel), et `{masculin|féminin}` pour
  un adjectif qui s'accorde. Exemples : « au petit lapin » →
  `{au} {petit|petite} {espece}` ; « d'un énorme tigre » →
  `d'{un} énorme {espece}` ; « les autres tigres » → `les autres {especes}`.
- Ne liste PAS les mentions génériques qui ne désignent pas le personnage
  (« comme un chien attrape une mouche »). Un rôle sans aucune mention
  n'apparaît pas dans la liste.
- **Un métier ou un titre n'est pas une espèce** (boucher, rémouleur,
  cavalier, paysan, bûcheron, meunier, gendarme, propriétaire…) : il RESTE
  dans le texte, et ne change qu'en genre, par les `accords` (« un boucher »
  → « une bouchère »). La peluche du parent garde son espèce et prend le
  métier : le texte dit « un boucher », la peluche montre un lapin. Seuls
  suivent la peluche les vrais mots d'espèce : animaux, créatures (troll,
  ogre, fée), et « garçon », « fille », « homme », « femme » quand ils
  désignent le personnage.
- Le mot d'espèce d'un rôle ne figure JAMAIS dans ses `accords` : il vit
  dans ses `mentions` (le code rend l'espèce ET le genre).

```json
"especes": [
  { "role": 1, "imposee": true },
  { "role": 2, "mentions": [ { "id": "a1e13:texte", "avant": "un énorme troll", "gabarit": "{un} énorme {espece}" } ] }
]
```

Le versement vérifie chaque gabarit : rendu avec l'espèce et le genre
d'origine du rôle, il doit redonner l'extrait `avant` à l'identique.

## Avant de rendre : l'autocontrôle

1. Le JSON est valide (le relire en entier).
2. Chaque `marionnetteId` existe ; chaque `tableauId` existe ; les ids suivent
   le schéma ; jamais plus de deux marionnettes en scène.
3. Chaque `avant` des accords se retrouve, exact, dans la ligne visée.
4. `interactions` couvre exactement les `adresse_public`.
5. Aucun nom de peluche n'apparaît dans un `avant`/`apres`, ni comme mot
   ordinaire du texte.
6. La fin du conte est jouée entière ; les répliques viennent du texte.
7. Tout personnage qui a 3 répliques ou plus est une marionnette (jusqu'à 6,
   les plus bavards d'abord) ; aucune réplique d'un personnage principal
   n'est dite en coulisse.
8. Chaque mention d'espèce, rendue avec l'espèce et le genre d'origine,
   redonne son extrait exact.
