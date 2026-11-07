import { expect, test, type Page } from '@playwright/test';
import * as THREE from 'three';
import type { Puzzle, Vec3, WorldDescription } from '../src/domain/types';
import { generate } from '../src/generation/generate';
import { LAYOUT_IDS, THEME_IDS } from '../src/generation/layouts';
import { lookDirection } from '../src/runtime/scene';

const SEED = 'jouable-1';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    const url = response.url();
    if (response.status() >= 400) failed.push(`${response.status()} ${url}`);
    if (url.includes('.wasm') && !new URL(url).pathname.startsWith('/pat-escape/')) {
      failed.push(`wasm hors base ${url}`);
    }
  });
  page.once('close', () => {
    if (errors.length || failed.length) {
      console.error([...errors, ...failed].join('\n'));
    }
  });
});

test('la souris vers la droite fait regarder vers la droite de l’écran', async ({ page }) => {
  await openGame(page, 'discovery');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect.poll(async () => page.locator('#app').getAttribute('data-phase')).toBe('running');
  const before = await pose(page);
  const start = facingBasis(before.yaw, before.pitch);
  await dragLook(page, 180, 0);
  const afterRight = await pose(page);
  const rightFacing = facingBasis(afterRight.yaw, afterRight.pitch);
  expect(rightFacing.forward.dot(start.right)).toBeGreaterThan(0.05);

  await dragLook(page, -180, 0);
  await dragLook(page, 0, 160);
  const afterDown = await pose(page);
  const downFacing = facingBasis(afterDown.yaw, afterDown.pitch);
  expect(downFacing.forward.dot(start.up)).toBeLessThan(-0.05);
});

test('charge une graine, huit modules, et une cible nommée', async ({ page }) => {
  const world = generate({ seed: SEED, difficulty: 'discovery', version: 1 });
  await openGame(page, 'discovery');
  await expect(page.getByRole('listitem')).toHaveCount(8);
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.locator('#view')).toBeVisible();
  const start = await pose(page);
  expect(Math.hypot(start.x - world.spawn.x, start.z - world.spawn.z)).toBeLessThan(0.4);
  const spot = world.spots[0];
  expect(spot).toBeTruthy();
  if (!spot) return;
  await lookAt(page, spot.interaction);
  await expect.poll(async () => (await pose(page)).label.length).toBeGreaterThan(0);
  await page.screenshot({ path: '/opt/cursor/artifacts/pat-escape-room.png', fullPage: false });
});

for (const difficulty of ['discovery', 'standard', 'expert'] as const) {
  test(`termine ${difficulty} par l’interface`, async ({ page }) => {
    test.setTimeout(720_000);
    const world = generate({ seed: SEED, difficulty, version: 1 });
    await openGame(page, difficulty);
    await page.getByRole('button', { name: 'Commencer' }).click();
    await playThrough(page, world);
    await expect(page.getByRole('heading', { name: /réussi/i })).toBeVisible();
    await expect(page.getByText(SEED, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/hors chrono/i)).toHaveCount(0);
    if (difficulty === 'discovery') {
      await expect.poll(async () => page.locator('#app').getAttribute('data-door-x')).toBe('1.050');
    }
  });
}

test('une mauvaise réponse ne vide pas l’inventaire et la pause cache la pièce', async ({ page }) => {
  const world = generate({ seed: SEED, difficulty: 'discovery', version: 1 });
  await openGame(page, 'discovery');
  await page.getByRole('button', { name: 'Commencer' }).click();
  const code = world.puzzles.find((puzzle) => puzzle.family === 'code');
  expect(code).toBeTruthy();
  if (!code || code.family !== 'code') return;
  await revealClue(page, world, code);
  await openStation(page, world, code);
  const before = await page.locator('#app').getAttribute('data-inventory');
  const wrong = code.solution === '000' ? '001' : '000';
  for (const digit of wrong) await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByRole('status')).toContainText(/pas la bonne/i);
  expect(await page.locator('#app').getAttribute('data-inventory')).toBe(before);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Reprendre' })).toBeVisible();
  const background = await page.locator('#veil').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).toBe('rgb(20, 14, 10)');
  await expect(page.locator('#view')).toHaveCSS('visibility', 'hidden');
  const timer = await page.locator('#timer').innerText();
  await page.waitForTimeout(1100);
  expect(await page.locator('#timer').innerText()).toBe(timer);
  const frozen = await pose(page);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyW');
  const still = await pose(page);
  expect(still.x).toBeCloseTo(frozen.x, 2);
  expect(still.z).toBeCloseTo(frozen.z, 2);
  await page.getByRole('button', { name: 'Reprendre' }).click();
  await expect(page.locator('#view')).toHaveCSS('visibility', 'visible');
});

test('le tactile sépare déplacement, regard et interaction', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 360, height: 800 },
  });
  const page = await context.newPage();
  await openGame(page, 'discovery');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-touch', '1');
  const interact = page.getByRole('button', { name: 'Interagir' });
  const box = await interact.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(48);
  expect(box?.height).toBeGreaterThanOrEqual(48);
  const before = await pose(page);
  const move = page.locator('#move-zone');
  const moveBox = await move.boundingBox();
  expect(moveBox).toBeTruthy();
  if (!moveBox) return;
  await move.dispatchEvent('pointerdown', { pointerId: 1, clientX: moveBox.x + 40, clientY: moveBox.y + 120, bubbles: true });
  await move.dispatchEvent('pointermove', { pointerId: 1, clientX: moveBox.x + 40, clientY: moveBox.y + 40, bubbles: true });
  await page.waitForTimeout(350);
  await move.dispatchEvent('pointerup', { pointerId: 1, clientX: moveBox.x + 40, clientY: moveBox.y + 40, bubbles: true });
  const moved = await pose(page);
  expect(Math.hypot(moved.x - before.x, moved.z - before.z)).toBeGreaterThan(0.15);
  const look = page.locator('#look-zone');
  const lookBox = await look.boundingBox();
  expect(lookBox).toBeTruthy();
  if (!lookBox) return;
  const yaw = moved.yaw;
  await look.dispatchEvent('pointerdown', { pointerId: 2, clientX: lookBox.x + 30, clientY: lookBox.y + 80, bubbles: true, button: 0, buttons: 1, isPrimary: true });
  await look.dispatchEvent('pointermove', { pointerId: 2, clientX: lookBox.x + 200, clientY: lookBox.y + 80, bubbles: true, button: 0, buttons: 1, isPrimary: true });
  await expect.poll(async () => page.locator('#app').getAttribute('data-pointers')).not.toBe('0');
  await page.waitForTimeout(200);
  const looked = await pose(page);
  await look.dispatchEvent('pointerup', { pointerId: 2, clientX: lookBox.x + 200, clientY: lookBox.y + 80, bubbles: true });
  expect(Math.abs(looked.yaw - yaw)).toBeGreaterThan(0.05);
  await page.setViewportSize({ width: 800, height: 360 });
  await expect(interact).toBeVisible();
  const landscape = await interact.boundingBox();
  expect(landscape?.height).toBeGreaterThanOrEqual(48);
  await context.close();
});

const visualSeeds = new Map<string, string>();
for (const theme of THEME_IDS) {
  for (const layout of LAYOUT_IDS) visualSeeds.set(`${theme}:${layout}`, '');
}
for (let index = 0; index < 5000 && [...visualSeeds.values()].some((seed) => seed === ''); index += 1) {
  const seed = `v1-${index}`;
  const world = generate({ seed, difficulty: 'discovery', version: 1 });
  const key = `${world.theme}:${world.layoutId}`;
  if (visualSeeds.get(key) === '') visualSeeds.set(key, seed);
}

for (const theme of THEME_IDS) {
  for (const layout of LAYOUT_IDS) {
    test(`charge dix modèles ${theme} ${layout}`, async ({ page }) => {
      const seed = visualSeeds.get(`${theme}:${layout}`);
      expect(seed, `${theme} ${layout}`).toBeTruthy();
      const glb: string[] = [];
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('response', (response) => {
        if (response.url().includes('/models/') && response.url().endsWith('.glb')) {
          glb.push(`${response.status()} ${new URL(response.url()).pathname}`);
        }
      });
      await page.goto(`/pat-escape/?seed=${seed}&difficulty=discovery&version=1`);
      await expect.poll(async () => page.locator('#app').getAttribute('data-visuals'), { timeout: 20_000 }).toBe('10');
      await expect(page.locator('#app')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('#app')).toHaveAttribute('data-layout', layout);
      await expect(page.locator('#app')).toHaveAttribute('data-door-x', '3.000');
      expect(glb.filter((line) => line.startsWith('200 '))).toHaveLength(10);
      expect(glb.filter((line) => !line.startsWith('200 '))).toEqual([]);
      expect(errors).toEqual([]);
      await page.getByRole('button', { name: 'Commencer' }).click();
      await expect.poll(async () => page.locator('#app').getAttribute('data-phase')).toBe('running');
      await page.screenshot({ path: `/opt/cursor/artifacts/pat-escape-${theme}-${layout}.png`, fullPage: false });
    });
  }
}

test('un GLB en échec laisse les neuf autres et la partie jouable', async ({ page }) => {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  const glb: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.url().includes('/models/') && response.url().endsWith('.glb')) {
      glb.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.route('**/tapis_*.glb', (route) => route.fulfill({ status: 404, body: 'missing' }));
  await openGame(page, 'discovery');
  await expect.poll(async () => page.locator('#app').getAttribute('data-visuals'), { timeout: 20_000 }).toBe('9');
  expect(glb.filter((line) => line.startsWith('200 '))).toHaveLength(9);
  expect(glb.filter((line) => line.startsWith('404 '))).toHaveLength(1);
  expect(pageErrors).toEqual([]);
  expect(errors.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Commencer' }).click();
  const world = generate({ seed: SEED, difficulty: 'discovery', version: 1 });
  const spot = world.spots.find((candidate) => candidate.id !== 'tapis');
  expect(spot).toBeTruthy();
  if (!spot) return;
  await lookAt(page, spot.interaction);
  await expect.poll(async () => (await pose(page)).target).toBe(spot.id);
  await page.screenshot({ path: '/opt/cursor/artifacts/pat-escape-missing-tapis.png', fullPage: false });
});

test('recommencer recharge dix modèles sans laisser le compte bloqué', async ({ page }) => {
  const glb: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/models/') && response.url().endsWith('.glb') && response.status() === 200) glb.push(response.url());
  });
  await openGame(page, 'discovery');
  await expect.poll(async () => page.locator('#app').getAttribute('data-visuals'), { timeout: 20_000 }).toBe('10');
  expect(glb).toHaveLength(10);
  await page.getByRole('button', { name: 'Commencer' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Recommencer cette graine' }).click();
  await expect.poll(async () => page.locator('#app').getAttribute('data-visuals'), { timeout: 20_000 }).toBe('10');
  expect(glb).toHaveLength(20);
});

async function openGame(page: Page, difficulty: 'discovery' | 'standard' | 'expert'): Promise<void> {
  await page.goto(`/pat-escape/?seed=${SEED}&difficulty=${difficulty}&version=1`);
  await expect(page.getByRole('button', { name: 'Commencer' })).toBeVisible();
}

async function playThrough(page: Page, world: WorldDescription): Promise<void> {
  for (const puzzle of world.puzzles) {
    if (puzzle.family === 'combine') {
      for (const ingredient of puzzle.ingredients) {
        const holder = world.spots.find((spot) => spot.contentIds.includes(ingredient));
        if (holder) await visit(page, holder.id, holder.interaction);
      }
    }
    await revealClue(page, world, puzzle);
    await openStation(page, world, puzzle);
    await answer(page, world, puzzle);
  }
  await visit(page, world.exit.id, world.exit.interaction);
  await page.keyboard.press('KeyE');
}

async function revealClue(page: Page, world: WorldDescription, puzzle: Puzzle): Promise<void> {
  const spot = world.spots.find((candidate) => candidate.contentIds.some((id) => puzzle.clueIds.includes(id)));
  if (!spot) return;
  await visit(page, spot.id, spot.interaction);
  await expect.poll(async () => page.locator('#app').getAttribute('data-journal')).toContain(puzzle.clueIds[0] ?? '');
}

async function openStation(page: Page, world: WorldDescription, puzzle: Puzzle): Promise<void> {
  const station = world.spots.find((spot) => spot.id === puzzle.stationId);
  expect(station).toBeTruthy();
  if (!station) return;
  await visit(page, station.id, station.interaction);
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function answer(page: Page, world: WorldDescription, puzzle: Puzzle): Promise<void> {
  if (puzzle.family === 'code') {
    for (const digit of puzzle.solution) await page.getByRole('button', { name: digit, exact: true }).click();
    await page.getByRole('button', { name: 'Valider' }).click();
  } else if (puzzle.family === 'symbols' || puzzle.family === 'order') {
    for (const id of puzzle.solution) await clickToken(page, world, id);
    await page.getByRole('button', { name: 'Valider' }).click();
  } else {
    for (const id of puzzle.ingredients) await clickToken(page, world, id);
    await page.getByRole('button', { name: 'Combiner' }).click();
  }
  await expect.poll(async () => page.locator('#app').getAttribute('data-solved')).toContain(puzzle.id);
}

async function clickToken(page: Page, world: WorldDescription, id: string): Promise<void> {
  const token = world.tokens.find((candidate) => candidate.id === id);
  const name = token ? `${token.label}, ${token.color}` : id;
  await page.getByRole('button', { name, exact: true }).click();
}

async function visit(page: Page, id: string, point: Vec3): Promise<void> {
  const stand = standPoint(point);
  await walkNear(page, stand.x, stand.z);
  await aim(page, point);
  const aimed = await pose(page);
  if (aimed.target !== id) {
    throw new Error(`visée ${id}, vu ${aimed.target || 'rien'} à ${JSON.stringify(aimed)}`);
  }
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(80);
}

function standPoint(point: Vec3): { x: number; z: number } {
  if (point.x > 2.15 && point.x < 3.85) {
    return { x: point.x, z: Math.min(4.9, Math.max(0.95, point.z)) };
  }
  const x = point.x >= 3 ? Math.max(2.35, point.x - 0.9) : Math.min(3.65, point.x + 0.9);
  return { x, z: Math.min(4.9, Math.max(0.95, point.z)) };
}

async function walkNear(page: Page, x: number, z: number): Promise<void> {
  let previous = await pose(page);
  for (let step = 0; step < 50; step += 1) {
    const now = await pose(page);
    if (Math.hypot(x - now.x, z - now.z) < 0.7) return;
    if (Math.hypot(now.x - previous.x, now.z - previous.z) < 0.04) {
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(160);
      await page.keyboard.up('KeyD');
    }
    previous = now;
    await turnTo(page, Math.atan2(x - now.x, z - now.z));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(380);
    await page.keyboard.up('KeyW');
  }
  throw new Error(`déplacement impossible vers ${x}, ${z} depuis ${JSON.stringify(await pose(page))}`);
}

async function aim(page: Page, point: Vec3): Promise<void> {
  const now = await pose(page);
  await turnTo(page, Math.atan2(point.x - now.x, point.z - now.z));
  const horizontal = Math.max(0.25, Math.hypot(point.x - now.x, point.z - now.z));
  const desired = Math.atan2(point.y - 1.55, horizontal);
  const delta = desired - (await pose(page)).pitch;
  if (Math.abs(delta) > 0.06) {
    await dragLook(page, 0, Math.max(-360, Math.min(360, -delta / 0.0022)));
  }
}

async function lookAt(page: Page, point: Vec3): Promise<void> {
  await aim(page, point);
}

async function turnTo(page: Page, yaw: number): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    const now = await pose(page);
    const delta = wrap(yaw - now.yaw);
    if (Math.abs(delta) < 0.08) return;
    const pixels = Math.max(-420, Math.min(420, -delta / 0.0022));
    await dragLook(page, pixels, 0);
  }
}

async function dragLook(page: Page, dx: number, dy: number): Promise<void> {
  const canvas = page.locator('#view');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas absent');
  const startX = box.x + box.width / 2;
  const startY = box.y + Math.min(box.height / 2, box.height - 80);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: Math.max(2, Math.min(4, Math.ceil(Math.abs(dx + dy) / 120))) });
  await page.mouse.up();
}

async function pose(page: Page): Promise<{ x: number; z: number; yaw: number; pitch: number; label: string; target: string }> {
  return page.locator('#app').evaluate((element) => ({
    x: Number(element.dataset.x ?? 0),
    z: Number(element.dataset.z ?? 0),
    yaw: Number(element.dataset.yaw ?? 0),
    pitch: Number(element.dataset.pitch ?? 0),
    label: element.dataset.targetLabel ?? '',
    target: element.dataset.targetId ?? '',
  }));
}

function facingBasis(yaw: number, pitch: number) {
  const camera = new THREE.PerspectiveCamera();
  const eye = new THREE.Vector3(0, 1.55, 0);
  const direction = lookDirection(yaw, pitch);
  camera.position.copy(eye);
  camera.up.set(0, 1, 0);
  camera.lookAt(eye.x + direction.x, eye.y + direction.y, eye.z + direction.z);
  camera.updateMatrixWorld(true);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  return { forward, right, up };
}

function wrap(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}
