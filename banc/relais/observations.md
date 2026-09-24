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

## Cas 2, étape 001 — synopsis
- `longueurConte` disait « on le joue, en coupant au plus un épisode » même
  pour un conte PLUS COURT que le spectacle (390 mots pour 500 visés). Le
  modèle devait deviner que la formule ne s'appliquait pas. Corrigé : quatre
  verdicts au lieu de trois.
- Deux contes d'une même saga (Frère Lapin) peuvent être retenus comme
  « trois histoires vraiment différentes » : la lettre est respectée, pas
  l'esprit.

## Cas 2, étape 002 — transposition
- CONFIRMÉ (2e cas) : la contradiction « tu ne coupes rien » / « changements
  annoncés » qui listent des coupes de durée. Corrigé : le prompt dit
  désormais que ces changements sont ceux du spectacle entier et que les
  coupes relèvent du découpage.
- Le résumé du synopsis fait DOUBLON avec le texte intégral à transposer :
  du prompt payé pour rien.

## Cas 2, étape 003 — découpage
- « le nom de l'animal du conte disparaît du texte, y compris titres, résumés
  et formules » s'appliquait AUSSI aux champs d'explication au parent
  (« changements », « note »), qui devenaient allusifs. Corrigé : la règle ne
  porte que sur ce qui se joue, et les mentions génériques sont épargnées —
  c'était aussi le défaut relevé au cas 1 (« on chasse les loups et les ours »).
- Le champ « passage » ne sait pas exprimer un extrait DISCONTINU quand une
  partie interne est coupée.

## Cas 2, étape 004 — découpage REFAIT  ⚠ COÛT
- Le découpage a été rejeté par la simulation et REFAIT : un appel entier
  perdu (≈ 2 700 mots de prompt). Motif : « Petite Souris entre dans la main
  gauche, déjà occupée par Petite Souris » — le modèle la fait entrer alors
  qu'elle était restée en scène à la fin de l'acte précédent.
- Or RIEN dans les contraintes de scène ne disait que la scène se POURSUIT
  d'un acte au suivant. Corrigé : c'est dit, et dit comme une faute.
- Quand le découpage est refusé, le modèle reçoit le SYMPTÔME mais pas son
  propre découpage fautif : il doit deviner ce qu'il avait écrit. Corrigé :
  on lui montre ses entrées et sorties refusées.

## Cas 2, étape 005 — écriture d'un acte
- MON CORRECTIF a créé une ambiguïté : « la main est calculée par
  l'application : ne l'indique pas » se lisait comme portant sur la RÉPONSE,
  alors que le schéma JSON exige « main ». Reformulé.
- Tension permanente entre « reprends le texte mot pour mot » et « une peluche
  n'a pas de doigts » : le modèle doit arbitrer à chaque objet manipulé.

## Cas 2, étape 006 — écriture d'un acte
- CONFIRMÉ : la tension entre « budget de mots » et « répliques mot pour mot »
  revient à chaque acte. Le budget disait « jamais au prix de la fin » ; il dit
  maintenant que la fidélité passe devant et que dépasser vaut mieux que couper.
- Quand le découpage fusionne deux épisodes, rien ne dit comment recoudre deux
  répliques du conte qui ne se suivaient pas.

## Cas 2, étape 007 — écriture d'un acte  ⚠ CAUSE RACINE TROUVÉE
- CONFIRMÉ 3 FOIS : le découpage propose des « moments avec le public » que
  l'écriture juge interdits (« demande aux enfants comment X pourrait se faire
  pardonner »), et en propose plus que la dose autorisée.
- CAUSE : `promptDecoupage` ne recevait JAMAIS `consignesInteraction`. Il
  inventait donc ces moments sans connaître la règle qui les encadre, et
  chaque acte devait ensuite les refuser ou les retordre. Corrigé.

## Cas 2, étape 008 — relecture
- Un titre de section DUPLIQUÉ dans la checklist (« LA PLACE DES DIDASCALIES
  ET DES APARTÉS, en détail : » suivi immédiatement de « La place des
  didascalies et des apartés : »). Supprimé.
- ANGLE MORT : la consigne « le champ ton est prévu, ne le signale pas »
  empêchait le relecteur de signaler un ton qui contredit l'âge du public
  (« je te mange », l'air menaçant, devant des 4 ans). Exception ajoutée.

## Cas 2, étape 009 — correction
- La règle de priorité que j'ai ajoutée FONCTIONNE : le conflit longueur /
  fidélité a été tranché tout seul, sans hésitation.
- Reste un conflit : une modification éditoriale peut faire DÉPASSER la dose
  d'adresses au public. Ajouté : une telle modification s'applique autrement,
  en gardant son intention.

## Cas 2, étape 010 — correction
- La nouvelle règle « une modification qui enfreindrait une règle s'applique
  autrement » FONCTIONNE : l'agent a choisi seul l'option compatible.
- Les interdits de style (points de suspension, maximes) ne disaient pas
  qu'ils portent sur ce que le modèle AJOUTE, pas sur le texte du conte.
  Précisé.

## Cas 3, étape 001 — synopsis
- L'application a distribué MÉMÉ TORTUE dans le rôle du LOUP du Petit
  Chaperon rouge. L'interdit « une petite bête douce ne joue pas un
  prédateur » ne couvrait que la famille « petit » : une tortue est rangée
  dans « eau », une fourmi dans « bestiole ». Étendu — les oiseaux restent
  permis, la famille contient l'aigle et le hibou.
- Rien ne dit comment traiter un rôle qui n'est ni animal ni humain mais une
  force personnifiée (le Soleil, le Nuage, le Mur).
- Les critères de choix sont listés sans ordre de priorité, alors que les
  contes arrivent déjà classés « du plus proche au moins proche ».

## Cas 3, étape 002 — transposition  ⚠ DÉFAUT DE FOND
- « Le Lièvre et le Hérisson » tient dans une ruse : la femme du hérisson lui
  ressemble TRAIT POUR TRAIT, et le lièvre s'y trompe. Le conte donne donc la
  même espèce aux deux rôles. L'application a distribué une TORTUE et un
  PINGOUIN : la ruse s'effondre, et rien ne le disait au modèle.
- Deux correctifs : la note d'espèce baisse quand des rôles jumeaux sont
  tenus par des espèces différentes (le conte recule sans être interdit), et
  surtout un AVERTISSEMENT explicite est envoyé au modèle, qui doit remotiver
  la ressemblance autrement — même chapeau, même cri, obscurité.

## Cas 3, étape 003 — découpage
- MON PROPRE AVERTISSEMENT proposait « l'obscurité » pour remotiver une
  ressemblance, ce qui contredit l'interdit des effets de lumière. Retiré.
- « Le Lièvre et le Hérisson » demande TROIS marionnettes visibles en même
  temps (le coureur et les deux sosies aux deux bouts) : impossible à deux
  mains. La barrière du nombre l'autorise pourtant, avec une simple réduction
  de note. Certains contes ont un besoin SIMULTANÉ que le nombre de rôles ne
  dit pas.

## Cas 3, étape 004 — découpage (2e essai)
- Le schéma des « mouvements » ne montrait qu'un exemple d'ENTREE, jamais de
  SORTIE : le modèle devait deviner si une sortie porte une main. Même famille
  de défaut que l'exemple incomplet de la correction. Corrigé.
- Écart né de mon correctif sur la transposition : les « changements annoncés
  au parent » (l'enjeu devient un gâteau) n'étaient appliqués NULLE PART — la
  transposition les ignore désormais, et rien ne disait au découpage que
  c'était à lui de les appliquer. Corrigé.

## Cas 3, étape 005 — écriture
- Mon correctif fonctionne : l'enjeu « gâteau » est désormais appliqué, et le
  modèle sait qu'il s'écarte du mot-à-mot pour une raison prévue.
- Petite contradiction : le découpage peut annoncer « marionnettes déjà en
  scène » alors que l'état fourni dit « la scène est vide ».

## Cas 3, étape 006 — écriture  ⚠
- L'ordre des entrées/sorties du découpage était traité comme IMPOSÉ : le
  modèle a COUPÉ une réplique du conte parce que le plan faisait sortir le
  personnage qui la disait. C'est exactement ce qu'on veut éviter. Corrigé :
  le plan est un plan, et on ne coupe jamais une réplique pour lui obéir.

## Cas 3, étape 007 — écriture
- Les consignes DEMANDENT « la formule que les enfants peuvent dire avec la
  marionnette », mais aucun des cinq types d'éléments ne l'exprime : ce n'est
  ni une adresse au public (elle est dite à un personnage) ni une simple
  réplique. Le modèle a inventé une combinaison. Elle est maintenant prescrite.

## Cas 3, étape 009 — relecture
- SUCCÈS DU CORRECTIF : le relecteur attrape de lui-même le problème des
  sosies (« Roi Corbeau regarde Pilou en face et l'appelle Mémé Tortue sans
  ressemblance qui l'explique »).
- Rien ne disait quoi faire des « problèmes déjà détectés par l'application »
  montrés au relecteur : les ignorer, les reprendre, ou construire dessus ?
  Précisé — il ne les répète pas.
- Les gravités « important » et « mineur » restent subjectives à la frontière.

## Cas 3, étape 010 — correction  ⚠ CONTRESENS DANS LES CONTRÔLES
- La consigne donnée au modèle dit, pour « quelques moments » : DEUX OU TROIS
  adresses au public DANS TOUT LE SPECTACLE. Le contrôle de l'application en
  exigeait UNE PAR ACTE. Il réclamait donc une adresse de plus alors que le
  spectacle avait déjà son compte — et la correction devait désobéir à l'un ou
  à l'autre. Corrigé : la dose se compte comme elle est annoncée.

## Cas 3, étapes 011 à 013 — corrections  ⚠
- Demander d'ALLONGER un acte dont le passage du conte est de la PURE
  NARRATION oblige à inventer tout le dialogue — l'inverse exact du principe
  de l'outil. La consigne disait « joue plus longuement ce que le conte
  raconte déjà » sans prévoir le cas où il n'y a rien à développer. Ajouté :
  dans ce cas, laisser l'acte court.
- Plusieurs modifications du relecteur offrent deux options (« supprime… ou
  remplace ») sans dire laquelle préférer, alors qu'une consigne voisine
  (allonger) tranche implicitement.

## Cas 4, étape 001 — synopsis
- « Punch et Judy » a été proposé alors que le parent a demandé AUCUNE
  interaction avec le public — or toute la pièce repose sur les cris des
  enfants (« c'est derrière toi ! »). Rien dans l'entonnoir ne sait qu'un
  conte a besoin du public pour exister. (Non corrigé : demanderait une
  donnée nouvelle dans les fiches.)
- « Petit Chat » est classé PRÉDATEUR (le nom l'emporte sur la description
  « chaton roux tout doux »), et peut donc jouer un renard. Défendable, mais
  l'agent l'a jugé « petite bête douce » : la frontière n'est pas évidente.

## Cas 4, étape 002 — relance de l'étape des synopsis  ⚠ COÛT
- APPEL ENTIER PERDU : le schéma limite chaque point de résumé à 220
  caractères, mais le prompt ne le disait NULLE PART. Le modèle a dépassé,
  la réponse a été refusée, et les 3 100 mots du prompt ont été renvoyés.
- Trois autres limites étaient muettes (titre 90, changements 260 et 4 points)
  et une était FAUSSE : le prompt annonçait 120 caractères d'accroche pour un
  schéma qui en accepte 140. Toutes énoncées désormais.

## Cas 4, étape 002 — synopsis  ⚠ LEVIER DE COÛT
- UN MODÈLE NE SAIT PAS COMPTER DES CARACTÈRES. Une limite serrée ne
  raccourcit pas sa réponse : elle la fait refuser, et tout l'appel est à
  refaire. Les bornes du schéma sont donc desserrées (résumé 220→400,
  accroche 140→200, titre 90→120, changements 260→400) et la concision est
  demandée EN PHRASES dans le prompt. Le schéma n'arrête plus que ce qui
  casserait l'affichage.

## Leçon de méthode
- Changer un prompt EN COURS de cas désynchronise le rejeu : les réponses
  enregistrées ne répondent plus aux prompts régénérés. Les cas 4 et 5 sont
  donc joués d'un bloc, sans retouche, pour valider tous les correctifs
  ensemble.

## Cas 4, étape 001 (rejoué) — synopsis  ⚠ À CORRIGER APRÈS LE CAS
- TROISIÈME occurrence : « Petit Chat », décrit « un chaton roux tout doux »,
  est distribué en RENARDE. `especeMarionnette` lit le NOM avant la
  description : « chat » est un prédateur, « chaton » une petite bête douce.
  Le nom l'emporte, donc le chaton devient prédateur et peut jouer un renard.
  L'agent a dû corriger la distribution de lui-même — « un piège caché dans
  les données plutôt que dans la consigne ».
- La légende des crochets n'illustre pas le cas d'une marionnette HUMAINE
  jouant un rôle animal.

## Cas 4, étape 002 — transposition
- SUCCÈS : mon correctif est compris — l'agent garde le texte intégral et
  laisse les coupes au découpage, sans hésiter.
- Le changement de GENRE (la Renarde jouée par Jean le Paysan : elle→il,
  commère→compère, « la première »→« le premier ») est « la retouche la plus
  dense de tout le texte » et rien ne la signale. À ajouter.

## Cas 4, étape 003 — découpage
- CONFIRMÉ (2e fois) : le champ « temps » n'est décrit NULLE PART, alors que
  « passage », « momentsPublic » et « budgetMots » le sont tous. À corriger.
- Rien ne dit si un CHANGEMENT DE TABLEAU oblige à faire sortir tout le monde.
  L'agent a supposé que oui, ce qui est raisonnable mais deviné.

## Cas 4, étape 005 — écriture
- Une PENSÉE INTÉRIEURE du conte (« Vieux Hibou réfléchit, réfléchit : … »)
  peut aller en aparté ou en didascalie : le prompt ne tranche pas.

## Cas 4, étape 008 — relecture
- Le prompt donne TROIS textes (conte d'origine, transposition, script) et
  n'indique pas lequel sert de référence : comparer au mauvais fait croire
  que des personnages ont « disparu sans raison ».
- Le format des remarques n'accepte que des remarques PAR ACTE : un défaut
  récurrent dans tout le script (les didascalies qui finissent par un état —
  « …soulagée », « …tout content ») n'a aucune place où se dire, et le
  relecteur a préféré se taire plutôt que de répéter la même chose cinq fois.

## Cas 4, étape 009 — correction  ⚠ LEVIER DE COÛT
- L'échappatoire « laisse l'acte court » fonctionne, mais l'appel a été
  DÉPENSÉ POUR RIEN : l'acte est revenu inchangé. Quand le seul reproche est
  la durée et qu'il n'y a rien à développer honnêtement, la correction est
  pure perte. À CORRIGER : élargir la tolérance PAR ACTE (±20 % → ±35 %) en
  gardant ±20 % pour le spectacle entier, pour que seuls les vrais écarts
  déclenchent une réécriture.

## Cas 4 terminé — LA CAUSE DE VOTRE PLAINTE D'ORIGINE
- 4 min pour 10 demandées. Le conte fait 909 mots pour 1 000 visés, le ratio
  idéal — MAIS quatre de ses huit rôles n'ont pas de marionnette. Leur texte
  ne se dit pas, et la durée s'effondre.
- `noteDuree` comptait le conte ENTIER. Elle compte désormais ce qui sera
  VRAIMENT JOUÉ : `motsJouables` retire la moitié de la part des rôles non
  tenus (approximation honnête — la narration et les rôles principaux portent
  plus que leur poids).

## Cas 5 — une seule marionnette
- Le prompt prévoit le cas « personnage sans marionnette » mais pas celui où
  c'est le PROTAGONISTE qui n'en a pas. Avec une seule peluche, c'est pourtant
  la règle plutôt que l'exception (CDC §6 : le second rôle se joue à la voix).
- « passage » ne dit pas s'il doit être contigu quand une partie interne est
  coupée (déjà relevé au cas 2).
- CONFIRMÉ : avec UNE seule marionnette, tout un rôle se joue à la voix
  depuis la coulisse — le CDC §6 le prévoit explicitement. Mais le prompt ne
  décrit la « voix en coulisse » que pour un personnage PONCTUELLEMENT hors
  champ. Le modèle a dû déduire qu'un rôle entier passe en
  note_marionnettiste. À CORRIGER après le cas.

## Cas 5, étape 006 — écriture
- L'exemple JSON de l'ÉCRITURE omet « note_marionnettiste » alors que le
  texte parle des « cinq types » — même famille de défaut que l'exemple
  incomplet de la correction, déjà corrigé. À CORRIGER.
- Le découpage a proposé un moment public qui suppose VISIBLE un personnage
  qu'il a lui-même déclaré invisible (« faire crier aux enfants qu'Askeladden
  a un sac caché »). Conséquence du cas à une seule marionnette.

## Cas 5 terminé — LA VOIX EN COULISSE N'ÉTAIT PAS COMPTÉE
- 2 min pour 5 visées. Avec UNE seule marionnette, tout un rôle du conte se
  joue à la voix depuis la coulisse — le CDC §6 le prévoit. Ces répliques
  sont écrites en `note_marionnettiste`, et `dureeElements` ne comptait pas
  les notes, « pas dites à voix haute ». Or celles-là le sont : c'est le
  parent qui prête sa voix. La moitié du spectacle était invisible au calcul.
- Corrigé : `motsDitsEnCoulisse` extrait ce qui suit « en coulisse : » et le
  compte. Le prompt impose désormais cette forme exacte, et dit qu'avec une
  seule marionnette ce n'est pas l'exception mais la règle.
- L'exemple JSON de l'écriture omettait `note_marionnettiste` alors que le
  texte parle des « cinq types » : complété.
