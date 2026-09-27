# Les actes courts comptés en mots, complétés par le directeur éditorial

**Date :** 2026-09-27
**Chantier :** « le conteur », étape E (CDC §6, « Budget de durée »)
**État :** terminée

## La question

Le Chaperon du relais « conteur » paraissait court à Nicolas. Les actes disaient
de 10 à 30 % de mots de moins que le découpage ne leur en prévoyait, et rien ne
le relevait.

Si l'application compte les mots de chaque acte et donne l'écart au directeur
éditorial, celui-ci complète-t-il avec le conte, sans inventer ?

## Le dispositif

- **Chaîne** : le compte des mots par acte avant la revue, avec un seuil à 80 %
  du budget. Le contrôle de durée ne désigne plus que les actes trop longs.
- **Cas joués** : le Chaperon à 4 ans et à 9 ans, les deux cas du relais
  « conteur » qui avaient des actes sous le seuil. À 7 ans, aucun acte n'était
  sous le seuil.
- **Étapes reprises** : les étapes 1 à 6 (synopsis, transposition, découpage,
  écriture des actes) sont celles du relais du même jour
  (`banc/relais/cas7-conteur`, `cas9-conteur`). Les actes sont donc les mêmes,
  aussi courts.
- **Étapes rejouées** : la revue et les corrections, par Sonnet 5 au relais,
  sans OpenRouter. Les données brutes sont dans `banc/relais/cas7-longueur` et
  `cas9-longueur`.
- **Les histoires** sont dans `histoires/`.

## Les résultats

| Spectacle | Durée pour 5:00 | Mots dits | Part du conteur | Mots hors du conte | Appels |
| --- | --- | --- | --- | --- | --- |
| Chaperon 4 ans, avant | 4:36 | 382 | 35 % | 1 % | 10 |
| **Chaperon 4 ans, actes courts** | **5:26** | 468 | 47 % | 1 % | **8** |
| Chaperon 9 ans, avant | 4:06 | 379 | 39 % | 0 % | 8 |
| **Chaperon 9 ans, actes courts** | **4:38** | 435 | 47 % | 0 % | **9** |

Les actes courts, mot à mot :

| Acte | Prévus | Écrits | Après la revue et la correction |
| --- | --- | --- | --- |
| 4 ans, acte 3 | 260 | 170 | 219 |
| 9 ans, acte 2 | 150 | 64 | 82 |
| 9 ans, acte 3 | 150 | 115 | 154 |

**Ce qui marche**
- **Le directeur complète avec le conte, mot pour mot.** Les sept phrases
  ajoutées sont toutes de Perrault, dites par le conteur. Par exemple, à 4 ans :
  « Rosette, qui entendit la grosse voix de Loup Gris, eut peur d'abord, mais,
  croyant que sa Mamie Rose était enrhumée, ». Aucune réplique n'est inventée.
- **Ce qu'il ajoute sert l'histoire, pas seulement la durée.** La peur de
  Rosette devant la grosse voix, son étonnement devant « Mamie Rose », le cri
  qui fait venir les bûcherons : trois maillons que l'acte avait perdus.
- **Il n'invente pas pour combler.** À 9 ans, l'acte 2 manquait de 86 mots. Le
  directeur n'y a trouvé qu'une phrase du conte, et il l'a dit : « Aucune
  réplique n'est perdue ; il ne reste que cette narration ». L'acte reste à 82
  mots.
- **Le coût reste du même ordre** : 8 appels au lieu de 10 à 4 ans, 9 au lieu
  de 8 à 9 ans. Aucune étape n'est ajoutée ; un acte complété passe par la
  correction qui existe déjà.
- **Les deux spectacles tiennent la durée** : 5:26 et 4:38 pour 5:00.

**Limites**
- **Un budget peut dépasser ce que le passage contient.** L'acte 2 de 9 ans a
  reçu 150 mots, mais le passage qu'il joue est court, et une bonne part en est
  montrée par les marionnettes plutôt que dite. Le découpage
  répartit les mots entre les actes sans savoir combien chaque passage en porte.
  Ce n'est pas un défaut du compte : le directeur l'a vu et s'est arrêté.
- **La part du conteur monte** (47 % dans les deux cas), puisque la narration est
  ce qui reste à rendre quand les répliques sont déjà là. Nicolas a décidé de ne
  pas la plafonner.
- **Les étapes 1 à 6 ont été écrites avec la chaîne `980f1ef`**, avant les
  calibrages du relais « conteur » (commit `73c74b4`). Pour une mesure de la revue et des
  corrections, cela ne change rien ; pour un spectacle complet, il faudrait
  rejouer depuis le début.
