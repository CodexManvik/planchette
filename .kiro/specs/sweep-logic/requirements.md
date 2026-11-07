# Sweep Logic Requirements

## Overview

The sweep logic is a pure state machine that governs the talking board's behavior. It processes ticks (time steps) and selects (user signals) to manage the board state, highlight options, build messages, and emit effects like speaking or ringing the bell. This module has no display code, no side effects, and no dependencies on browsers, timers, or input devices.

## Core State Model

The board has five active layers plus one rest state:

- **rest:** waiting for the patient to wake
- **needs:** showing nine quick options (Pain, Breathing, Thirsty, etc.)
- **followup:** showing context choices that refine the selected need
- **alphabet:** showing suggestions and letter groups for spelling
- **letters:** sweeping one letter group at a time
- **hold:** displaying the final message for one step before speaking

Each layer displays one or more options. The sweep moves through them with each tick. A select (patient signal) picks the highlighted option and moves to the next layer, completes a message, or cancels.

## Board Content

Every say value is a complete sentence. Fragments are joined with a single space, never ". ".

**Pain:** no say value, opens the location node.
- Locations: Head "Pain in my head.", Chest "Pain in my chest.", Stomach "Pain in my stomach.", My back "Pain in my back.", Arm or leg "Pain in my arm or leg.", Other "Pain somewhere else."
- Each location opens the severity node: A little "It hurts a little.", Bad "It's bad.", Very bad "It's very bad." (bell).
- Every severity option has a Back option.

**Breathing:** "I can't breathe well." (bell). No follow-up.

**Toilet:** "I need the toilet." No follow-up.

**Yes:** "Yes." No follow-up.

**No:** "No." No follow-up.

**Thirsty:** opens the choice node.
- Choices: Water "Please bring me water.", Wet my mouth "Please wet my mouth."
- Every choice option has a Back option.

**Hot or cold:** opens the choice node.
- Choices: Too hot "I'm too hot.", Too cold "I'm too cold."
- Every choice option has a Back option.

**Call someone:** opens the choice node.
- Choices: Nurse or doctor "Please get the nurse or doctor." (bell), Family "Please get my family." (bell).
- Every choice option has a Back option.

**Spell:** action 'spell'. No follow-up.

Every follow-up node ends with a "Go back" option with action 'back'. The needs root has no Back. The "Back" location and the 'back' action are different things; give the location option a distinct id.

## Requirements

### R1: Rest Behavior (no-op on tick)

**User story:** The patient is sleeping and should not be disturbed.

WHEN the state is at rest AND a tick arrives THE SYSTEM SHALL change nothing and produce no effects.

**Acceptance criteria:**
1. The state remains at rest.
2. The index does not change.
3. No effects are emitted.

### R2: Rest Wake-up (select opens needs or alphabet)

**User story:** The patient signals readiness to communicate.

WHEN the state is at rest AND a select arrives THE SYSTEM SHALL reset nodeId to the root, path to [], fragments to [], groupIndex to null, held to null, set index to 0, reset idleSweeps to 0. If draft is non-empty, move to alphabet; otherwise move to needs.

**Acceptance criteria:**
1. Selecting from rest opens the needs ring at index 0 if draft is empty.
2. If the draft is non-empty when select arrives, the state opens alphabet at index 0 instead.
3. path is set to [].
4. fragments is set to [].
5. groupIndex is set to null.
6. held is set to null.
7. idleSweeps is reset to 0.

### R3: Tick in Active Layer (advance options)

**User story:** The planchette sweeps through the options, one option per tick.

WHEN a tick arrives in an active layer (needs, followup, alphabet, or letters) THE SYSTEM SHALL move to the next option and wrap to the first when the end is reached.

**Acceptance criteria:**
1. index increments by 1 on each tick.
2. When index reaches the last option, the next tick sets index to 0 and increments idleSweeps.
3. No effects are emitted when index does not wrap.
4. idleSweeps only increments when index wraps past the last option.

### R4: Return to Rest After Two Idle Sweeps

**User story:** A patient who is not responding should not keep the board awake.

WHEN two full sweeps pass with no select (idleSweeps reaches 2) THE SYSTEM SHALL return to rest on the same tick and keep any draft and lastMessage.

**Acceptance criteria:**
1. idleSweeps increments only when index wraps.
2. When idleSweeps reaches 2, the same tick moves layer to rest.
3. The draft field is preserved.
4. lastMessage is preserved.

### R5: Select with goto (move to next node, add fragment)

**User story:** Selecting a need opens follow-ups; selecting a follow-up location opens severity; selecting severity completes the message.

WHEN a select chooses an option with a `goto` field THE SYSTEM SHALL push the current nodeId onto path, push the option's `say` value to fragments if present or an empty string `''` if not, open the target node, set layer to followup, set index to 0, reset idleSweeps to 0, and produce no effects.

**Acceptance criteria:**
1. The current nodeId is pushed onto path.
2. If the option has a say value, it is pushed to fragments; otherwise `''` (empty string) is pushed.
3. nodeId changes to the goto target.
4. layer is set to followup.
5. index is set to 0.
6. idleSweeps is reset to 0.
7. No effects are emitted.

### R6: Select with no goto (move to hold, complete message)

**User story:** Selecting the final option (e.g., "Very bad") moves the message to hold for review.

WHEN a select chooses an option with no `goto` field THE SYSTEM SHALL push the option's `say` value to fragments (if present), filter fragments to include only non-empty strings, join them with a single space to form the held message, set held.source to 'board', move to hold, set index to 0, and produce no effects.

**Acceptance criteria:**
1. If the option has a say value, it is pushed to fragments; otherwise fragments is left unchanged.
2. The held message is formed by joining only non-empty fragments with a single space: `fragments.filter(f => f.length > 0).join(' ')`.
3. held.source is set to 'board'.
4. layer is set to hold.
5. held.text contains the complete message.
6. held.bell is set according to the bell rule for the final selection.
7. index is set to 0.
8. No effects are emitted yet (speech comes on the next tick during hold).

### R7: Select Back (return to parent, remove last fragment)

**User story:** The patient changes their mind about a detail and wants to revise.

WHEN a select chooses an option with action 'back' THE SYSTEM SHALL pop path to restore the previous nodeId, always pop exactly one entry from fragments, set index to 0, reset idleSweeps to 0, and produce no effects.

**Acceptance criteria:**
1. path.pop() restores the previous nodeId.
2. fragments.pop() always removes exactly one entry (which may be an empty string if the opening option had no say value).
3. layer is set to followup if path is non-empty, or needs if path is empty.
4. index is set to 0.
5. idleSweeps is reset to 0.
6. No effects are emitted.

### R8: Select Spell (open alphabet layer)

**User story:** The patient wants to spell a custom message instead of choosing a quick option.

WHEN a select chooses an option with action 'spell' THE SYSTEM SHALL move to the alphabet layer, set index to 0, set groupIndex to null, reset idleSweeps to 0, and produce a requestSuggestions effect.

**Acceptance criteria:**
1. layer is set to alphabet.
2. index is set to 0.
3. groupIndex is set to null.
4. idleSweeps is reset to 0.
5. A requestSuggestions effect is emitted with the current draft.

### R9: Alphabet Layer Sweep Order (suggestions, groups, controls)

**User story:** The alphabet is organized for speed and clarity.

WHEN the alphabet layer is active THE SYSTEM SHALL sweep in this order: up to three suggestions, six letter groups (A–D, E–H, I–M, N–R, S–V, W–Z), then Speak, Delete, Space, and Needs. (added)

**Acceptance criteria:**
1. The option list is: current suggestions (0–3), then six groups, then four controls.
2. optionCount is 3 + 6 + 4 = 13 when three suggestions are present, or fewer when suggestions are fewer.
3. When groupIndex is null and index < number of suggestions, a suggestion is highlighted.
4. When groupIndex is null and index >= number of suggestions and index < number of suggestions + 6, a letter group is highlighted.
5. When groupIndex is null and index >= number of suggestions + 6, a control is highlighted.
6. The sweep wraps: after Needs, the next tick returns to suggestions at index 0.
7. Use optionCount (not fixed index ranges) to determine the last option in every layer.

### R10: Select Letter Group (sweep letters)

**User story:** Selecting a group opens its letters for individual selection.

WHEN a select chooses a letter group THE SYSTEM SHALL move to the letters layer, set groupIndex to the group number, set index to 0, set layer to letters, and produce no effects.

**Acceptance criteria:**
1. layer is set to letters.
2. groupIndex is set to match the selected group (0–5).
3. index is set to 0.
4. idleSweeps is reset to 0.

### R11: Letter Group Full Sweep (no select returns to alphabet)

**User story:** If the patient does not select a letter from the group, the board returns to the alphabet options.

WHEN index wraps past the last letter in a group THE SYSTEM SHALL return to the alphabet layer, set groupIndex to null, set index to 0, reset idleSweeps to 0, and produce no effects. (added)

**Acceptance criteria:**
1. After a full cycle of letters with no select, index wraps past the last letter.
2. layer is set to alphabet.
3. groupIndex is set to null.
4. index is set to 0.
5. idleSweeps is reset to 0.
6. No effects are emitted.

### R12: Select Letter (add to draft, emit requestSuggestions)

**User story:** Each letter typed should trigger word-suggestion updates.

WHEN a select chooses a letter THE SYSTEM SHALL add it to the draft, move to the alphabet layer, set index to 0, reset idleSweeps to 0, and emit a requestSuggestions effect.

**Acceptance criteria:**
1. The letter character is appended to the draft string in uppercase.
2. layer is set to alphabet.
3. groupIndex is set to null.
4. index is set to 0.
5. idleSweeps is reset to 0.
6. A requestSuggestions effect is emitted with the updated draft.

### R13: Select Word Suggestion (complete word, add space)

**User story:** Selecting a word suggestion fills in the current word and adds a space for the next word.

WHEN a select chooses a word suggestion THE SYSTEM SHALL replace the partial word at the end of the draft with the suggestion text and add one space, stay in the alphabet layer, set index to 0, reset idleSweeps to 0, and emit a requestSuggestions effect. (added)

**Acceptance criteria:**
1. The word at the end of the draft is replaced with suggestion.text in uppercase.
2. A space character is appended to the draft.
3. The draft is stored in uppercase.
4. layer remains alphabet.
5. index is set to 0.
6. groupIndex is set to null.
7. idleSweeps is reset to 0.
8. A requestSuggestions effect is emitted with the updated draft.

### R14: Select Sentence Suggestion or Speak (move to hold)

**User story:** A complete sentence suggestion or the Speak button moves the message into the hold state.

WHEN a select chooses a sentence suggestion THE SYSTEM SHALL set held.text to the suggestion text, set held.source to 'draft', move to the hold layer, set index to 0, reset idleSweeps to 0, and produce no effects. WHEN a select chooses the Speak control with a non-empty draft THE SYSTEM SHALL set held.text to draft.trim(), set held.source to 'draft', move to the hold layer, set index to 0, reset idleSweeps to 0, and produce no effects. WHEN a select chooses the Speak control with an empty or whitespace-only draft THE SYSTEM SHALL stay in the alphabet layer and do nothing.

**Acceptance criteria:**
1. If a sentence suggestion: held.text is set to the suggestion text and held.source is set to 'draft'.
2. If Speak with non-empty draft: held.text is set to draft.trim() and held.source is set to 'draft'.
3. If Speak with empty or whitespace-only draft: no state change, no effects.
4. layer is set to hold only when entering hold.
5. index is set to 0 only when entering hold.
6. held.bell is set to false for sentence suggestions and spelled text.
7. idleSweeps is reset to 0 only when entering hold.
8. No effects are emitted during hold selection.

### R15: Delete Control (remove last character from draft)

**User story:** The patient can fix a typing mistake by deleting the last character.

WHEN a select chooses the Delete control THE SYSTEM SHALL remove the last character from the draft, stay in the alphabet layer, set index to 0, reset idleSweeps to 0, and emit a requestSuggestions effect. (added)

**Acceptance criteria:**
1. If draft.length > 0, draft.pop() or draft = draft.slice(0, -1).
2. If draft.length === 0, draft remains empty.
3. layer remains alphabet.
4. index is set to 0.
5. groupIndex is set to null.
6. idleSweeps is reset to 0.
7. A requestSuggestions effect is emitted with the updated (or empty) draft.

### R16: Space Control (add space to draft)

**User story:** The patient can add a space between words when typing custom text.

WHEN a select chooses the Space control THE SYSTEM SHALL add a space character to the draft, stay in the alphabet layer, set index to 0, reset idleSweeps to 0, and emit a requestSuggestions effect. (added)

**Acceptance criteria:**
1. A space character is appended to the draft.
2. layer remains alphabet.
3. index is set to 0.
4. groupIndex is set to null.
5. idleSweeps is reset to 0.
6. A requestSuggestions effect is emitted with the updated draft.

### R17: Needs Control (return from alphabet to needs)

**User story:** From the alphabet, the patient can return to the quick-option ring without deleting their draft.

WHEN a select chooses the Needs control in the alphabet layer THE SYSTEM SHALL return to the needs layer at the root, set index to 0, reset idleSweeps to 0, preserve the draft, and produce no effects. (added)

**Acceptance criteria:**
1. layer is set to needs.
2. nodeId is set to the needs ring root.
3. path is cleared to empty.
4. fragments is cleared to empty.
5. index is set to 0.
6. idleSweeps is reset to 0.
7. draft is preserved unchanged.
8. No effects are emitted.

### R18: Tick During Hold (emit speak, emit bell, clear draft, return to needs)

**User story:** During the hold step, the message is spoken, the bell may ring, and the board is ready for the next message.

WHEN a tick arrives during hold THE SYSTEM SHALL emit a speak effect with the held message, emit a bell effect if held.bell is true, set lastMessage to the held message, clear the draft only if held.source is 'draft', set fragments to [], set path to [], set nodeId to the needs ring root, set groupIndex to null, set held to null, move to the needs layer, set index to 0, reset idleSweeps to 0, and produce no further effects.

**Acceptance criteria:**
1. A speak effect is emitted with the held message text.
2. If held.bell is true, a bell effect is emitted.
3. lastMessage is updated to the held message.
4. If held.source is 'draft', draft is cleared to an empty string.
5. If held.source is 'board', draft is preserved unchanged.
6. fragments is set to an empty array.
7. path is set to an empty array.
8. groupIndex is set to null.
9. layer is set to needs.
10. nodeId is set to the needs ring root.
11. held is set to null.
12. index is set to 0.
13. idleSweeps is reset to 0.
14. No other effects are emitted.

### R19: Select During Hold (cancel, emit nothing)

**User story:** A second signal during hold cancels the message before it is spoken.

WHEN a select arrives during hold THE SYSTEM SHALL cancel the message, produce no effects. If held.source is 'board' THE SYSTEM SHALL return to needs at the root with fragments and path empty. If held.source is 'draft' THE SYSTEM SHALL return to the alphabet layer with the draft intact. In both cases, set index to 0, reset idleSweeps to 0, and clear held. (added)

**Acceptance criteria:**
1. No speak effect is emitted.
2. No bell effect is emitted.
3. If held.source is 'board': layer is set to needs, nodeId to root, path to empty, fragments to empty.
4. If held.source is 'draft': layer is set to alphabet, groupIndex to null, draft preserved unchanged.
5. In both cases: held is set to null, index to 0, idleSweeps to 0.
6. No effects are emitted.

### R20: Suggestions Event (update suggestions array)

**User story:** As the draft changes, the predictor (local or AI) sends new suggestions to display.

WHEN a suggestions event arrives THE SYSTEM SHALL check if forDraft matches the current draft. If it differs, ignore the event. If it matches, replace the suggestions array with the new items, keep the highlighted item the same in the alphabet layer, and produce no effects. The event never resets idleSweeps and never emits effects.

**Acceptance criteria:**
1. If forDraft differs from draft, the event is ignored entirely.
2. If forDraft matches draft, suggestions is set to the provided items array.
3. In the alphabet layer: if a group or control is highlighted, adjust index to keep it highlighted. If a suggestion is highlighted and no longer exists, highlight the first letter group (set index to the suggestion count).
4. A select must never land on a different option because suggestions arrived.
5. idleSweeps is not reset.
6. No effects are emitted.
7. No layer or nodeId change occurs.
8. If the suggestions event arrives during hold, the suggestions array is updated only if forDraft matches; hold is not interrupted.

### R21: Index Bounds

**User story:** The highlighted index must always point to a valid option in the current layer.

WHEN any transition occurs THE SYSTEM SHALL ensure that index is always in range [0, optionCount - 1] by construction. The property test P7 verifies this.

**Acceptance criteria:**
1. By design, index is always set to 0 on layer or node changes.
2. When index increments, it wraps at optionCount - 1.
3. index is never invalid for the current layer, node, and suggestion count.
4. P7 checks the invariant across all reachable states.

---

## Correctness Properties

These properties validate the core correctness of the sweep logic. They are checked by property-based tests using fast-check.

### P1: Every option is reachable from every layer

**Property:** For any layer and node, there exists a sequence of ticks (and selects, if required) that reaches every option in that node.

**Validates requirements:** R3 (tick advancement), R9 (alphabet sweep order), R10 (letter group selection), R11 (full sweep returns to alphabet).

**Test approach:** Generate a random start state and node, then attempt to reach each option by ticking and/or selecting. All should be reachable.

### P2: Every state has a path back to needs

**Property:** From any reachable state, there exists a sequence of ticks and selects that returns the state to the needs ring.

**Validates requirements:** R7 (back action), R17 (needs control), R19 (cancel during hold).

**Test approach:** Generate random reachable states and actions. Ensure that repeated Back or Needs selections eventually reach needs.

### P3: A single select chooses a need, and any follow-up result takes at most three selects

**Property:** Starting from needs, selecting an option with `goto` moves to followup. Each top-level need takes exactly one select. Pain takes three selects total to reach hold (need → location → severity). Thirsty, Hot or cold, and Call someone take two selects. No path takes more than three.

**Validates requirements:** R5 (goto movement), R6 (no goto completes), R18 (speak on tick during hold).

**Test approach:** For each of the nine needs, select it, then select each follow-up path. Measure the number of selects required. No path should exceed 3 selects before reaching hold.

### P4: A message is never spoken without a select

**Property:** A speak effect is only emitted when a tick occurs during the hold state. Hold is entered only by a select on a complete option, a sentence suggestion, or Speak with non-empty text. Delete and Space never enter hold.

**Validates requirements:** R14 (sentence suggestion to hold), R18 (tick during hold emits speak), R19 (select cancels held).

**Test approach:** Generate random sequences of ticks and selects. Record all speak effects. Verify that each speak effect was preceded by a select into hold.

### P5: A cancel during hold always stops speech

**Property:** A select during hold (R19) cancels the message. If a second tick arrives, no speak is emitted.

**Validates requirements:** R19 (select cancels held), R18 (tick after cancel moves to needs without speak).

**Test approach:** Reach hold, send a select (cancel), then send a tick. Verify no speak effect is emitted.

### P6: At rest, ticks never change the selection or output

**Property:** While at rest, any number of ticks leaves the state unchanged and produces no effects.

**Validates requirements:** R1 (rest no-op on tick).

**Test approach:** Start at rest, generate a sequence of ticks, and verify the state is identical before and after.

### P7: Index is always valid

**Property:** For any state and layer, index is within [0, optionCount - 1]. optionCount is 1 for rest and hold, 9 for needs, 6+ for followup nodes, and variable for alphabet (sum of suggestions, 6 letter groups, and 4 controls).

**Validates requirements:** R21 (index bounds), R3 (tick wrapping), R10 (group selection), R11 (full sweep), R9 (optionCount rule).

**Test approach:** Generate random sequences of ticks and selects. After each state change, verify that index is within bounds for the current layer using optionCount.

---

## Functional Scope

**Included:** pure logic for board state transitions, message building, and effect generation.

**Excluded:** display rendering, timing and tick generation, signal input handling, speech synthesis, Arduino communication, MediaPipe face detection, AI or local prediction, and any browser APIs.
