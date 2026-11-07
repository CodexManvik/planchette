# Sweep Logic Tasks

## Task 1: Define types and constants

- [ ] Create `src/core/types.ts` with `Layer`, `BoardOption`, `BoardNode`, `Board`, `Suggestion`, `SweepState`, `SweepEvent`, `Effect`, and `OptionItem` types
- [ ] Add `LETTER_GROUPS` constant: six arrays of letters (A–D, E–H, I–M, N–R, S–V, W–Z)
- [ ] Add control identifiers: `CTRL_SPEAK`, `CTRL_DELETE`, `CTRL_SPACE`, `CTRL_NEEDS`
- [ ] Add `ROOT_NODE_ID = 'needs'`
- [ ] Export all types and constants

**Requirements covered:** foundation for all requirements

---

## Task 2: Define board content

- [ ] Create `src/core/board-content.ts`
- [ ] Define `needs` node with nine options: Pain (goto pain-location), Breathing (say, bell), Thirsty (goto thirsty-choice), Toilet (say), Hot or cold (goto temp-choice), Call someone (goto call-choice), Yes (say), No (say), Spell (action)
- [ ] Define `pain-location` node with six locations plus Go back (id: loc-back, action: back); use label "My back" for the body location (id: loc-back-body) with say "Pain in my back."
- [ ] Define `pain-severity` node with three severities (Very bad sets bell) plus Go back (id: loc-back, action: back)
- [ ] Define `thirsty-choice` node with Water, Wet my mouth, plus Go back (id: loc-back, action: back)
- [ ] Define `temp-choice` node with Too hot, Too cold, plus Go back (id: loc-back, action: back)
- [ ] Define `call-choice` node with Nurse or doctor (bell), Family (bell), plus Go back (id: loc-back, action: back)
- [ ] Every back action option shall have label "Go back" and action 'back'
- [ ] Export `board: Board` as the default export
- [ ] Verify all say values are complete sentences as specified in requirements

**Requirements covered:** board structure for R5, R6, R7, R8, R18

---

## Task 3: Implement optionsFor function

- [ ] Create `src/core/sweep.ts`
- [ ] Import types, constants, and board
- [ ] Implement `optionsFor(state: SweepState, board: Board): OptionItem[]`:
  - rest: return one placeholder
  - needs/followup: return board options wrapped as 'board' kind
  - alphabet: return suggestions (kind: 'suggestion'), six letter groups (kind: 'group'), four controls (kind: 'control')
  - letters: return letters from `LETTER_GROUPS[groupIndex]` (kind: 'letter')
  - hold: return one placeholder
- [ ] Implement `optionCount(state: SweepState, board: Board): number` as `optionsFor(state, board).length`
- [ ] Export both functions

**Requirements covered:** foundation for R3, R9, R21

---

## Task 4: Implement initialState

- [ ] In `src/core/sweep.ts`, implement `initialState(board: Board): SweepState`
- [ ] Return state with layer: 'rest', nodeId: ROOT_NODE_ID, path: [], index: 0, fragments: [], draft: '', groupIndex: null, suggestions: [], held: null, lastMessage: null, idleSweeps: 0

**Requirements covered:** starting point for all requirements

---

## Task 5: Implement next() for rest layer

- [ ] In `src/core/sweep.ts`, implement `next(state: SweepState, event: SweepEvent, board: Board): { state: SweepState; effects: Effect[] }`
- [ ] Handle rest + tick: return state unchanged, no effects
- [ ] Handle rest + select: reset nodeId to ROOT_NODE_ID, path to [], fragments to [], groupIndex to null, held to null, index to 0, idleSweeps to 0; if draft is non-empty, move to alphabet; else move to needs
- [ ] Add unit test in `tests/sweep.test.ts` for R1 (tick at rest) and R2 (select wakes)

**Requirements covered:** R1, R2

---

## Task 6: Implement next() for tick in active layers

- [ ] Handle tick in needs, followup, alphabet, letters:
  - increment index
  - if index >= optionCount, wrap to 0 and increment idleSweeps
  - if idleSweeps reaches 2, set layer to rest on the same tick
- [ ] Special case for letters layer wrap: if index wraps past last letter, move to alphabet, set groupIndex to null, index to 0, idleSweeps to 0 (not rest)
- [ ] Add unit tests for R3 (tick advances and wraps) and R4 (two sweeps return to rest)

**Requirements covered:** R3, R4, R11 (letters wrap to alphabet)

---

## Task 7: Implement next() for select in needs and followup (board options)

- [ ] In needs or followup, when select arrives, get the current option from board
- [ ] If option has `action === 'spell'`: move to alphabet, emit requestSuggestions(draft)
- [ ] If option has `action === 'back'`: pop path, pop fragments (always pop exactly one entry), set layer to followup or needs (if path empty), index to 0, idleSweeps to 0
- [ ] If option has `goto`: push nodeId to path, push say to fragments if present or '' (empty string) if not, set nodeId to goto, layer to followup, index to 0, idleSweeps to 0
- [ ] If option has no `goto`: push say to fragments if present or '' if not, filter fragments to non-empty, join with ' ', set held = { text: joined fragments, bell: option.bell ?? false, source: 'board' }, layer to hold, index to 0
- [ ] Add unit tests for R5 (goto), R6 (no goto), R7 (back), R8 (spell)
- [ ] Add example test for "Pain → Chest → Bad"

**Requirements covered:** R5, R6, R7, R8

---

## Task 8: Implement next() for select in alphabet layer

- [ ] Get current option from optionsFor(state, board)[state.index]
- [ ] If option is suggestion (word): replace partial word in draft with suggestion.text (uppercase) + ' ', emit requestSuggestions(draft), set index to 0, idleSweeps to 0
- [ ] If option is suggestion (sentence): set held = { text: suggestion.text, bell: false, source: 'draft' }, layer to hold, index to 0, idleSweeps to 0
- [ ] If option is group: set layer to letters, groupIndex to selected, index to 0, idleSweeps to 0
- [ ] If option is control (speak): if draft.trim() is non-empty, set held = { text: draft.trim(), bell: false, source: 'draft' }, layer to hold, index to 0, idleSweeps to 0; else no-op
- [ ] If option is control (delete): draft = draft.slice(0, -1), emit requestSuggestions(draft), index to 0, idleSweeps to 0
- [ ] If option is control (space): draft += ' ', emit requestSuggestions(draft), index to 0, idleSweeps to 0
- [ ] If option is control (needs): layer to needs, nodeId to ROOT_NODE_ID, path to [], fragments to [], index to 0, idleSweeps to 0, draft unchanged
- [ ] Add unit tests for R9, R10, R13, R14, R15, R16, R17
- [ ] Add example test for "I NEE" + suggestion "need" → "I NEED "

**Requirements covered:** R9, R10, R13, R14, R15, R16, R17

---

## Task 9: Implement next() for select in letters layer

- [ ] Get current letter from LETTER_GROUPS[groupIndex][index]
- [ ] Append letter (uppercase) to draft
- [ ] Move to alphabet, set groupIndex to null, index to 0, idleSweeps to 0
- [ ] Emit requestSuggestions(draft)
- [ ] Add unit test for R12

**Requirements covered:** R12

---

## Task 10: Implement next() for hold layer

- [ ] Handle tick during hold:
  - emit speak(held.text)
  - emit bell if held.bell is true
  - set lastMessage to held.text
  - clear draft if held.source is 'draft'
  - set fragments to [], path to [], nodeId to ROOT_NODE_ID, groupIndex to null, layer to needs, held to null, index to 0, idleSweeps to 0
- [ ] Handle select during hold:
  - if held.source is 'board': layer to needs, nodeId to ROOT_NODE_ID, path to [], fragments to []
  - if held.source is 'draft': layer to alphabet, groupIndex to null, draft unchanged
  - set held to null, index to 0, idleSweeps to 0
  - no effects
- [ ] Add unit tests for R18 (tick during hold) and R19 (select cancels)

**Requirements covered:** R18, R19

---

## Task 11: Implement suggestions event handling

- [ ] Handle suggestions event:
  - if forDraft !== state.draft, return state unchanged, no effects
  - record current highlighted item from optionsFor(state, board)[state.index]
  - update state.suggestions = items
  - rebuild options list
  - adjust index to keep the same item highlighted by identity (group, control, or suggestion text)
  - if current was a suggestion that no longer exists, set index to first letter group (suggestion count)
- [ ] Add unit test for R20 (suggestions update with forDraft check and index stability)

**Requirements covered:** R20

---

## Task 12: Property test P1 (reachability)

- [ ] Create `tests/sweep.property.test.ts`
- [ ] Set up fast-check arbitraries for events (tick, select, suggestions with random forDraft)
- [ ] Implement P1: bounded breadth-first search over states keyed by (layer, nodeId, index, groupIndex, held)
- [ ] For each board node, verify every option is reachable by ticks and selects
- [ ] Set numRuns to 500

**Requirements covered:** validates R3, R9, R10, R11

---

## Task 13: Property test P2 (path back to needs)

- [ ] Implement P2: generate random event sequences, apply to initialState
- [ ] From each resulting state, attempt to reach needs by selecting Back, Needs, or cancel
- [ ] Verify that within 20 steps, layer becomes 'needs' and nodeId becomes ROOT_NODE_ID
- [ ] Set numRuns to 500

**Requirements covered:** validates R7, R17, R19

---

## Task 14: Property test P3 (select counts)

- [ ] Implement P3: for each of the nine needs, start from needs and select through each follow-up path
- [ ] Count selects to reach hold
- [ ] Verify: Breathing, Toilet, Yes, No take 1; Thirsty, Hot or cold, Call someone take 2; Pain takes 3
- [ ] This is an exhaustive check over the board tree, not random

**Requirements covered:** validates R5, R6, R18

---

## Task 15: Property test P4 (speak only after select)

- [ ] Implement P4: generate random event sequences
- [ ] Track all speak effects
- [ ] For each speak, verify the sequence contains a select that moved to hold before the tick that emitted speak
- [ ] Set numRuns to 500

**Requirements covered:** validates R14, R18, R19

---

## Task 16: Property test P5 (cancel stops speech)

- [ ] Implement P5: generate sequences that reach hold
- [ ] Insert a select (cancel), then a tick
- [ ] Verify no speak effect is emitted on the tick after cancel
- [ ] Set numRuns to 500

**Requirements covered:** validates R19, R18

---

## Task 17: Property test P6 (rest is stable)

- [ ] Implement P6: start at rest
- [ ] Apply a random sequence of ticks (no selects)
- [ ] Verify the state is identical before and after
- [ ] Set numRuns to 500

**Requirements covered:** validates R1

---

## Task 18: Property test P7 (index always valid)

- [ ] Implement P7: generate random event sequences
- [ ] After each event, compute optionCount(state, board)
- [ ] Verify 0 <= state.index < optionCount
- [ ] Set numRuns to 500

**Requirements covered:** validates R21, R3, R9, R10, R11

---

## Task 19: Edge case tests

- [ ] Add unit test: empty draft with Speak does nothing
- [ ] Add unit test: empty draft with Delete does nothing
- [ ] Add unit test: suggestions arriving with mismatched forDraft are ignored
- [ ] Add unit test: Back at the first follow-up level returns to needs
- [ ] Add unit test: wrap during letters layer returns to alphabet (not rest)
- [ ] Add unit test: a matching suggestions event during hold does not interrupt hold; layer, held, and index remain unchanged

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
