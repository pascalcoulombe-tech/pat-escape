# Pat Escape GLB Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher les 10 GLB du thème et du gabarit de la partie, sans changer collisions, ancres, générateur ni regard.

**Architecture:** Les boîtes actuelles restent les cibles du rayon. Les GLB sont des visuels posés aux centres déjà calculés. Un échec de fichier ne retire que ce slot. `BASE_URL` préfixe `/pat-escape/`.

**Tech Stack:** TypeScript, Vite, three.js `GLTFLoader`, Vitest, Playwright.

## Global Constraints

- Approche A seulement. Pas de linteau, pas d’animation, pas de scale entre gabarits.
- 10 fichiers par partie : `room_shell.glb`, `door.glb`, et `${kind}_${layoutId}.glb` pour les 8 modules.
- `room_shell` à `(0,0,0)`. Les autres au centre d’AABB, rotation identité, échelle 1.
- Porte ouverte : `position.x = 1.05` seulement. Collider Rapier inchangé.
- Ne pas mettre les GLB dans le rayon. Les boîtes proxy restent sélectionnables même si `visible` passe à false.
- Dispose et jeton d’époque : une réponse tardive après restart ne s’attache pas et libère ses ressources.
- 78 GLB copiés tels quels. Somme 2090432 octets. `bytes` du manifeste et SHA-256 de `transfer_checksums.json` doivent coller aux fichiers.
- Regard `yaw -= lookX` conservé. Pas de fusion ni de déploiement.

---

### Tâche 1 — Contrats d’URL et d’intégrité

**Fichiers :** `src/runtime/model-url.ts`, `tests/model-url.test.ts`, `tests/glb-integrity.test.ts`, `public/models/**`, `src/assets/delivery-manifest.json`, `src/assets/glb-checksums.json`.

- [x] Écrire les tests : 10 URL pour un couple thème/gabarit, `commode`+`couloir` différent de `commode`+`perimetre`, base `/pat-escape/`, 3×3 couvert, somme 2090432, chaque `bytes` et chaque SHA-256.
- [x] Les lancer et constater l’échec d’import.
- [x] Implémenter `modelUrl` et `assetsForRun`.
- [x] Relancer jusqu’au vert.

### Tâche 2 — Rayon malgré `visible === false`

**Fichiers :** `src/runtime/proxy-raycast.ts`, `tests/proxy-raycast.test.ts`.

- [x] Test : un maillage `visible = false` est quand même touché par `raycastProxy`.
- [x] Constater le rouge, puis implémenter en forçant `visible` le temps de `mesh.raycast`.
- [x] Vert.

### Tâche 3 — Branchement visuel

**Fichiers :** `src/runtime/scene.ts`, `src/runtime/visuals.ts`, `src/ui/app.ts`.

- [x] Charger les 10 URL, poser coque et meubles, ghost `colorWrite/depthWrite` false sur les proxies sans `visible = false`.
- [x] GLB : `raycast` vide. Porte : groupe déplacé en X.
- [x] Époque + dispose. `dataset.visuals` et `dataset.doorX`.
- [x] Fallback par slot si le chargement rejette.

### Tâche 4 — Navigateur et docs

**Fichiers :** `e2e/game.spec.ts`, `README.md`, `GAME.md`.

- [x] 9 couples thème/gabarit : 10 visuels, pas de 404.
- [x] Souris droite/gauche/bas inchangée. Une interaction et la porte après une partie Découverte.
- [x] Un GLB en 404 : 9 visuels, la partie continue.
- [x] `npm test`, typecheck, build, e2e concernés. Captures. Pas de merge.

---
