import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { initialState, next, optionCount, optionsFor } from '../src/core/sweep';
import { board } from '../src/core/board-content';
import {
  SweepState,
  SweepEvent,
  LETTER_GROUPS,
  ROOT_NODE_ID,
  Effect,
  Suggestion,
  CTRL_SPEAK,
  CTRL_DELETE,
  CTRL_SPACE,
  CTRL_NEEDS
} from '../src/core/types';

describe('Sweep Logic Property Tests', () => {
  // ========== HELPERS ==========

  type Step =
    | { kind: 'tick' }
    | { kind: 'select' }
    | { kind: 'suggest'; items: Suggestion[]; stale: boolean };

  const WORD_POOL = ['need', 'water', 'nurse', 'please', 'help', 'pain'];
  const SENTENCE_POOL = ['I need water', 'Please help me', 'Call the nurse'];

  const stepArb: fc.Arbitrary<Step> = fc.oneof(
    fc.constant<Step>({ kind: 'tick' }),
    fc.constant<Step>({ kind: 'select' }),
    fc.record({
      kind: fc.constant('suggest' as const),
      items: fc.array(
        fc.oneof(
          fc.record({
            text: fc.constantFrom(...WORD_POOL),
            kind: fc.constant('word' as const)
          }),
          fc.record({
            text: fc.constantFrom(...SENTENCE_POOL),
            kind: fc.constant('sentence' as const)
          })
        ),
        { maxLength: 3 }
      ),
      stale: fc.boolean()
    })
  );

  interface Transition {
    prev: SweepState;
    event: SweepEvent;
    next: SweepState;
    effects: Effect[];
  }

  function applyStep(state: SweepState, step: Step): Transition {
    let event: SweepEvent;

    if (step.kind === 'tick') {
      event = { type: 'tick' };
    } else if (step.kind === 'select') {
      event = { type: 'select' };
    } else {
      const forDraft = step.stale ? state.draft + 'X' : state.draft;
      event = { type: 'suggestions', items: step.items, forDraft };
    }

    const result = next(state, event, board);
    return { prev: state, event, next: result.state, effects: result.effects };
  }

  function walk(steps: Step[]): Transition[] {
    const transitions: Transition[] = [];
    let state = initialState(board);

    for (const step of steps) {
      const t = applyStep(state, step);
      transitions.push(t);
      state = t.next;
    }

    return transitions;
  }

  function highlighted(state: SweepState): string {
    const options = optionsFor(state, board);
    const item = options[state.index];

    if (!item) {
      return 'placeholder:unknown';
    }

    switch (item.kind) {
      case 'board':
        return `board:${state.nodeId}:${item.option.id}`;
      case 'group':
        return `group:${item.groupIndex}`;
      case 'letter':
        return `letter:${state.groupIndex}:${item.letter}`;
      case 'control':
        return `control:${item.id}`;
      case 'suggestion':
        return `suggestion:${item.suggestion.text}`;
      case 'placeholder':
        if (state.layer === 'rest') return 'placeholder:rest';
        if (state.layer === 'hold') return 'placeholder:hold';
        return 'placeholder:unknown';
    }
  }

  interface StateKey {
    layer: string;
    nodeId: string;
    pathKey: string;
    index: number;
    groupIndex: number | null;
    heldText: string;
    draftEmpty: boolean;
    idleSweeps: number;
  }

  function stateKey(state: SweepState): StateKey {
    return {
      layer: state.layer,
      nodeId: state.nodeId,
      pathKey: state.path.join('/'),
      index: state.index,
      groupIndex: state.groupIndex,
      heldText: state.held?.text ?? '',
      draftEmpty: state.draft.length === 0,
      idleSweeps: state.idleSweeps
    };
  }

  function bfsReachable(): SweepState[] {
    interface QueueEntry {
      state: SweepState;
      depth: number;
    }

    const queue: QueueEntry[] = [{ state: initialState(board), depth: 0 }];
    const visited = new Map<string, SweepState>();
    const states: SweepState[] = [];

    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;

      const { state, depth } = entry;
      const key = JSON.stringify(stateKey(state));

      if (visited.has(key)) continue;
      visited.set(key, state);
      states.push(state);

      if (depth < 80) {
        const tickResult = next(state, { type: 'tick' }, board);
        queue.push({ state: tickResult.state, depth: depth + 1 });

        const selectResult = next(state, { type: 'select' }, board);
        queue.push({ state: selectResult.state, depth: depth + 1 });
      }
    }

    return states;
  }

  // ========== PROPERTIES ==========

  // P1: Exhaustive reachability
  it('P1: every board option, group, letter, and control is reachable', () => {
    const reached = bfsReachable();
    const highlightedSet = new Set(reached.map(highlighted));

    // Build expected set from board
    const expected = new Set<string>();

    // Board options
    for (const nodeId in board) {
      const node = board[nodeId];
      for (const option of node.options) {
        expected.add(`board:${nodeId}:${option.id}`);
      }
    }

    // Groups
    for (let g = 0; g < LETTER_GROUPS.length; g++) {
      expected.add(`group:${g}`);
    }

    // Letters
    for (let g = 0; g < LETTER_GROUPS.length; g++) {
      for (const letter of LETTER_GROUPS[g]) {
        expected.add(`letter:${g}:${letter}`);
      }
    }

    // Controls
    expected.add(`control:${CTRL_SPEAK}`);
    expected.add(`control:${CTRL_DELETE}`);
    expected.add(`control:${CTRL_SPACE}`);
    expected.add(`control:${CTRL_NEEDS}`);

    for (const exp of expected) {
      expect(highlightedSet.has(exp), `Expected ${exp} to be reachable`).toBe(true);
    }
  });

  // P2: Every reachable state can return to needs
  it('P2: every reachable state has a path back to needs root', () => {
    const reached = bfsReachable();

    for (const startState of reached) {
      interface QueueEntry {
        state: SweepState;
        depth: number;
      }

      const queue: QueueEntry[] = [{ state: startState, depth: 0 }];
      const visited = new Set<string>();
      let found = false;

      while (queue.length > 0) {
        const entry = queue.shift();
        if (!entry) break;

        const { state, depth } = entry;
        const key = JSON.stringify(stateKey(state));

        if (visited.has(key) || depth > 40) continue;
        visited.add(key);

        // Check if we've reached the goal state
        if (state.layer === 'needs' && state.nodeId === ROOT_NODE_ID && state.path.length === 0) {
          found = true;
          break;
        }

        // Enqueue tick
        const tickResult = next(state, { type: 'tick' }, board);
        queue.push({ state: tickResult.state, depth: depth + 1 });

        // Enqueue select
        const selectResult = next(state, { type: 'select' }, board);
        queue.push({ state: selectResult.state, depth: depth + 1 });
      }

      const highlightStr = highlighted(startState);
      const startLayerStr = startState.layer;
      expect(found, `Failed to reach needs from ${highlightStr} (layer: ${startLayerStr})`).toBe(true);
    }
  });

  // P3: Exhaustive select counts for all paths ending in hold
  it('P3: exact select counts for all paths to hold from needs', () => {
    interface Path {
      selects: number;
      heldText: string;
      bell: boolean;
    }

    const paths: Path[] = [];

    function dfs(state: SweepState, selectCount: number) {
      if (state.layer === 'hold') {
        paths.push({
          selects: selectCount,
          heldText: state.held!.text,
          bell: state.held!.bell
        });
        return;
      }

      if (state.layer !== 'needs' && state.layer !== 'followup') return;

      const options = board[state.nodeId].options;
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (option.action === 'back' || option.action === 'spell') continue;

        const newState = { ...state, index: i };
        const result = next(newState, { type: 'select' }, board);
        dfs(result.state, selectCount + 1);
      }
    }

    const start = initialState(board);
    const wakeResult = next(start, { type: 'select' }, board);
    dfs(wakeResult.state, 0);

    // Count by select count
    const oneSelect = paths.filter((p) => p.selects === 1);
    const twoSelect = paths.filter((p) => p.selects === 2);
    const threeSelect = paths.filter((p) => p.selects === 3);

    // 4 direct: Breathing, Toilet, Yes, No
    expect(oneSelect.length).toBe(4);

    // 6 two-step: Thirsty (2), Hot or cold (2), Call someone (2)
    expect(twoSelect.length).toBe(6);

    // 18 three-step: Pain (6 locations × 3 severities)
    expect(threeSelect.length).toBe(18);

    expect(paths.length).toBe(28);

    // Check specific messages
    const chestBad = paths.find((p) => p.heldText.includes('chest') && p.heldText.includes('bad'));
    expect(chestBad).toBeDefined();
    expect(chestBad!.bell).toBe(false);

    const breathing = paths.find((p) => p.heldText.includes("can't breathe"));
    expect(breathing).toBeDefined();
    expect(breathing!.bell).toBe(true);
  });

  // P4: Speak only from hold after tick
  it('P4: speak effects only occur on tick from hold, and entering hold requires select', () => {
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 1, maxLength: 50 }), (steps) => {
        const transitions = walk(steps);

        for (const t of transitions) {
          const hasSpeak = t.effects.some((e) => e.type === 'speak');

          if (hasSpeak) {
            expect(t.prev.layer).toBe('hold');
            expect(t.event.type).toBe('tick');
            expect(t.effects.find((e) => e.type === 'speak')?.type === 'speak' &&
                   (t.effects.find((e) => e.type === 'speak') as Effect & { type: 'speak' }).text)
              .toBe(t.prev.held!.text);
          }

          if (t.next.layer === 'hold' && t.prev.layer !== 'hold') {
            expect(t.event.type).toBe('select');
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  // P5: Select during hold cancels, no speak on subsequent ticks
  it('P5: after canceling hold with select, ticks emit no speak or bell', () => {
    fc.assert(
      fc.property(
        fc.array(stepArb, { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 30 }),
        (steps, tickCount) => {
          const transitions = walk(steps);
          const holdState = transitions.find((t) => t.next.layer === 'hold');

          if (!holdState) return;

          const cancelResult = next(holdState.next, { type: 'select' }, board);
          expect(cancelResult.effects).toEqual([]);

          let state = cancelResult.state;
          for (let i = 0; i < tickCount; i++) {
            const tickResult = next(state, { type: 'tick' }, board);
            const hasSpeak = tickResult.effects.some((e) => e.type === 'speak');
            const hasBell = tickResult.effects.some((e) => e.type === 'bell');
            expect(hasSpeak).toBe(false);
            expect(hasBell).toBe(false);
            state = tickResult.state;
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  // P6: Rest is stable under ticks
  it('P6: ticks at rest leave state unchanged and emit no effects', () => {
    fc.assert(
      fc.property(
        fc.array(stepArb, { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 20 }),
        (steps, tickCount) => {
          const transitions = walk(steps);
          const restStates = transitions.filter((t) => t.next.layer === 'rest');

          for (const t of restStates) {
            const restSnapshot = JSON.stringify(t.next);

            let state = t.next;
            for (let i = 0; i < tickCount; i++) {
              const result = next(state, { type: 'tick' }, board);
              expect(result.effects).toEqual([]);
              expect(JSON.stringify(result.state)).toBe(restSnapshot);
              state = result.state;
            }
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  // P7: Index bounds + highlight stability on suggestions
  it('P7: index always valid, and matching suggestions preserve highlight', () => {
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 1, maxLength: 100 }), (steps) => {
        const transitions = walk(steps);

        for (const t of transitions) {
          const count = optionCount(t.next, board);
          expect(t.next.index).toBeGreaterThanOrEqual(0);
          expect(t.next.index).toBeLessThan(count);

          // Check highlight stability on suggestion events
          if (t.event.type === 'suggestions' && t.prev.layer === 'alphabet') {
            const forDraftMatches = t.event.forDraft === t.prev.draft;
            if (!forDraftMatches) continue;

            const prevHighlight = highlighted(t.prev);
            const nextHighlight = highlighted(t.next);

            if (prevHighlight.startsWith('suggestion:')) {
              const prevText = prevHighlight.split(':')[1];
              const stillExists = t.next.suggestions.some((s) => s.text === prevText);

              if (stillExists) {
                expect(nextHighlight).toBe(prevHighlight);
              } else {
                expect(nextHighlight).toBe('group:0');
              }
            } else {
              expect(nextHighlight).toBe(prevHighlight);
            }
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  // P8: Stale suggestions are no-ops
  it('P8: stale suggestions leave state unchanged except matching ones change suggestions and index', () => {
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 1, maxLength: 50 }), (steps) => {
        const transitions = walk(steps);

        for (const t of transitions) {
          if (t.event.type !== 'suggestions') continue;

          const forDraftMatches = t.event.forDraft === t.prev.draft;

          if (!forDraftMatches) {
            expect(t.next).toEqual(t.prev);
            expect(t.effects).toEqual([]);
          } else {
            const prevCopy = { ...t.prev, suggestions: t.event.items };
            const nextCopy = { ...t.next };

            if (t.prev.layer === 'alphabet') {
              prevCopy.index = t.next.index;
            }

            expect(nextCopy).toEqual(prevCopy);
          }
        }
      }),
      { numRuns: 1000 }
    );
  });
});
