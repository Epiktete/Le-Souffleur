# Le conteur : la narration dite par le parent

**Date :** 2026-09-27, lancée le 2026-09-26 au soir
**Chantier :** « le conteur » (CDC §6, « Le conteur et les trois voies de la parole »)
**État :** terminée

## La question

Quand le parent peut dire la narration du conte, mot pour mot :
- l'histoire se comprend-elle mieux ?
- le spectacle tient-il sa durée ?
- la parole reste-t-elle celle du conte ?

## Le dispositif

- **Chaîne** : le commit `980f1ef` et ses fiches (`f529345`). Elle a trois voies
  de parole (la réplique, le discours rendu direct, le conteur) et le contrôle 9,
  qui vérifie que la parole vient du conte.
- **Qui joue le modèle** : Sonnet 5, au relais, sans OpenRouter. Chaque étape est
  un agent neuf qui ne lit que les deux fichiers du prompt.
- **Les cas joués** :

  | Conte | Âges | Durée visée | Données brutes |
  | --- | --- | --- | --- |
  | *Le Petit Chaperon rouge* | 4, 7 et 9 ans | 5 min | `banc/relais/cas7-conteur`, `cas8-conteur`, `cas9-conteur` |
  | *L'Intrépide Soldat de plomb*, le conte le plus narratif de l'échantillon | 7 ans | 8 min | `banc/relais/cas10-conteur` |

- **Les histoires** sont dans `histoires/`.
- **Comparaison** : avec l'expérience du 2026-09-26, cas « avant » et « après ».

## Les résultats

| Spectacle | Durée | Mots dits | Part du conteur | Mots hors du conte |
| --- | --- | --- | --- | --- |
| Chaperon, avant les retouches (2026-09-26) | 3:43 à 4:22 pour 5:00 | 280 à 300 | 0 % | 5 à 8 % |
| Chaperon, après les retouches (2026-09-26) | 3:38 à 3:55 pour 5:00 | 236 à 302 | 0 % | 2 à 4 % |
| **Chaperon, conteur, 4 ans** | **4:36** pour 5:00 | 382 | 35 % | 1 % |
| **Chaperon, conteur, 7 ans** | **5:14** pour 5:00 | 476 | 47 % | 3 % |
| **Chaperon, conteur, 9 ans** | **4:06** pour 5:00 | 379 | 39 % | 0 % |
| **Soldat de plomb, conteur, 7 ans** | **14:28** pour 8:00 | 1 474 | **96 %** | 0 % |

**Ce qui marche**
- **Ce que la narration dit s'entend.** À 7 ans, le conteur dit : « Les
  bûcherons, qui passaient devant la maison, l'entendirent ronfler. » On sait
  enfin qui sauve Rosette.
- **Le Chaperon tient sa durée** pour la première fois : de 4:06 à 5:14 pour
  5:00, contre 3:38 à 4:22 auparavant.
- **La parole reste celle du conte** : de 0 à 3 % de mots dits absents du texte.
- **Le contrôle 9 attrape une paraphrase, et la correction la répare.** À 7 ans,
  le conteur avait dit « Un jour, sa mère, qui venait de cuire des galettes, dit à
  Rosette… ». Après correction, c'est la phrase exacte de Perrault.
- **La revue applique la règle « montré ou dit, jamais les deux »** : elle signale
  deux passages où le conteur redisait une action déjà montrée.
- **La fin de Perrault à 9 ans est sobre** : le loup se jette sur Rosette, le
  conteur dit « Il la mangea. », Rosette sort.

**Ce qui ne marche pas encore**
1. **La dose du conteur.** Il dit de 35 à 47 % du Chaperon, et 96 % du Soldat.
   Dans le Soldat, les actes 3 et 4 n'ont plus une seule réplique : le parent lit
   le conte pendant que les marionnettes sortent et entrent. Même dans le
   Chaperon de 7 ans, le sauvetage est presque entièrement raconté.
2. **Un conte narratif et long ne se coupe plus.**
   - Le Soldat dure 14:28 pour 8:00. Le découpage prévoyait 800 mots, mais les
     actes ont dit presque toute la narration.
   - Le message « acte trop long » demande de resserrer « ce qui ne vient pas du
     conte » : or tout en vient désormais.
   - Une correction a même rétabli l'épisode du rat, que le découpage avait coupé
     pour tenir la durée.

## Corrigé à la suite de l'expérience

1. **Une section « À jouer » décrivait un événement propre à un âge.** La fiche du
   Chaperon disait « Quand la fillette crie pour appeler les bûcherons, le public
   crie avec elle », vrai jusqu'à 4 ans seulement. À 9 ans, le synopsis en a fait
   la fin, à la place de celle de Perrault. La phrase est retirée, le guide
   l'interdit, et le cas de 9 ans a été rejoué depuis le début.
2. **Les guillemets donnaient un faux positif.** À 4 ans, le conteur disait bien
   la phrase de la mère, mais sans les guillemets « » du texte. Le contrôle 9
   ignore désormais guillemets et tirets.
3. **Deux règles se contredisaient** : « des phrases entières » et « ne jamais
   redire une action montrée ». Le conteur dit maintenant un passage continu du
   texte, qui peut être une fin de phrase : « Il la mangea. »
4. **Le seuil des mots inventés** passe de 25 % à 10 %. Les dix spectacles mesurés
   vont de 0 à 8 %.
5. **La banque transformait les identifiants.** Une peluche nommée « Soldat »
   aurait changé `dk-soldat-de-plomb` en `dk-{{r1}}-de-plomb`. Les identifiants
   et le titre du conte ne sont plus touchés. Quand le nom d'une peluche est aussi
   un nom commun du conte (« le soldat »), la banque refuse le spectacle : mieux
   vaut un refus clair qu'un remplacement faux.
6. **Le relais ne verse plus dans la banque sans qu'on le demande**
   (`RELAIS_BANQUE=1`). La banque ne sait pas encore l'âge, et un spectacle de
   9 ans ne doit pas être servi à 4.

## À décider

Les deux défauts restants (la dose du conteur, et la coupe des contes longs) ont
une même cause : **rien ne décide combien le conteur dit**. Une piste de
structure : le découpage fixe, acte par acte, ce que dira le conteur, et ses
coupes s'imposent à la revue et aux corrections. Le contrôle 9 vérifie ensuite
un plafond de la part du conteur. Voir le compte rendu à Nicolas du 2026-09-27.
