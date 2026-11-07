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

## Déploiement

Le workflow `.github/workflows/pages.yml` est manuel (`workflow_dispatch`) et ne déploie que `main`. Il installe, teste, typecheck, build, puis publie l’artefact Pages. Cette branche de fonctionnalité n’est pas déployée.

## Limites V1

Une seule pièce par partie. Pas de sauvegarde, de serveur, de voix, de saut ni d’assets externes. L’objectif de 30 images/s sur un Samsung Galaxy S20 réel n’a pas été mesuré ici : voir `GAME.md`.
