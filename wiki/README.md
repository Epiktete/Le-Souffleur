# Le répertoire du Souffleur

Un recueil de contes, fables et pièces de marionnettes du domaine public,
venus de toutes les cultures. Le générateur ne part plus de rien : il part
d'une histoire qui a fait ses preuves depuis des siècles, et l'adapte aux
marionnettes de la famille.

## Le principe

1. Le parent choisit ses marionnettes. Chacune a une **espèce** (lapin,
   ours, sorcière…) et des **traits** (rusé, peureux, gourmand…).
2. On compare ce plateau aux fiches : combien de personnages il faut, de
   quelles espèces, avec quels caractères. Les contes qui s'en approchent le
   plus remontent.
3. Le modèle lit les meilleurs, en retient **trois**, et propose au parent
   trois synopsis : chacun adapte un conte à cette distribution, en gardant
   son essence.
4. Le parent choisit, et le script s'écrit à partir du conte choisi.

## Les trois dossiers

| Dossier | Contenu | Qui le lit |
| --- | --- | --- |
| `raw/` | Le texte original, dans sa langue, avec sa source et ses droits en en-tête | Nous, pour vérifier |
| `fr/` | La version française intégrale, traduite par nous depuis l'original | Le modèle, pour adapter le conte retenu |
| `fiches/` | La fiche synthétique : personnages, attributs, essence, trame | Le modèle et l'application, pour choisir |

Un conte porte le même identifiant dans les trois dossiers :
`raw/de-musiciens-de-breme.md`, `fr/de-musiciens-de-breme.md`,
`fiches/de-musiciens-de-breme.md`. Le préfixe dit l'origine (`de-`
Allemagne, `afr-` Afrique, `zh-` Chine, `guignol-` Lyon…).

Les textes originaux se récupèrent avec :

    node tools/telecharger-contes.mjs

La liste des contes et de leurs sources est dans `tools/sources-contes.mjs`.
Après avoir ajouté ou modifié une fiche, on vérifie sa forme avec :

    node tools/verifier-fiches.mjs

## Le format d'une fiche

```yaml
---
id: de-musiciens-de-breme
titre: Les Musiciens de Brême
culture: Allemagne
source: "Jacob et Wilhelm Grimm, Contes de l'enfance et du foyer, 1857 (n° 27)"
genre: conte d'animaux
age: [3, 8]
personnages: 4              # rôles qui comptent : un par marionnette
figurants: 1                # rôles qu'on peut jouer à la voix ou supprimer
roles:
  - nom: l'Âne
    espece: âne
    categorie: animal
    traits: [courageux, gentil]
    fonction: meneur
  - nom: le Coq
    ...
lieux: [la route, la maison des voleurs]
ressorts: [union des faibles, peur par le bruit]
structure: randonnée
---
```

Suivent trois paragraphes courts : **Essence** (une phrase : ce qu'il faut
garder pour que ce soit encore ce conte), **Trame** (cinq points au plus) et
**À adapter** (ce qui ne passe pas devant des enfants de 3 à 10 ans, ou pas
sur un théâtre de salon, et comment le remplacer).

### Les champs qui servent au choix

L'application les lit dans `src/services/repertoire.ts` et les note dans
`src/services/choixContes.ts` : le **nombre** de personnages, puis les
**traits**, l'**ébauche** du parent, la **durée**, et enfin l'**espèce**, qui ne
sert qu'à départager — sauf qu'une petite bête douce ne joue jamais un
prédateur ni un ogre. Le champ `source` est cité au parent sous « D'après » sur la carte du
synopsis.

- **personnages** : le nombre de rôles qui portent l'histoire. Une famille
  qui a trois marionnettes cherche d'abord les contes à trois.
- **categorie** : `animal`, `humain`, `merveilleux` (fée, ogre, dragon,
  esprit) ou `objet` (un pain qui roule, une marmite).
- **espece** : le mot simple qu'on mettrait sur la marionnette (lièvre,
  renard, roi, sorcière). Un lièvre du conte peut être joué par un lapin :
  c'est le rôle qui compte.
- **traits** : pris d'abord dans la liste de la marionnethèque —
  gentil, méchant, coquin, rusé, peureux, courageux, gourmand, grognon,
  rêveur, bavard, maladroit, savant, farceur, timide — puis, si aucun ne
  convient, dans ce complément : vantard, naïf, paresseux, sage, avare,
  orgueilleux, curieux, têtu, travailleur, généreux, jaloux, menteur, fort,
  minuscule.
- **fonction** : ce que fait le rôle dans l'histoire — héros, trompeur,
  dupe, adversaire, aide, juge, meneur, compagnon, victime, donneur.

## Pourquoi les originaux et pas seulement des résumés

Un résumé garde l'intrigue et perd tout le reste : la formule qui revient,
la réplique qui fait rire, le rythme. Ce sont eux qui font qu'un conte se
raconte encore après trois cents ans. Le modèle adapte donc à partir de la
version française intégrale, et la fiche ne sert qu'à le trouver.

## Le domaine public

Chaque texte original porte en en-tête la raison pour laquelle il est libre :
auteur, collecteur ou traducteur mort depuis plus de soixante-dix ans, ou
texte anonyme ancien. Les versions françaises de `fr/` sont nos propres
traductions : elles appartiennent au projet, sous la même licence MIT.
