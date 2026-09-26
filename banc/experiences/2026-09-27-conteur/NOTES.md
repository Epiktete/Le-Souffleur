# Le conteur : la narration dite par le parent

**Date :** 2026-09-27, lancée le 2026-09-26 au soir
**Chantier :** « le conteur » (CDC §6, « Le conteur et les trois voies de la parole »)
**État :** en cours

## La question

Quand le parent peut dire la narration du conte, mot pour mot :
- l'histoire se comprend-elle mieux ?
- le spectacle tient-il sa durée ?
- la parole reste-t-elle celle du conte ?

## Le dispositif

- **Chaîne** : le commit `980f1ef` et ses fiches (`f529345`). Elle a trois voies
  de parole (la réplique, le discours rendu direct, le conteur) et le contrôle 9,
  qui vérifie que la parole vient du conte.
- **Qui joue le modèle** : Sonnet 5, au relais, sans OpenRouter.
- **Les cas joués** :

  | Conte | Âges | Durée | Données brutes |
  | --- | --- | --- | --- |
  | *Le Petit Chaperon rouge* | 4, 7 et 9 ans | 5 min | `banc/relais/cas7-conteur`, `cas8-conteur`, `cas9-conteur` |
  | *L'Intrépide Soldat de plomb*, le conte le plus narratif de l'échantillon | 7 ans | 8 min | `banc/relais/cas10-conteur` |

- **Comparaison** : avec l'expérience du 2026-09-26, cas « après ».
- **Les histoires** seront dans `histoires/`.

## Relevé en cours de route

1. **Une fiche a trompé le modèle, par ma faute.** La section « À jouer » du
   Chaperon disait « Quand la fillette crie pour appeler les bûcherons, le public
   crie avec elle ». C'est vrai jusqu'à 4 ans seulement. À 9 ans, le synopsis en a
   fait la fin du conte, à la place de celle de Perrault. La phrase est retirée, le
   guide interdit désormais d'écrire dans « À jouer » un événement propre à un âge,
   et le cas de 9 ans a été rejoué depuis le début.
2. **Le contrôle 9 attrape une vraie paraphrase.** À 7 ans, le conteur a dit « Un
   jour, sa mère, qui venait de cuire des galettes, dit à Rosette… », qui n'est pas
   le texte : l'acte est renvoyé en correction.
3. **Le contrôle 9 donne aussi un faux positif.** À 4 ans, le conteur a bien dit le
   texte, mais sans les guillemets « » de la parole de la mère. Il faut que la
   vérification ignore guillemets et tirets ; ce sera corrigé après l'expérience,
   pour ne pas fausser le rejeu.
