# Le Souffleur

Générez le script d'un spectacle de marionnettes avec les peluches de vos
enfants, puis jouez-le en lisant un prompteur piloté au clavier ou à la pédale.

Le Souffleur n'invente pas d'histoire : il choisit, dans une **contothèque** de
156 contes, fables et pièces de marionnettes du domaine public venus de toutes
les cultures, ceux qui vont à vos peluches, vous en propose trois, puis adapte
celui que vous choisissez — en lui restant fidèle.

Tout se passe dans votre navigateur : **il n'y a aucun serveur**. Vos
marionnettes, vos spectacles et votre clé API ne quittent jamais votre
ordinateur, sauf le texte envoyé au fournisseur d'IA au moment d'une génération.

> **État d'avancement.** Le parcours complet est là : créer ses marionnettes,
> générer le script, le corriger, l'imprimer, et **jouer le spectacle**. Restent
> à faire le mode démo, l'onboarding et l'export-import des données.

## Comment une histoire est choisie et adaptée

1. **Le choix des contes**, fait par l'application, sans IA : les contes qui ont
   le bon nombre de personnages pour vos marionnettes, notés sur leurs traits de
   caractère, votre ébauche éventuelle, la durée demandée et, en dernier,
   l'espèce (un lapin peut jouer un chevreuil, jamais un loup).
2. **Trois synopsis** : l'IA en retient trois parmi les huit meilleurs et vous
   les présente, chacun avec le conte d'origine, qui joue qui et ce qui change.
3. **L'adaptation, en trois passes** :
   - l'*éditeur* récrit le conte entier en remplaçant ses personnages par vos
     marionnettes, en changeant le moins de mots possible ;
   - le *dramaturge et metteur en scène* le découpe en tableaux et en actes, et
     le met en scène — les paroles du conte deviennent les répliques, la
     narration devient didascalies et apartés ;
   - le *directeur éditorial* fait la dernière revue avant livraison.

Une marionnette animale garde son espèce dans le texte, la fin du conte est
toujours jouée en entier, et ce qui a mal vieilli (caricatures, sexisme) est
retiré.

## Installer

Il faut [Node.js](https://nodejs.org) version 20 ou plus récente. Vérifiez
qu'il est installé en tapant `node -v` dans un terminal.

Placez-vous dans le dossier du projet, puis installez les dépendances. Cette
commande télécharge les briques logicielles nécessaires ; elle ne se lance
qu'une fois :

```
npm install
```

## Lancer pendant le développement

```
npm run dev
```

Cette commande démarre un serveur local et affiche une adresse
(`http://localhost:5173`) à ouvrir dans votre navigateur. La page se met à jour
automatiquement quand un fichier change. `Ctrl + C` arrête le serveur.

## Fabriquer la version à publier

```
npm run build
```

Le résultat est écrit dans le dossier `dist/`. C'est un site statique : il n'a
besoin d'aucun serveur applicatif, seulement d'un hébergement de fichiers.

Pour vérifier ce build avant de le publier :

```
npm run preview
```

## Vérifier que tout fonctionne

```
npm test
```

Lance les tests automatiques de la logique : choix des contes, routage,
stockage local, validation des marionnettes, simulation de scène, calcul de
durée et lecture des réponses du modèle.

```
npm run test:parcours
```

Lance les tests de parcours dans un vrai navigateur, sur le build réel : création
d'une marionnette, persistance après rechargement,
navigation au clavier, et **génération complète d'un spectacle** avec un
fournisseur d'IA simulé — aucun appel réel, aucun coût. La première exécution
télécharge un navigateur de test.

```
npm run check
```

Vérifie la cohérence des types du code. Les trois doivent finir sans erreur.

## Jouer un spectacle

Ouvrir un spectacle donne deux modes plein écran, entre lesquels on bascule
librement. On en sort par **Échap** ou par la croix en haut à droite.

- **Édition** : lire le script, le corriger, préparer les décors, l'imprimer.
- **Lecture** : jouer. Les dialogues sont à gauche, en grand ; tout ce qui ne
  se dit pas à voix haute — actions, entrées et sorties, notes — est à droite,
  plus petit.

En mode lecture, on **tourne la page** au lieu de faire défiler : avec une
peluche sur chaque main, seul le pied est libre. La barre Espace, les flèches
et la touche Page suivante fonctionnent toutes, car les pédales tourne-pages
du commerce n'envoient pas la même chose selon les modèles.

Le menu (touche **M**) donne accès à la taille du texte, à l'inversion des
couleurs, et à une **page de test de la pédale** : à essayer avant la
représentation plutôt que devant les enfants.

## Publier sur GitHub Pages

Le dépôt contient une publication automatique
([.github/workflows/publier.yml](.github/workflows/publier.yml)) : à chaque envoi
sur la branche `main`, GitHub lance les tests, fabrique le site et le publie.

Une seule fois, dans le dépôt GitHub : **Settings**, puis **Pages**, puis
**Source : GitHub Actions**. Le site est ensuite servi à l'adresse
`https://votre-nom.github.io/nom-du-depot/`. Aucune configuration de chemin
n'est nécessaire : le build utilise des chemins relatifs.

## Clé API

L'application n'embarque aucune clé. C'est vous qui saisissez la vôtre dans
l'écran **Paramètres IA**, et elle n'est enregistrée sur l'appareil que si vous
cochez explicitement la case prévue.

**OpenRouter est le fournisseur recommandé** : une seule clé donne accès à tous
les modèles. Le modèle proposé par défaut est `openai/gpt-5.6-sol`, que vous
pouvez remplacer par n'importe quel autre dans les paramètres.

### Choisir un modèle

Un spectacle demande une dizaine d'appels au modèle, dont un qui récrit le conte
entier. Deux familles conviennent :

- **Les modèles à raisonnement**, comme `openai/gpt-5.6-sol`. Ils réfléchissent
  avant de répondre, mais leur réflexion est facturée et consomme le budget de
  la réponse. L'application en tient compte et relance automatiquement avec un
  budget doublé si une réponse est coupée.
- **Les modèles ordinaires**, comme `openai/gpt-5.2`. Moins chers, plus
  rapides, souvent suffisants.

Si une génération s'arrête sur « Le modèle s'est arrêté avant d'avoir fini »,
essayez un spectacle plus court ou un modèle sans mode de réflexion.

Les six préréglages de fournisseur ont été testés depuis un navigateur : tous
répondent. Deux particularités : **Google Gemini** répond `400` au lieu de `401`
quand la clé est invalide, et **Anthropic** exige l'en-tête
`anthropic-dangerous-direct-browser-access`. La page de test reste disponible
dans [tools/etape0/](tools/etape0/) pour revérifier un fournisseur.

## Structure du projet

| Chemin | Contenu |
| --- | --- |
| `src/config.ts` | **Toutes les constantes réglables** : vitesse de lecture, durées, bornes des curseurs. |
| `src/textes.ts` | **Tous les textes de l'interface**, en français. |
| `src/app.css` | **La charte graphique** : les 5 couleurs, les polices, les formes. |
| `src/prompts.ts` | **Les consignes données à l'IA**, une par étape. À modifier ici pour changer le style des spectacles. |
| `src/services/choixContes.ts` | **Le choix des contes** : barrières, note pondérée et réglage de ses poids, espèces. |
| `wiki/` | **La contothèque** : les textes d'origine, leurs versions françaises et une fiche par conte. Voir [wiki/README.md](wiki/README.md). |
| `src/types.ts` | Le modèle de données (marionnettes, spectacles, actes). |
| `src/services/` | La couche qui parle au stockage, à la contothèque et à l'IA. L'interface n'y accède jamais directement. |
| `src/composants/` | Les écrans et les morceaux d'interface. |
| `src/etat/` | L'état réactif partagé entre les écrans. |
| `src/polices/` | Andika et IBM Plex Mono, auto-hébergées. |
| `tests/` | Tests de la logique, rapides, sans navigateur. |
| `tests-parcours/` | Tests de parcours dans un vrai navigateur (Playwright). |
| `banc/` | Banc d'essai : génère de vrais spectacles avec une vraie clé, pour juger la qualité. Jamais livré. |
| `tools/` | Outils de développement : récupération et vérification des contes, polices, favicon. |

## Enrichir la contothèque

Chaque conte existe en trois versions : le texte original dans `wiki/raw/`, sa
version française dans `wiki/fr/`, et une fiche dans `wiki/fiches/` qui décrit
ses personnages, leurs traits, l'essence du conte et ce qu'il faut adapter pour
des enfants. Après avoir ajouté ou modifié un conte :

```
node tools/verifier-fiches.mjs
node tools/indexer-contes.mjs
```

Le premier vérifie la forme des fiches, le second recalcule la longueur et les
mots-clés de chaque conte, qui servent au choix. Le détail est dans
[wiki/README.md](wiki/README.md).

## Les images

Les illustrations vivent dans [assets/](assets/) et sont empaquetées avec
l'application : aucune n'est chargée depuis un service extérieur.

| Fichier | Où il sert |
| --- | --- |
| `Lesouffleur.webp` | Bandeau en tête du menu principal. |
| `Titre.webp` | Le nom de l'outil, dessiné, dans l'en-tête. |
| `Ecriture.webp` | Icône animée pendant que le modèle écrit. |
| `favicon.webp` | Icône de l'onglet du navigateur. |
| `favicon.png` | Secours pour Safari, fabriqué à partir du WebP. |
| `RideauGauche.webp`, `RideauDroite.webp` | Pas encore utilisés. |

Si vous remplacez le favicon, regénérez son secours PNG :

```
node tools/convertir-favicon.mjs
```

## Mettre à jour les polices

Les polices sont dans le dépôt : aucun appel à un service extérieur n'est fait
quand un visiteur ouvre la page. Pour les retélécharger :

```
node tools/telecharger-polices.mjs
```

## Vie privée

- Aucune télémétrie, aucun traceur, aucun cookie.
- Aucune dépendance chargée depuis un service extérieur à l'exécution.
- Le fournisseur d'IA ne reçoit que du texte : aucune image ne part, jamais.
- Ce qui part au fournisseur au moment d'une génération : le nom, la
  description et les traits des marionnettes choisies, les réglages
  du studio, votre ébauche éventuelle, et le texte du conte adapté.
- Vos données vivent dans le navigateur : l'export pour les sauvegarder reste
  à faire.

## Licence

Code sous licence [MIT](LICENSE). Les contes de la contothèque sont du domaine
public ; les traductions françaises de `wiki/fr/` sont celles du projet, sous
la même licence. Les polices Andika et IBM Plex Mono restent sous licence SIL
Open Font License 1.1.
