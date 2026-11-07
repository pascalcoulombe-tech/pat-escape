# Pat Escape — proposition de design V1

Document de revue avant implémentation. La direction « pièces modulaires » est approuvée selon le message relayé de BOSS. Les nombres et seuils ci-dessous sont des **choix proposés, pas des données mesurées**.

Dépôt de cette V1 : https://github.com/pascalcoulombe-tech/pat-escape
Publication prévue : https://pascalcoulombe-tech.github.io/pat-escape/ (base `/pat-escape/`).
Le dépôt passcool17/pat-escape n'est pas la destination.

## Expérience et périmètre
Escape room en première personne, navigateur ordinateur/mobile, interface française, three.js + Rapier. Explorer, découvrir des indices, résoudre une chaîne et ouvrir la sortie. Pat Cognefoudre, lynx guide, commente par texte et aide sur demande.

V1 : une pièce d’environ 6 × 6 mètres par partie, trois ambiances (cabane, chalet, sous-sol), trois gabarits de disposition, une porte de sortie et huit meubles/modules par pièce. Les trois ambiances ne sont pas des niveaux enchaînés. Murs, portes et meubles utilisent des emplacements et rotations autorisés, garantissant les passages.

Approches : pièce fixe avec codes variables (simple mais peu variée), assemblage libre (validation trop coûteuse), **modules à emplacements sûrs** (retenu : variété maîtrisée). Primitives et matériaux simples uniquement ; aucun asset externe, copie des assets de Pat, Blender, voix, multijoueur, combat, saut ou objets empilables. Version jouable avant polish. GitHub Pages est la seule cible envisagée, sans serveur ni compte.

## Difficultés proposées
| Mode | Énigmes obligatoires | Temps actif | Demandes d’aide |
| --- | --- | --- | --- |
| Découverte | 4 | 20 min | 6 |
| Standard | 6 | 15 min | 3 |
| Expert | 8 | 10 min | 1 |

Les quatre familles sont présentes à chaque partie ; les modes supérieurs répètent des modèles avec paramètres distincts. Trouver une clé simple et actionner la sortie ne comptent pas comme énigmes supplémentaires. Mauvaises réponses sans pénalité temporelle.

## Génération et garantie de solvabilité
Banque V1 : quatre modèles paramétrables : cadenas à trois chiffres ; association de trois symboles ; mécanismes dans un ordre de trois ou quatre positions ; combinaison explicite de deux objets compatibles.

Entrées : seed, difficulté et version du générateur. Sorties déterministes : plan, cachettes, paramètres, solutions et graphe de dépendances acyclique. Une chaîne principale, éventuellement ramifiée puis réunie, conduit à la sortie. Chaque récompense sert à une étape ultérieure. Les premiers indices et objets sont disponibles dès le départ.

Codes, couleurs, ordres, symboles et cachettes varient. Couleurs toujours doublées de formes/symboles ou noms : aucun indice fondé sur la couleur seule. Cachettes sûres : tiroir, sous un tapis interactif, étagère ; aucun déplacement physique de meuble requis. Aucun indice derrière son propre verrou, directement ou indirectement.

Avant lancement, un solveur abstrait simule les découvertes, acquisitions et résolutions jusqu’à la sortie : absence de cycle, indices disponibles avant leurs solutions, recettes complètes, absence de consommation conflictuelle. Un contrôle spatial distinct vérifie les passages et les zones d’interaction. Après au plus 20 candidats déterministes invalides, utiliser un gabarit de secours validé conservant difficulté, nombre d’énigmes et paramètres issus de la seed. Aucune réussite ne dépend du hasard pendant une action.

## Contrôles et confort
Ordinateur : ZQSD/WASD et flèches pour marcher, souris pour regarder après clic de verrouillage du pointeur, E ou clic pour interagir, Échap pour pause. Sensibilité réglable ; ni saut, sprint ni accroupissement nécessaires. Vitesse proposée 2 m/s ; portée d’interaction 1,8 m.

Mobile : paysage recommandé, portrait utilisable ; joystick gauche, glissement à droite pour la caméra, bouton Interagir séparé. Inventaire et pause hors des zones de déplacement/caméra ; multitouch simultané pris en charge. Pas de gyroscope. Cibles d’au moins 48 pixels CSS, pavé numérique intégré et viseur avec nom de l’objet ciblé ; aucun petit objet n’exige un tap précis sur sa géométrie. Texte contrasté, redimensionnable ; indices relisibles dans un carnet.

## Inventaire et Pat
Inventaire sans limite pour les objets de la partie ; aucune pose, perte ou projection d’objet. Combinaisons via recettes reconnues seulement ; erreur sans consommation. Transitions idempotentes : une récompense ne se récupère qu’une fois. Un objet consommé ne peut être requis ailleurs. Les indices découverts restent dans le carnet.

Pat est représenté par une silhouette/portrait stylisé original en primitives/UI et de courtes répliques françaises, sans assets externes. Commentaires gratuits sans solution révélée. Après 90 secondes actives sans progression, il propose une aide sans la déclencher. Une demande explicite consomme une aide ; conseils successifs sur une énigme accessible, de piste à instruction concrète. Aucun conseil sur un verrou encore inaccessible ; compteur visible, aucun coût temporel.

## Timer, pause et fin
Départ du timer après fermeture des commandes initiales. Inventaire, carnet, aide et saisie de code laissent tourner le temps. Pause explicite, perte de focus, onglet masqué ou interruption système suspendent commandes, physique et timer. Reprise par bouton uniquement. La pause ferme les panneaux et masque la scène pour éviter l’analyse gratuite ; aucun classement compétitif.

À zéro : jeu gelé, écran Temps écoulé. Choix : continuer hors chrono (entraînement), recommencer la même seed, nouvelle partie. Victoire après interaction avec la sortie débloquée : temps actif, aides, difficulté et seed affichés. Une réussite après expiration est marquée hors chrono.

Seed copiable et partageable dans l’URL avec difficulté et version. Rejouer cette seed remet intégralement timer, puzzles, inventaire et cachettes à zéro ; Nouvelle partie choisit une seed différente. Pas de sauvegarde de progression en V1 : recharger recommence la seed, avertissement visible. Une version de seed non prise en charge est refusée clairement, jamais modifiée silencieusement.

## Séparation des responsabilités
- **Générateur pur** : seed/difficulté/version vers description immuable et validation ; indépendant du navigateur et des moteurs.
- **État des puzzles** : découvre, prend, combine et résout ; autorité unique sur inventaire, solutions et progression. Actions invalides sans perte d’objet.
- **Rendu three.js** : affiche description et état, sélection, éclairage, qualité ; ne décide pas des récompenses.
- **Physique Rapier** : collisions statiques et joueur cinématique ; aucun puzzle dépendant de la simulation. Ouverture d’une porte synchronisée avec sa collision.
- **UI/contrôles** : intentions souris/tactiles, carnet, Pat, pause et fin ; timer fondé sur durée active réelle, jamais sur le nombre d’images.

## Validation et Samsung S20
Validation proposée : au moins 1 000 seeds par difficulté, déterminisme, quatre familles présentes, graphes résolubles, aucune clé manquante ni indice auto-verrouillé. Vérifier chaque gabarit/cachette spatialement : le solveur logique ne prouve pas seul l’accessibilité en 3D. Tester mauvaises réponses, actions répétées, consommation, pause, arrière-plan, expiration, continuation et restart identique.

Avant publication : partie complète clavier/souris et sur Samsung S20 réel, portrait/paysage, rotation, multitouch et symboles lisibles, sans blocage ni perte d’objet. Si le téléphone est indisponible, déclarer ce contrôle non réalisé.

Objectif proposé, non garanti : 30 images/s stables sur S20 en qualité basse. Mobile démarre sans ombres dynamiques ni post-traitement, peu de lumières, géométries partagées et ratio de pixels plafonné à 1. Après 5 secondes actives sous 25 images/s, réduire progressivement la résolution jusqu’à un ratio de 0,65 ; remontée après 10 secondes au-dessus de 35, plafond mobile 1. Qualité manuelle disponible. Aucun ajustement de logique, collisions, indices, vitesse du joueur ou timer. Mesurer temps d’image et mémoire sur une partie complète ; si le minimum reste insuffisant, signaler l’objectif non atteint plutôt que promettre la compatibilité.

## À valider avant implémentation
1. Une pièce par partie, trois ambiances, huit meubles et quatre modèles paramétrables.
2. Réglages 4/6/8 énigmes, 20/15/10 minutes, 6/3/1 aides.
3. Pause sans pénalité, continuation hors chrono et absence de sauvegarde de progression.
4. Commandes tactiles à deux zones et cible S20 de 30 images/s avec résolution adaptative.

Auto-revue effectuée : pas de placeholder ; nombres compatibles avec les quatre familles ; pause et expiration distinctes ; solvabilité logique séparée de l’accès physique ; périmètre limité à une V1. Propriétaire confirmé après création du dépôt public : https://github.com/pascalcoulombe-tech/pat-escape. La cible Pages est https://pascalcoulombe-tech.github.io/pat-escape/. Le dépôt passcool17/pat-escape n'est pas utilisé.
