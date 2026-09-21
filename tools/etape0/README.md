# Étape 0 — Page de test des fournisseurs IA

Cette page sert à répondre à une seule question, mais elle est décisive :
**chaque fournisseur d'IA accepte-t-il d'être appelé directement depuis un
navigateur ?**

L'application finale n'aura aucun serveur (CDC §3). Un fournisseur qui refuse
les appels venant d'une page web est donc inutilisable, même avec une clé
valable. Le CDC §5 demande de retirer ou de marquer « expérimental » tout
préréglage qui échoue à ce test.

Cette page est un **outil jetable**. Elle ne fera pas partie de l'application.

## Lancer la page

Ouvrez un terminal dans le dossier du projet et tapez :

```
node tools/etape0/serveur.mjs
```

Cette commande démarre un mini-serveur sur votre ordinateur, qui ne fait que
servir la page de test. Il ne stocke rien et n'envoie rien nulle part.

Ouvrez ensuite **http://localhost:5500** dans votre navigateur.

Pour arrêter le serveur : revenez dans le terminal et appuyez sur `Ctrl + C`.

> **Pourquoi un serveur, et pas un double-clic sur le fichier ?**
> Une page ouverte par double-clic est identifiée par les API comme venant de
> « nulle part », et beaucoup la rejettent pour cette seule raison. Le test
> serait faussé. En passant par `http://localhost`, on se place dans les mêmes
> conditions que le futur site en ligne.

## Utiliser la page

Chaque fournisseur a sa carte, avec deux boutons :

- **Tester avec ma clé** — le test complet. Collez votre clé dans le champ
  prévu, vérifiez le nom du modèle, cliquez.
- **Tester sans clé (CORS)** — envoie volontairement une fausse clé. Utile pour
  les fournisseurs dont vous n'avez pas de compte : si le fournisseur répond
  « 401 », c'est que l'appel depuis le navigateur fonctionne et qu'il ne
  manquait que la clé.

Le bouton **Tester tous les fournisseurs sans clé** en haut de page enchaîne
les six cartes.

## Lire les résultats

| Colonne | Ce qu'elle dit |
| --- | --- |
| Appel possible depuis ce navigateur | Le point décisif. « non » = fournisseur à écarter de la V1. |
| Clé acceptée | « non » attendu lors d'un test sans clé. |
| JSON valide renvoyé | Le modèle a bien répondu un objet JSON propre, comme le pipeline l'exigera. |
| Statut HTTP | Le code renvoyé. 200 = tout va bien, 401 = clé refusée, 429 = trop de demandes. |
| GET /models | Si « oui », l'application pourra proposer une liste déroulante de modèles au lieu d'un champ libre. |
| Latence | Durée de l'appel, pour comparer les fournisseurs. |
| Jetons (usage) | Consommation de l'appel, si le fournisseur la renvoie. |

## Renvoyer le tableau

Cliquez sur **Produire le tableau de résultats**, puis sur **Copier dans le
presse-papier**, et collez le résultat dans la conversation.

Le tableau contient l'URL, le modèle et les résultats. **Il ne contient jamais
votre clé.**

## Et votre clé ?

Elle reste en mémoire dans l'onglet, le temps de la session. Elle n'est
enregistrée nulle part (ni fichier, ni `localStorage`), n'apparaît ni dans la
console ni dans le tableau, et disparaît dès que vous fermez l'onglet.
