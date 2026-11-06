import { describe, expect, it } from 'vitest';
import {
  hintOfferReady,
  initialSession,
  reduceSession,
  sessionActionForVisibility,
} from '../src/domain/session';

function advance(state: ReturnType<typeof initialSession>, ms: number) {
  let next = state;
  let left = ms;
  while (left > 0) {
    const step = Math.min(2_000, left);
    next = reduceSession(next, { type: 'tick', deltaMs: step });
    left -= step;
  }
  return next;
}

describe('cycle de vie du temps', () => {
  it('ne décompte pas pendant l’introduction', () => {
    const intro = initialSession('standard');
    expect(intro.phase).toBe('intro');
    expect(intro.remainingMs).toBe(900_000);
    expect(intro.hintBudget).toBe(3);
    const ticked = reduceSession(intro, { type: 'tick', deltaMs: 1_000 });
    expect(ticked.phase).toBe('intro');
    expect(ticked.remainingMs).toBe(900_000);
    expect(ticked.activeMs).toBe(0);
  });

  it('décompte en jeu et laisse tourner le temps sans action de pause', () => {
    let session = reduceSession(initialSession('discovery'), { type: 'start' });
    expect(session.phase).toBe('running');
    session = reduceSession(session, { type: 'tick', deltaMs: 1_000 });
    expect(session.remainingMs).toBe(1_199_000);
    expect(session.activeMs).toBe(1_000);
    expect(session.sinceProgressMs).toBe(1_000);
  });

  it('suspend le temps en pause et ne reprend qu’avec une action explicite', () => {
    let session = reduceSession(initialSession('expert'), { type: 'start' });
    session = reduceSession(session, { type: 'tick', deltaMs: 1_500 });
    session = reduceSession(session, { type: 'pause' });
    const paused = reduceSession(session, { type: 'tick', deltaMs: 1_500 });
    expect(paused.phase).toBe('paused');
    expect(paused.remainingMs).toBe(session.remainingMs);
    expect(paused.activeMs).toBe(session.activeMs);
    expect(reduceSession(paused, { type: 'tick', deltaMs: 100 }).phase).toBe('paused');
    expect(reduceSession(paused, { type: 'resume' }).phase).toBe('running');
  });

  it('expire à zéro pile, sans temps négatif', () => {
    let session = reduceSession(initialSession('discovery'), { type: 'start' });
    session = advance(session, 1_200_000 - 400);
    expect(session.remainingMs).toBe(400);
    session = reduceSession(session, { type: 'tick', deltaMs: 800 });
    expect(session.remainingMs).toBe(0);
    expect(session.phase).toBe('expired');
    expect(session.activeMs).toBe(1_200_000);
    const stuck = reduceSession(session, { type: 'tick', deltaMs: 500 });
    expect(stuck.phase).toBe('expired');
    expect(stuck.remainingMs).toBe(0);
  });

  it('ignore un grand delta de retour en arrière-plan', () => {
    let session = reduceSession(initialSession('discovery'), { type: 'start' });
    session = reduceSession(session, { type: 'tick', deltaMs: 1_000 });
    const remaining = session.remainingMs;
    session = reduceSession(session, { type: 'tick', deltaMs: 30_000 });
    expect(session.remainingMs).toBe(remaining);
    expect(session.activeMs).toBe(1_000);
  });

  it('passe en entraînement puis en victoire hors chrono', () => {
    let session = advance(reduceSession(initialSession('expert'), { type: 'start' }), 600_000);
    expect(session.phase).toBe('expired');
    session = reduceSession(session, { type: 'continueTraining' });
    expect(session.phase).toBe('training');
    expect(session.outOfTime).toBe(true);
    const active = session.activeMs;
    session = reduceSession(session, { type: 'tick', deltaMs: 1_000 });
    expect(session.remainingMs).toBe(0);
    expect(session.activeMs).toBe(active);
    session = reduceSession(session, { type: 'pause' });
    session = reduceSession(session, { type: 'resume' });
    expect(session.phase).toBe('training');
    session = reduceSession(session, { type: 'win' });
    expect(session.phase).toBe('won');
    expect(session.outOfTime).toBe(true);
  });

  it('remet le compteur d’inactivité à zéro quand la partie avance', () => {
    let session = advance(reduceSession(initialSession('discovery'), { type: 'start' }), 90_000);
    expect(session.sinceProgressMs).toBe(90_000);
    expect(hintOfferReady(session)).toBe(true);
    expect(session.hintsUsed).toBe(0);
    session = reduceSession(session, { type: 'progress' });
    expect(session.sinceProgressMs).toBe(0);
    expect(hintOfferReady(session)).toBe(false);
  });

  it('borne les aides au budget et plafonne le niveau', () => {
    let session = reduceSession(initialSession('expert'), { type: 'start' });
    session = reduceSession(session, { type: 'hintUsed', puzzleId: 'puzzle-a' });
    expect(session.hintsUsed).toBe(1);
    expect(session.hintLevels['puzzle-a']).toBe(1);
    session = reduceSession(session, { type: 'hintUsed', puzzleId: 'puzzle-b' });
    expect(session.hintsUsed).toBe(1);
    expect(session.hintLevels['puzzle-b']).toBeUndefined();

    let discovery = reduceSession(initialSession('discovery'), { type: 'start' });
    for (let count = 0; count < 5; count += 1) {
      discovery = reduceSession(discovery, { type: 'hintUsed', puzzleId: 'puzzle-a' });
    }
    expect(discovery.hintsUsed).toBe(3);
    expect(discovery.hintLevels['puzzle-a']).toBe(3);
  });

  it('met en pause au flou, à la page cachée et à Échap, sans reprise automatique', () => {
    expect(sessionActionForVisibility('blur')).toEqual({ type: 'pause' });
    expect(sessionActionForVisibility('hidden')).toEqual({ type: 'pause' });
    expect(sessionActionForVisibility('escape')).toEqual({ type: 'pause' });
    expect(sessionActionForVisibility('visible')).toBeNull();
  });
});
