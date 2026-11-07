import {
  Board,
  BoardOption,
  Effect,
  LETTER_GROUPS,
  OptionItem,
  ROOT_NODE_ID,
  SweepEvent,
  SweepState,
  CTRL_SPEAK,
  CTRL_DELETE,
  CTRL_SPACE,
  CTRL_NEEDS
} from './types.js';

/**
 * Task 3: optionsFor returns the list of options for the current state.
 * The result varies by layer.
 */
export function optionsFor(state: SweepState, board: Board): OptionItem[] {
  switch (state.layer) {
    case 'rest':
      return [{ kind: 'placeholder' }];

    case 'needs':
    case 'followup':
      return board[state.nodeId].options.map((opt) => ({ kind: 'board', option: opt }));

    case 'alphabet': {
      const items: OptionItem[] = [];

      // Suggestions first
      state.suggestions.forEach((suggestion, index) => {
        items.push({ kind: 'suggestion', suggestion, index });
      });

      // Six letter groups
      LETTER_GROUPS.forEach((letters, groupIndex) => {
        items.push({ kind: 'group', groupIndex, letters });
      });

      // Four controls
      items.push({ kind: 'control', id: CTRL_SPEAK, label: 'Speak' });
      items.push({ kind: 'control', id: CTRL_DELETE, label: 'Delete' });
      items.push({ kind: 'control', id: CTRL_SPACE, label: 'Space' });
      items.push({ kind: 'control', id: CTRL_NEEDS, label: 'Needs' });

      return items;
    }

    case 'letters':
      return LETTER_GROUPS[state.groupIndex!].map((letter) => ({ kind: 'letter', letter }));

    case 'hold':
      return [{ kind: 'placeholder' }];
  }
}

/**
 * Task 3: optionCount is the length of the options list for the current layer.
 */
export function optionCount(state: SweepState, board: Board): number {
  return optionsFor(state, board).length;
}

/**
 * Task 4: initialState returns the starting state: at rest, waiting for a signal.
 */
export function initialState(board: Board): SweepState {
  return {
    layer: 'rest',
    nodeId: ROOT_NODE_ID,
    path: [],
    index: 0,
    fragments: [],
    draft: '',
    groupIndex: null,
    suggestions: [],
    held: null,
    lastMessage: null,
    idleSweeps: 0
  };
}

/**
 * next processes one event (tick, select, or suggestions) and returns the new state and effects.
 * This is the core state machine for the talking board.
 */
export function next(
  state: SweepState,
  event: SweepEvent,
  board: Board
): { state: SweepState; effects: Effect[] } {
  let newState = { ...state };
  const effects: Effect[] = [];

  if (event.type === 'tick') {
    // Tasks 5, 6, 10: Handle tick in each layer
    switch (state.layer) {
      case 'rest':
        // Task 5: R1 - Rest with tick: no-op
        return { state, effects };

      case 'needs':
      case 'followup':
      case 'alphabet': {
        // Task 6: R3 - Advance index on tick
        const current = optionCount(state, board);
        newState.index = state.index + 1;

        if (newState.index >= current) {
          newState.index = 0;
          newState.idleSweeps = state.idleSweeps + 1;

          // Task 6: R4 - Two full sweeps return to rest
          if (newState.idleSweeps >= 2) {
            newState.layer = 'rest';
          }
        }
        return { state: newState, effects };
      }

      case 'letters': {
        // Task 6 special case: Letters wrap back to alphabet, not to rest
        const current = LETTER_GROUPS[state.groupIndex!].length;
        newState.index = state.index + 1;

        if (newState.index >= current) {
          // Task 6 + R11 - Full sweep of letters returns to alphabet
          newState.layer = 'alphabet';
          newState.groupIndex = null;
          newState.index = 0;
          newState.idleSweeps = 0;
        }
        return { state: newState, effects };
      }

      case 'hold': {
        // Task 10: R18 - Tick during hold emits speak and bell, returns to needs
        effects.push({ type: 'speak', text: state.held!.text });

        if (state.held!.bell) {
          effects.push({ type: 'bell' });
        }

        newState.lastMessage = state.held!.text;

        // Clear draft only if held.source is 'draft'
        if (state.held!.source === 'draft') {
          newState.draft = '';
        }

        newState.fragments = [];
        newState.path = [];
        newState.nodeId = ROOT_NODE_ID;
        newState.groupIndex = null;
        newState.held = null;
        newState.layer = 'needs';
        newState.index = 0;
        newState.idleSweeps = 0;

        return { state: newState, effects };
      }
    }
  }

  if (event.type === 'select') {
    // Tasks 5, 7, 8, 9, 10: Handle select in each layer
    switch (state.layer) {
      case 'rest': {
        // Task 5: R2 - Select at rest wakes up
        newState.nodeId = ROOT_NODE_ID;
        newState.path = [];
        newState.fragments = [];
        newState.groupIndex = null;
        newState.held = null;
        newState.index = 0;
        newState.idleSweeps = 0;

        if (state.draft.length > 0) {
          newState.layer = 'alphabet';
        } else {
          newState.layer = 'needs';
        }
        return { state: newState, effects };
      }

      case 'needs':
      case 'followup': {
        // Task 7: Handle select on board options (needs and followup)
        const options = board[state.nodeId].options;
        const option = options[state.index];

        if (!option) {
          return { state, effects };
        }

        // Task 7: R8 - Spell action opens alphabet
        if (option.action === 'spell') {
          newState.layer = 'alphabet';
          newState.index = 0;
          newState.groupIndex = null;
          newState.idleSweeps = 0;
          effects.push({ type: 'requestSuggestions', draft: state.draft });
          return { state: newState, effects };
        }

        // Task 7: R7 - Back action pops path and fragments
        if (option.action === 'back') {
          if (state.path.length > 0) {
            newState.nodeId = state.path[state.path.length - 1];
            newState.path = state.path.slice(0, -1);
          }
          // Always pop exactly one fragment
          if (state.fragments.length > 0) {
            newState.fragments = state.fragments.slice(0, -1);
          }
          newState.layer = state.path.length > 1 ? 'followup' : 'needs';
          newState.index = 0;
          newState.idleSweeps = 0;
          return { state: newState, effects };
        }

        // Task 7: R5 - goto action navigates
        if (option.goto) {
          newState.path = [...state.path, state.nodeId];
          newState.fragments = [...state.fragments, option.say ?? ''];
          newState.nodeId = option.goto;
          newState.layer = 'followup';
          newState.index = 0;
          newState.idleSweeps = 0;
          return { state: newState, effects };
        }

        // Task 7: R6 - No goto completes the message
        {
          const finalFragments = [
            ...state.fragments,
            ...(option.say ? [option.say] : [])
          ];
          const heldText = finalFragments
            .filter((f) => f.length > 0)
            .join(' ');

          newState.fragments = finalFragments;
          newState.held = {
            text: heldText,
            bell: option.bell ?? false,
            source: 'board'
          };
          newState.layer = 'hold';
          newState.index = 0;
          return { state: newState, effects };
        }
      }

      case 'alphabet': {
        // Task 8: Handle select in alphabet layer
        const options = optionsFor(state, board);
        const item = options[state.index];

        if (!item) {
          return { state, effects };
        }

        // Task 8: R13 - Word suggestion
        if (item.kind === 'suggestion' && item.suggestion.kind === 'word') {
          // Find the last word in draft (after last space)
          const lastSpaceIdx = state.draft.lastIndexOf(' ');
          const beforeLastWord = lastSpaceIdx === -1 ? '' : state.draft.slice(0, lastSpaceIdx + 1);
          newState.draft = beforeLastWord + item.suggestion.text.toUpperCase() + ' ';
          newState.index = 0;
          newState.idleSweeps = 0;
          effects.push({ type: 'requestSuggestions', draft: newState.draft });
          return { state: newState, effects };
        }

        // Task 8: R14 - Sentence suggestion
        if (item.kind === 'suggestion' && item.suggestion.kind === 'sentence') {
          newState.held = {
            text: item.suggestion.text,
            bell: false,
            source: 'draft'
          };
          newState.layer = 'hold';
          newState.index = 0;
          newState.idleSweeps = 0;
          return { state: newState, effects };
        }

        // Task 8: R10 - Letter group selection
        if (item.kind === 'group') {
          newState.layer = 'letters';
          newState.groupIndex = item.groupIndex;
          newState.index = 0;
          newState.idleSweeps = 0;
          return { state: newState, effects };
        }

        // Task 8: R14, R15, R16, R17 - Control options
        if (item.kind === 'control') {
          // Task 8: R14 - Speak control
          if (item.id === CTRL_SPEAK) {
            const trimmedDraft = state.draft.trim();
            if (trimmedDraft.length > 0) {
              newState.held = {
                text: trimmedDraft,
                bell: false,
                source: 'draft'
              };
              newState.layer = 'hold';
              newState.index = 0;
              newState.idleSweeps = 0;
            }
            return { state: newState, effects };
          }

          // Task 8: R15 - Delete control
          if (item.id === CTRL_DELETE) {
            if (state.draft.length > 0) {
              newState.draft = state.draft.slice(0, -1);
            }
            newState.index = 0;
            newState.idleSweeps = 0;
            effects.push({ type: 'requestSuggestions', draft: newState.draft });
            return { state: newState, effects };
          }

          // Task 8: R16 - Space control
          if (item.id === CTRL_SPACE) {
            newState.draft = state.draft + ' ';
            newState.index = 0;
            newState.idleSweeps = 0;
            effects.push({ type: 'requestSuggestions', draft: newState.draft });
            return { state: newState, effects };
          }

          // Task 8: R17 - Needs control
          if (item.id === CTRL_NEEDS) {
            newState.layer = 'needs';
            newState.nodeId = ROOT_NODE_ID;
            newState.path = [];
            newState.fragments = [];
            newState.index = 0;
            newState.idleSweeps = 0;
            return { state: newState, effects };
          }
        }

        return { state, effects };
      }

      case 'letters': {
        // Task 9: R12 - Select letter adds to draft
        const letter = LETTER_GROUPS[state.groupIndex!][state.index];
        newState.draft = state.draft + letter;
        newState.layer = 'alphabet';
        newState.groupIndex = null;
        newState.index = 0;
        newState.idleSweeps = 0;
        effects.push({ type: 'requestSuggestions', draft: newState.draft });
        return { state: newState, effects };
      }

      case 'hold': {
        // Task 10: R19 - Select during hold cancels
        if (state.held!.source === 'board') {
          newState.layer = 'needs';
          newState.nodeId = ROOT_NODE_ID;
          newState.path = [];
          newState.fragments = [];
        } else {
          // source === 'draft'
          newState.layer = 'alphabet';
          newState.groupIndex = null;
        }
        newState.held = null;
        newState.index = 0;
        newState.idleSweeps = 0;
        return { state: newState, effects };
      }
    }
  }

  if (event.type === 'suggestions') {
    // Task 11: R20 - Handle suggestions event
    // If forDraft doesn't match, ignore the event
    if (event.forDraft !== state.draft) {
      return { state, effects };
    }

    // Update suggestions
    newState.suggestions = event.items;

    // Only adjust index in alphabet layer to keep highlighted item stable
    if (state.layer === 'alphabet') {
      const currentOptions = optionsFor(state, board);
      const currentItem = currentOptions[state.index];

      if (!currentItem) {
        newState.index = 0;
        return { state: newState, effects };
      }

      const newOptions = optionsFor(newState, board);

      // Keep group highlighted
      if (currentItem.kind === 'group') {
        const newIdx = newOptions.findIndex(
          (opt) => opt.kind === 'group' && opt.groupIndex === currentItem.groupIndex
        );
        if (newIdx >= 0) {
          newState.index = newIdx;
        }
        return { state: newState, effects };
      }

      // Keep control highlighted
      if (currentItem.kind === 'control') {
        const newIdx = newOptions.findIndex(
          (opt) => opt.kind === 'control' && opt.id === currentItem.id
        );
        if (newIdx >= 0) {
          newState.index = newIdx;
        }
        return { state: newState, effects };
      }

      // If was a suggestion that still exists, keep it highlighted
      if (currentItem.kind === 'suggestion') {
        const newIdx = newOptions.findIndex(
          (opt) =>
            opt.kind === 'suggestion' &&
            opt.suggestion.text === currentItem.suggestion.text
        );
        if (newIdx >= 0) {
          newState.index = newIdx;
          return { state: newState, effects };
        }

        // Suggestion no longer exists, move to first letter group
        const firstGroupIdx = newOptions.findIndex((opt) => opt.kind === 'group');
        if (firstGroupIdx >= 0) {
          newState.index = firstGroupIdx;
        }
        return { state: newState, effects };
      }
    }

    return { state: newState, effects };
  }

  return { state, effects };
}
