# Le même conte à 4, 7 et 9 ans, avant et après les retouches selon l'âge

**Date :** 2026-09-26
**Chantier :** « l'âge » (CDC §6, « Les retouches selon l'âge »)

## La question

Le réglage d'âge change-t-il vraiment le spectacle ? Et le modèle réadoucit-il
un texte déjà adapté ?

## Le dispositif

- **Le conte** : *Le Petit Chaperon rouge* (Perrault), avec la même troupe à chaque
  fois : Rosette, Loup Gris, Mamie Rose.
- **Les réglages** : 5 minutes, 1 marionnettiste.
- **Les âges** : 4, 7 et 9 ans, soit une version par tranche de la fiche de
  retouches (l'armoire, les bûcherons, la fin de Perrault).
- **Les deux chaînes comparées** :
  - « avant » : le commit `5765dce`, où le modèle adoucit lui-même selon l'âge ;
  - « après » : le commit `137a226`, où le texte arrive déjà retouché.
- **Qui joue le modèle** : Sonnet 5, au relais, sans OpenRouter. Chaque étape est
  un agent neuf qui ne lit que les deux fichiers du prompt.
- **Les histoires** sont dans `histoires/`, les données brutes dans
  `banc/relais/casN-avant` et `banc/relais/casN-apres`.

## Les résultats

| Âge | Avant | Après |
| --- | --- | --- |
| 4 ans | Mamie Rose dans l'armoire, le loup s'enfuit. La formule « Tire la chevillette » a disparu. | Mamie Rose dans l'armoire ; les bûcherons chassent le loup à coups de bâton ; on partage la galette. « Elle habite bien loin ? » |
| 7 ans | La même fin qu'à 4 ans ; « heurte » et « huche » restent. | Le loup mange Rosette, s'endort ; secoué, il les rend vivantes ; il détale sous les coups. |
| 9 ans | Encore la même fin, et une consolation inventée : « Il ne reviendra plus ». | La fin de Perrault, hors scène : « un grand bruit, puis plus rien ». |

- **Avant, l'âge ne changeait rien au fond.**
- **Après, il y a trois spectacles distincts, fidèles aux retouches.** La formule
  est gardée partout, et la langue ancienne a disparu.
- **Aucun réadoucissement** : la transposition de 7 ans ne change que les noms, et
  la revue de 9 ans ne signale pas la fin de Perrault.

## Ce que l'expérience a révélé

1. **La narration est perdue.** À 7 ans, les bûcherons ne sont jamais nommés : leur
   phrase est devenue une didascalie muette. Cause : la narration n'avait que deux
   sorties, la réplique ou la didascalie. **Réponse** : le chantier « le conteur »
   (CDC §6), éprouvé dans l'expérience du 2026-09-27.
2. **Les six spectacles sont trop courts** : 3 min 38 à 4 min 22 pour 5 min visées.
   Même cause : seules les répliques comptent dans la durée. Même réponse.
3. **À 9 ans, rien n'annonce au parent la fin de Perrault.** Nicolas a jugé que ce
   n'était pas grave.
4. **Des répliques sentimentales sont encore inventées** (« Merci, ma petite
   Rosette »). Le contrôle 9 du chantier « le conteur » les mesure désormais.
