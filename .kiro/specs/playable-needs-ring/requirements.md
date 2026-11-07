# Requirements: Playable Needs Ring

**Feature:** First playable version of Planchette in the browser with spacebar input, speech output, and the plain Daylight look.

**Goal:** A person can wake the board, pick a need, hear the message spoken, and see it in large text, all using the spacebar.

**Status:** Ready for implementation

---

## Context

The sweep logic (`src/core/sweep.ts`, `src/core/types.ts`) is complete and tested. This spec builds the first runnable application around it. The board uses a ticker to send ticks, the spacebar to send selects, a signal filter to prevent accidental repeats, and Web Speech to speak completed messages. The display is driven purely by `SweepState` and must never contain sweep logic.

**Fix 1: Effects without side effects in the reducer.** The reducer state is `AppModel = { sweep: SweepState; pending: Effect[]; seq: number }`. `reduce(model, event)` calls `next()`, and returns the new sweep, pending set to the returned effects, and seq + 1 when there are effects. A `useEffect` keyed on `model.seq` processes `model.pending`. Never write to refs or call anything with side effects inside the reducer. Put `reduce` in `src/ui/model.ts` as a pure exported function, and unit test it.

This version uses the plain Daylight design. Parlour comes in a later spec.

---

## Requirements (EARS Format)

### R1. Ticker
**WHILE** the page is visible and not paused  
**THE SYSTEM SHALL** send one tick event every sweep step.

- **AC 1.1:** A real ticker module in `src/ui/ticker.ts` exports `createTicker({ stepMs, onTick, doc = document })` returning `{ start(), stop(), setStep(ms), pause(), resume(), isRunning() }`.
- **AC 1.2:** Use a single `setInterval`. `setStep` clamps to 800–4000 and restarts the interval.
- **AC 1.3:** The ticker doesn't tick while paused or while `doc.hidden` is true, and listens for `visibilitychange`.
- **AC 1.4:** App uses the ticker, and `tests/ticker.test.ts` tests it with `vi.useFakeTimers()`. Don't test a copy of the logic.

### R2. Signal Filter
**WHEN** a signal arrives with a timestamp  
**THE SYSTEM SHALL** apply a refractory period filter.

- **AC 2.1:** The filter is created with `createSignalFilter({ refractoryMs })` and returns an object with an `accept(timestampMs)` method.
- **AC 2.2:** The first signal is always accepted.
- **AC 2.3:** Any signal arriving less than `refractoryMs` after the last accepted signal is rejected.
- **AC 2.4:** No two accepted signals are ever closer than `refractoryMs`.
- **AC 2.5:** The default refractory period is 500 ms.

### R3. Keyboard Source
**WHEN** the spacebar is pressed  
**THE SYSTEM SHALL** send a select event through the signal filter.

- **AC 3.1:** App takes optional props `{ speaker?: Speaker; now?: () => number; initialStepMs?: number }`. They default to `createSpeaker()`, `() => performance.now()` and `1500`.
- **AC 3.2:** Keyboard selects go through `createSignalFilter({ refractoryMs: 500 })` using `now()`.
- **AC 3.3:** The keyboard source handles `keydown` for Space (`event.code === 'Space'` or `event.key === ' '`), ignores repeats, calls `preventDefault()`, then `onSelect()`.
- **AC 3.4:** It also handles `keyup` for Space and calls `preventDefault()`, so a focused button is never activated.
- **AC 3.5:** Carer buttons use `onMouseDown={e => e.preventDefault()}` so a mouse click doesn't move focus to them.
- **AC 3.6:** In `tests/keyboard.test.ts`, check that a focused button's click handler never runs when Space is pressed and released.

### R4. Speaker
**WHEN** a `speak` effect arrives  
**THE SYSTEM SHALL** speak the text using Web Speech.

- **AC 4.1:** Define `Speaker = { say(text: string): void; available(): boolean }` in `src/output/speaker.ts`.
- **AC 4.2:** `createSpeaker({ onError })` calls `onError` when speech synthesis is missing, `speak()` throws, or `utterance.onerror` fires.
- **AC 4.3:** App shows the "Speech isn't working. Messages will appear as text." notice when `!speaker.available()` at start or when `onError` fires. Large text is shown either way.

### R5. Effects
**WHEN** an effect is produced by the sweep logic  
**THE SYSTEM SHALL** process it as follows.

- **AC 5.1:** `speak` effects call the speaker and update the large message display.
- **AC 5.2:** `bell` effects show a clear, non-flashing "Calling for help" notice for 10 seconds.
- **AC 5.3:** `requestSuggestions` effects are ignored until the spelling spec.

### R6. Display
**WHEN** the sweep state changes  
**THE SYSTEM SHALL** show the appropriate layer display.

- **AC 6.1:** In `rest` layer: "Resting. Press space to start."
- **AC 6.2:** In `needs` and `followup` layers: the options in a ring layout, with the highlighted option marked by more than colour alone, and its label also shown large in the centre.
- **AC 6.3:** In `alphabet` and `letters` layers: a simple list or grid of the current options for now, with the highlighted option clearly marked. (Arcs come in a later spec.)
- **AC 6.4:** In `hold` layer: the held message shown large, with "Speaking next. Press space to cancel."
- **AC 6.5:** The last spoken message (`state.lastMessage`) stays visible in large text after it is spoken.
- **AC 6.6:** All displays are driven purely by `SweepState` through `optionsFor(state, board)`. No sweep logic runs in the display code.

### R7. Carer Controls
**WHEN** a carer interacts with the controls  
**THE SYSTEM SHALL** adjust settings without interfering with the patient's spacebar input.

- **AC 7.1:** Three speed buttons: Slow (2500 ms), Medium (1500 ms), Fast (1000 ms).
- **AC 7.2:** A Pause button that stops ticks and a Resume button that restarts them.
- **AC 7.3:** Controls are reachable by mouse.
- **AC 7.4:** Controls do not take keyboard focus away from the board's spacebar handling.
- **AC 7.5:** Controls are visually separate from the patient's board display.

### R8. Accessibility
**WHEN** the board is displayed  
**THE SYSTEM SHALL** follow accessibility rules from `.kiro/steering/accessibility.md`.

- **AC 8.1:** The highlighted option is announced to screen readers through a polite ARIA live region.
- **AC 8.2:** All text is readable from 2 metres.
- **AC 8.3:** `prefers-reduced-motion` is respected: animations are replaced with instant transitions when requested.
- **AC 8.4:** The highlighted option is marked by text or shape, not colour alone.

### R9. Architecture
**WHEN** the application runs  
**THE SYSTEM SHALL** follow this structure.

- **AC 9.1:** `src/ui/App.tsx` owns the state through `useReducer` around `next()`.
- **AC 9.2:** Effects are processed in `useEffect`, so no side effects run inside the reducer.
- **AC 9.3:** Pure helper functions live outside components so they can be unit tested.
- **AC 9.4:** The board content is imported from `src/core/board-content.ts` and never modified by the UI.

---

## Non-Functional Requirements

- **NFR1:** All files use strict TypeScript with no `any` types.
- **NFR2:** All user-facing text follows the tone guidelines in `.kiro/steering/tone.md`.
- **NFR3:** Tests run in Vitest with jsdom; no new dependencies are added without asking.

---

## Testing Requirements

### T1. Filter Property Tests
**File:** `tests/filter.property.test.ts`

- **T1.1:** Use fast-check to generate random sequences of timestamps (both increasing and equal).
- **T1.2:** Property: no two accepted signals are closer than `refractoryMs`.
- **T1.3:** Property: the first signal is always accepted.
- **T1.4:** Run with `numRuns: 1000`.

### T2. Ticker Tests
**File:** `tests/ticker.test.ts`

- **T2.1:** Use `vi.useFakeTimers()` to control time.
- **T2.2:** Test that ticks fire at the correct interval.
- **T2.3:** Test that changing speed clears the old timer and starts the new one with no stacking.
- **T2.4:** Test that ticks stop when paused.
- **T2.5:** Test that ticks stop when the document is hidden.

### T3. Keyboard Tests
**File:** `tests/keyboard.test.ts`

- **T3.1:** Test that Space triggers a select once.
- **T3.2:** Test that auto-repeat events (`event.repeat === true`) are ignored.
- **T3.3:** Test that `preventDefault()` is called.
- **T3.4:** Test that a focused button does not also receive a click when Space is pressed.

### T4. Speaker Tests
**File:** `tests/speaker.test.ts`

- **T4.1:** Mock `window.speechSynthesis`.
- **T4.2:** Test that `say(text)` cancels earlier speech before speaking.
- **T4.3:** Test that `available()` returns `false` when `speechSynthesis` is undefined.

### T5. Integration Test
**File:** `tests/app.test.tsx`

- **T5.1:** Render `<App />` into a jsdom container using Preact's `render()`.
- **T5.2:** Use fake timers.
- **T5.3:** Press Space to wake from rest.
- **T5.4:** Advance timers to highlight Pain, then press Space to select it.
- **T5.5:** Advance timers to highlight Chest, then press Space.
- **T5.6:** Advance timers to highlight Bad, then press Space.
- **T5.7:** Advance timer once more to trigger the hold tick.
- **T5.8:** Assert that "Pain in my chest. It's bad." appears on screen.
- **T5.9:** Assert that the mocked speaker received the same text.

---

## Out of Scope

- Camera input (Task 5)
- Arduino knock box (Task 9)
- AI suggestions (Task 7)
- Parlour design (Task 11)
- Offline support (Task 12)
- Setup flow (Task 8)

---

## Risks

- **R1:** If Web Speech is unavailable in the test environment, tests must mock it completely.
- **R2:** If the spacebar also clicks focused buttons, the workaround is to listen at `document` level and check `event.target`.

---

## Success Criteria

- All tests pass.
- A person can open the page, press Space to wake, navigate the needs ring, and hear a complete message spoken.
- The message appears in large text, readable from 2 metres.
- `npm run typecheck` and `npm run build` pass with no errors.
