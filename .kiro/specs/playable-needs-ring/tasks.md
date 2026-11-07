# Tasks: Playable Needs Ring

**Feature:** First playable version with spacebar input and speech output.

**Status:** Ready to start

---

## Overview

This spec builds the first runnable application. The sweep logic is complete. These tasks add input handling, output handling, display, and tests.

Work in the order given. Each task is small and testable.

---

## Tasks

### Pure Reducer

- [ ] **Task 1:** Create `src/ui/model.ts` with `reduce(model, event, board)` (Fix 1)
  - Exports `AppModel = { sweep: SweepState; pending: Effect[]; seq: number }`
  - Pure function that calls `next()` and returns new model with effects and incremented seq
  - Unit test in `tests/model.test.ts` with sample inputs

### Core Logic

- [ ] **Task 2:** Create `src/core/filter.ts` with `createSignalFilter({ refractoryMs })` (R2)
  - Exports `{ accept(timestampMs) }` method
  - First signal always accepted
  - Rejects signals within refractory period
  - Pure function with closure over last accepted timestamp

- [ ] **Task 3:** Create `tests/filter.property.test.ts` with fast-check properties (T1)
  - Property: first signal always accepted
  - Property: no two accepted signals closer than `refractoryMs`
  - Use `fc.array(fc.integer())` for timestamps
  - `numRuns: 1000`

### Input

- [ ] **Task 4:** Create `src/input/keyboard.ts` with `createKeyboardSource()` (Fix 5, R3)
  - Implements `SignalSource` interface
  - Listens for Space keydown and keyup
  - Ignores `event.repeat` on keydown
  - Calls `preventDefault()` on both keydown and keyup
  - Handles both `event.code === 'Space'` and `event.key === ' '`
  - Listens at `document` level

- [ ] **Task 5:** Create `tests/keyboard.test.ts` (Fix 5, T3)
  - Test Space triggers select once
  - Test auto-repeat ignored
  - Test `preventDefault()` called on keydown and keyup
  - Test focused button doesn't also click when Space pressed and released

### Output

- [ ] **Task 6:** Create `src/output/speaker.ts` with `createSpeaker()` (Fix 4, R4)
  - Exports `Speaker = { say(text: string): void; available(): boolean }`
  - `createSpeaker({ onError })` calls `onError` when speech unavailable, speak throws, or utterance.onerror fires
  - `say()` calls `speechSynthesis.cancel()` then `speak()`
  - Selects English voice from `getVoices()`
  - `available()` checks for `speechSynthesis`

- [ ] **Task 7:** Create `tests/speaker.test.ts` (T4)
  - Mock `window.speechSynthesis` and `SpeechSynthesisUtterance`
  - Test `say()` cancels before speaking
  - Test `available()` returns false without `speechSynthesis`
  - Test `onError` called on speech failure

### Ticker

- [ ] **Task 8:** Create `src/ui/ticker.ts` with `createTicker()` (Fix 3, R1)
  - Exports `createTicker({ stepMs, onTick, doc = document })` returning `{ start(), stop(), setStep(ms), pause(), resume(), isRunning() }`
  - Uses a single `setInterval`
  - `setStep` clamps to 800–4000 and restarts interval
  - Doesn't tick while paused or while `doc.hidden` is true
  - Listens for `visibilitychange`

- [ ] **Task 9:** Create `tests/ticker.test.ts` (T2, Fix 3)
  - Mock `setInterval` with `vi.useFakeTimers()`
  - Test correct interval
  - Test speed change clears old timer
  - Test pause stops ticks
  - Test hidden document stops ticks

### Display Components

- [ ] **Task 10:** Create `src/ui/themes.css` with Daylight design (R8)
  - `.app` container with flex column layout
  - `.centre-label` large text (4rem), readable from 2m
  - `.ring-options` circular layout for needs
  - `.highlighted` border + position marker like "▶", not colour alone
  - `.options-grid` for alphabet/letters
  - Minimum contrast 4.5:1
  - `@media (prefers-reduced-motion: reduce)` removes transitions

- [ ] **Task 11:** Create `src/ui/Notices.tsx` (Fix 4, R4.4, R5.2)
  - Props: `speechUnavailable`, `bellNoticeVisible`
  - Speech notice: "Speech isn't working. Messages will appear as text."
  - Bell notice: "Calling for help" (non-flashing, 10 second duration managed by App)

- [ ] **Task 12:** Create `src/ui/Board.tsx` (R6)
  - Props: `state: SweepState`, `board: Board`
  - Calls `optionsFor(state, board)` to get options
  - Rest layer: "Resting. Press space to start."
  - Needs/followup: ring layout with centre label and `aria-live="polite"`
  - Alphabet/letters: simple grid with draft text above
  - Hold: large held message with "Speaking next. Press space to cancel."
  - Highlighted option marked by more than colour

### Main App

- [ ] **Task 13:** Create `src/ui/App.tsx` with reducer and ticker (Fix 1, Fix 2, Fix 3, R1, R3, R4, R5, R7, R8, R9)
  - `useReducer` around `reduce(model, event, board)`
  - Props: `{ speaker?: Speaker; now?: () => number; initialStepMs?: number }`
  - Defaults: `createSpeaker({ onError: ... })`, `() => performance.now()`, `1500`
  - Keyboard source with signal filter using `now()`
  - Ticker created with `initialStepMs` and `onTick`
  - Process effects in `useEffect` keyed on `model.seq`
  - Carer controls with `onMouseDown={e => e.preventDefault()}`
  - Bell notice shows for 10 seconds, new bell restarts

- [ ] **Task 14:** Update `src/index.tsx` to render `<App />` (R9)

- [ ] **Task 15:** Update `src/index.css` with base typography and layout (R8)
  - `rem` units for all text
  - Base font size for 2m readability
  - No layout code, just typography

### Integration Test

- [ ] **Task 16:** Create `tests/model.test.ts` (Fix 1)
  - Test pure `reduce()` function with sample inputs
  - Assert model.seq increments when effects present
  - Assert pending contains expected effects

- [ ] **Task 17:** Create `tests/app.test.tsx` (Fix 2, T5)
  - Render `<App />` into jsdom with optional props
  - Mock `speechSynthesis` and pass fake `speaker` and `now()`
  - Use `vi.useFakeTimers()`
  - Wake with Space, select Pain, Chest, Bad
  - Advance timers to trigger hold tick
  - Assert "Pain in my chest. It's bad." on screen
  - Assert speaker called with same text

### Verification

- [ ] **Task 18:** Run `npm test` and fix any failures
- [ ] **Task 19:** Run `npm run typecheck` and fix any type errors
- [ ] **Task 20:** Run `npm run build` and confirm it succeeds
- [ ] **Task 21:** Manual test: open in browser, press Space, navigate needs ring, hear message
- [ ] **Task 22:** Manual test: check text readability from 2 metres
- [ ] **Task 23:** Manual test: enable `prefers-reduced-motion` and confirm no animations

---

## Acceptance

The spec is complete when:

1. All checkboxes above are ticked.
2. All tests pass.
3. A person can open the page, press Space, navigate the needs ring, and hear a message spoken.
4. The last message appears in large text.
5. `npm run typecheck` and `npm run build` pass.

---

## Notes

- Tasks reference requirement numbers and fix numbers in parentheses.
- Keep tasks small: 15–30 minutes each.
- Commit after every 3–5 tasks.
- Update `docs/kiro-journal.md` at the end with what worked and what needed correction.
