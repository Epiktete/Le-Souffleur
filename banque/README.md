# La banque de spectacles

Un fonds de spectacles déjà écrits, rangés **sans les noms des marionnettes**.

Écrire un spectacle coûte une dizaine d'appels au modèle. Deux familles qui
demandent « un conte de loup, cinq minutes, quatre ans, deux peluches »
recevront deux fois le même travail, payé deux fois. Ce dossier garde le
premier, pour que le second soit gratuit.

Un spectacle y est stocké comme un **modèle** : partout où se lisait « Petite
Souris », le fichier porte `{{r1}}`. Les noms ne reviennent qu'à la lecture,
quand on peuple le modèle avec la troupe d'un parent — par du code, sans IA.

## Ce qu'il y a dedans

    index.json          la signature de chaque spectacle, chargée au démarrage
    spectacles/         un fichier par spectacle, chargé à la demande
      de-chat-et-souris-associes--1.json

Le nom de fichier est `{conte}--{n}` : `n` distingue plusieurs adaptations d'un
même conte, et rien n'est jamais remplacé — deux adaptations sont deux
spectacles.

`index.json` ne porte que ce qui sert à **apparier** une demande : durée, âge,
nombre de marionnettistes, interaction, et pour chaque rôle son espèce, sa
famille et ses traits. Une vingtaine de lignes, là où les spectacles pèsent
trente kilo-octets chacun.

## Comment on l'alimente

L'application tourne entièrement dans le navigateur : elle ne sait pas écrire
dans le dépôt. Le fonds est donc alimenté par le banc et par le relais, qui
fabriquent de vrais spectacles hors navigateur.

    npm run relais          (ou npm run banc)
    npm run banque          reconstruit index.json
    git add banque && git commit

Le versement est **idempotent** : rejouer le même cas ne crée pas de doublon.

## Le garde-fou

Après variabilisation, tout le texte est reparcouru à la recherche des noms
d'origine, sous forme normalisée — sans accents, sans casse. S'il en reste un,
le spectacle **n'est pas versé**, et le banc le dit :

    banque : NON VERSÉ — « gros loup » subsiste dans le modèle : …

Un nom oublié contaminerait tous les spectacles tirés de ce modèle : une famille
lirait le nom de la peluche d'une autre. Mieux vaut un fonds plus petit.

## Ce qui n'est pas emporté

Un modèle ne garde de la bible que ce qui sert à rejouer : le conte, le synopsis
retenu, la transposition, l'adaptation, la relecture. Sont laissés de côté :

- le **dossier des peluches** — « un lapin en tissu beige, une oreille
  recousue » —, reconstruit avec les peluches d'aujourd'hui ;
- les **notes de délibération** (contes présentés, synopsis rejetés), qui
  parlent d'une troupe qui n'est plus là.

Les identifiants internes sont renumérotés (`t1`, `a1`, `a1e1`) : un modèle n'a
que faire d'UUID tirés au hasard, et un `git diff` en devient lisible.

## Où c'est écrit

| | |
|---|---|
| [src/services/banque.ts](../src/services/banque.ts) | `variabiliser`, `peupler`, la lecture du fonds |
| [banc/banque.ts](../banc/banque.ts) | le versement depuis le banc et le relais |
| [tools/indexer-banque.mjs](../tools/indexer-banque.mjs) | la reconstruction de l'index |
| [tests/banque.test.ts](../tests/banque.test.ts) | l'aller-retour sur de vrais spectacles |

## Ce qui n'existe pas encore

L'appariement d'une demande à un modèle, l'interface qui proposerait le
spectacle du fonds avant d'en écrire un, et la retouche par IA d'un spectacle
déjà construit. Cette étape n'a posé que les fondations : l'application ne lit
pas encore le fonds.

## Le peuplement : ce que les noms ne suffisent pas à rendre

*Conçu le 2026-09-27, à brancher quand la qualité des adaptations sera jugée
bonne — le fonds ne se remplit pas avant.*

Un spectacle stocké n'est pas neutre : sa transposition a été écrite pour une
troupe précise. Trois choses y restent accrochées, que remplacer les noms ne
défait pas :

1. **le genre grammatical** — « elle », « gourmande », « la première » suivent
   la peluche d'origine ;
2. **l'espèce dans le texte** — « le renard détale », et depuis le conteur la
   narration se dit : l'espèce sort du nom bien plus qu'avant ;
3. **l'âge** — le texte porte les retouches de fond et de langue d'un âge
   précis.

**Le principe : l'appariement porte les contraintes, le code ne fait que les
noms.** Plutôt que de rendre le peuplement intelligent, on ne sert un modèle
qu'aux demandes qu'il peut satisfaire par simple remplacement :

- la **signature** de l'index gagne, par rôle, le **genre grammatical** de la
  peluche d'origine et un booléen **espèce citée hors du nom** (mesuré au
  versement, comme le garde-fou des noms résiduels) ; et, pour le spectacle,
  l'**âge** et le **profil de retouches** ;
- une demande s'apparie si, rôle par rôle, la peluche du parent a le **même
  genre grammatical**, et la **même espèce** quand elle est citée hors du nom
  (la même famille suffit sinon) ; et si l'âge demandé donne le **même profil
  de retouches** que celui du spectacle stocké ;
- durée, marionnettistes et interaction se servent tels quels : ce sont les
  attributs du contenu, pas des réglages à imiter.

**L'option : une retouche d'accords, petite et vérifiable.** Quand seul le
genre grammatical diverge (ou l'espèce, dans la même famille), un unique appel
à un petit modèle, température 0, peut combler l'écart : il reçoit le script
peuplé et la liste fermée des rôles qui changent, et renvoie une **liste de
remplacements** « avant → après » (jamais le texte entier), que le code
applique et vérifie comme il applique les fiches de retouches
(`trouverExtrait`). Un remplacement introuvable fait refuser la retouche, et
la demande repart vers la génération complète : jamais de texte à moitié
accordé. Coût : quelques secondes et quelques centaines de jetons, contre une
dizaine d'appels pour générer à neuf.

**Comment le fonds se remplit.** Pas de campagne de 150 productions : la
qualité d'abord. Le fonds s'alimente comme aujourd'hui, en sous-produit du
banc et du relais (`RELAIS_BANQUE=1`), au fil des contes joués et relus — et
seuls les spectacles dont la durée tient et dont la revue est passée entrent
au fonds.
