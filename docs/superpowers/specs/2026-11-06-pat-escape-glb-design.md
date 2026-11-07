# Pat Escape — design d’intégration des GLB

Statut : approuvé par Pascal (« Oui, je valide ce plan d’intégration pour Arcade, sans fusion ni publication. »). Implémentation sur une nouvelle branche, sans fusion ni publication.

Lecture seule du `main` `8ae55abbf81656351e0595e1ea411e660b56f130` et de l’archive immutable `pat-escape-blender-delivery_d840.zip`. Les AABB de `src/generation/layouts.ts` sont identiques entre ce `main` et `fc031bf512e5969168640276d74e85eb1a9e77bb` (manifeste `sourceSha`). Le seul écart de `main` depuis `fc031bf` est le regard : `yaw -= lookX` et l’extraction de `lookDirection`. Ce correctif reste. Les GLB n’ont pas été modifiés.

## Constats vérifiés

78 fichiers, 26 par thème (`cabane`, `chalet`, `sous-sol`), somme **2 090 432** octets. Chaque GLB : 1 matériau, 1 PNG 48×8 embarqué, 44 à 704 triangles, pas d’extension, pas d’animation, pas de caméra, pas d’URI externe. `id` n’est pas unique : `commode` apparaît 9 fois. La clé est `thème + fichier`, ou `thème + id + layoutId` pour les meubles. `room_shell` et la porte (`id` manifeste `sortie`, fichier `door.glb`) n’ont pas de `layoutId`.

Comparaison manifeste ↔ `interactionFor` / centres d’AABB : **0 écart** sur taille, centre, face et ancre. Les bornes des 78 maillages tiennent dans ±demi-taille à 1e-4 m près. La géométrie (hash manifeste) est la même d’un thème à l’autre ; seule la palette change.

| Pièce | Placement réel dans le GLB |
| --- | --- |
| `room_shell.glb` | Un seul nœud à l’origine monde. Boîte englobante x −0,25…6,25, y −0,08…2,79, z −0,25…6,25. 84 triangles = 7 boîtes (sol, plafond, 5 murs). Pas de linteau. |
| `door.glb` | Origine au centre, ±0,7 × ±1,2 × ±0,15. À poser au centre code `(3, 1,2, 6,05)`. 660 triangles. Aucun nœud charnière. |
| Meubles | Racine nommée comme le fichier, translation nulle, rotation identité, échelle 1. Détails (tiroirs, cadenas, leviers, symboles) **cuits dans le maillage**, pas des nœuds animables. |

Le jeu n’a pas de `GLTFLoader`. Sol, murs, plafond, porte et meubles sont des `BoxGeometry` mises à l’échelle des AABB. Rapier et les ancres viennent de `layouts.ts`, pas du fichier. La porte ouverte est un coulissage `position.x = 1,05` (−1,95 m) et un collider désactivé.

### Bande grise au-dessus de la porte

Elle est visible sur `room_cabane.png`. Ce n’est pas une couleur de la palette (six teintes, pas de gris). Le mur nord ne couvre que x 0…2,3 et 3,7…6 jusqu’à y = 2,7. La porte s’arrête à y = 2,4. Il reste un vide de 1,4 × 0,3 m au-dessus du battant. Le gris de l’aperçu est le fond de la scène Blender vu par ce trou. En jeu, le même trou existe déjà avec les boîtes : on verrait la couleur de fond / brouillard (`#d7c4a3` en cabane, pas le gris de l’aperçu). Ne pas modifier le GLB pour boucher ce trou sans accord : un linteau serait une géométrie et, si on veut qu’il bloque, une collision nouvelles.

### Sélection

Le pick vise les ancres (portée 1,8 m, cône) puis un rayon contre les maillages bloquants. Un meuble détaillé **à l’intérieur** de l’AABB ne dépasse pas la boîte, mais ses creux laissent passer un rayon que la boîte pleine arrêtait. Remplacer les boîtes de sélection par les GLB changerait donc les occultations. Le tapis ne bloque pas le déplacement et est ignoré s’il y a une autre cible dans 0,5 rad.

## Trois approches

**A — Visuels seulement, boîtes de sélection conservées.** Charger le GLB, le poser au centre (ou à l’origine pour la coque), ne pas le mettre dans le rayon. Garder les boîtes actuelles comme occultants, invisibles ou quasi invisibles. La porte visuelle coulisse en X ; le collider Rapier ne change pas. Recommandé : plus petit écart, ancres et solvabilité intactes.

**B — Le GLB remplace aussi le rayon.** Moins de maillages doublons, mais les creux et la poignée changent qui est visé. À écarter pour cette première intégration.

**C — Tout charger (78) ou un seul GLB mis à l’échelle.** Écarté. Seuls le thème et le gabarit de la partie sont utiles (10 fichiers : coque, porte, 8 meubles). Les proportions diffèrent entre `perimetre`, `couloir` et `fer` ; une échelle non uniforme déformerait le modèle. Le code ne scale pas les meubles aujourd’hui.

## Spec proposée (A)

### Chargement

`import.meta.env.BASE_URL` (`/pat-escape/` en production). Fichiers servis en statique, par exemple `public/models/<thème>/<fichier>.glb`, URL `${BASE_URL}models/cabane/commode_perimetre.glb`. Pas de Draco.

Pour une partie : thème + `layoutId` → ces 10 URL seulement. Cache par cette clé. Au restart, si le couple change, `dispose` des géométries, matériaux et textures de l’ancien lot. Si un fichier échoue (réseau, parse), ce slot seul retombe sur la boîte actuelle et le message d’échec reste visible dans la console ; la partie continue. Ne pas bloquer le boot sur un GLB.

Placement : `room_shell` à `(0,0,0)` sans recentrage. Porte et meubles : position = `worldCenter` du manifeste, qui doit rester égal au centre calculé par `buildLayout`. Rotation identité, échelle 1. Porte ouverte : seulement `position.x = 1,05`.

### Inchangé

Générateur, solveur, `reduceGame`, collisions, ancres, portée, vitesse, regard (`yaw -= lookX`), thèmes logiques, base Pages. Pas de lynx GLB : il n’est pas dans la livraison ; le lynx primitif reste.

### Tests prévus lors de l’implémentation

- Table thème + gabarit + id → URL sous `BASE_URL`, et `commode` + `couloir` ≠ `commode` + `perimetre`.
- Contrat : centres et ancres du manifeste (copie figée) = `buildLayout` pour les 8 × 3.
- Échec d’un GLB : la boîte de ce slot reste, les autres slots chargés ne sont pas annulés.
- Restart : pas d’accumulation de géométries (compteur avant/après dispose).
- Navigateur : la pièce affiche les modèles du thème, E sur la commode et le pupitre garde les mêmes messages, la porte fermée bloque puis s’ouvre, souris droite/gauche/bas comme après le correctif. Pas d’erreur console ni 404 sous `/pat-escape/`.
- Regard vers la porte : noter si le trou au-dessus montre le brouillard. Pas de retouche d’asset dans ce lot.

### Suite

Après accord écrit : nouvelle branche depuis `main`, nouvelle PR. Pas de fusion, pas de déploiement, pas de `workflow_dispatch` dans ce travail.
