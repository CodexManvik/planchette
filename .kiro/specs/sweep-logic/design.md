# Sweep Logic Design

## Overview

The sweep logic is a pure state machine that processes ticks (time steps) and selects (user signals) to manage board state, highlight options, build messages, and emit effects. This module has no display code, no side effects, and no browser dependencies.

## Files

- `src/core/types.ts` — shared types and interfaces
- `src/core/board-content.ts` — needs ring data, follow-ups, wording, bell rules
- `src/core/sweep.ts` — pure state machine: `initialState()` and `next()`
- `tests/sweep.test.ts` — unit tests, one per requirement
- `tests/sweep.property.test.ts` — property-based tests with fast-check

## Types

### From Shared Interfaces

```ts
type Layer = 'rest' | 'needs' | 'followup' | 'alphabet' | 'letters' | 'hold';

interface BoardOption {
  id: string;          // unique option identifier
  label: string;       // display text
  say?: string;        // sentence fragment added to message
  goto?: string;       // next BoardNode id; no goto means message is complete
  bell?: boolean;      // ring bell when this message is spoken
  action?: 'spell' | 'back';
}

interface BoardNode {
  id: string;
  options: BoardOption[];
}

type Board = Record<string, BoardNode>;

interface Suggestion {
  text: string;
  kind: 'word' | 'sentence';
}

interface SweepState {
  layer: Layer;
  nodeId: string;            // current BoardNode for needs and followup
  path: string[];            // parent BoardNode ids, used by Back
  index: number;             // highlighted option
  fragments: string[];       // follow-up message built so far
  draft: string;             // spelled text
  groupIndex: number | null; // open letter group (0–5)
  suggestions: Suggestion[];
  held: { text: string; bell: boolean; source: 'board' | 'draft' } | null;
  lastMessage: string | null;
  idleSweeps: number;
}

type SweepEvent =
  | { type: 'tick' }
  | { type: 'select' }
  | { type: 'suggestions'; items: Suggestion[]; forDraft: string };

type Effect =
  | { type: 'speak'; text: string }
  | { type: 'bell' }
  | { type: 'requestSuggestions'; draft: string };
```

### Internal Helpers

```ts
// Letter groups for alphabet layer
const LETTER_GROUPS = [
  ['A', 'B', 'C', 'D'],
  ['E', 'F', 'G', 'H'],
  ['I', 'J', 'K', 'L', 'M'],
  ['N', 'O', 'P', 'Q', 'R'],
  ['S', 'T', 'U', 'V'],
  ['W', 'X', 'Y', 'Z']
];

// Control option identifiers
const CTRL_SPEAK = 'speak';
const CTRL_DELETE = 'delete';
const CTRL_SPACE = 'space';
const CTRL_NEEDS = 'needs';

// Root node identifier
const ROOT_NODE_ID = 'needs';
```

## Board Content

The board is a tree of nodes. Each node has an id and a list of options. Every option has an id and label. Options may have:
- `say`: a complete sentence fragment
- `goto`: the next node id
- `bell`: ring the bell when the message is spoken
- `action`: 'spell' or 'back'

### Structure

```
needs (root)
├─ Pain → pain-location
│  ├─ Head → pain-severity ("Pain in my head.")
│  ├─ Chest → pain-severity ("Pain in my chest.")
│  ├─ Stomach → pain-severity ("Pain in my stomach.")
│  ├─ My back → pain-severity ("Pain in my back.")
│  ├─ Arm or leg → pain-severity ("Pain in my arm or leg.")
│  ├─ Other → pain-severity ("Pain somewhere else.")
│  └─ Go back (loc-back)
│
├─ Breathing ("I can't breathe well.", bell)
├─ Thirsty → thirsty-choice
│  ├─ Water ("Please bring me water.")
│  ├─ Wet my mouth ("Please wet my mouth.")
│  └─ Go back (loc-back)
│
├─ Toilet ("I need the toilet.")
├─ Hot or cold → temp-choice
│  ├─ Too hot ("I'm too hot.")
│  ├─ Too cold ("I'm too cold.")
│  └─ Go back (loc-back)
│
├─ Call someone → call-choice
│  ├─ Nurse or doctor ("Please get the nurse or doctor.", bell)
│  ├─ Family ("Please get my family.", bell)
│  └─ Go back (loc-back)
│
├─ Yes ("Yes.")
├─ No ("No.")
└─ Spell (action: 'spell')

pain-severity
├─ A little ("It hurts a little.")
├─ Bad ("It's bad.")
├─ Very bad ("It's very bad.", bell)
└─ Go back (loc-back)
```

### Node Definitions

```ts
const board: Board = {
  needs: {
    id: 'needs',
    options: [
      { id: 'pain', label: 'Pain', goto: 'pain-location' },
      { id: 'breathing', label: 'Breathing', say: "I can't breathe well.", bell: true },
      { id: 'thirsty', label: 'Thirsty', goto: 'thirsty-choice' },
      { id: 'toilet', label: 'Toilet', say: 'I need the toilet.' },
      { id: 'hot-cold', label: 'Hot or cold', goto: 'temp-choice' },
      { id: 'call', label: 'Call someone', goto: 'call-choice' },
      { id: 'yes', label: 'Yes', say: 'Yes.' },
      { id: 'no', label: 'No', say: 'No.' },
      { id: 'spell', label: 'Spell', action: 'spell' }
    ]
  },
  
  'pain-location': {
    id: 'pain-location',
    options: [
      { id: 'loc-head', label: 'Head', say: 'Pain in my head.', goto: 'pain-severity' },
      { id: 'loc-chest', label: 'Chest', say: 'Pain in my chest.', goto: 'pain-severity' },
      { id: 'loc-stomach', label: 'Stomach', say: 'Pain in my stomach.', goto: 'pain-severity' },
      { id: 'loc-back-body', label: 'My back', say: 'Pain in my back.', goto: 'pain-severity' },
      { id: 'loc-limb', label: 'Arm or leg', say: 'Pain in my arm or leg.', goto: 'pain-severity' },
      { id: 'loc-other', label: 'Other', say: 'Pain somewhere else.', goto: 'pain-severity' },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  },
  
  'pain-severity': {
    id: 'pain-severity',
    options: [
      { id: 'sev-little', label: 'A little', say: 'It hurts a little.' },
      { id: 'sev-bad', label: 'Bad', say: "It's bad." },
      { id: 'sev-very', label: 'Very bad', say: "It's very bad.", bell: true },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  },
  
  'thirsty-choice': {
    id: 'thirsty-choice',
    options: [
      { id: 'water', label: 'Water', say: 'Please bring me water.' },
      { id: 'wet-mouth', label: 'Wet my mouth', say: 'Please wet my mouth.' },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  },
  
  'temp-choice': {
    id: 'temp-choice',
    options: [
      { id: 'too-hot', label: 'Too hot', say: "I'm too hot." },
      { id: 'too-cold', label: 'Too cold', say: "I'm too cold." },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  },
  
  'call-choice': {
    id: 'call-choice',
    options: [
      { id: 'call-nurse', label: 'Nurse or doctor', say: 'Please get the nurse or doctor.', bell: true },
      { id: 'call-family', label: 'Family', say: 'Please get my family.', bell: true },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  }
};
```

## Options List Function

The `optionsFor` function returns the list of options for the current state. The result type varies by layer.

```ts
type OptionItem = 
  | { kind: 'suggestion'; suggestion: Suggestion; index: number }
  | { kind: 'group'; groupIndex: number; letters: string[] }
  | { kind: 'letter'; letter: string }
  | { kind: 'control'; id: string; label: string }
  | { kind: 'board'; option: BoardOption }
  | { kind: 'placeholder' };

function optionsFor(state: SweepState, board: Board): OptionItem[] {
  switch (state.layer) {
    case 'rest':
      return [{ kind: 'placeholder' }];
    
    case 'needs':
    case 'followup':
      return board[state.nodeId].options.map(opt => ({ kind: 'board', option: opt }));
    
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
      return LETTER_GROUPS[state.groupIndex!].map(letter => ({ kind: 'letter', letter }));
    
    case 'hold':
      return [{ kind: 'placeholder' }];
  }
}

// Derived count for wrap logic
function optionCount(state: SweepState, board: Board): number {
  return optionsFor(state, board).length;
}
```

## Transition Table

### Rest Layer

| Event | Action | State Changes | Effects |
|---|---|---|---|
| tick | no-op | none | none |
| select | wake up | if draft non-empty: layer = alphabet; else: layer = needs; nodeId = ROOT_NODE_ID, path = [], fragments = [], groupIndex = null, held = null, index = 0, idleSweeps = 0 | none |

### Needs Layer

| Event | Action | State Changes | Effects |
|---|---|---|---|
| tick | advance | index++; wrap at optionCount - 1 (increment idleSweeps); if idleSweeps == 2, layer = rest | none |
| select on option with goto | navigate | path.push(nodeId), fragments.push(say if present else ''), nodeId = goto, layer = followup, index = 0, idleSweeps = 0 | none |
| select on option with no goto and say | complete | fragments.push(say), held = { text: fragments filter non-empty .join(' '), bell, source: 'board' }, layer = hold, index = 0 | none |
| select on Spell | spell | layer = alphabet, index = 0, groupIndex = null, idleSweeps = 0 | requestSuggestions(draft) |

### Followup Layer

| Event | Action | State Changes | Effects |
|---|---|---|---|
| tick | advance | index++; wrap at optionCount - 1 (increment idleSweeps); if idleSweeps == 2, layer = rest | none |
| select on option with goto | navigate | path.push(nodeId), fragments.push(say if present else ''), nodeId = goto, index = 0, idleSweeps = 0 | none |
| select on option with no goto | complete | fragments.push(say if present else ''), held = { text: fragments filter non-empty .join(' '), bell, source: 'board' }, layer = hold, index = 0 | none |
| select on Back | go back | nodeId = path.pop(), fragments.pop(), layer = followup or needs (if path empty), index = 0, idleSweeps = 0 | none |

### Alphabet Layer

| Event | Action | State Changes | Effects |
|---|---|---|---|
| tick | advance | index++; wrap at optionCount - 1 (increment idleSweeps); if idleSweeps == 2, layer = rest | none |
| select on suggestion (word) | complete word | replace partial word with suggestion.text + ' ', index = 0, idleSweeps = 0 | requestSuggestions(draft) |
| select on suggestion (sentence) | hold | held = { text: suggestion.text, bell: false, source: 'draft' }, layer = hold, index = 0, idleSweeps = 0 | none |
| select on letter group | open group | layer = letters, groupIndex = selected, index = 0, idleSweeps = 0 | none |
| select on Speak | hold if non-empty | if draft.trim() non-empty: held = { text: draft.trim(), bell: false, source: 'draft' }, layer = hold, index = 0, idleSweeps = 0; else: no-op | none |
| select on Delete | delete char | draft = draft.slice(0, -1), index = 0, idleSweeps = 0 | requestSuggestions(draft) |
| select on Space | add space | draft += ' ', index = 0, idleSweeps = 0 | requestSuggestions(draft) |
| select on Needs | return | layer = needs, nodeId = ROOT_NODE_ID, path = [], fragments = [], index = 0, idleSweeps = 0, draft unchanged | none |

### Letters Layer

| Event | Action | State Changes | Effects |
|---|---|---|---|
| tick | advance | index++; if index >= LETTER_GROUPS[groupIndex].length: layer = alphabet, groupIndex = null, index = 0, idleSweeps = 0 | none |
| select on letter | add letter | draft += letter (uppercase), layer = alphabet, groupIndex = null, index = 0, idleSweeps = 0 | requestSuggestions(draft) |

### Hold Layer

| Event | Action | State Changes | Effects |
|---|---|---|---|
| tick | speak and clear | lastMessage = held.text, draft cleared if held.source == 'draft', fragments = [], path = [], nodeId = ROOT_NODE_ID, layer = needs, held = null, index = 0, idleSweeps = 0 | speak(held.text), bell if held.bell |
| select | cancel | if held.source == 'board': layer = needs, nodeId = ROOT_NODE_ID, path = [], fragments = []; if held.source == 'draft': layer = alphabet, groupIndex = null, draft unchanged; held = null, index = 0, idleSweeps = 0 | none |

### Wrap-Around Rules

- In every active layer, `index` increments on tick.
- When `index` reaches `optionCount - 1` and another tick arrives, `index` wraps to 0 and `idleSweeps` increments.
- When `idleSweeps` reaches 2, the layer moves to `rest` on that same tick.
- In the letters layer, when `index` wraps past the last letter, the layer returns to alphabet (not rest).

### Back with Path and Fragments

- Selecting Back pops `path` to restore `nodeId` and always pops exactly one entry from `fragments`.
- Every `goto` pushes exactly one entry onto `fragments`: the option's `say` if present, or an empty string `''` if not.
- When building `held.text`, join only the non-empty fragments with a single space: `fragments.filter(f => f.length > 0).join(' ')`.
- A complete option with no `goto` pushes its `say` (which always exists) before joining.
- If `path` is empty after popping, `layer` becomes `needs`; otherwise `followup`.

### Hold and Cancel Rules

- During hold, the first tick speaks the message and emits effects.
- A select during hold cancels the message with no effects.
- If `held.source` is `'board'`, cancel returns to needs with fragments and path cleared.
- If `held.source` is `'draft'`, cancel returns to alphabet with the draft intact.

### Word Suggestions Replace the Partial Word

- Selecting a word suggestion finds the last word in the draft (characters after the last space or from the start).
- That partial word is replaced with the suggestion text, uppercased, followed by a space.
- Example: draft "I NEE" + suggestion "need" → "I NEED ".

## Suggestions Event

### forDraft Check

- The `suggestions` event includes a `forDraft` field that must match the current `draft`.
- If `forDraft !== draft`, the event is ignored entirely.
- This prevents stale suggestions from a previous draft from updating the list.

### Keeping the Highlighted Item Highlighted

- When suggestions arrive in the alphabet layer, the current `index` might point to a suggestion, group, or control.
- If `index` points to a group or control, adjust `index` to keep the same item highlighted by identity.
- If `index` points to a suggestion that no longer exists, set `index` to the first letter group (suggestion count).
- The goal: a select must never land on a different option because suggestions arrived mid-sweep.

**Algorithm:**

1. Record what kind of item is highlighted: `current = optionsFor(state, board)[state.index]`.
2. Update `state.suggestions = items`.
3. Rebuild the options list: `newOptions = optionsFor(state, board)`.
4. If `current.kind === 'group'`, find the same `groupIndex` in `newOptions` and set `index` to that position.
5. If `current.kind === 'control'`, find the same `id` in `newOptions` and set `index` to that position.
6. If `current.kind === 'suggestion'` and the same suggestion text exists in `newOptions`, set `index` to that position.
7. If `current.kind === 'suggestion'` and it no longer exists, set `index` to the first letter group (suggestion count).

## Test Design

### Unit Tests (`tests/sweep.test.ts`)

One test per requirement, covering:

- **R1:** tick at rest does nothing.
- **R2:** select at rest opens needs (or alphabet if draft exists).
- **R3:** tick advances index and wraps.
- **R4:** two full sweeps return to rest.
- **R5:** select with goto navigates.
- **R6:** select with no goto moves to hold.
- **R7:** select Back returns to parent.
- **R8:** select Spell opens alphabet.
- **R9:** alphabet layer sweep order is suggestions, groups, controls.
- **R10:** select letter group opens letters.
- **R11:** full letter sweep returns to alphabet.
- **R12:** select letter adds to draft.
- **R13:** select word suggestion completes word and adds space.
- **R14:** select sentence suggestion or Speak moves to hold; empty draft with Speak does nothing.
- **R15:** select Delete removes last character.
- **R16:** select Space adds space.
- **R17:** select Needs returns to needs.
- **R18:** tick during hold emits speak and bell, clears draft if source is 'draft'.
- **R19:** select during hold cancels, no effects.
- **R20:** suggestions event updates list if forDraft matches, keeps highlighted item stable.
- **R20 edge case:** a matching suggestions event during hold does not interrupt hold; only alphabet layer adjusts index.

**Example test for "Pain, Chest, Bad":**

```ts
test('R5, R6, R18: Pain → Chest → Bad produces "Pain in my chest. It\'s bad."', () => {
  let state = initialState(board);
  
  // Wake
  ({ state } = next(state, { type: 'select' }, board));
  expect(state.layer).toBe('needs');
  
  // Select Pain (index 0)
  ({ state } = next(state, { type: 'select' }, board));
  expect(state.layer).toBe('followup');
  expect(state.nodeId).toBe('pain-location');
  
  // Tick to Chest (index 1)
  ({ state } = next(state, { type: 'tick' }, board));
  ({ state } = next(state, { type: 'select' }, board));
  expect(state.nodeId).toBe('pain-severity');
  expect(state.fragments).toEqual(['Pain in my chest.']);
  
  // Tick to Bad (index 1)
  ({ state } = next(state, { type: 'tick' }, board));
  const { state: nextState, effects } = next(state, { type: 'select' }, board);
  expect(nextState.layer).toBe('hold');
  expect(nextState.held?.text).toBe("Pain in my chest. It's bad.");
  
  // Tick during hold speaks
  const { effects: speakEffects } = next(nextState, { type: 'tick' }, board);
  expect(speakEffects).toContainEqual({ type: 'speak', text: "Pain in my chest. It's bad." });
});
```

**Example test for "I NEE" + suggestion "need":**

```ts
test('R13: word suggestion replaces partial word and adds space', () => {
  let state = initialState(board);
  state.layer = 'alphabet';
  state.draft = 'I NEE';
  state.suggestions = [{ text: 'need', kind: 'word' }];
  
  // Select the word suggestion
  const { state: nextState } = next(state, { type: 'select' }, board);
  expect(nextState.draft).toBe('I NEED ');
});
```

### Property Tests (`tests/sweep.property.test.ts`)

Use fast-check with `numRuns: 500` minimum.

#### Arbitraries

```ts
const eventArb = fc.oneof(
  fc.constant({ type: 'tick' as const }),
  fc.constant({ type: 'select' as const }),
  fc.record({
    type: fc.constant('suggestions' as const),
    items: fc.array(fc.record({
      text: fc.string({ minLength: 1, maxLength: 20 }),
      kind: fc.constantFrom('word' as const, 'sentence' as const)
    }), { maxLength: 3 }),
    forDraft: fc.string({ maxLength: 50 })
  })
);

const eventSequenceArb = fc.array(eventArb, { minLength: 1, maxLength: 100 });
```

#### P1: Every option is reachable

Use bounded breadth-first search over states, keyed by `(layer, nodeId, index, groupIndex, held)`. Draft text is excluded from the key to keep the space finite.

For each node in the board, check that every option can be reached by ticks and selects from `initialState()`.

#### P2: Every state has a path back to needs

Generate random states by applying random event sequences. From each state, attempt to reach needs by selecting Back repeatedly (if in followup), selecting Needs (if in alphabet), or selecting cancel (if in hold).

Verify that within a bounded number of steps (e.g., 20), the state returns to `layer === 'needs' && nodeId === ROOT_NODE_ID`.

#### P3: A single select chooses a need, any follow-up result takes at most three selects

For each of the nine needs, start from needs, select the need (1 select), then select each follow-up path to completion. Count the selects.

- Breathing, Toilet, Yes, No: 1 select total (immediate hold).
- Thirsty, Hot or cold, Call someone: 2 selects total (need → choice).
- Pain: 3 selects total (need → location → severity).

#### P4: A message is never spoken without a select

Generate random event sequences. Track all `speak` effects. For each speak, verify that the sequence contains a select that moved into hold before the tick that emitted speak.

#### P5: A cancel during hold always stops speech

Generate sequences that reach hold. Insert a select (cancel), then a tick. Verify no speak effect is emitted on the tick after cancel.

#### P6: At rest, ticks never change the selection or output

Start at rest. Apply a random sequence of ticks (no selects). Verify the state is identical before and after.

#### P7: Index is always valid

Generate random event sequences. After each event, compute `optionCount(state, board)` and verify `0 <= state.index < optionCount`.

### Edge Cases

- **Empty draft with Speak:** selecting Speak when draft is empty or whitespace-only does nothing (R14).
- **Empty draft with Delete:** selecting Delete when draft is empty does nothing (R15).
- **Matching suggestions event during hold:** if a sentence suggestion event arrives with `forDraft` matching `draft` during hold, the suggestions array is updated but nothing else changes—hold is not interrupted. The rule is the same in every layer: if `forDraft` matches, store the suggestions. Only the alphabet layer adjusts index based on the new suggestions.
- **Suggestions arriving during rest:** forDraft check ensures stale suggestions are ignored.
- **Back at the first follow-up level:** path contains one entry (the needs root), so popping it returns to needs.
- **Wrap during letters layer:** when index wraps past the last letter, the layer returns to alphabet (not rest), and idleSweeps is reset.

## Summary

This design defines:
1. **Five files** to implement and test the sweep logic.
2. **Types** copied from the shared interfaces plus internal helpers.
3. **Board content** as data, with node ids, option ids, labels, say, goto, bell, and action.
4. **optionsFor** function listing options for each layer, including alphabet list built from suggestions, groups, and controls.
5. **Transition table** for every layer, showing what tick and select do, with wrap-around, idleSweeps, rest return, Back with path, hold and cancel rules, and word suggestion replacement.
6. **Suggestions event** with forDraft check and index stability.
7. **Test design**: unit tests (one per requirement), property tests with fast-check (seven properties, numRuns >= 500, bounded BFS for P1/P2), and edge cases.

The pure logic is now fully specified. Implementation follows the tasks in tasks.md.
