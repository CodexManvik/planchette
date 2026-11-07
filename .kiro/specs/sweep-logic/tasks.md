# Sweep Logic Tasks

## Task 1: Define types and constants

- [x] Create `src/core/types.ts` with `Layer`, `BoardOption`, `BoardNode`, `Board`, `Suggestion`, `SweepState`, `SweepEvent`, `Effect`, and `OptionItem` types
- [x] Add `LETTER_GROUPS` constant: six arrays of letters (A–D, E–H, I–M, N–R, S–V, W–Z)
- [x] Add control identifiers: `CTRL_SPEAK`, `CTRL_DELETE`, `CTRL_SPACE`, `CTRL_NEEDS`
- [x] Add `ROOT_NODE_ID = 'needs'`
- [x] Export all types and constants

**Requirements covered:** foundation for all requirements

---

## Task 2: Define board content

- [x] Create `src/core/board-content.ts`
- [x] Define `needs` node with nine options: Pain (goto pain-location), Breathing (say, bell), Thirsty (goto thirsty-choice), Toilet (say), Hot or cold (goto temp-choice), Call someone (goto call-choice), Yes (say), No (say), Spell (action)
- [x] Define `pain-location` node with six locations plus Go back (id: loc-back, action: back); use label "My back" for the body location (id: loc-back-body) with say "Pain in my back."
- [x] Define `pain-severity` node with three severities (Very bad sets bell) plus Go back (id: loc-back, action: back)
- [x] Define `thirsty-choice` node with Water, Wet my mouth, plus Go back (id: loc-back, action: back)
- [x] Define `temp-choice` node with Too hot, Too cold, plus Go back (id: loc-back, action: back)
- [x] Define `call-choice` node with Nurse or doctor (bell), Family (bell), plus Go back (id: loc-back, action: back)
- [x] Every back action option shall have label "Go back" and action 'back'
- [x] Export `board: Board` as the default export
- [x] Verify all say values are complete sentences as specified in requirements

**Requirements covered:** board structure for R5, R6, R7, R8, R18

---

## Task 3: Implement optionsFor function

- [x] Create `src/core/sweep.ts`
- [x] Import types, constants, and board
- [x] Implement `optionsFor(state: SweepState, board: Board): OptionItem[]`:
  - rest: return one placeholder
  - needs/followup: return board options wrapped as 'board' kind
  - alphabet: return suggestions (kind: 'suggestion'), six letter groups (kind: 'group'), four controls (kind: 'control')
  - letters: return letters from `LETTER_GROUPS[groupIndex]` (kind: 'letter')
  - hold: return one placeholder
- [x] Implement `optionCount(state: SweepState, board: Board): number` as `optionsFor(state, board).length`
- [x] Export both functions

**Requirements covered:** foundation for R3, R9, R21

---

## Task 4: Implement initialState

- [x] In `src/core/sweep.ts`, implement `initialState(board: Board): SweepState`
- [x] Return state with layer: 'rest', nodeId: ROOT_NODE_ID, path: [], index: 0, fragments: [], draft: '', groupIndex: null, suggestions: [], held: null, lastMessage: null, idleSweeps: 0

**Requirements covered:** starting point for all requirements

---

## Task 5: Implement next() for rest layer

- [x] In `src/core/sweep.ts`, implement `next(state: SweepState, event: SweepEvent, board: Board): { state: SweepState; effects: Effect[] }`
- [x] Handle rest + tick: return state unchanged, no effects
- [x] Handle rest + select: reset nodeId to ROOT_NODE_ID, path to [], fragments to [], groupIndex to null, held to null, index to 0, idleSweeps to 0; if draft is non-empty, move to alphabet; else move to needs
- [x] Add unit test in `tests/sweep.test.ts` for R1 (tick at rest) and R2 (select wakes)

**Requirements covered:** R1, R2

---

## Task 6: Implement next() for tick in active layers

- [x] Handle tick in needs, followup, alphabet, letters:
  - increment index
  - if index >= optionCount, wrap to 0 and increment idleSweeps
  - if idleSweeps reaches 2, set layer to rest on the same tick
- [x] Special case for letters layer wrap: if index wraps past last letter, move to alphabet, set groupIndex to null, index to 0, idleSweeps to 0 (not rest)
- [x] Add unit tests for R3 (tick advances and wraps) and R4 (two sweeps return to rest)

**Requirements covered:** R3, R4, R11 (letters wrap to alphabet)

---

## Task 7: Implement next() for select in needs and followup (board options)

- [x] In needs or followup, when select arrives, get the current option from board
- [x] If option has `action === 'spell'`: move to alphabet, emit requestSuggestions(draft)
- [x] If option has `action === 'back'`: pop path, pop fragments (always pop exactly one entry), set layer to followup or needs (if path empty), index to 0, idleSweeps to 0
- [x] If option has `goto`: push nodeId to path, push say to fragments if present or '' (empty string) if not, set nodeId to goto, layer to followup, index to 0, idleSweeps to 0
- [x] If option has no `goto`: push say to fragments if present or '' if not, filter fragments to non-empty, join with ' ', set held = { text: joined fragments, bell: option.bell ?? false, source: 'board' }, layer to hold, index to 0
- [x] Add unit tests for R5 (goto), R6 (no goto), R7 (back), R8 (spell)
- [x] Add example test for "Pain → Chest → Bad"

**Requirements covered:** R5, R6, R7, R8

---

## Task 8: Implement next() for select in alphabet layer

- [x] Get current option from optionsFor(state, board)[state.index]
- [x] If option is suggestion (word): replace partial word in draft with suggestion.text (uppercase) + ' ', emit requestSuggestions(draft), set index to 0, idleSweeps to 0
- [x] If option is suggestion (sentence): set held = { text: suggestion.text, bell: false, source: 'draft' }, layer to hold, index to 0, idleSweeps to 0
- [x] If option is group: set layer to letters, groupIndex to selected, index to 0, idleSweeps to 0
- [x] If option is control (speak): if draft.trim() is non-empty, set held = { text: draft.trim(), bell: false, source: 'draft' }, layer to hold, index to 0, idleSweeps to 0; else no-op
- [x] If option is control (delete): draft = draft.slice(0, -1), emit requestSuggestions(draft), index to 0, idleSweeps to 0
- [x] If option is control (space): draft += ' ', emit requestSuggestions(draft), index to 0, idleSweeps to 0
- [x] If option is control (needs): layer to needs, nodeId to ROOT_NODE_ID, path to [], fragments to [], index to 0, idleSweeps to 0, draft unchanged
- [x] Add unit tests for R9, R10, R13, R14, R15, R16, R17
- [x] Add example test for "I NEE" + suggestion "need" → "I NEED "

**Requirements covered:** R9, R10, R13, R14, R15, R16, R17

---

## Task 9: Implement next() for select in letters layer

- [x] Get current letter from LETTER_GROUPS[groupIndex][index]
- [x] Append letter (uppercase) to draft
- [x] Move to alphabet, set groupIndex to null, index to 0, idleSweeps to 0
- [x] Emit requestSuggestions(draft)
- [x] Add unit test for R12

**Requirements covered:** R12

---

## Task 10: Implement next() for hold layer

- [x] Handle tick during hold:
  - emit speak(held.text)
  - emit bell if held.bell is true
  - set lastMessage to held.text
  - clear draft if held.source is 'draft'
  - set fragments to [], path to [], nodeId to ROOT_NODE_ID, groupIndex to null, layer to needs, held to null, index to 0, idleSweeps to 0
- [x] Handle select during hold:
  - if held.source is 'board': layer to needs, nodeId to ROOT_NODE_ID, path to [], fragments to []
  - if held.source is 'draft': layer to alphabet, groupIndex to null, draft unchanged
  - set held to null, index to 0, idleSweeps to 0
  - no effects
- [x] Add unit tests for R18 (tick during hold) and R19 (select cancels)

**Requirements covered:** R18, R19

---

## Task 11: Implement suggestions event handling

- [x] Handle suggestions event:
  - if forDraft !== state.draft, return state unchanged, no effects
  - record current highlighted item from optionsFor(state, board)[state.index]
  - update state.suggestions = items
  - rebuild options list
  - adjust index to keep the same item highlighted by identity (group, control, or suggestion text)
  - if current was a suggestion that no longer exists, set index to first letter group (suggestion count)
- [x] Add unit test for R20 (suggestions update with forDraft check and index stability)

**Requirements covered:** R20

---

## Task 12: Property test P1 (reachability)

- [x] Create `tests/sweep.property.test.ts`
- [x] Set up fast-check arbitraries for events (tick, select, suggestions with random forDraft)
- [x] Implement P1: bounded breadth-first search over states keyed by (layer, nodeId, index, groupIndex, held)
- [x] For each board node, verify every option is reachable by ticks and selects
- [x] Set numRuns to 500

**Requirements covered:** validates R3, R9, R10, R11

---

## Task 13: Property test P2 (path back to needs)

- [x] Implement P2: generate random event sequences, apply to initialState
- [x] From each resulting state, attempt to reach needs by selecting Back, Needs, or cancel
- [x] Verify that within 20 steps, layer becomes 'needs' and nodeId becomes ROOT_NODE_ID
- [x] Set numRuns to 500

**Requirements covered:** validates R7, R17, R19

---

## Task 14: Property test P3 (select counts)

- [x] Implement P3: for each of the nine needs, start from needs and select through each follow-up path
- [x] Count selects to reach hold
- [x] Verify: Breathing, Toilet, Yes, No take 1; Thirsty, Hot or cold, Call someone take 2; Pain takes 3
- [x] This is an exhaustive check over the board tree, not random

**Requirements covered:** validates R5, R6, R18

---

## Task 15: Property test P4 (speak only after select)

- [x] Implement P4: generate random event sequences
- [x] Track all speak effects
- [x] For each speak, verify the sequence contains a select that moved to hold before the tick that emitted speak
- [x] Set numRuns to 500

**Requirements covered:** validates R14, R18, R19

---

## Task 16: Property test P5 (cancel stops speech)

- [x] Implement P5: generate sequences that reach hold
- [x] Insert a select (cancel), then a tick
- [x] Verify no speak effect is emitted on the tick after cancel
- [x] Set numRuns to 500

**Requirements covered:** validates R19, R18

---

## Task 17: Property test P6 (rest is stable)

- [x] Implement P6: start at rest
- [x] Apply a random sequence of ticks (no selects)
- [x] Verify the state is identical before and after
- [x] Set numRuns to 500

**Requirements covered:** validates R1

---

## Task 18: Property test P7 (index always valid)

- [x] Implement P7: generate random event sequences
- [x] After each event, compute optionCount(state, board)
- [x] Verify 0 <= state.index < optionCount
- [x] Set numRuns to 500

**Requirements covered:** validates R21, R3, R9, R10, R11

---

## Task 19: Edge case tests

- [x] Add unit test: empty draft with Speak does nothing
- [x] Add unit test: empty draft with Delete does nothing
- [x] Add unit test: suggestions arriving with mismatched forDraft are ignored
- [x] Add unit test: Back at the first follow-up level returns to needs
- [x] Add unit test: wrap during letters layer returns to alphabet (not rest)
- [x] Add unit test: a matching suggestions event during hold does not interrupt hold; layer, held, and index remain unchanged

**Requirements covered:** edge cases for R14, R15, R20, R7, R11, R20

---

## Task 20: Run all tests and verify

- [ ] Run `npm test`
- [ ] Verify all unit tests pass
- [ ] Verify all property tests pass with numRuns >= 500
- [ ] Check that no test is skipped or disabled
- [ ] Confirm test coverage includes all 21 requirements

**Requirements covered:** all

---

## Summary

- **Types and board content:** Tasks 1–2
- **Core functions:** Tasks 3–4
- **State machine logic:** Tasks 5–11
- **Property tests:** Tasks 12–18
- **Edge cases and verification:** Tasks 19–20

Total: 20 tasks, ordered to build incrementally from types to logic to tests.
