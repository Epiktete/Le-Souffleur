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
   moyen de jouer un conte à 4 ans est de lui ôter ce qu'il raconte (un soldat de
   plomb qui ne fond pas), on ne l'adoucit pas : on relève l'âge minimum de sa
   fiche. *Le Soldat de plomb* est ainsi passé à 7-10 ans (décision de Nicolas,
   2026-09-26).

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
| `mal-vieilli` — caricature d'un peuple, sexisme, moquerie d'une infirmité | retiré, ou retourné | idem | idem | idem | 10 |

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

**Deux cas tranchés sur l'échantillon** (Nicolas, 2026-09-26) :
- **Le petit pain mangé à la fin d'un conte de randonnée n'est pas un « gentil tué
  pour de bon ».** Kolobok, le Bonhomme de pain d'épice : un pain avalé d'un
  « ham ! », c'est la chute d'un conte de tout-petits, pas une mort qu'on pleure.
  Aucun moment, et le conte garde son âge.
- **Un parent qui bat un enfant innocent se traite comme un abandon** (*La Table,
  l'Âne et le Bâton*) : jusqu'à 4 ans, le parent gronde au lieu de battre ;
  ensuite, le conte tel qu'il est écrit.

**Hors scène** veut dire que la chose arrive derrière le castelet ou entre deux
scènes, et qu'on la sait par une phrase : « Le loup avala la mère-grand d'une
bouchée. » Elle n'est ni montrée ni détaillée.

**Les petits reçoivent une note de jeu, pas un texte changé.** Pour 3 à 6 ans,
l'application ajoute d'elle-même une note au parent en tête du script : grosse voix
oui, cri soudain non ; aucun personnage qui se change en menace sous leurs yeux (la
citrouille qui devient carrosse, elle, se joue à vue) ; dire avant de commencer
que l'histoire finit bien. Il n'y a rien à écrire pour cela dans une fiche.

## La langue

La plupart des textes de `wiki/fr/` sont nos propres traductions, déjà en français
d'aujourd'hui. Le travail de langue se concentre sur Perrault, La Fontaine et les
pièces de Guignol.

La langue se règle **par tranche d'âge**, comme le fond. Chaque nature de
retouche a son âge plafond : au-delà, le texte du conte reste tel qu'il est
écrit. Le vérificateur le fait respecter. On ne peut donc pas remplacer un mot
rare pour un enfant de 7 ans : c'est à cet âge-là qu'il apprend des mots en
écoutant des histoires.

| Nature | Jusqu'à | Ce qui gêne | Ce qu'on fait |
| --- | --- | --- | --- |
| `mot-disparu` | toujours | seyait, huis, heurter (frapper à la porte) | le mot d'aujourd'hui |
| `faux-ami` | toujours | ennui (tourment), étonné (frappé de stupeur), gentil (noble), incontinent (aussitôt) | le mot d'aujourd'hui ; c'est le plus urgent, car l'enfant croit comprendre |
| `tournure` | toujours | « à cause qu'elle », « je veux l'aller voir », « je m'y en vais », un subjonctif imparfait dans une réplique | la tournure d'aujourd'hui, en gardant les mots |
| `connecteur` | 8 ans | dans une réplique, un connecteur rare d'opposition ou de temps : « or », « cependant », « néanmoins », « tandis que » | « mais », « pendant que » |
| `pronom` | 6 ans | un « il » ou un « elle » loin de son nom, ou qui pourrait désigner deux personnages | on redit le nom |
| `relative` | 6 ans | une relative enchâssée : « le loup que la fille avait vu près du moulin courut… » | deux propositions |
| `ordre` | 6 ans | des faits racontés dans le désordre : « avant de partir, il avait… » | dans l'ordre où ils arrivent |
| `mot-rare` | 6 ans | un mot rare que la scène n'éclaire pas | le mot courant, ou quelques mots d'explication en passant quand le mot compte pour l'histoire |
| `parler` | 4 ans | dans une réplique, une tournure qui ne se dit qu'à l'écrit : interrogation inversée (« Demeure-t-elle bien loin ? »), passé simple, négation sans « pas » (« il n'osa ») | la tournure parlée : « Elle habite bien loin ? » |

**Choisir l'âge d'un mot rare.** Il vaut jusqu'à 4 ans s'il dépasse le vocabulaire
d'un enfant de maternelle, et jusqu'à 6 ans s'il reste opaque à un enfant de CP.
Les livres pour les tout-petits contiennent deux fois moins de mots rares que les
livres pour enfants : c'est le seul endroit où l'on en retire vraiment.

**Tout ce qui s'entend.** Les enfants entendent les répliques, et aussi la
narration que dit le conteur (CDC §6, « Le conteur et les trois voies de la
parole », 2026-09-26). Les retouches par âge portent donc sur les paroles des
personnages comme sur la narration. Une seule exception : `parler` ne vaut que
pour les répliques. Le conteur garde la langue du récit, passé simple compris :
c'est celle de toutes les histoires qu'on lit aux enfants.

**Une retouche est la plus petite possible.**
- On change le mot ou le bout de phrase qui gêne, et le reste de la phrase ne
  bouge pas.
- On n'ajoute rien : ni diminutif, ni « petit », ni exclamation, ni onomatopée,
  ni phrase d'explication. La seule exception est l'explication de quelques mots
  d'un `mot-rare`.

**Jamais retouché** :
- un mot rare que la scène éclaire, et tout mot rare à partir de 7 ans (dévorer,
  chaumière, festin, rusé, aussitôt, galette) ;
- une formule rituelle, même ancienne : « Tire la chevillette, la bobinette
  cherra ». L'action en donne le sens (la porte s'ouvre), et Perrault la voulait
  déjà vieillie ;
- la longueur d'une phrase en elle-même ;
- le rythme, les répétitions, le passé simple du récit ;
- les vers d'une fable : leur musique fait partie du conte. Un mot à la rime ne se
  remplace que s'il empêche de comprendre, et jamais pour 7 ans et plus ;
- le parler de Guignol, qui est son personnage. On n'y retouche que ce qu'un
  enfant ne peut pas comprendre, et on lui laisse son accent.

**La question à se poser**, pour chaque retouche de langue : « Un enfant de cet âge
qui entend cette réplique jouée par une marionnette comprend-il qui fait quoi, et
pourquoi ? » Si oui, on ne touche à rien.

**Les plafonds provisoires.** La part des mots changés pour la langue est
signalée au-dessus de 15 % à 3 ans, 10 % à 6 ans et 5 % à 9 ans. Ces chiffres
seront fixés d'après l'échantillon. Un conte au-dessus n'est pas faux, mais il
faut relire ses retouches une à une.

## Le format d'une fiche

```json
{
  "id": "fr-perrault-chaperon-rouge",
  "langue": [
    {"avant": "lui seyait si bien", "apres": "lui allait si bien", "nature": "mot-disparu"},
    {"avant": "à cause qu'elle se trouvait un peu mal", "apres": "parce qu'elle se trouvait un peu mal", "nature": "tournure"},
    {"avant": "Demeure-t-elle bien loin ?", "apres": "Elle habite bien loin ?", "nature": "parler", "jusqua": 4}
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
| `nature` | un mot de la liste ci-dessus |
| `jusqua` | l'âge jusqu'auquel la retouche s'applique, au plus le plafond de sa nature ; absent pour les natures qui valent toujours |
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

**Elle ne décrit jamais un événement qui n'existe qu'à certains âges.** Elle vaut
pour tous les âges, et le modèle la lit comme l'histoire. Au relais, la phrase
« Quand la fillette crie pour appeler les bûcherons, le public crie avec elle »,
vraie seulement jusqu'à 4 ans, a suffi pour qu'à 9 ans le modèle remplace la fin
de Perrault par le sauvetage.

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
