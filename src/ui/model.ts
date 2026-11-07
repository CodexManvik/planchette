import { Board, SweepEvent, SweepState, Effect } from '../core/types.js';
import { next } from '../core/sweep.js';

export interface AppModel {
  sweep: SweepState;
  pending: Effect[];
  seq: number;
}

/**
 * Pure reducer that wraps next() and returns AppModel with effects and seq.
 * No side effects run inside this function.
 */
export function reduce(model: AppModel, event: SweepEvent, board: Board): AppModel {
  const { state: newSweep, effects } = next(model.sweep, event, board);

  if (effects.length > 0) {
    return {
      sweep: newSweep,
      pending: effects,
      seq: model.seq + 1
    };
  }

  return { ...model, sweep: newSweep };
}
