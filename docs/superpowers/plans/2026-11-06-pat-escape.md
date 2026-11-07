# Pat Escape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la V1 jouable de Pat Escape conformément à `docs/superpowers/specs/2026-11-06-pat-escape-design.md`, validée selon le message relayé « Oui, je valide, go construis-le ».

**Dépôt :** https://github.com/pascalcoulombe-tech/pat-escape uniquement.
**Pages :** https://pascalcoulombe-tech.github.io/pat-escape/ avec base `/pat-escape/`.
Ne pas substituer passcool17/pat-escape ni un autre compte.

**Architecture:** Générateur déterministe et moteur d’état purs, séparés du rendu three.js, des collisions Rapier et des adaptateurs UI/contrôles. Un solveur valide la logique et un validateur spatial valide les accès. La physique ne décide jamais des solutions.

**Tech Stack:** TypeScript strict, Vite, three.js, Rapier navigateur/WASM, Vitest, Playwright ; versions compatibles choisies et verrouillées par l’agent cloud.

## Global Constraints
- Une pièce d’environ 6 × 6 mètres par partie, trois ambiances (cabane, chalet, sous-sol), trois gabarits de disposition, une porte de sortie et huit meubles/modules par pièce.
- Découverte : 4 énigmes, 20 min, 6 aides ; Standard : 6 énigmes, 15 min, 3 aides ; Expert : 8 énigmes, 10 min, 1 aide.
- Quatre familles à chaque partie : code de trois chiffres, trois symboles, ordre de trois ou quatre positions, combinaison de deux objets.
- Vitesse proposée 2 m/s ; portée d’interaction 1,8 m ; cibles tactiles d’au moins 48 pixels CSS.
- Après 90 secondes actives sans progression, Pat propose une aide sans la déclencher.
- Au plus 20 candidats déterministes invalides, puis secours validé conservant difficulté et nombre d’énigmes.
- Aucun asset externe, copie des assets de Pat, Blender, voix, multijoueur, combat, saut ou objets empilables. Primitives originales et interface française.
- Pas de compte, serveur, classement ou sauvegarde de progression ; rechargement = nouvelle tentative de la même seed.
- GitHub Pages seule cible, base `/pat-escape/`, dépôt https://github.com/pascalcoulombe-tech/pat-escape, URL https://pascalcoulombe-tech.github.io/pat-escape/. Livrer jouable avant polish. Aucun travail GitHub exécuté par la rédaction de ce plan. Ne pas utiliser passcool17/pat-escape.
- Le cloud choisit les détails internes sans élargir le périmètre. Les seuils de performance restent des objectifs non mesurés jusqu’à preuve réelle.

## Carte des fichiers et contrats
Chemins relatifs au futur dépôt. Pas de dépôt créé par ce document.

| Fichiers | Responsabilité |
| --- | --- |
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | scripts, typage strict, base statique |
| `src/domain/types.ts`, `config.ts` | contrats et difficultés |
| `src/generation/{random,layouts,generate,validate,solve}.ts` | tirages, modules sûrs, validation logique/spatiale |
| `src/domain/{state,session,hints}.ts` | transitions, timer, aides |
| `src/runtime/{physics,scene,quality}.ts` | Rapier, three.js, qualité |
| `src/input/{desktop,touch}.ts` | intentions normalisées |
| `src/ui/{app,panels,pat}.ts` et `src/ui/styles.css` | interface française et styles |
| `src/{main,seed-url}.ts` | composition et paramètres URL |
| `tests/{generation,state,session,hints,spatial,quality,seed-url}.test.ts` | tests purs |
| `e2e/game.spec.ts`, `playwright.config.ts` | smoke navigateur |
| `.github/workflows/pages.yml`, `README.md`, `GAME.md` | vérification, déploiement futur, règles et preuves |

La feuille `src/ui/styles.css` est l’unique fichier de styles. Les accolades ci-dessus désignent des fichiers distincts, pas des fichiers littéraux.

Contrats à figer en tâche 1 (notations TypeScript de design, pas une implémentation) :
- `Difficulty = 'discovery' | 'standard' | 'expert'` ; `Family = 'code' | 'symbols' | 'order' | 'combine'` ; `Id = string`.
- `SeedInput = Readonly<{seed: string; difficulty: Difficulty; version: 1}>` ; seed normalisée non vide, maximum 64 caractères ASCII alphanumériques/tiret ; autre entrée rejetée en français.
- `Token = Readonly<{id: Id; label: string; symbol: string; color: string}>` ; couleur jamais seule.
- `Puzzle` union discriminée par `family` : champs communs `id`, `requires: readonly Id[]`, `clueIds: readonly Id[]`, `rewardIds: readonly Id[]` ; champs propres code (`solution: string`), symbols (`solution: readonly Id[]` de longueur 3), order (`solution: readonly Id[]` longueur 3/4), combine (`ingredients: readonly [Id, Id]`, `resultId: Id`).
- `WorldDescription` contient `input: SeedInput`, `theme`, `layoutId`, `spawn`, `exit`, `modules`, `spots`, `tokens`, `puzzles`, `initialIds`, `exitRequires`. `spawn`/positions utilisent `{x:number;y:number;z:number}` ; modules et spots ont identifiants, volumes de collision et zones d’interaction. Chaque spot indique explicitement son contenu et ses prérequis. Catalogues en lecture seule.
- `generate(input: SeedInput): WorldDescription` ; `validate(world: WorldDescription): readonly ValidationIssue[]` ; `solve(world: WorldDescription): SolveResult`. `ValidationIssue = {kind: 'logic'|'spatial'; id: Id; reason: string}` ; `SolveResult = {solvable: boolean; acquired: readonly Id[]; trace: readonly Id[]}`.
- `GameState` contient `discoveredIds`, `inventoryIds`, `consumedIds`, `solvedIds`, `journalIds` (tableaux readonly d’Id) et `exitOpened: boolean`.
- `Answer` union discriminée par `family`, valeurs string pour code, tableau d’Id pour symbols/order, paire d’Id pour combine. `GameAction` union : découvrir spot, prendre objet, soumettre réponse avec puzzleId, ouvrir sortie. `reduceGame(world, state, action): Transition` ; `initialGame(world): GameState` ; `Transition = {state: GameState; progressed: boolean; message: string}`. Signatures emploient les types précédents, aucun DOM.
- `SessionState` : phase `'intro'|'running'|'paused'|'expired'|'training'|'won'`, `activeMs`, `remainingMs`, `sinceProgressMs`, `outOfTime`, `hintsUsed`, niveaux d’aide par puzzle. `SessionAction` : start, pause, resume, tick avec `deltaMs`, progress, continueTraining, win, hintUsed avec puzzleId. `reduceSession(state, action): SessionState` ; `initialSession(difficulty): SessionState`.
- `selectHint(world, game, session): {puzzleId: Id; level: number; text: string} | null` ; sélection pure, consommation seulement après demande valide.
- `InputFrame = {moveX:number;moveZ:number;lookX:number;lookY:number;interact:boolean}` ; `PhysicsAdapter.step(input: InputFrame, deltaSeconds:number): void`, `setDoorOpen(open:boolean):void`, `dispose():void`, `getPose(): {position: {x:number;y:number;z:number}; yaw:number; pitch:number}`.
- `SceneAdapter.render(pose, game: GameState): void`, `pick(pose): Id|null`, `setPixelRatio(ratio:number):void`, `dispose():void` ; pose reprend exactement le type retourné par `getPose`. Pick renvoie une cible accessible dans 1,8 m, pas une récompense.
- `QualityState = {ratio:number;slowMs:number;fastMs:number;mode:'auto'|'manual'}` ; `updateQuality(state, fps:number, activeDeltaMs:number): QualityState`.
- `parseSeedUrl(url: URL): SeedInput | {error:string}` ; `formatSeedUrl(url: URL, input: SeedInput): URL` ; aucun accès réseau.

## Discipline d’exécution
Agent cloud par défaut, pas de nouvelle question sur le mode d’exécution. Charger la spec et ce plan avant de commencer. Le dépôt autorisé est https://github.com/pascalcoulombe-tech/pat-escape ; ne pas réinterpréter un refus d’accès et ne pas substituer un autre compte. Les étapes suivantes sont des prescriptions de travail : ce plan ne contient volontairement ni implémentation ni résultats inventés. Les contrats guident l’agent ; il écrit les tests puis le code minimal.

Chaque case est une action courte ; fractionner un cas volumineux sans changer le livrable. Pour chaque tâche : écrire assertions, exécuter et constater l’échec pertinent, implémenter, réexécuter, examiner le diff puis commit local ciblé. Un échec d’environnement n’est pas un test rouge fonctionnel. Noter commandes, résultats réels et limites dans GAME.md.

### Tâche 1 — Socle et contrats purs
**Fichiers :** configuration racine, `src/domain/types.ts`, `config.ts`, `src/generation/random.ts`, `tests/generation.test.ts`.
**Interface :** produit SeedInput, WorldDescription et tous les contrats ci-dessus ; aucun import three.js/Rapier dans domain/generation.
- [ ] Créer scripts `dev`, `test` (Vitest run), `typecheck` (tsc sans émission), `build` (typecheck puis Vite), `preview`, `test:e2e` (Playwright) ; base Vite `/pat-escape/`, dépendances verrouillées.
- [ ] Ajouter tests de configuration : difficultés exactement 4/6/8, 1200/900/600 secondes, 6/3/1 aides ; RNG identique pour même seed et séquence, indépendant de Date/Math.random.
- [ ] Exécuter `npm test -- tests/generation.test.ts` : constater les échecs avant logique.
- [ ] Écrire contrats, configuration et RNG minimal ; refuser seeds invalides et difficultés inconnues aux frontières.
- [ ] Exécuter tests, `npm run typecheck`, `npm run build` ; vérifier imports purs ; commit local `feat: define deterministic game contracts`.

### Tâche 2 — Génération, solveur et accès spatiaux
**Fichiers :** `src/generation/{layouts,generate,validate,solve}.ts`, `tests/{generation,spatial}.test.ts`.
**Interface :** consomme SeedInput ; produit generate/validate/solve avec les contrats fixés. solve simule prérequis et consommation sans lire le rendu.
- [ ] Tester une fixture soluble à quatre familles et des fixtures invalides : cycle indirect, indice derrière son verrou, ingrédient manquant, objet consommé requis deux fois, sortie inaccessible.
- [ ] Tester 3 gabarits × 3 ambiances : huit modules, spawn libre, chemin vers sortie, chaque zone interactive atteignable par un joueur de rayon proposé 0,30 m, portée 1,8 m. Validation par volumes dilatés et grille navigable ; le détail de résolution appartient au cloud et doit être documenté.
- [ ] Exécuter les deux fichiers de tests et constater les échecs.
- [ ] Construire modules/slots sûrs, quatre modèles paramétrables, DAG, cachettes et solveur par acquisitions jusqu’au point fixe ; détecter cycles séparément. Brancher validation et secours après 20 essais ; test forçant ce secours via dépendance injectable de validation, non via hasard.
- [ ] Ajouter boucle seeds `v1-0` à `v1-999` pour chaque difficulté : 3 000 mondes, génération doublée égale, nombre exact, quatre familles, validate vide, solve soluble et sortie atteinte. Vérifier diversité des codes/ordres/cachettes sur le corpus sans exiger que chaque paire de seeds diffère.
- [ ] Exécuter `npm test -- tests/generation.test.ts tests/spatial.test.ts` ; rapporter nombre réellement parcouru, erreurs avec seed/difficulté ; commit `feat: generate and validate solvable rooms`.

### Tâche 3 — État, inventaire, réponses et carnet
**Fichiers :** `src/domain/state.ts`, `tests/state.test.ts`.
**Interface :** consomme WorldDescription/GameAction ; produit initialGame/reduceGame. Aucune mutation du monde ou de l’état d’entrée.
- [ ] Tester réponses correctes/incorrectes des quatre familles ; entrée code préserve les zéros initiaux. Test de mélange de familles refusé, prise inaccessible refusée, récompense unique, mauvaise combinaison sans perte.
- [ ] Tester recette correcte consommée une fois, carnet persistant, inventaire sans capacité, sortie impossible avant tous prérequis ; rejouer une action n’accorde rien deux fois.
- [ ] Exécuter `npm test -- tests/state.test.ts` et vérifier rouge ; implémenter transitions et messages français.
- [ ] Rejouer la trace du solveur via de vraies actions du moteur sur une seed de chaque difficulté pour prouver l’accord solveur/moteur.
- [ ] Exécuter tests et typecheck ; commit `feat: implement puzzle and inventory state`.

### Tâche 4 — Session, timer, aides et seeds URL
**Fichiers :** `src/domain/{session,hints}.ts`, `src/seed-url.ts`, `tests/{session,hints,seed-url}.test.ts`.
**Interface :** produit initialSession/reduceSession/selectHint/parseSeedUrl/formatSeedUrl ; réutilise uniquement les types de la carte.
- [ ] Avec deltas simulés, tester intro sans décompte, running avec décompte, inventaire/carnet sans pause, pause sans temps ni physique, reprise explicite, zéro exact, training puis victoire hors chrono ; progression remet le compteur d’inactivité à zéro.
- [ ] Tester proposition à 90 secondes sans consommation, demande explicite bornée au budget, aucune aide sur énigme inaccessible, progression des conseils vers instruction concrète et commentaires sans révélation.
- [ ] Tester URL aller-retour, seed/version invalides rejetées en français, nouvelle seed différente, reset intégral de la même seed et absence de restauration d’état après reload.
- [ ] Exécuter les trois fichiers, constater rouge ; implémenter états et frontière URL. Utiliser durée monotone active ; ignorer le grand delta de retour d’arrière-plan.
- [ ] Réexécuter tests/typecheck ; commit `feat: add session lifecycle hints and seed replay`.

### Tâche 5 — Pièce 3D et collisions
**Fichiers :** `src/runtime/{physics,scene}.ts`, `src/main.ts`, `tests/spatial.test.ts`, `e2e/game.spec.ts`, configuration Playwright.
**Interface :** produit PhysicsAdapter/SceneAdapter ; consomme description, GameState et InputFrame. Boucle principale compose sans dupliquer les règles.
- [ ] Ajouter smoke : charger une seed, voir pièce et huit modules, constater spawn sans chevauchement et libellé de cible. Ajouter test de collision du contrôleur sur mur/porte puis passage après ouverture.
- [ ] Exécuter `npm run test:e2e` et constater échec fonctionnel ; créer primitives, matériaux, silhouette de Pat et trois ambiances originales.
- [ ] Initialiser Rapier/WASM, joueur cinématique, collisions statiques et pas physique fixe ; vitesse 2 m/s indépendante des images. Aucun objet mobile nécessaire.
- [ ] Relier pose caméra, pick à 1,8 m, occultation par murs/meubles et ouverture visuelle/physique simultanée de porte ; disposer ressources lors du restart sans accumulation.
- [ ] Exécuter tests, build et smoke ; vérifier erreurs console/réseau (dont WASM) ; commit `feat: render modular rooms with safe collisions`.

### Tâche 6 — Contrôles et interface française jouable
**Fichiers :** `src/input/{desktop,touch}.ts`, `src/ui/{app,panels,pat}.ts`, `src/ui/styles.css`, `src/main.ts`, `e2e/game.spec.ts`.
**Interface :** contrôles émettent InputFrame et intentions ; UI envoie GameAction/SessionAction et affiche états, jamais ne décide de solution.
- [ ] Ajouter smoke ciblant boutons par rôles/libellés : introduction, inventaire/carnet, quatre interfaces de réponse, message erreur sans perte, pause opaque, expiration, entraînement et écran victoire.
- [ ] Tester touches ZQSD/WASD/flèches, mouvement normalisé diagonal, regard borné verticalement, sensibilité, E/clic, perte pointer lock/blur/visibilitychange en pause. Les entrées sont relâchées en pause.
- [ ] Tester multitouch séparant joystick gauche, regard droit et bouton Interagir ; pointercancel et interruption système ne laissent aucun mouvement bloqué. Portrait, paysage et rotation restent utilisables.
- [ ] Exécuter e2e rouge ; réaliser panneaux, pavé code, associations symboliques, séquence mécanismes, combinaison d’inventaire, Pat, aides, timer, seed/URL et avertissement rechargement.
- [ ] Vérifier zones tactiles ≥48 pixels CSS, texte agrandi, contraste, symboles doublant les couleurs, cible nommée ; aucune permission gyroscope. Pause ferme panneaux et masque scène ; reprise seulement par bouton.
- [ ] Réexécuter e2e, tests/typecheck et partie manuelle navigateur complète ; commit `feat: add accessible desktop and touch gameplay`.

### Tâche 7 — Qualité mobile et fiabilité
**Fichiers :** `src/runtime/quality.ts`, intégration scene/main, `tests/quality.test.ts`, `e2e/game.spec.ts`, `GAME.md`.
**Interface :** updateQuality ne retourne que QualityState ; setPixelRatio ne modifie jamais logique ni physique.
- [ ] Tester basse qualité mobile initiale ratio 1 ; baisse après 5 secondes actives sous 25 fps, plancher 0,65 ; remontée après 10 secondes au-dessus de 35, plafond 1 ; mode manuel stable ; pause exclue des fenêtres.
- [ ] Exécuter test rouge puis implémenter paliers proposés de 0,1, dernier palier borné à 0,65 ; aucun post-traitement/ombre dynamique mobile, lumières limitées et géométries partagées.
- [ ] Exécuter `npm test -- tests/quality.test.ts` et smoke aux tailles portrait/paysage S20 ; tester plusieurs restarts sans croissance continue des ressources et interruptions sans saut de timer.
- [ ] Écrire protocole S20 réel dans GAME.md : modèle/OS/navigateur, seed/difficulté, qualité, durée active, temps d’image et mémoire si API disponible, partie entière, rotation/multitouch/lecture symboles. Signaler explicitement métriques mémoire indisponibles.
- [ ] Réaliser le test réel seulement si appareil accessible ; sinon marquer « téléphone réel non testé ». Émulation viewport, Chromium headless et smoke ne prouvent ni performance ni compatibilité S20.
- [ ] Rapporter objectif 30 fps atteint/non atteint/non mesuré avec mesures et méthode, pas une affirmation issue des seuils ; commit `perf: add adaptive mobile quality and validation protocol`.

### Tâche 8 — Livraison statique, docs et preuves
**Fichiers :** `.github/workflows/pages.yml`, `README.md`, `GAME.md`, configuration build si nécessaire.
**Interface :** artefact `dist/` autonome sous `/pat-escape/`, pas de serveur applicatif. Workflow build/test puis upload/deploy Pages via mécanisme officiel et permissions minimales.
- [ ] README : installation via `npm ci`, commandes réelles, contrôles, URL seed, limitations V1, restart sans sauvegarde, base de déploiement et prérequis Pages.
- [ ] GAME.md : règles/difficultés, génération/solveur/contrats, commandes et résultats datés, couverture 3 000 seeds, limites du contrôle spatial, smoke navigateur distinct du téléphone réel, objectifs non mesurés identifiés.
- [ ] Exécuter `npm ci`, `npm test`, `npm run typecheck`, `npm run build` ; consigner sorties et nombre de tests réels, jamais recopier « attendu » comme « réussi ».
- [ ] Servir via `npm run preview -- --host 0.0.0.0` et exécuter Playwright sur `/pat-escape/` ; aucun chemin absolu racine cassé, WASM chargé, liens seeds rechargeables, pas d’erreur console. Prévoir serveur preview Playwright avec réutilisation désactivée en CI.
- [ ] Exécuter une partie complète de chaque difficulté via UI sur seeds connues, sans accès de debug en production. Tests peuvent importer le générateur pour connaître les réponses ; aucun bouton de solution exposé au joueur.
- [ ] Revoir diff/scope/types, corriger échecs et relancer suites concernées ; commit local `docs: document game and static Pages delivery`.
- [ ] Étape externe : la branche de fonctionnalité peut être poussée et ouverte en PR. Ne pas fusionner ni déployer cette branche. Le workflow Pages reste manuel et limité à `main`. Aucun lien n’est déclaré publié avant une exécution réelle du workflow.

## Auto-revue de couverture et sortie attendue
- Expérience/périmètre/ambiances/modules : tâches 1, 2, 5 ; aucun asset externe ni scope supplémentaire.
- Difficultés/quatre familles/variations seed/solvabilité/20 essais : tâches 1–3 ; corpus de 1 000 seeds par difficulté et fixtures négatives explicites.
- Accessibilité spatiale et collisions : tâches 2, 5 ; solveur logique non confondu avec preuve 3D.
- Inventaire/carnet/Pat/budgets/90 secondes : tâches 3, 4, 6.
- Timer/pause/interruption/fin/entraînement/restart/version URL : tâches 4, 6.
- Contrôles souris/clavier/tactile/48 pixels/symboles : tâches 5, 6.
- S20/adaptation/mesures et limites de preuve : tâche 7 ; seuils 25/35 fps et 5/10 secondes conservés.
- README/GAME/build base/Pages/tests honnêtes : tâche 8.
- Types : mêmes SeedInput, WorldDescription, GameState, SessionState, InputFrame et adaptateurs à chaque frontière ; unions discriminées pour réponses et actions, readonly aux frontières pures ; aucun `any` de contournement. Les variantes d’action sont à formaliser dans types.ts avant consommateurs.
- Placeholders : aucun point fonctionnel laissé indéfini ; le choix de bibliothèques mineures, organisation interne des panneaux et algorithme RNG appartient au cloud, sous tests de contrats et version verrouillée. Aucune obligation d’implémentation contenue dans la rédaction de ce plan n’a été exécutée.

Livrable de l’agent : code/build, commits locaux, résultats exacts des commandes, statut smoke navigateur, statut distinct téléphone réel, limites restantes et statut explicite du déploiement. Pas de nouvelle question sur le mode d’exécution : agent cloud par défaut.
