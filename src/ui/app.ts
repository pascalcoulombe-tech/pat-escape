import { DIFFICULTIES } from '../domain/config';
import { patComment, selectHint } from '../domain/hints';
import { hintOfferReady, initialSession, reduceSession, sessionActionForVisibility } from '../domain/session';
import { initialGame, reduceGame } from '../domain/state';
import type { Difficulty, GameState, Id, InputFrame, SeedInput, SessionState, WorldDescription } from '../domain/types';
import { generate } from '../generation/generate';
import { lookFromPointer, movementFromKeys } from '../input/desktop';
import { frameFromPointers, type PointerPoint } from '../input/touch';
import { createPhysics } from '../runtime/physics';
import { initialQuality, updateQuality } from '../runtime/quality';
import { createScene } from '../runtime/scene';
import { formatSeedUrl, mintSeed, parseSeedUrl } from '../seed-url';
import { lynxPortrait, symbolFigure } from './pat';
import type { PhysicsAdapter, Pose, QualityState, SceneAdapter } from '../domain/types';

type Panel = 'none' | 'journal' | 'inventory' | 'code' | 'symbols' | 'order' | 'combine' | 'hint';

export function boot(root: HTMLElement): void {
  const url = new URL(location.href);
  const parsed = parseSeedUrl(url);
  if ('error' in parsed) {
    if (url.searchParams.has('version') && url.searchParams.get('version') !== '1') {
      root.innerHTML = `<main class="card"><h1>Pat Escape</h1><p role="alert">${escapeHtml(parsed.error)}</p></main>`;
      return;
    }
    showMenu(root);
    return;
  }
  void startGame(root, parsed);
}

function showMenu(root: HTMLElement): void {
  root.innerHTML = `<main class="card"><h1>Pat Escape</h1><p>Une pièce, une sortie, Pat comme guide. Rien n'est sauvegardé : recharger recommence la graine.</p><p>Choisis une difficulté.</p><div class="choices"><button type="button" data-difficulty="discovery">Découverte</button><button type="button" data-difficulty="standard">Standard</button><button type="button" data-difficulty="expert">Expert</button></div></main>`;
  root.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((button) => {
    button.addEventListener('click', () => {
      const difficulty = button.dataset.difficulty as Difficulty;
      const entropy = crypto.getRandomValues(new Uint32Array(12));
      const seed = mintSeed(Array.from(entropy));
      location.assign(formatSeedUrl(new URL(location.href), { seed, difficulty, version: 1 }).href);
    });
  });
}

async function startGame(root: HTMLElement, input: SeedInput): Promise<void> {
  const mobile = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  root.dataset.touch = mobile ? '1' : '0';
  document.documentElement.dataset.touch = mobile ? '1' : '0';
  root.innerHTML = `
    <canvas id="view"></canvas>
    <div id="reticle"><span id="target-name"></span></div>
    <header id="hud">
      <button type="button" id="pause">Pause</button>
      <div id="timer">--:--</div>
      <div id="hint-count"></div>
      <button type="button" id="journal">Carnet</button>
      <button type="button" id="inventory">Inventaire</button>
      <button type="button" id="help">Demander de l'aide</button>
    </header>
    <div id="move-zone"></div>
    <div id="look-zone"></div>
    <button type="button" id="interact">Interagir</button>
    <div id="pat">${lynxPortrait()}<p id="pat-line"></p></div>
    <p id="offer" hidden></p>
    <p id="status" role="status"></p>
    <div id="panel"></div>
    <div id="veil"></div>
    <ul id="module-list"></ul>
  `;
  const canvas = root.querySelector<HTMLCanvasElement>('#view');
  if (!canvas) return;
  let world = generate(input);
  let game = initialGame(world);
  let session: SessionState = initialSession(input.difficulty);
  let quality: QualityState = initialQuality();
  let physics: PhysicsAdapter = await createPhysics(world);
  let scene: SceneAdapter = createScene(canvas, world, mobile);
  const modules = root.querySelector('#module-list');
  if (modules) modules.innerHTML = world.modules.map((module) => `<li>${escapeHtml(module.label)}</li>`).join('');

  const keys = new Set<string>();
  const pointers = new Map<number, PointerPoint>();
  let sensitivity = 1;
  let lookDx = 0;
  let lookDy = 0;
  let interactQueued = false;
  let panel: Panel = 'none';
  let puzzleId: Id | null = null;
  let codeBuffer = '';
  let picks: Id[] = [];
  let message = '';
  let hintText = '';
  let veilKey = '';
  let panelKey = '';
  let alive = true;
  let appliedRatio = -1;

  const timer = must(root, '#timer');
  const hintCount = must(root, '#hint-count');
  const targetName = must(root, '#target-name');
  const patLine = must(root, '#pat-line');
  const offer = must(root, '#offer');
  const status = must(root, '#status');
  const panelRoot = must(root, '#panel');
  const veil = must(root, '#veil');

  const conceal = () => session.phase === 'intro' || session.phase === 'paused' || session.phase === 'expired' || session.phase === 'won';

  const urlText = () => formatSeedUrl(new URL(location.href), world.input).href;

  const paintVeil = () => {
    const key = `${session.phase}:${session.outOfTime}:${world.input.seed}`;
    if (key === veilKey) return;
    veilKey = key;
    const hidden = !conceal();
    veil.hidden = hidden;
    if (hidden) {
      veil.innerHTML = '';
      return;
    }
    const label = DIFFICULTIES[world.input.difficulty].label;
    if (session.phase === 'intro') {
      veil.innerHTML = `<main class="card"><h1>Pat Escape</h1><p>${escapeHtml(label)} · graine ${escapeHtml(world.input.seed)}</p><p>Recharger la page recommence cette graine. Rien n'est sauvegardé.</p><p>Ordinateur : ZQSD, WASD ou les flèches pour marcher, souris pour regarder, E ou un clic pour interagir, Échap pour la pause. Téléphone : joystick à gauche, glisser à droite pour la caméra, bouton Interagir. Pas de gyroscope.</p><label>Adresse de la graine<input id="seed-link" readonly value="${escapeHtml(urlText())}"></label><button type="button" data-action="start">Commencer</button></main>`;
    } else if (session.phase === 'paused') {
      veil.innerHTML = `<main class="card"><h1>Pause</h1><p>Le temps et la physique sont arrêtés. La pièce est cachée.</p><button type="button" data-action="resume">Reprendre</button><label>Sensibilité <input id="sensitivity" type="range" min="0.4" max="2" step="0.1" value="${sensitivity}"></label><div class="choices"><button type="button" data-action="quality-auto">Qualité auto</button><button type="button" data-action="quality-low">Qualité basse</button></div><button type="button" data-action="restart">Recommencer cette graine</button><button type="button" data-action="fresh">Nouvelle partie</button><label>Adresse de la graine<input id="seed-link" readonly value="${escapeHtml(urlText())}"></label></main>`;
    } else if (session.phase === 'expired') {
      veil.innerHTML = `<main class="card"><h1>Temps écoulé</h1><p>La partie est gelée. Tu peux continuer hors chrono, recommencer cette graine ou en tirer une autre.</p><button type="button" data-action="training">Continuer hors chrono</button><button type="button" data-action="restart">Recommencer cette graine</button><button type="button" data-action="fresh">Nouvelle partie</button></main>`;
    } else {
      const clock = formatClock(session.activeMs);
      veil.innerHTML = `<main class="card"><h1>${session.outOfTime ? 'Réussi hors chrono' : "C'est réussi"}</h1><p>${escapeHtml(label)} · temps actif ${clock} · aides ${session.hintsUsed}/${session.hintBudget}</p><p>Graine ${escapeHtml(world.input.seed)}</p><label>Adresse de la graine<input id="seed-link" readonly value="${escapeHtml(urlText())}"></label><button type="button" data-action="restart">Recommencer cette graine</button><button type="button" data-action="fresh">Nouvelle partie</button></main>`;
    }
    veil.querySelector('[data-action="start"]')?.addEventListener('click', () => {
      session = reduceSession(session, { type: 'start' });
      veilKey = '';
    });
    veil.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
      session = reduceSession(session, { type: 'resume' });
      veilKey = '';
    });
    veil.querySelector('[data-action="training"]')?.addEventListener('click', () => {
      session = reduceSession(session, { type: 'continueTraining' });
      veilKey = '';
    });
    veil.querySelector('[data-action="restart"]')?.addEventListener('click', () => { void restart(); });
    veil.querySelector('[data-action="fresh"]')?.addEventListener('click', () => { freshSeed(); });
    veil.querySelector('[data-action="quality-low"]')?.addEventListener('click', () => {
      quality = { ratio: 0.65, slowMs: 0, fastMs: 0, mode: 'manual' };
    });
    veil.querySelector('[data-action="quality-auto"]')?.addEventListener('click', () => {
      quality = { ...initialQuality(), mode: 'auto' };
    });
    veil.querySelector<HTMLInputElement>('#sensitivity')?.addEventListener('input', (event) => {
      sensitivity = Number((event.target as HTMLInputElement).value);
    });
  };

  const paintPanel = () => {
    const key = `${panel}:${puzzleId ?? ''}:${codeBuffer}:${picks.join(',')}:${hintText}:${game.inventoryIds.join(',')}:${game.journalIds.join(',')}`;
    if (key === panelKey) return;
    panelKey = key;
    if (panel === 'none') {
      panelRoot.hidden = true;
      panelRoot.innerHTML = '';
      panelRoot.removeAttribute('role');
      return;
    }
    panelRoot.hidden = false;
    panelRoot.setAttribute('role', 'dialog');
    panelRoot.setAttribute('aria-modal', 'true');
    const puzzle = world.puzzles.find((candidate) => candidate.id === puzzleId) ?? null;
    if (panel === 'journal') {
      panelRoot.setAttribute('aria-label', 'Carnet');
      const notes = game.journalIds.map((id) => tokenLabel(world, id));
      panelRoot.innerHTML = `<h2>Carnet</h2>${notes.length ? `<ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : '<p>Aucune note pour l’instant.</p>'}<button type="button" data-action="close">Fermer</button>`;
    } else if (panel === 'inventory') {
      panelRoot.setAttribute('aria-label', 'Inventaire');
      const items = game.inventoryIds.map((id) => tokenButton(world, id));
      panelRoot.innerHTML = `<h2>Inventaire</h2><div class="choices">${items.join('') || '<p>Ton sac est vide.</p>'}</div><button type="button" data-action="close">Fermer</button>`;
    } else if (panel === 'hint') {
      panelRoot.setAttribute('aria-label', 'Aide de Pat');
      panelRoot.innerHTML = `<h2>Pat</h2><p>${escapeHtml(hintText)}</p><button type="button" data-action="close">Fermer</button>`;
    } else if (panel === 'code') {
      panelRoot.setAttribute('aria-label', 'Cadenas');
      panelRoot.innerHTML = `<h2>Cadenas</h2><p class="code-view">${escapeHtml(codeBuffer.padEnd(3, '·'))}</p><div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => `<button type="button" data-digit="${digit}">${digit}</button>`).join('')}</div><div class="choices"><button type="button" data-action="clear">Effacer</button><button type="button" data-action="submit">Valider</button><button type="button" data-action="close">Fermer</button></div>`;
    } else if ((panel === 'symbols' || panel === 'order') && puzzle && (puzzle.family === 'symbols' || puzzle.family === 'order')) {
      panelRoot.setAttribute('aria-label', panel === 'symbols' ? 'Symboles' : 'Mécanismes');
      const options = [...puzzle.solution].sort((a, b) => tokenLabel(world, a).localeCompare(tokenLabel(world, b), 'fr'));
      panelRoot.innerHTML = `<h2>${panel === 'symbols' ? 'Symboles' : 'Mécanismes'}</h2><p>${picks.map((id) => escapeHtml(tokenLabel(world, id))).join(' · ') || 'Rien de choisi.'}</p><div class="choices">${options.map((id) => `<button type="button" data-pick="${escapeHtml(id)}">${tokenButton(world, id)}</button>`).join('')}</div><div class="choices"><button type="button" data-action="clear">Effacer</button><button type="button" data-action="submit">Valider</button><button type="button" data-action="close">Fermer</button></div>`;
    } else if (panel === 'combine') {
      panelRoot.setAttribute('aria-label', 'Combinaison');
      panelRoot.innerHTML = `<h2>Combinaison</h2><p>${picks.map((id) => escapeHtml(tokenLabel(world, id))).join(' + ') || 'Choisis deux objets.'}</p><div class="choices">${game.inventoryIds.map((id) => `<button type="button" data-pick="${escapeHtml(id)}">${tokenButton(world, id)}</button>`).join('') || '<p>Ton sac est vide.</p>'}</div><div class="choices"><button type="button" data-action="clear">Effacer</button><button type="button" data-action="submit">Combiner</button><button type="button" data-action="close">Fermer</button></div>`;
    }
    panelRoot.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach((button) => {
      button.addEventListener('click', () => {
        if (codeBuffer.length < 3) codeBuffer += button.dataset.digit ?? '';
        panelKey = '';
      });
    });
    panelRoot.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.pick ?? '';
        const limit = panel === 'combine' ? 2 : limitFor(world, puzzleId);
        if (picks.includes(id) || picks.length >= limit) return;
        picks = [...picks, id];
        panelKey = '';
      });
    });
    panelRoot.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
      codeBuffer = '';
      picks = [];
      panelKey = '';
    });
    panelRoot.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      panel = 'none';
      panelKey = '';
    });
    panelRoot.querySelector('[data-action="submit"]')?.addEventListener('click', () => { submitPanel(); });
  };

  const apply = (previous: GameState, nextMessage: string, progressed: boolean, next: GameState) => {
    const clues = next.journalIds.filter((id) => !previous.journalIds.includes(id));
    message = clues.length ? clues.map((id) => tokenLabel(world, id)).join(' ') : nextMessage;
    if (progressed) session = reduceSession(session, { type: 'progress' });
    game = next;
    if (next.exitOpened && !previous.exitOpened) {
      physics.setDoorOpen(true);
      session = reduceSession(session, { type: 'win' });
      panel = 'none';
      veilKey = '';
    }
    panelKey = '';
  };

  const submitPanel = () => {
    const puzzle = world.puzzles.find((candidate) => candidate.id === puzzleId);
    if (!puzzle) return;
    const left = picks[0];
    const right = picks[1];
    const answer = puzzle.family === 'code'
      ? { family: 'code' as const, value: codeBuffer }
      : puzzle.family === 'symbols'
        ? { family: 'symbols' as const, value: picks }
        : puzzle.family === 'order'
          ? { family: 'order' as const, value: picks }
          : left && right
            ? { family: 'combine' as const, value: [left, right] as const }
            : null;
    if (!answer) return;
    const result = reduceGame(world, game, { type: 'submit', puzzleId: puzzle.id, answer });
    apply(game, result.message, result.progressed, result.state);
    if (result.progressed) {
      panel = 'none';
      codeBuffer = '';
      picks = [];
    }
  };

  const interact = () => {
    if (conceal() || panel !== 'none') return;
    const pose: Pose = physics.getPose();
    const id = scene.pick(pose);
    if (!id) {
      message = 'Rien à portée.';
      return;
    }
    if (id === world.exit.id) {
      const result = reduceGame(world, game, { type: 'openExit' });
      apply(game, result.message, result.progressed, result.state);
      return;
    }
    const spot = world.spots.find((candidate) => candidate.id === id);
    if (!spot) return;
    if (!game.discoveredIds.includes(spot.id)) {
      const discovered = reduceGame(world, game, { type: 'discover', spotId: spot.id });
      apply(game, discovered.message, discovered.progressed, discovered.state);
      if (!discovered.state.discoveredIds.includes(spot.id)) return;
    }
    if (spot.role === 'hide') {
      const clueMessage = message;
      for (const itemId of spot.contentIds) {
        if (world.puzzles.some((puzzle) => puzzle.clueIds.includes(itemId))) continue;
        const taken = reduceGame(world, game, { type: 'take', spotId: spot.id, itemId });
        apply(game, taken.message, taken.progressed, taken.state);
      }
      if (clueMessage) message = `${clueMessage} ${message}`.trim();
      return;
    }
    const puzzle = world.puzzles.find((candidate) => candidate.family === spot.family && !game.solvedIds.includes(candidate.id));
    if (!puzzle || !spot.family) {
      message = 'Ce mécanisme a déjà servi.';
      return;
    }
    const needs = puzzle.family === 'combine' ? [...puzzle.requires, ...puzzle.ingredients] : puzzle.requires;
    if (needs.some((need) => !game.inventoryIds.includes(need) || game.consumedIds.includes(need)) || puzzle.clueIds.some((clue) => !game.journalIds.includes(clue))) {
      message = 'Il te manque encore quelque chose.';
      return;
    }
    puzzleId = puzzle.id;
    codeBuffer = '';
    picks = [];
    panel = spot.family;
    panelKey = '';
  };

  const pause = () => {
    const action = sessionActionForVisibility('escape');
    if (!action) return;
    if (session.phase !== 'running' && session.phase !== 'training') return;
    panel = 'none';
    keys.clear();
    pointers.clear();
    session = reduceSession(session, action);
    veilKey = '';
    panelKey = '';
  };

  const restart = async () => {
    alive = false;
    physics.dispose();
    scene.dispose();
    world = generate(input);
    game = initialGame(world);
    session = initialSession(input.difficulty);
    quality = initialQuality();
    appliedRatio = -1;
    keys.clear();
    pointers.clear();
    panel = 'none';
    message = '';
    hintText = '';
    veilKey = '';
    panelKey = '';
    physics = await createPhysics(world);
    scene = createScene(canvas, world, mobile);
    alive = true;
  };

  const freshSeed = () => {
    const entropy = crypto.getRandomValues(new Uint32Array(12));
    const seed = mintSeed(Array.from(entropy), world.input.seed);
    location.assign(formatSeedUrl(new URL(location.href), { ...world.input, seed }).href);
  };

  const askHint = () => {
    const choice = selectHint(world, game, session);
    if (!choice) {
      message = 'Aucune aide disponible.';
      return;
    }
    const known = session.hintLevels[choice.puzzleId] ?? 0;
    if (choice.level > known) session = reduceSession(session, { type: 'hintUsed', puzzleId: choice.puzzleId });
    hintText = choice.text;
    panel = 'hint';
    panelKey = '';
  };

  root.querySelector('#pause')?.addEventListener('click', pause);
  root.querySelector('#journal')?.addEventListener('click', () => { panel = panel === 'journal' ? 'none' : 'journal'; panelKey = ''; });
  root.querySelector('#inventory')?.addEventListener('click', () => { panel = panel === 'inventory' ? 'none' : 'inventory'; panelKey = ''; });
  root.querySelector('#help')?.addEventListener('click', askHint);
  root.querySelector('#interact')?.addEventListener('click', () => { interactQueued = true; });

  const track = (zone: 'move' | 'look', element: HTMLElement | null) => {
    if (!element) return;
    const update = (event: PointerEvent) => {
      if (event.type === 'pointerdown') {
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          /* Les événements synthétiques n'ont pas toujours de pointeur capturable. */
        }
        pointers.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, zone });
      } else if (event.type === 'pointermove' && pointers.has(event.pointerId)) {
        const current = pointers.get(event.pointerId);
        if (!current) return;
        pointers.set(event.pointerId, { ...current, lastX: current.x, lastY: current.y, x: event.clientX, y: event.clientY });
      } else pointers.delete(event.pointerId);
    };
    element.addEventListener('pointerdown', update);
    element.addEventListener('pointermove', update);
    element.addEventListener('pointerup', update);
    element.addEventListener('pointercancel', update);
  };
  track('move', root.querySelector('#move-zone'));
  track('look', root.querySelector('#look-zone'));

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let originX = 0;
  let originY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    if (root.dataset.touch === '1') return;
    dragging = true;
    originX = lastX = event.clientX;
    originY = lastY = event.clientY;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (root.dataset.touch === '1') return;
    if (document.pointerLockElement === canvas && (event.movementX !== 0 || event.movementY !== 0)) {
      lookDx += event.movementX;
      lookDy += event.movementY;
      return;
    }
    if (!dragging) return;
    lookDx += event.clientX - lastX;
    lookDy += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - originX, event.clientY - originY);
    dragging = false;
    if (moved < 8 && document.pointerLockElement !== canvas) {
      void Promise.resolve(canvas.requestPointerLock()).catch(() => undefined);
    }
    if (document.pointerLockElement === canvas && moved < 8) interactQueued = true;
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      event.preventDefault();
      if (panel !== 'none') {
        panel = 'none';
        panelKey = '';
      } else pause();
      return;
    }
    if (event.code === 'KeyE' && !event.repeat) interactQueued = true;
    keys.add(event.code);
    if (event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => {
    const action = sessionActionForVisibility('blur');
    if (action) pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      const action = sessionActionForVisibility('hidden');
      if (action) pause();
    }
  });

  let previous = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (!alive) return;
    const deltaMs = Math.max(0, now - previous);
    previous = now;
    const playing = session.phase === 'running' || session.phase === 'training';
    if (playing) session = reduceSession(session, { type: 'tick', deltaMs });
    const canSteer = playing && panel === 'none' && !conceal();
    const keyboard = canSteer ? movementFromKeys(keys) : { moveX: 0, moveZ: 0 };
    const look = canSteer ? lookFromPointer(lookDx, lookDy, sensitivity) : { lookX: 0, lookY: 0 };
    lookDx = 0;
    lookDy = 0;
    const touch = canSteer ? frameFromPointers([...pointers.values()], sensitivity) : { moveX: 0, moveZ: 0, lookX: 0, lookY: 0, interact: false };
    for (const [id, pointer] of pointers) {
      if (pointer.zone === 'look') pointers.set(id, { ...pointer, lastX: pointer.x, lastY: pointer.y });
    }
    let moveX = keyboard.moveX + touch.moveX;
    let moveZ = keyboard.moveZ + touch.moveZ;
    const length = Math.hypot(moveX, moveZ);
    if (length > 1) {
      moveX /= length;
      moveZ /= length;
    }
    const inputFrame: InputFrame = {
      moveX,
      moveZ,
      lookX: look.lookX + touch.lookX,
      lookY: look.lookY + touch.lookY,
      interact: false,
    };
    if (playing) physics.step(inputFrame, deltaMs / 1000);
    if (interactQueued && canSteer) interact();
    interactQueued = false;
    const pose = physics.getPose();
    scene.render(pose, game);
    const target = canSteer ? scene.pick(pose) : null;
    const spot = world.spots.find((candidate) => candidate.id === target);
    targetName.textContent = spot?.label ?? (target === world.exit.id ? world.exit.label : '');
    timer.textContent = session.phase === 'training' || (session.phase === 'won' && session.outOfTime) ? 'Hors chrono' : formatClock(session.remainingMs);
    hintCount.textContent = `Aides : ${session.hintsUsed} / ${session.hintBudget}`;
    patLine.textContent = patComment(world, game);
    offer.hidden = !hintOfferReady(session);
    offer.textContent = 'Pat a une idée. Demande-lui si tu veux.';
    status.textContent = message;
    canvas.classList.toggle('concealed', conceal());
    root.dataset.phase = session.phase;
    root.dataset.x = pose.position.x.toFixed(3);
    root.dataset.z = pose.position.z.toFixed(3);
    root.dataset.yaw = pose.yaw.toFixed(3);
    root.dataset.pitch = pose.pitch.toFixed(3);
    root.dataset.targetId = target ?? '';
    root.dataset.targetLabel = targetName.textContent;
    root.dataset.inventory = game.inventoryIds.join(',');
    root.dataset.journal = game.journalIds.join(',');
    root.dataset.solved = game.solvedIds.join(',');
    root.dataset.pointers = String(pointers.size);
    root.dataset.visuals = String(scene.visualCount());
    root.dataset.doorX = scene.doorX().toFixed(3);
    root.dataset.theme = world.theme;
    root.dataset.layout = world.layoutId;
    if (mobile) {
      const active = session.phase === 'running' ? deltaMs : 0;
      const fps = deltaMs > 0 ? 1000 / deltaMs : 60;
      quality = updateQuality(quality, fps, active);
      const ratio = quality.ratio;
      if (ratio !== appliedRatio) {
        scene.setPixelRatio(ratio);
        appliedRatio = ratio;
      }
    } else if (appliedRatio !== 1) {
      scene.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      appliedRatio = 1;
    }
    paintVeil();
    paintPanel();
  };
  requestAnimationFrame(frame);
}

function limitFor(world: WorldDescription, puzzleId: Id | null): number {
  const puzzle = world.puzzles.find((candidate) => candidate.id === puzzleId);
  if (!puzzle) return 2;
  if (puzzle.family === 'symbols') return 3;
  if (puzzle.family === 'order') return puzzle.solution.length;
  return 2;
}

function tokenLabel(world: WorldDescription, id: Id): string {
  return world.tokens.find((token) => token.id === id)?.label ?? id;
}

function tokenButton(world: WorldDescription, id: Id): string {
  const token = world.tokens.find((candidate) => candidate.id === id);
  if (!token) return escapeHtml(id);
  return `${symbolFigure(token.symbol, token.color)}<span>${escapeHtml(token.label)}, ${escapeHtml(token.color)}</span>`;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function must(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Élément manquant : ${selector}`);
  return element;
}
