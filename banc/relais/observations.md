# Observations du relais (défauts de prompt relevés en jouant le modèle)

## Cas 1, étape 001 — synopsis
- « marionnettistes : 1, donc 2 mains » est donné dans le dossier mais le
  prompt système ne dit jamais ce qu'il faut en faire à cette étape.
- La consigne « écris pour le parent, phrases qui se tiennent seules, sans
  vocabulaire de métier » est dite trois fois sous des formes voisines.

## Cas 1, étape 002 — transposition
- CONTRADICTION : le système dit « tu ne coupes rien, tu ne résumes rien »,
  mais l'utilisateur contient les « changements » du synopsis, qui annoncent
  des coupes déjà décidées. Le modèle doit arbitrer seul.
- Le « nom de l'animal du conte disparaît du texte » s'applique aussi aux
  mentions GÉNÉRIQUES (« on chasse les loups et les ours » → « ourse »), ce
  qui n'est pas voulu : seule l'espèce DU PERSONNAGE doit changer.
- Rien ne dit si les adresses affectueuses (« mon petit ours ») prennent le
  nom de la marionnette ou restent telles quelles.

## Cas 1, étape 003 — découpage
- RÉGRESSION DE MON FAIT : la légende des crochets avait été glissée dans
  POUR_LE_PARENT, constante partagée avec le découpage. Le modèle y cherchait
  des crochets inexistants. Corrigé : la légende ne sert qu'aux synopsis.
- Le champ « temps » du schéma n'est expliqué nulle part, alors que
  « passage », « momentsPublic » et « budgetMots » le sont tous. Le modèle
  devine.

## Cas 1, étape 004 — écriture d'un acte
- La conduite donne des MAINS contradictoires (deux sorties sur M1G alors
  qu'une marionnette était entrée en M1D). Or `attribuerMains` recalcule tout :
  la main écrite par le modèle au découpage n'est qu'une préférence. On lui
  envoie donc une donnée fausse qu'il doit contredire.
- Le découpage propose des « moments publics » formulés en question
  d'opinion, catégorie interdite à l'étape d'écriture. L'interdit n'est pas
  rappelé au découpage.

## Cas 1, étape 005 — écriture d'un acte (confirmation)
- La contradiction des mains SE RÉPÈTE à chaque acte : elle est systématique.
  Corrigé : la conduite ne donne plus la main, seulement l'ordre des entrées
  et sorties, et dit explicitement que l'application la calcule.
- Le texte transposé demande des gestes impossibles (« couvrir de bûches »,
  « attacher avec une corde ») : la contrainte « pas de doigts » s'applique à
  l'écriture mais rien ne l'a empêchée d'entrer dans la transposition.

## Cas 1, étape 006 — écriture d'un acte
- CONFIRMÉ (2e fois) : la frontière entre « faire deviner » et « demander aux
  enfants de trouver l'idée à la place du personnage » n'est pas nette. Le
  découpage propose des moments que l'écriture croit interdits.
- Un BRUIT fait en coulisse (aboiements, grincement) n'entre dans aucun des
  cinq types d'éléments. Le modèle choisit la didascalie par analogie, sans
  que le prompt tranche.

## Cas 1, étape 007 — relecture
- CONTRADICTION née de mon propre correctif : la relecture reçoit les écarts
  de durée (« resserre d'environ 40 mots ») alors qu'on lui interdit de
  proposer des coupes pour gagner du temps. Corrigé : la durée ne lui est
  plus transmise, elle se règle à la correction.
- La phrase « une marionnette animale appelée par l'espèce du conte et non
  par la sienne » est syntaxiquement ambiguë : deux lectures possibles.

## Le pipeline lui-même
- Les `catch` défensifs de la relecture et des corrections avalent TOUTE
  erreur. Une revue finale qui échouerait systématiquement serait invisible :
  le spectacle est livré sans elle, sans que rien ne le signale au parent.

## Cas 1, étape 008 — correction d'un acte  ⚠ LE PLUS GRAVE
- Le prompt de correction ne montrait qu'UN SEUL type d'élément dans son
  exemple JSON : {"type": "replique"}. Le modèle ne pouvait pas savoir que
  « entree », « sortie », « didascalie », « adresse_public » et
  « note_marionnettiste » existent. En réécrivant un acte, il perdait donc
  entrées, sorties et didascalies — ce qui explique très probablement l'acte 4
  cassé de « Poulette Pioupiou ». Corrigé : la liste complète, et le rappel
  de recopier le nom de la MARIONNETTE et jamais celui du rôle.

## Cas 1, étape 009 — correction d'un acte
- Les modifications du directeur éditorial et les problèmes automatiques
  peuvent se CONTREDIRE dans le même prompt (« garde ce moment public » d'un
  côté, « resserre de 40 mots » de l'autre) sans que rien ne dise lequel prime.
- Une correction qui porte sur les didascalies laisse la réplique du conte
  citer l'objet qu'on vient de retirer de la scène.

## Cas 1, étape 010 — correction (confirmation)
- CONFIRMÉ (2e fois) : les modifications se contredisent (« retire cette
  image » allonge le texte, « resserre de 42 mots » le raccourcit) sans ordre
  de priorité. Corrigé : bloquant > éditorial > longueur, et la durée ne
  justifie jamais de couper une réplique du conte.
- La consigne de durée était un QUOTA impossible à tenir quand tout le texte
  vient du conte. Corrigée en jauge explicite.
