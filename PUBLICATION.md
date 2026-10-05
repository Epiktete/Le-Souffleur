# Développement privé et publication

- `Epiktete/Le-Souffleur-dev` est le dépôt privé de développement. Le dossier
  local garde son historique complet et son remote `origin` pointe ici.
- `Epiktete/Le-Souffleur` est le dépôt public des versions distribuées. Son
  historique démarre avec la première publication après séparation.
- Le site conserve l’adresse `https://epiktete.github.io/Le-Souffleur/`.

## Publier une version choisie

Depuis le dépôt privé, enregistrer les changements, puis vérifier la version :

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
```

Lorsque cette version est prête à être rendue publique :

```powershell
npm.cmd run publier:public
```

La commande exporte uniquement les fichiers du commit HEAD avec `git archive`,
dans un dossier temporaire sous `test-results/`. Elle clone le dépôt public,
remplace ses fichiers par cette version, puis crée et pousse un commit public.
Les anciens fichiers retirés du projet sont aussi retirés de la version courante.
Les fichiers locaux non versionnés et les anciens commits privés ne sont pas
transférés. Chaque version publique publiée conserve ensuite son propre commit.
Si le dépôt public a avancé entre-temps, le push échoue sans écraser son historique.

Ne pas pousser une branche du dépôt privé directement vers le dépôt public :
cela transférerait ses anciens commits. Ne pas fusionner les deux historiques.
Les contributions publiques éventuelles doivent être examinées puis intégrées
dans le dépôt privé avant une nouvelle publication choisie.

GitHub Actions vérifie, construit et déploie les versions publiques. Le même
workflow garde les vérifications dans le dépôt privé, mais son étape de
déploiement y est désactivée. La séparation ne retire pas les permissions MIT
accordées sur les versions autrefois publiques.
