# Pat Escape — règles et preuves

Date des commandes ci-dessous : 2026-11-06. Les chiffres viennent des sorties réelles, pas d’un résultat attendu recopié.

## Règles

Une pièce d’environ 6 × 6 m par partie. Ambiances : cabane, chalet, sous-sol. Huit modules : commode, coffre, étagère, tapis, pupitre, tableau, leviers, table. La sortie est une porte, pas une énigme de plus.

| Mode | Énigmes | Temps actif | Aides |
| --- | --- | --- | --- |
| Découverte | 4 | 20 min | 6 |
| Standard | 6 | 15 min | 3 |
| Expert | 8 | 10 min | 1 |

Les quatre familles sont toujours là : cadenas à trois chiffres (zéros initiaux conservés), trois symboles, ordre de trois ou quatre mécanismes, combinaison de deux objets. Une mauvaise réponse ne consomme rien et n’enlève pas de temps.

Pat est un lynx original, en primitives et dans l’interface. Il commente sans donner la solution. Après 90 secondes actives sans progrès, il propose une aide. Il faut la demander. Les conseils vont de la piste à l’instruction concrète. Aucune aide sur un verrou encore inaccessible.

Le temps part quand on ferme les commandes initiales. Inventaire, carnet, aide et saisie laissent tourner le temps. Pause, perte de focus ou onglet caché arrêtent commandes, physique et temps. On reprend seulement avec le bouton. À zéro : écran Temps écoulé, puis continuer hors chrono, recommencer la même graine, ou nouvelle partie. Une réussite après expiration est marquée hors chrono.

Pas de sauvegarde. Recharger recommence la graine. L’adresse porte `seed`, `difficulty` et `version=1`. Une autre version est refusée, jamais réécrite.

## Contrats

Le générateur, le solveur et l’état n’importent ni three.js ni Rapier.

- `generate(seed, difficulté, version)` produit une description immuable. Après 20 candidats refusés, un gabarit de secours garde la difficulté, le nombre d’énigmes et les paramètres tirés de la graine.
- `validate` sépare les problèmes logiques et spatiaux.
- `solve` simule découvertes, prises et résolutions jusqu’à la sortie. Il ne prouve pas qu’un joueur 3D peut s’approcher.
- `reduceGame` est la seule autorité sur l’inventaire, le carnet et les solutions.
- Le rendu affiche. Rapier déplace un corps cinématique et la porte. Le temps vient de la durée active, pas du nombre d’images.

Contrôle spatial : grille de 0,25 m, obstacles dilatés du rayon 0,30 m, chemin orthogonal depuis le spawn vers une cellule à moins de 1,80 m de chaque zone. Les tapis ne bloquent pas. Ce n’est pas une preuve physique complète : le test Rapier du contrôleur, dans `tests/spatial.test.ts`, vérifie en plus le mur, la porte fermée et le passage une fois ouverte.

## Commandes du 2026-11-06

`npm test` — Vitest 5.1.0, 8 fichiers, 52 tests, 52 réussites, 0 échec, environ 7,0 s.

`npm run typecheck` — `tsc --noEmit`, succès.

`npm run build` — Vite 8, base `/pat-escape/`. Le paquet `@dimforge/rapier3d-compat` embarque le WASM dans le JavaScript servi sous `/pat-escape/assets/`. Aucune requête WASM vers la racine du site n’est nécessaire. Le build signale un chunk supérieur à 500 kB, sans échec.

`CI=1 npm run test:e2e` — terminé le 2026-11-07 à 00:03 UTC. Playwright, Chromium, preview sur `http://127.0.0.1:4173/pat-escape/`. 6 tests, 6 réussites, 0 échec, 7,5 min. La passe joue Découverte, Standard et Expert jusqu’à l’écran de victoire sur la graine `jouable-1`, vérifie une mauvaise réponse sans perte, la pause opaque, et le tactile en 360×800 puis 800×360. Le serveur de preview a relancé `npm run build`, donc le typecheck et le build de cette passe ont réussi. Avertissement Vite : un chunk dépasse 500 kB.

Le corpus `v1-0` … `v1-999` × Découverte, Standard, Expert fait 3 000 mondes. Chaque monde est généré deux fois et comparé, contient le bon nombre d’énigmes et les quatre familles, `validate` vide, `solve` soluble avec la sortie atteinte. Les codes, ordres et cachettes varient sur le corpus. Au moins un code commence par zéro.

## Navigateur et téléphone

Les tests Playwright jouent les trois difficultés jusqu’à la victoire avec la souris, le clavier et les panneaux. Ils ne lisent pas le solveur pour cliquer à la place du joueur : ils lisent la graine pour connaître les réponses, puis visent, interagissent et saisissent. Une mauvaise réponse est vérifiée sans perte d’inventaire. La pause cache la scène, fige le temps et ignore la marche. Un contexte tactile sépare joystick, regard et bouton Interagir, en portrait 360×800 et en paysage 800×360.

Ce n’est pas un Samsung Galaxy S20. Aucun téléphone physique n’était branché. **Téléphone réel non testé.** L’émulation de viewport, Chromium headless et la fumée tactile ne prouvent ni les 30 images/s ni la compatibilité S20.

L’objectif 30 images/s en qualité basse sur S20 est **non mesuré**. La qualité mobile démarre à un ratio de pixels de 1, sans ombre dynamique ni post-traitement. Elle baisse de 0,1 après 5 secondes actives sous 25 images/s, plancher 0,65, et remonte après 10 secondes au-dessus de 35, plafond 1. La pause est exclue de ces fenêtres. Le mode manuel ne bouge pas. Aucune API mémoire n’a été lue sur un appareil : métriques mémoire indisponibles.

### Protocole S20, non exécuté

1. Modèle, OS, navigateur.
2. Graine, difficulté, qualité auto ou manuelle.
3. Partie entière, portrait puis paysage, dont une rotation pendant le jeu.
4. Multitouch : joystick et regard en même temps, puis Interagir.
5. Lire un symbole : forme et nom, pas seulement la couleur.
6. Temps d’image si l’outil du navigateur le donne. Mémoire seulement si `performance.memory` existe ; sinon l’écrire comme indisponible.
7. Si le minimum reste sous 30 images/s au plancher 0,65, le noter. Ne pas conclure à la compatibilité depuis ce dépôt.

## Suite

Idées hors V1 : plusieurs pièces reliées, sauvegarde explicite, voix de Pat, variantes de modules. Rien de cela n’est dans cette version.
