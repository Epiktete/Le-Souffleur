# L'écriture des actes en parallèle, et la référence complète

**Date :** 2026-09-27
**Chantier :** revue d'architecture (commits f79e596 → 185a569)
**État :** terminée

## La question

Quand les actes s'écrivent tous en même temps (leur couture étant le texte
transposé), et que la revue ne reçoit plus que la transposition :
- les transitions d'un acte à l'autre tiennent-elles ?
- le script vaut-il celui de la chaîne séquentielle ?

## Le dispositif

Le Chaperon à 7 ans, 5 min (le cas 8), rejoué de zéro sur la chaîne des
commits ci-dessus, Sonnet 5 au relais : `banc/relais/cas8-parallele`.
Comparaison : `cas8-conteur` (chaîne séquentielle du chantier « le conteur »).

## Les résultats

| | cas8-conteur (séquentiel) | cas8-parallele |
| --- | --- | --- |
| Étapes (appels) | 12 | **9** |
| Appels d'actes | 3, l'un après l'autre | 3, **tous en même temps** |
| Durée estimée | 5:14 pour 5:00 | 6:30 pour 5:00 (+30 %) |
| Part du conteur | 47 % | 55 % |
| Mots hors du conte | 3 % | 3 % |
| Problèmes restants | 1 (contrôle 9 non résolu) | 1 (durée globale, avertissement) |

**Les transitions tiennent.** Aucun conflit de mains, aucune phrase dite en
double aux coutures (contrôle 10 muet), Loup Gris reste en scène de l'acte 2
à l'acte 3 sans ré-entrer. Un seul chevauchement doux : la flânerie de
Rosette, montrée en fin d'acte 1, est redite par le conteur au début de
l'acte 2 — un raccord de reprise plus qu'un défaut.

**Quatre défauts du cas séquentiel ont disparu :**
1. les bûcherons sont annoncés à l'acte 1 (« il n'osa, à cause de quelques
   bûcherons ») avant d'être nommés à l'acte 3 ;
2. « Loup Gris tira la chevillette, et la porte s'ouvrit » est dit ;
3. l'hésitation de Rosette (« eut peur d'abord, mais, croyant que… ») est
   dite ;
4. le sauvetage est dans l'ordre : ronflement → les bûcherons entrent →
   secoué → recraché → chassé à coups de bâton (au séquentiel, les coups
   s'entendaient avant d'être annoncés).

**La relecture cite désormais le texte mot pour mot** dans ses modifications
(consigne renforcée) : les trois corrections demandées étaient des passages
exacts du texte transposé, et aucune n'a été rejetée par le contrôle 9.

## Ce qui reste à surveiller

- La durée penche maintenant vers le TROP LONG (+30 %) : l'acte court est
  complété par le directeur, mais rien ne resserre un spectacle entier un peu
  long — c'est un avertissement, le parent coupe s'il veut.
- La fin est sèche : les entrées finales de Mamie Rose et Rosette, bien
  vivantes, ne sont suivies d'aucune didascalie de retrouvailles — rien
  d'inventé, donc rien d'écrit. Une idée de mise en scène de la fiche
  (« À jouer ») pourrait guider le parent ici.
- Deux éléments conteur consécutifs qui se suivent dans la même phrase
  (« …la dévora en moins de rien, » / « car il y avait plus de trois
  jours… ») gagneraient à être fusionnés à l'affichage.
