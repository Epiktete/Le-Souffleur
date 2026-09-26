# Adapter un conte à l'âge : le guide des retouches

Ce guide sert à écrire les fiches `wiki/retouches/<id>.json`. Une fiche dit, pour
un conte, ce qui change dans son texte selon l'âge du public. L'application
l'applique d'elle-même au texte de `wiki/fr/<id>.md`, sans IA. Le modèle qui écrit
ensuite le spectacle reçoit un texte déjà à la mesure de l'âge, et ne l'adoucit
plus (CDC §6, « Les retouches selon l'âge »).

Les fiches sont préparées **hors ligne**, par Claude dans l'environnement de
développement, jamais par un appel OpenRouter. Nicolas en relit un échantillon.

## Trois idées avant tout

1. **Retirer le détail, pas l'événement.** Ce qui fait du mal à un enfant, c'est
   le détail complaisant, la violence impunie, la souffrance prolongée d'un
   personnage qu'il aime. Que le loup mange, que le méchant soit puni, que Guignol
   rosse le gendarme, ce n'est pas un danger : c'est le conte.
2. **Moderniser, pas appauvrir.** À l'oral, un enfant comprend bien plus qu'il ne
   lit, et c'est en entendant des mots rares qu'il les apprend. On ne remplace que
   ce qu'il ne peut pas comprendre.
3. **Un adoucissement qui retourne le sens du conte ne se fait pas.** Si le seul
   moyen de jouer un conte à 4 ans est de lui ôter ce qu'il raconte (Kolobok qui
   n'est pas mangé, un soldat de plomb qui ne fond pas), on ne l'adoucit pas : on
   relève l'âge minimum de sa fiche.

## La grille du fond

Un **moment** est un passage du conte qui pourrait changer selon l'âge. Il a un
**type**, pris dans la liste ci-dessous, et des **niveaux** : chaque niveau dit ce
que devient le moment jusqu'à un certain âge. Au-dessus du dernier niveau, le
conte reste tel qu'il est écrit.

| Type | 3-4 ans | 5-6 ans | 7-8 ans | 9-10 ans | Âge limite le plus haut |
| --- | --- | --- | --- | --- | --- |
| `menace` — le méchant menace de manger, de tuer | gardée | gardée | gardée | gardée | aucun niveau |
| `coups` — coups burlesques sur le méchant, chute | gardés | gardés | gardés | gardés | aucun niveau |
| `ruse` — mensonge, vol du rusé ; méchant ridiculisé | gardés | gardés | gardés | gardés | aucun niveau |
| `alcool` — vin, ivresse | vin gardé ; l'ivresse devient une somnolence | gardés | gardés | gardés | 4 |
| `devoration-delivree` — un gentil avalé, que le conte délivre | avalé hors scène, délivré dans la même scène | idem | comme le conte, sans détail | comme le conte | 6 |
| `mort-gentil` — un gentil tué pour de bon | il en réchappe de justesse | la mort devient réversible | réversible, ou gardée hors scène si c'est le sens du conte | gardée, hors scène, sans détail | 8 |
| `punition` — le méchant puni ou tué | puni sans mourir, tout de suite et sous nos yeux ; la victime retrouve son bien | mort possible, dite en une phrase, hors scène | comme le conte | comme le conte | 6 |
| `abandon` — des parents abandonnent leurs enfants | perdus en forêt | gardé comme le conte le porte (misère, marâtre, père à contrecœur) | comme le conte | comme le conte | 4 |
| `cruaute` — mutilation, torture, détail sanglant | retiré | retiré | le fait en une phrase, si l'histoire en a besoin | idem | 10 |
| `sexualite` — sous-entendu sexuel, morale galante | retiré | retiré | retiré | retiré | 10 |
| `mal-vieilli` — caricature d'un peuple, sexisme, moquerie d'une infirmité | retourné | retourné | retourné | retourné | 10 |

**L'âge limite le plus haut** est un garde-fou contre l'excès de prudence.
`tools/verifier-retouches.mjs` signale un moment dont un niveau dépasse cette
limite, et aussi un moment de type `menace`, `coups` ou `ruse` qui aurait un
niveau. Il reste possible de passer outre, mais la raison doit être écrite dans le
champ `pourquoi` du moment.

**Le niveau le plus bas vaut pour tous les âges au-dessous**, jusqu'à 3 ans. Le
choix des contes peut proposer un conte jusqu'à 3 ans sous l'âge minimum de sa
fiche, quand il manque de candidats. Le premier niveau d'un moment doit donc
convenir au plus jeune public possible, max(3, âge minimum − 3) : pour un conte
`age: [7, 10]`, c'est un enfant de 4 ans. Un moment dont aucun niveau n'atteint
cet âge ne serait jamais appliqué, et le vérificateur le signale.

**Hors scène** veut dire que la chose arrive derrière le castelet ou entre deux
scènes, et qu'on la sait par une phrase : « Le loup avala la mère-grand d'une
bouchée. » Elle n'est ni montrée ni détaillée.

**Les petits reçoivent une note de jeu, pas un texte changé.** Pour 3 à 6 ans,
l'application ajoute d'elle-même une note au parent en tête du script : grosse voix
oui, cri soudain non ; aucune transformation à vue ; dire avant de commencer que
l'histoire finit bien. Il n'y a rien à écrire pour cela dans une fiche.

## La langue

Les enfants n'entendent que les **répliques** : la narration devient des
didascalies, que seul le parent lit. Les retouches de langue portent donc d'abord
sur ce que disent les personnages.

La plupart des textes de `wiki/fr/` sont nos propres traductions, déjà en français
d'aujourd'hui. Le travail de langue se concentre sur Perrault, La Fontaine et les
pièces de Guignol.

**Toujours retouché** (retouche sans âge limite, qui vaut jusqu'à 10 ans) :

| Nature | Exemples | Ce qu'on fait |
| --- | --- | --- |
| `mot-disparu` | seyait, huis, heurter (frapper à la porte) | le mot d'aujourd'hui |
| `faux-ami` | ennui (tourment), étonné (frappé de stupeur), gentil (noble), incontinent (aussitôt) | le mot d'aujourd'hui ; c'est le plus urgent, car l'enfant croit comprendre |
| `tournure` | « à cause qu'elle », « je veux l'aller voir », « je m'y en vais », un subjonctif imparfait dans une réplique | la tournure d'aujourd'hui, en gardant les mots |

**Retouché selon l'âge** (en général jusqu'à 4 ou 6 ans) :

| Nature | Ce qu'on fait |
| --- | --- |
| `pronom` | un « il » ou un « elle » loin de son nom, ou qui pourrait désigner deux personnages : on redit le nom |
| `relative` | une relative enchâssée (« le loup que la fille avait vu près du moulin courut… ») devient deux propositions |
| `mot-cle` | un mot rare dont dépend l'intrigue et que la scène n'éclaire pas : on l'explique en passant, plus rarement on le remplace |

**Jamais retouché** :
- un mot rare mais vivant (dévorer, chaumière, festin, rusé, aussitôt, galette) ;
- une formule rituelle, même ancienne : « Tire la chevillette, la bobinette
  cherra ». L'action en donne le sens (la porte s'ouvre), et Perrault la voulait
  déjà vieillie ;
- la longueur d'une phrase en elle-même ;
- le rythme, les répétitions, le passé simple du récit ;
- le parler de Guignol, qui est son personnage. On n'y retouche que ce qu'un
  enfant ne peut pas comprendre, et on lui laisse son accent.

**La question à se poser**, pour chaque retouche de langue : « Un enfant de cet âge
qui entend cette réplique jouée par une marionnette comprend-il qui fait quoi, et
pourquoi ? » Si oui, on ne touche à rien.

## Le format d'une fiche

```json
{
  "id": "fr-perrault-chaperon-rouge",
  "langue": [
    {"avant": "lui seyait si bien", "apres": "lui allait si bien", "nature": "mot-disparu"},
    {"avant": "à cause qu'elle se trouvait un peu mal", "apres": "parce qu'elle se trouvait un peu mal", "nature": "tournure"},
    {"avant": "…", "apres": "…", "nature": "pronom", "jusqua": 4}
  ],
  "moments": [
    {
      "id": "mere-grand-devoree",
      "type": "devoration-delivree",
      "niveaux": [
        {
          "jusqua": 4,
          "annonce": "La mère-grand se cache dans l'armoire.",
          "retouches": [
            {"avant": "Il se jeta sur la bonne femme, et la dévora en moins de rien", "apres": "…"},
            {"avant": "…", "apres": "…"}
          ]
        }
      ]
    }
  ]
}
```

**Les champs d'une retouche de langue.**

| Champ | Contenu |
| --- | --- |
| `avant` | un extrait du texte de `wiki/fr/<id>.md`, recopié tel quel |
| `apres` | ce qui le remplace |
| `nature` | un mot de la liste ci-dessus : `mot-disparu`, `faux-ami`, `tournure`, `pronom`, `relative` ou `mot-cle` |
| `jusqua` | facultatif, l'âge jusqu'auquel la retouche s'applique ; absent, elle vaut toujours |
| `partout` | facultatif : la retouche s'applique à chaque occurrence, en mot entier et en gardant la majuscule. C'est pour les refrains et les mots qui reviennent. Sans lui, l'extrait doit être unique dans le texte. |

**Les champs d'un moment de fond.**

| Champ | Contenu |
| --- | --- |
| `id` | un nom court, en minuscules et tirets |
| `type` | un type de la grille |
| `niveaux` | du plus bas au plus haut |
| `pourquoi` | facultatif ; obligatoire seulement pour passer outre la grille |

**Les champs d'un niveau.**

| Champ | Contenu |
| --- | --- |
| `jusqua` | l'âge limite ; les `jusqua` d'un même moment sont croissants et tous différents |
| `annonce` | une phrase pour le parent, sur ce qui change dans l'histoire, au passé ou au présent, avec les noms des personnages du conte |
| `retouches` | tous les passages que ce niveau change, **y compris les conséquences plus loin dans le conte** : si la mère-grand est cachée, elle ne sort pas du ventre du loup à la fin, elle sort de l'armoire |

**Comment l'application choisit.**
- **Pour chaque moment**, elle prend le niveau qui a la plus petite `jusqua`
  restant supérieure ou égale à l'âge du public. Si l'âge dépasse toutes les
  `jusqua`, le moment reste tel que le conte l'écrit.
- **Le texte `apres` d'un niveau de fond est écrit en français d'aujourd'hui.**
  Les retouches de langue qui tombent à l'intérieur d'un passage retouché sont
  alors ignorées. Au-dessus du dernier niveau, le passage est l'original, et les
  retouches de langue s'y appliquent normalement.
- **Deux retouches ne se chevauchent jamais à moitié.** Une retouche de langue est
  soit entièrement dans un passage de fond, soit entièrement dehors.

**Retrouver un extrait.** L'application ne tient pas compte de la forme de
l'apostrophe (’ ou '), des espaces multiples ni des retours à la ligne. Un extrait
de fond doit être trouvé exactement une fois. Sinon, il faut l'allonger jusqu'à
ce qu'il soit unique.

## La section « À jouer » des fiches

La section « À adapter » des fiches de `wiki/fiches/` devient « À jouer » quand le
conte reçoit sa fiche de retouches.

**Elle garde :**
- les idées de mise en scène ;
- ce que le public peut crier, compter, répéter ;
- les conseils de durée (« garder deux évasions sur trois ») ;
- les parentés avec d'autres contes.

**Elle perd** tout ce qui change l'histoire (« remplacer… par… », « supprimer… ») :
c'est désormais le travail de la fiche de retouches, âge par âge.

## Avant de valider une fiche

1. `node tools/verifier-retouches.mjs` passe sans erreur. Ses avertissements sont
   lus un par un.
2. `node tools/verifier-retouches.mjs --rendre <id>` affiche chaque version
   distincte du conte. On les relit en entier, pour vérifier deux choses :
   - chaque version se tient ;
   - aucune conséquence d'un moment n'a été oubliée plus loin dans le texte.
3. On compare la part du texte retouchée à celle des autres contes de même
   origine. Un chiffre très au-dessus veut presque toujours dire qu'on en fait trop.

## Sources

Réunies le 2026-09-26 ; celles marquées « secondaire » n'ont été lues qu'à travers
une autre source.

**La peur, la mort, la justice.**
- **Cantor**, « Fear and the Media ». Les 3-5 ans ont peur de ce qui a l'air
  effrayant, et « ce n'est pas vrai » ne les rassure pas ; les 8-12 ans craignent
  les menaces réalistes.
  https://www.encyclopedia.com/media/encyclopedias-almanacs-transcripts-and-maps/fear-and-media
- **Cantor, Wilson et al. 1983.** Une transformation fait le plus peur aux 3-5 ans.
  https://eric.ed.gov/?id=ED236737
- **Hoffner & Cantor 1990.** Savoir que ça finit bien réduit la peur
  d'anticipation. https://eric.ed.gov/?id=EJ404956
- **Speece & Brent 1984 ; Slaughter & Lyons 2003.** Le caractère définitif de la
  mort est compris entre 5 et 7 ans. https://eric.ed.gov/?id=EJ308874 ;
  https://pubmed.ncbi.nlm.nih.gov/12646154/
- **Hamlin et al. 2011 ; Kenward & Dahl 2011 ; McAuliffe, Jordan & Warneken
  2015.** Dès la petite enfance, l'enfant approuve qu'on sanctionne la
  marionnette méchante. https://pubmed.ncbi.nlm.nih.gov/21604863/ ;
  https://pubmed.ncbi.nlm.nih.gov/25460374/
- **Aidman 1997, synthèse de la National Television Violence Study.** La violence
  impunie et la violence tournée en rigolade sont des éléments à risque ; voir le
  coupable puni réduit la peur. https://files.eric.ed.gov/fulltext/ED414078.pdf

**L'école, la loi, le théâtre.**
- **Eduscol**, sélection de maternelle 2020 : *Le Petit Chaperon rouge* de
  Perrault, texte original.
  https://eduscol.education.gouv.fr/sites/default/files/document/lecture-cycle-1-liste-de-reference-2020-pdf-74148.pdf
- **Eduscol**, liste du cycle 3 2018 : Perrault dans le texte, *La Petite Fille aux
  allumettes*, *La Chèvre de M. Seguin*.
  https://eduscol.education.gouv.fr/sites/default/files/document/lecture-cycle-3-liste-de-reference-2018-pdf-74166.pdf
- **Loi n° 49-956 du 16 juillet 1949**, article 2 dans sa version en vigueur :
  proscrit l'incitation à la violence, pas sa représentation.
  https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000878175/
- ***Guignol et le concours de coups de bâton***, joué à la Maison de Guignol de
  Lyon, dès 3 ans. https://www.citizenkid.com/sortie/guignol-et-le-concours-de-coups-de-baton-a1064950

**La langue.**
- **Hayes & Ahrens 1988** (secondaire). Les livres pour enfants contiennent plus de
  mots rares que la conversation adulte.
  https://www.aft.org/sites/default/files/cunningham.pdf
- **Elley 1989**, *Reading Research Quarterly* 24(2). Des enfants de 7-8 ans
  apprennent des mots rien qu'en écoutant une histoire.
- **Davison & Kantor 1982**, *Reading Research Quarterly* 17. Des textes
  simplifiés pour avoir des phrases courtes sont parfois plus difficiles que
  l'original.
- **Megherbi & Ehrlich 2005.** Les enfants de 7-8 ans qui comprennent mal
  rattachent un pronom au dernier nom entendu.
- **Aslanov 2021**, *Malice* n° 12. Les archaïsmes voulus de Perrault ; « cherra »
  était déjà vieilli en 1697.
  https://cielam.univ-amu.fr/malice/articles/archaismes-lexicaux-neologismes-chez-charles-perrault-marie-catherine-daulnoy

**Les modèles.**
- **Rooein et al. 2023.** Donner l'âge du public ne suffit pas à faire varier le
  niveau d'un texte. https://arxiv.org/abs/2312.02065
- **Imperial et al. 2024.** Décrire la norme vaut mieux que nommer le niveau.
  https://arxiv.org/html/2402.12593
- **OpenAI, guide GPT-4.1.** Les modèles récents suivent les consignes « more
  literally » et reprennent mot pour mot les phrases données en exemple.
