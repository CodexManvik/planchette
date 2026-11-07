import { describe, it, expect } from 'vitest';
import { initialState, next, optionCount, optionsFor } from '../src/core/sweep';
import { board } from '../src/core/board-content';

describe('Sweep Logic Unit Tests', () => {
  // Task 5: R1 - Rest behavior (tick at rest)
  it('R1: tick at rest changes nothing', () => {
    const state = initialState(board);
    expect(state.layer).toBe('rest');

    const { state: nextState, effects } = next(state, { type: 'tick' }, board);

    expect(nextState.layer).toBe('rest');
    expect(nextState.index).toBe(state.index);
    expect(effects).toEqual([]);
  });

  // Task 5: R2 - Rest wake-up (select opens needs when draft is empty)
  it('R2: select at rest with empty draft opens needs', () => {
    const state = initialState(board);
    expect(state.layer).toBe('rest');
    expect(state.draft).toBe('');

    const { state: nextState } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('needs');
    expect(nextState.nodeId).toBe('needs');
    expect(nextState.path).toEqual([]);
    expect(nextState.fragments).toEqual([]);
    expect(nextState.groupIndex).toBeNull();
    expect(nextState.held).toBeNull();
    expect(nextState.index).toBe(0);
    expect(nextState.idleSweeps).toBe(0);
  });

  // Task 5: R2 - Rest wake-up (select opens alphabet when draft is non-empty)
  it('R2: select at rest with non-empty draft opens alphabet', () => {
    let state = initialState(board);
    state.draft = 'HELLO';

    const { state: nextState } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('alphabet');
    expect(nextState.nodeId).toBe('needs');
    expect(nextState.path).toEqual([]);
    expect(nextState.fragments).toEqual([]);
    expect(nextState.index).toBe(0);
  });

  // Task 6: R3 - Tick advances index
  it('R3: tick in needs advances index', () => {
    let state = initialState(board);
    state.layer = 'needs';

    for (let i = 0; i < 9; i++) {
      const { state: nextState } = next(state, { type: 'tick' }, board);
      expect(nextState.index).toBe((i + 1) % optionCount(state, board));
      state = nextState;
    }
  });

  // Task 6: R3 - Wrap-around on last option
  it('R3: tick wraps index at end of options', () => {
    let state = initialState(board);
    state.layer = 'needs';
    const count = optionCount(state, board);

    state.index = count - 1;
    const { state: nextState } = next(state, { type: 'tick' }, board);

    expect(nextState.index).toBe(0);
  });

  // Task 6: R4 - Two idle sweeps return to rest
  it('R4: two full sweeps return to rest', () => {
    let state = initialState(board);
    state.layer = 'needs';
    const count = optionCount(state, board);

    // First sweep: from index 0 to end and wrap (idleSweeps = 1)
    for (let i = 0; i < count; i++) {
      const { state: nextState } = next(state, { type: 'tick' }, board);
      state = nextState;
    }
    expect(state.idleSweeps).toBe(1);
    expect(state.layer).toBe('needs');

    // Second sweep: from index 0 to end and wrap (idleSweeps = 2, layer = rest)
    for (let i = 0; i < count; i++) {
      const { state: nextState } = next(state, { type: 'tick' }, board);
      state = nextState;
      if (state.layer === 'rest') break;
    }

    expect(state.layer).toBe('rest');
  });

  // Task 7: R5 - Select with goto navigates to follow-up
  it('R5: select Pain opens pain-location follow-up', () => {
    let state = initialState(board);
    state.layer = 'needs';

    // Pain is at index 0
    expect(state.index).toBe(0);
    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.path).toContain('needs');
    expect(nextState.nodeId).toBe('pain-location');
    expect(nextState.layer).toBe('followup');
    expect(nextState.fragments).toContain(''); // Pain has no say value
    expect(nextState.index).toBe(0);
    expect(nextState.idleSweeps).toBe(0);
    expect(effects).toEqual([]);
  });

  // Task 7: R6 - Select with no goto completes message
  it('R6: select Breathing (no goto) moves to hold with message', () => {
    let state = initialState(board);
    state.layer = 'needs';
    state.index = 1; // Breathing

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('hold');
    expect(nextState.held).not.toBeNull();
    expect(nextState.held!.text).toBe("I can't breathe well.");
    expect(nextState.held!.bell).toBe(true);
    expect(nextState.held!.source).toBe('board');
    expect(nextState.index).toBe(0);
    expect(effects).toEqual([]);
  });

  // Task 7: R7 - Select Back returns to parent
  it('R7: select Back returns from follow-up to needs', () => {
    let state = initialState(board);
    state.layer = 'followup';
    state.nodeId = 'pain-location';
    state.path = ['needs'];
    state.fragments = [''];

    // Go back is the last option in pain-location
    state.index = board['pain-location'].options.length - 1;

    const { state: nextState } = next(state, { type: 'select' }, board);

    expect(nextState.nodeId).toBe('needs');
    expect(nextState.path).toEqual([]);
    expect(nextState.fragments).toEqual([]);
    expect(nextState.layer).toBe('needs');
    expect(nextState.index).toBe(0);
  });

  // Task 7: R8 - Select Spell opens alphabet
  it('R8: select Spell opens alphabet with requestSuggestions effect', () => {
    let state = initialState(board);
    state.layer = 'needs';
    state.index = 8; // Spell is the 9th option (index 8)
    state.draft = 'TEST';

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('alphabet');
    expect(nextState.index).toBe(0);
    expect(nextState.groupIndex).toBeNull();
    expect(nextState.idleSweeps).toBe(0);
    expect(effects).toContainEqual({ type: 'requestSuggestions', draft: 'TEST' });
  });

  // Task 7: Example test - Pain → Chest → Bad
  it('R5, R6, R18: Pain → Chest → Bad produces correct message', () => {
    let state = initialState(board);

    // Wake up
    ({ state } = next(state, { type: 'select' }, board));
    expect(state.layer).toBe('needs');

    // Select Pain (index 0)
    ({ state } = next(state, { type: 'select' }, board));
    expect(state.layer).toBe('followup');
    expect(state.nodeId).toBe('pain-location');
    expect(state.fragments).toEqual(['']);

    // Tick to Chest (index 1)
    ({ state } = next(state, { type: 'tick' }, board));
    expect(state.index).toBe(1);

    // Select Chest
    ({ state } = next(state, { type: 'select' }, board));
    expect(state.nodeId).toBe('pain-severity');
    expect(state.fragments).toEqual(['', 'Pain in my chest.']);

    // Tick to Bad (index 1)
    ({ state } = next(state, { type: 'tick' }, board));
    expect(state.index).toBe(1);

    // Select Bad
    let result = next(state, { type: 'select' }, board);
    expect(result.state.layer).toBe('hold');
    expect(result.state.held!.text).toBe("Pain in my chest. It's bad.");
    expect(result.state.held!.bell).toBe(false);

    // Tick during hold to emit speak
    result = next(result.state, { type: 'tick' }, board);
    expect(result.effects).toContainEqual({ type: 'speak', text: "Pain in my chest. It's bad." });
    expect(result.state.layer).toBe('needs');
  });

  // Task 8: R9 - Alphabet layer sweep order
  it('R9: alphabet layer has suggestions, groups, and controls in order', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [
      { text: 'suggestion1', kind: 'word' },
      { text: 'suggestion2', kind: 'word' }
    ];

    const options = optionsFor(state, board);

    // First 2 are suggestions
    expect(options[0].kind).toBe('suggestion');
    expect(options[1].kind).toBe('suggestion');

    // Next 6 are groups
    for (let i = 2; i < 8; i++) {
      expect(options[i].kind).toBe('group');
    }

    // Last 4 are controls
    for (let i = 8; i < 12; i++) {
      expect(options[i].kind).toBe('control');
    }
  });

  // Task 8: R10 - Select letter group
  it('R10: select letter group opens letters layer', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];

    // First group is at index 0
    const { state: nextState } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('letters');
    expect(nextState.groupIndex).toBe(0);
    expect(nextState.index).toBe(0);
    expect(nextState.idleSweeps).toBe(0);
  });

  // Task 8: R11 - Full letter sweep returns to alphabet
  it('R11: full sweep of letters returns to alphabet', () => {
    let state = initialState(board);
    state.layer = 'letters';
    state.groupIndex = 0;

    const letterCount = 4; // A, B, C, D

    for (let i = 0; i < letterCount; i++) {
      const { state: nextState } = next(state, { type: 'tick' }, board);
      state = nextState;
    }

    expect(state.layer).toBe('alphabet');
    expect(state.groupIndex).toBeNull();
    expect(state.index).toBe(0);
    expect(state.idleSweeps).toBe(0);
  });

  // Task 9: R12 - Select letter adds to draft
  it('R12: select letter adds to draft and returns to alphabet', () => {
    let state = initialState(board);
    state.layer = 'letters';
    state.groupIndex = 0;
    state.index = 0; // A
    state.draft = 'TEST';

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.draft).toBe('TESTA');
    expect(nextState.layer).toBe('alphabet');
    expect(nextState.groupIndex).toBeNull();
    expect(nextState.index).toBe(0);
    expect(effects).toContainEqual({ type: 'requestSuggestions', draft: 'TESTA' });
  });

  // Task 8: R13 - Word suggestion replaces partial word
  it('R13: word suggestion replaces partial word and adds space', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.draft = 'I NEE';
    state.suggestions = [{ text: 'need', kind: 'word' }];

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.draft).toBe('I NEED ');
    expect(nextState.layer).toBe('alphabet');
    expect(nextState.index).toBe(0);
    expect(effects).toContainEqual({ type: 'requestSuggestions', draft: 'I NEED ' });
  });

  // Task 8: Example test - "I NEE" + suggestion "need"
  it('R13: example - I NEE plus need', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.draft = 'I NEE';
    state.suggestions = [{ text: 'need', kind: 'word' }];

    const { state: nextState } = next(state, { type: 'select' }, board);
    expect(nextState.draft).toBe('I NEED ');
  });

  // Task 8: R14 - Sentence suggestion
  it('R14: select sentence suggestion moves to hold', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [{ text: 'Please bring me water.', kind: 'sentence' }];

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('hold');
    expect(nextState.held!.text).toBe('Please bring me water.');
    expect(nextState.held!.source).toBe('draft');
    expect(nextState.held!.bell).toBe(false);
    expect(effects).toEqual([]);
  });

  // Task 8: R14 - Speak with non-empty draft
  it('R14: select Speak with non-empty draft moves to hold', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];
    state.draft = 'HELLO THERE';

    // Speak control is at index: suggestions (0) + groups (6) + 0 (Speak)
    state.index = 6;

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('hold');
    expect(nextState.held!.text).toBe('HELLO THERE');
    expect(nextState.held!.source).toBe('draft');
    expect(effects).toEqual([]);
  });

  // Task 8: R14 - Speak with empty draft does nothing
  it('R14: select Speak with empty draft does nothing', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];
    state.draft = '';

    // Speak control is at index 6
    state.index = 6;

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('alphabet');
    expect(nextState.held).toBeNull();
    expect(effects).toEqual([]);
  });

  // Task 8: R15 - Delete removes last character
  it('R15: select Delete removes last character from draft', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];
    state.draft = 'HELLO';

    // Delete control is at index: suggestions (0) + groups (6) + 1 (Delete)
    state.index = 7;

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.draft).toBe('HELL');
    expect(nextState.layer).toBe('alphabet');
    expect(effects).toContainEqual({ type: 'requestSuggestions', draft: 'HELL' });
  });

  // Task 8: R15 - Delete with empty draft does nothing
  it('R15: select Delete with empty draft does nothing', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];
    state.draft = '';

    state.index = 7;

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.draft).toBe('');
    expect(effects).toContainEqual({ type: 'requestSuggestions', draft: '' });
  });

  // Task 8: R16 - Space adds space
  it('R16: select Space adds space to draft', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];
    state.draft = 'HELLO';

    // Space control is at index: suggestions (0) + groups (6) + 2 (Space)
    state.index = 8;

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.draft).toBe('HELLO ');
    expect(nextState.layer).toBe('alphabet');
    expect(effects).toContainEqual({ type: 'requestSuggestions', draft: 'HELLO ' });
  });

  // Task 8: R17 - Needs control returns to needs
  it('R17: select Needs returns to needs ring with draft preserved', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];
    state.draft = 'TEST';

    // Needs control is at index: suggestions (0) + groups (6) + 3 (Needs)
    state.index = 9;

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('needs');
    expect(nextState.nodeId).toBe('needs');
    expect(nextState.path).toEqual([]);
    expect(nextState.fragments).toEqual([]);
    expect(nextState.draft).toBe('TEST');
    expect(nextState.index).toBe(0);
    expect(effects).toEqual([]);
  });

  // Task 10: R18 - Tick during hold emits speak and bell
  it('R18: tick during hold emits speak and bell if set', () => {
    let state = initialState(board);
    state.layer = 'hold';
    state.held = { text: 'I can\'t breathe well.', bell: true, source: 'board' };

    const { state: nextState, effects } = next(state, { type: 'tick' }, board);

    expect(effects).toContainEqual({ type: 'speak', text: 'I can\'t breathe well.' });
    expect(effects).toContainEqual({ type: 'bell' });
    expect(nextState.layer).toBe('needs');
    expect(nextState.lastMessage).toBe('I can\'t breathe well.');
    expect(nextState.draft).toBe('');
  });

  // Task 10: R18 - Tick during hold preserves draft if source is 'board'
  it('R18: tick during hold preserves draft if source is board', () => {
    let state = initialState(board);
    state.layer = 'hold';
    state.draft = 'SAVED';
    state.held = { text: 'Some message', bell: false, source: 'board' };

    const { state: nextState } = next(state, { type: 'tick' }, board);

    expect(nextState.draft).toBe('SAVED');
  });

  // Task 10: R19 - Select during hold cancels from board
  it('R19: select during hold cancels and returns from board message', () => {
    let state = initialState(board);
    state.layer = 'hold';
    state.held = { text: 'Message', bell: false, source: 'board' };
    state.path = ['needs'];
    state.fragments = ['fragment'];

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('needs');
    expect(nextState.nodeId).toBe('needs');
    expect(nextState.path).toEqual([]);
    expect(nextState.fragments).toEqual([]);
    expect(nextState.held).toBeNull();
    expect(effects).toEqual([]);
  });

  // Task 10: R19 - Select during hold cancels from draft
  it('R19: select during hold cancels and returns from draft message', () => {
    let state = initialState(board);
    state.layer = 'hold';
    state.held = { text: 'Message', bell: false, source: 'draft' };
    state.draft = 'KEPT';

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('alphabet');
    expect(nextState.groupIndex).toBeNull();
    expect(nextState.draft).toBe('KEPT');
    expect(nextState.held).toBeNull();
    expect(effects).toEqual([]);
  });

  // Task 11: R20 - Suggestions event with matching forDraft
  it('R20: suggestions event with matching forDraft updates list', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.draft = 'HEL';

    const { state: nextState } = next(state, {
      type: 'suggestions',
      items: [{ text: 'hello', kind: 'word' }],
      forDraft: 'HEL'
    }, board);

    expect(nextState.suggestions).toEqual([{ text: 'hello', kind: 'word' }]);
  });

  // Task 11: R20 - Suggestions event with mismatched forDraft is ignored
  it('R20: suggestions event with mismatched forDraft is ignored', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.draft = 'HEL';
    state.suggestions = [];

    const { state: nextState } = next(state, {
      type: 'suggestions',
      items: [{ text: 'hello', kind: 'word' }],
      forDraft: 'WRONG'
    }, board);

    expect(nextState.suggestions).toEqual([]);
  });

  // Task 11: R20 - Keep highlighted group stable when suggestions arrive
  it('R20: suggestions arrival keeps highlighted group stable', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.draft = 'T';
    state.suggestions = [{ text: 'the', kind: 'word' }];

    // Move index to the first group (after 1 suggestion)
    state.index = 1;

    const { state: nextState } = next(state, {
      type: 'suggestions',
      items: [
        { text: 'the', kind: 'word' },
        { text: 'that', kind: 'word' },
        { text: 'there', kind: 'word' }
      ],
      forDraft: 'T'
    }, board);

    // Index should still point to the first group
    const newOptions = optionsFor(nextState, board);
    expect(newOptions[nextState.index].kind).toBe('group');
  });

  // Task 11: R20 - Move to first group if highlighted suggestion disappears
  it('R20: if highlighted suggestion disappears, move to first group', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.draft = 'HEL';
    state.suggestions = [{ text: 'hello', kind: 'word' }];

    // Index points to the suggestion
    state.index = 0;

    const { state: nextState } = next(state, {
      type: 'suggestions',
      items: [], // No more suggestions
      forDraft: 'HEL'
    }, board);

    const newOptions = optionsFor(nextState, board);
    // Should point to first letter group
    expect(newOptions[nextState.index].kind).toBe('group');
  });

  // Task 11: R20 - Suggestions event during hold does not interrupt hold
  it('R20: suggestions event during hold does not interrupt hold', () => {
    let state = initialState(board);
    state.layer = 'hold';
    state.draft = 'HEL';
    state.held = { text: 'Message', bell: false, source: 'draft' };

    const { state: nextState } = next(state, {
      type: 'suggestions',
      items: [{ text: 'hello', kind: 'word' }],
      forDraft: 'HEL'
    }, board);

    expect(nextState.layer).toBe('hold');
    expect(nextState.held).toEqual({ text: 'Message', bell: false, source: 'draft' });
    expect(nextState.suggestions).toEqual([{ text: 'hello', kind: 'word' }]);
  });

  // Task 19: Edge case - empty draft with Speak does nothing
  it('Task 19 edge case: empty draft with Speak does nothing', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];
    state.draft = '';

    // Speak control is at index: suggestions (0) + groups (6) + 0 (Speak)
    state.index = 6;

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('alphabet');
    expect(nextState.held).toBeNull();
    expect(effects).toEqual([]);
  });

  // Task 19: Edge case - empty draft with Delete does nothing
  it('Task 19 edge case: empty draft with Delete does nothing', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];
    state.draft = '';

    // Delete control is at index: suggestions (0) + groups (6) + 1 (Delete)
    state.index = 7;

    const { state: nextState, effects } = next(state, { type: 'select' }, board);

    expect(nextState.draft).toBe('');
    expect(nextState.layer).toBe('alphabet');
    expect(effects).toContainEqual({ type: 'requestSuggestions', draft: '' });
  });

  // Task 19: Edge case - suggestions with mismatched forDraft are ignored
  it('Task 19 edge case: suggestions with mismatched forDraft are ignored', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.draft = 'HEL';
    state.suggestions = [{ text: 'hello', kind: 'word' }];

    const { state: nextState } = next(state, {
      type: 'suggestions',
      items: [{ text: 'world', kind: 'word' }],
      forDraft: 'WRONG'
    }, board);

    // Suggestions should not change
    expect(nextState.suggestions).toEqual([{ text: 'hello', kind: 'word' }]);
  });

  // Task 19: Edge case - Back at first follow-up level returns to needs
  it('Task 19 edge case: Back at first follow-up level returns to needs', () => {
    let state = initialState(board);
    state.layer = 'followup';
    state.nodeId = 'pain-location';
    state.path = ['needs'];
    state.fragments = [''];
    state.index = board['pain-location'].options.length - 1; // Go back

    const { state: nextState } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('needs');
    expect(nextState.nodeId).toBe('needs');
    expect(nextState.path).toEqual([]);
    expect(nextState.fragments).toEqual([]);
  });

  // Task 19: Edge case - wrap during letters layer returns to alphabet (not rest)
  it('Task 19 edge case: wrap during letters layer returns to alphabet not rest', () => {
    let state = initialState(board);
    state.layer = 'letters';
    state.groupIndex = 0; // A, B, C, D
    state.index = 3; // At D

    // One tick wraps to alphabet
    const { state: nextState } = next(state, { type: 'tick' }, board);

    expect(nextState.layer).toBe('alphabet');
    expect(nextState.groupIndex).toBeNull();
    expect(nextState.index).toBe(0);
    expect(nextState.idleSweeps).toBe(0);
  });

  // Task 19: Edge case - matching suggestions event during hold does not interrupt hold
  it('Task 19 edge case: matching suggestions during hold does not interrupt hold', () => {
    let state = initialState(board);
    state.layer = 'hold';
    state.draft = 'TEST';
    state.held = { text: 'Message', bell: false, source: 'draft' };
    state.index = 0;

    const { state: nextState, effects } = next(state, {
      type: 'suggestions',
      items: [{ text: 'test', kind: 'word' }],
      forDraft: 'TEST'
    }, board);

    expect(nextState.layer).toBe('hold');
    expect(nextState.held).toEqual({ text: 'Message', bell: false, source: 'draft' });
    expect(nextState.index).toBe(0);
    expect(effects).toEqual([]);
  });

  // Task 19: Edge case - whitespace-only draft with Speak does nothing
  it('Task 19 edge case: whitespace-only draft with Speak does nothing', () => {
    let state = initialState(board);
    state.layer = 'alphabet';
    state.suggestions = [];
    state.draft = '   ';

    // Speak control is at index 6
    state.index = 6;

    const { state: nextState } = next(state, { type: 'select' }, board);

    expect(nextState.layer).toBe('alphabet');
    expect(nextState.held).toBeNull();
  });
});
