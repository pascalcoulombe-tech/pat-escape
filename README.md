# Pat Escape

Escape room en première personne, dans le navigateur. Une pièce par partie, trois ambiances (cabane, chalet, sous-sol), Pat comme guide texte. Français du Québec. Aucune sauvegarde de progression : recharger recommence la même graine.

Dépôt : https://github.com/pascalcoulombe-tech/pat-escape

Publication prévue, après fusion sur `main` et lancement manuel du workflow : https://pascalcoulombe-tech.github.io/pat-escape/

## Installation

```bash
npm ci
```

## Commandes

| Commande | Effet |
| --- | --- |
| `npm test` | Vitest, une fois |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | typecheck puis build Vite, base `/pat-escape/` |
| `npm run dev` | serveur de développement |
| `npm run preview` | sert `dist/` |
| `npm run test:e2e` | Playwright contre le build de preview |

## Contrôles

Ordinateur : ZQSD, WASD ou les flèches pour marcher, souris pour regarder après un clic, E ou un clic pour interagir, Échap pour la pause. Vitesse 2 m/s, portée 1,8 m.

Téléphone : joystick à gauche, glisser à droite pour la caméra, bouton Interagir. Inventaire, carnet et pause restent hors de ces zones. Pas de gyroscope. Cibles d’au moins 48 pixels CSS.

## Graine

L’adresse contient `seed`, `difficulty` (`discovery`, `standard` ou `expert`) et `version=1`.

`/pat-escape/?seed=jouable-1&difficulty=discovery&version=1`

Une version autre que 1 est refusée. Une nouvelle partie choisit une autre graine. Recommencer remet le temps, les énigmes, l’inventaire et les cachettes à zéro.

## Modèles

Chaque partie affiche dix GLB locaux, ceux du thème et du gabarit tirés : `room_shell.glb`, `door.glb`, et un fichier par meuble. L’adresse est préfixée par la base Vite, `/pat-escape/models/…` dans le build. Les collisions, les ancres et le générateur restent ceux des boîtes. Un fichier manquant ne retire que son slot : la boîte de couleur reste, et la partie continue. Aucun service externe. Pas d’animation. Pas de linteau : l’ouverture au-dessus de la porte laisse voir le brouillard de la pièce.

## Déploiement

Le workflow `.github/workflows/pages.yml` est manuel (`workflow_dispatch`) et ne déploie que `main`. Il installe, teste, typecheck, build, puis publie l’artefact Pages. Cette branche de fonctionnalité n’est pas déployée.

## Limites V1

Une seule pièce par partie. Pas de sauvegarde, de serveur, de voix ni de saut. Les GLB sont dans le dépôt, pas chargés ailleurs. L’objectif de 30 images/s sur un Samsung Galaxy S20 réel n’a pas été mesuré ici : voir `GAME.md`.
