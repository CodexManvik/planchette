import { describe, it, expect } from 'vitest';
import { reduce, AppModel } from '../src/ui/model.js';
import { board } from '../src/core/board-content.js';
import { initialState } from '../src/core/sweep.js';

describe('reduce', () => {
  it('increments seq when effects are present', () => {
    const initialModel: AppModel = {
      sweep: initialState(board),
      pending: [],
      seq: 0
    };

    // Wake from rest with select - no effects
    const afterSelect = reduce(initialModel, { type: 'select' }, board);
    expect(afterSelect.seq).toBe(0); // No effects on wake
    expect(afterSelect.pending.length).toBe(0);
    expect(afterSelect.sweep.layer).toBe('needs');

    // Select Pain (has a goto, so produces no final effect)
    const afterPain = reduce(afterSelect, { type: 'select' }, board);
    expect(afterPain.seq).toBe(0); // No new effects
    expect(afterPain.sweep.layer).toBe('followup');

    // Tick to Chest
    const afterTick = reduce(afterPain, { type: 'tick' }, board);
    expect(afterTick.seq).toBe(0); // Tick produces no effects
    expect(afterTick.sweep.index).toBe(1);

    // Select Chest (has goto)
    const afterChest = reduce(afterTick, { type: 'select' }, board);
    expect(afterChest.seq).toBe(0);
    expect(afterChest.sweep.layer).toBe('followup');

    // Tick to Bad
    const afterTickBad = reduce(afterChest, { type: 'tick' }, board);
    expect(afterTickBad.seq).toBe(0);
    expect(afterTickBad.sweep.index).toBe(1);

    // Select Bad (no goto, message complete, held)
    const afterBad = reduce(afterTickBad, { type: 'select' }, board);
    expect(afterBad.seq).toBe(0);
    expect(afterBad.sweep.layer).toBe('hold');

    // Tick during hold (triggers speak effect)
    const afterHoldTick = reduce(afterBad, { type: 'tick' }, board);
    expect(afterHoldTick.seq).toBe(1); // Effects present!
    expect(afterHoldTick.pending.length).toBe(1);
    expect(afterHoldTick.pending[0].type).toBe('speak');
  });

  it('returns model with pending effects when effects exist', () => {
    const initialModel: AppModel = {
      sweep: initialState(board),
      pending: [],
      seq: 0
    };

    // Wake, select Pain, Chest, Bad, then hold tick
    let model = reduce(initialModel, { type: 'select' }, board);
    model = reduce(model, { type: 'select' }, board);
    model = reduce(model, { type: 'tick' }, board);
    model = reduce(model, { type: 'select' }, board);
    model = reduce(model, { type: 'tick' }, board);
    model = reduce(model, { type: 'select' }, board);
    const holdModel = reduce(model, { type: 'tick' }, board);

    expect(holdModel.pending.length).toBeGreaterThan(0);
    const speakEffect = holdModel.pending.find((e) => e.type === 'speak');
    expect(speakEffect).toBeDefined();
  });

  it('returns unchanged seq when no effects', () => {
    const initialModel: AppModel = {
      sweep: initialState(board),
      pending: [],
      seq: 5
    };

    const afterTick = reduce(initialModel, { type: 'tick' }, board);
    expect(afterTick.seq).toBe(5); // Unchanged
  });

  it('is pure: input model is not mutated', () => {
    const initialModel: AppModel = {
      sweep: initialState(board),
      pending: [],
      seq: 0
    };

    const originalSeq = initialModel.seq;
    const originalSweepLayer = initialModel.sweep.layer;

    reduce(initialModel, { type: 'select' }, board);

    expect(initialModel.seq).toBe(originalSeq);
    expect(initialModel.sweep.layer).toBe(originalSweepLayer);
  });
});
