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
