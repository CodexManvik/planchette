# Design: Playable Needs Ring

**Feature:** First playable version with spacebar input, speech output, and Daylight design.

---

## Architecture Overview

The application follows a unidirectional data flow:

```
Input (keyboard) → Signal Filter → Select Event
                                        ↓
Timer (ticker) → Tick Event ──────────→ Reducer (reduce)
                                        ↓
                    AppModel (sweep, pending, seq)
                                        ↓
                        ┌───────────────┴───────────────┐
                        ↓                               ↓
                    Display                         Effects
                (Board, Arcs, etc.)         (useEffect keyed on seq)
                                              ↓
                                    Output (Speaker, Bell)
```

**Pure logic:** `src/ui/model.ts` contains a pure `reduce(model, event)` function with no side effects. The reducer returns AppModel with new sweep, effects in pending, and incremented seq.

**Effects handling:** `src/ui/App.tsx` has a `useEffect` keyed on `model.seq`. When seq changes, it processes `model.pending`. No side effects run inside `reduce()`.

**Display:** All UI components receive `SweepState` and `Board` as props. They call `optionsFor(state, board)` to get the current options and render them. No sweep logic runs in display code.

---

## File List

### New Files

| Path | Responsibility | Exports |
|---|---|---|
| `src/ui/model.ts` | Pure reducer wrapping `next()` | `reduce(model, event, board)` |
| `src/core/filter.ts` | Refractory period signal filter (pure) | `createSignalFilter(opts)` |
| `src/input/keyboard.ts` | Spacebar input source | `createKeyboardSource()` (implements `SignalSource`) |
| `src/output/speaker.ts` | Web Speech wrapper with error handling | `createSpeaker(opts)` with `say(text)` and `available()` |
| `src/ui/ticker.ts` | Real timer module | `createTicker(opts)` with `start()`, `stop()`, `setStep()`, etc. |
| `src/ui/App.tsx` | Root component: state, ticker, effect handling | `<App />` with optional props |
| `src/ui/Board.tsx` | Needs and follow-up ring display | `<Board state={...} board={...} />` |
| `src/ui/Notices.tsx` | Family-facing notices (speech unavailable, calling for help) | `<Notices />` |
| `src/ui/themes.css` | Daylight design styles | CSS classes |
| `tests/filter.property.test.ts` | fast-check property tests for filter | (test file) |
| `tests/ticker.test.ts` | Vitest tests for ticker module | (test file) |
| `tests/keyboard.test.ts` | Vitest tests for keyboard source | (test file) |
| `tests/speaker.test.ts` | Vitest tests for speaker with mocked speechSynthesis | (test file) |
| `tests/model.test.ts` | Unit tests for pure `reduce()` function | (test file) |
| `tests/app.test.tsx` | Integration test: full flow from wake to message spoken | (test file) |

### Modified Files

- `src/index.tsx`: Renders `<App />` into the DOM.
- `src/index.css`: Basic page layout and typography.

---

## Component Structure

### App.tsx

**State management:**

```tsx
interface AppModel {
  sweep: SweepState;
  pending: Effect[];
  seq: number;
}

function reduce(model: AppModel, event: SweepEvent, board: Board): AppModel {
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

export function App(props?: {
  speaker?: Speaker;
  now?: () => number;
  initialStepMs?: number;
}) {
  const speaker = props?.speaker ?? createSpeaker({ onError: () => setSpeechUnavailable(true) });
  const now = props?.now ?? (() => performance.now());
  const initialStepMs = props?.initialStepMs ?? 1500;

  const [model, dispatch] = useReducer(
    (model: AppModel, event: SweepEvent) => reduce(model, event, board),
    { sweep: initialState(board), pending: [], seq: 0 }
  );

  const [ticker, setTicker] = useState<ReturnType<typeof createTicker> | null>(null);
  const [speechUnavailable, setSpeechUnavailable] = useState(!speaker.available());
  const [bellNoticeVisible, setBellNoticeVisible] = useState(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState<string | null>(null);
```

**Timer management:**

```tsx
useEffect(() => {
  const t = createTicker({
    stepMs: initialStepMs,
    onTick: () => dispatch({ type: 'tick' }),
    doc: document
  });
  t.start();
  setTicker(t);
  
  return () => t.stop();
}, [initialStepMs]);
```

**Keyboard input:**

```tsx
useEffect(() => {
  const filter = createSignalFilter({ refractoryMs: 500 });
  const source = createKeyboardSource();
  
  source.start(() => {
    const timestamp = now();
    if (filter.accept(timestamp)) {
      dispatch({ type: 'select' });
    }
  });
  
  return () => source.stop();
}, [now]);
```

**Effect processing:**

```tsx
useEffect(() => {
  model.pending.forEach(effect => {
    if (effect.type === 'speak') {
      speaker.say(effect.text);
      setLastSpokenMessage(effect.text);
    }
    if (effect.type === 'bell') {
      setBellNoticeVisible(true);
      setTimeout(() => setBellNoticeVisible(false), 10000);
    }
    if (effect.type === 'requestSuggestions') {
      // Ignored for now
    }
  });
}, [model.seq, speaker]);
```

**Structure:**

```tsx
return (
  <div class="app">
    <Notices 
      speechUnavailable={speechUnavailable}
      bellNoticeVisible={bellNoticeVisible}
    />
    
    <div class="patient-display">
      <Board state={model.sweep} board={board} />
      {lastSpokenMessage && (
        <div class="last-message">{lastSpokenMessage}</div>
      )}
    </div>

    <div class="carer-controls">
      <button onMouseDown={e => e.preventDefault()} onClick={() => ticker?.setStep(2500)}>Slow</button>
      <button onMouseDown={e => e.preventDefault()} onClick={() => ticker?.setStep(1500)}>Medium</button>
      <button onMouseDown={e => e.preventDefault()} onClick={() => ticker?.setStep(1000)}>Fast</button>
      <button onMouseDown={e => e.preventDefault()} onClick={() => ticker?.isRunning() ? ticker.pause() : ticker?.resume()}>
        {ticker?.isRunning() ? 'Pause' : 'Resume'}
      </button>
    </div>
  </div>
);
```

---

## Ticker Module Design

**File:** `src/ui/ticker.ts`

**Interface and implementation:**

```typescript
export interface Ticker {
  start(): void;
  stop(): void;
  setStep(ms: number): void;
  pause(): void;
  resume(): void;
  isRunning(): boolean;
}

export function createTicker(opts: {
  stepMs: number;
  onTick: () => void;
  doc?: Document;
}): Ticker {
  const doc = opts.doc ?? document;
  let intervalId: number | undefined;
  let paused = false;

  const clamp = (ms: number): number => Math.max(800, Math.min(4000, ms));
  
  const tick = () => {
    if (!paused && !doc.hidden) {
      opts.onTick();
    }
  };

  const startInterval = (ms: number) => {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(tick, clamp(ms)) as unknown as number;
  };

  return {
    start() {
      startInterval(opts.stepMs);
    },

    stop() {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },

    setStep(ms: number) {
      startInterval(ms);
    },

    pause() {
      paused = true;
    },

    resume() {
      paused = false;
    },

    isRunning(): boolean {
      return intervalId !== undefined && !paused;
    }
  };
}
```

---

## Speaker Design

**File:** `src/output/speaker.ts`

**Interface and implementation:**

```typescript
export interface Speaker {
  say(text: string): void;
  available(): boolean;
}

export function createSpeaker(opts?: { onError?: () => void }): Speaker {
  const onError = opts?.onError ?? (() => {});

  return {
    available(): boolean {
      return typeof window !== 'undefined' && 'speechSynthesis' in window;
    },

    say(text: string): void {
      if (!this.available()) {
        onError();
        return;
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set up error handler
        utterance.onerror = () => {
          onError();
        };

        // Select English voice
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        onError();
      }
    }
  };
}
```

---

**File:** `src/core/filter.ts`

**Algorithm:**

```typescript
export function createSignalFilter(opts: { refractoryMs: number }) {
  let lastAcceptedMs: number | null = null;

  return {
    accept(timestampMs: number): boolean {
      if (lastAcceptedMs === null) {
        lastAcceptedMs = timestampMs;
        return true;
      }

      const elapsed = timestampMs - lastAcceptedMs;
      if (elapsed >= opts.refractoryMs) {
        lastAcceptedMs = timestampMs;
        return true;
      }

      return false;
    }
  };
}
```

**Properties verified by fast-check:**

1. First signal is always accepted.
2. No two accepted signals are closer than `refractoryMs`.
3. For any sequence of timestamps, accepted timestamps form a subsequence where each gap is `>= refractoryMs`.

---

## Keyboard Source Design

**File:** `src/input/keyboard.ts`

**Implementation:**

```typescript
export interface SignalSource {
  start(onSelect: () => void): void;
  stop(): void;
}

export function createKeyboardSource(): SignalSource {
  let handlers: { keydown: ((e: KeyboardEvent) => void) | null; keyup: ((e: KeyboardEvent) => void) | null } = {
    keydown: null,
    keyup: null
  };

  return {
    start(onSelect) {
      handlers.keydown = (e: KeyboardEvent) => {
        // AC 3.3: Space keydown, ignore auto-repeat
        if ((e.code === 'Space' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          onSelect();
        }
      };

      handlers.keyup = (e: KeyboardEvent) => {
        // AC 3.4: Space keyup, prevent button activation
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
        }
      };

      document.addEventListener('keydown', handlers.keydown);
      document.addEventListener('keyup', handlers.keyup);
    },

    stop() {
      if (handlers.keydown) {
        document.removeEventListener('keydown', handlers.keydown);
        handlers.keydown = null;
      }
      if (handlers.keyup) {
        document.removeEventListener('keyup', handlers.keyup);
        handlers.keyup = null;
      }
    }
  };
}
```

---

## Speaker Design

**File:** `src/output/speaker.ts`

**Implementation:**

```typescript
export function createSpeaker() {
  return {
    available(): boolean {
      return typeof window !== 'undefined' && 'speechSynthesis' in window;
    },

    say(text: string): void {
      if (!this.available()) {
        return;
      }

      // AC 4.1: Cancel any speech in progress
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // AC 4.2: Use an English voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Speech failed:', err);
        // Caller handles unavailability through available() check
      }
    }
  };
}
```

---

## Board Display Design

**File:** `src/ui/Board.tsx`

**Component:**

```tsx
interface BoardProps {
  state: SweepState;
  board: Board;
}

export function Board({ state, board }: BoardProps) {
  const options = optionsFor(state, board);
  const currentOption = options[state.index];

  if (state.layer === 'rest') {
    return (
      <div class="board rest">
        <div class="message">Resting. Press space to start.</div>
      </div>
    );
  }

  if (state.layer === 'hold') {
    return (
      <div class="board hold">
        <div class="held-message">{state.held!.text}</div>
        <div class="instruction">Speaking next. Press space to cancel.</div>
      </div>
    );
  }

  if (state.layer === 'needs' || state.layer === 'followup') {
    return (
      <div class="board ring">
        <div class="centre-label" aria-live="polite">
          {currentOption?.kind === 'board' ? currentOption.option.label : ''}
        </div>
        
        <div class="ring-options">
          {options.map((item, i) => {
            if (item.kind !== 'board') return null;
            const highlighted = i === state.index;
            return (
              <div 
                key={item.option.id}
                class={`ring-option ${highlighted ? 'highlighted' : ''}`}
              >
                {item.option.label}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (state.layer === 'alphabet' || state.layer === 'letters') {
    // Simple list for now; arcs come later
    return (
      <div class="board alphabet">
        <div class="draft">{state.draft}</div>
        
        <div class="centre-label" aria-live="polite">
          {getLabelForOption(currentOption)}
        </div>

        <div class="options-grid">
          {options.map((item, i) => {
            const highlighted = i === state.index;
            return (
              <div 
                key={i}
                class={`option ${highlighted ? 'highlighted' : ''}`}
              >
                {getLabelForOption(item)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

function getLabelForOption(item: OptionItem | undefined): string {
  if (!item) return '';
  if (item.kind === 'suggestion') return item.suggestion.text;
  if (item.kind === 'group') return item.letters.join('–');
  if (item.kind === 'letter') return item.letter;
  if (item.kind === 'control') return item.label;
  if (item.kind === 'board') return item.option.label;
  return '';
}
```

---

## Notices Design

**File:** `src/ui/Notices.tsx`

```tsx
interface NoticesProps {
  speechUnavailable: boolean;
  bellNoticeVisible: boolean;
}

export function Notices({ speechUnavailable, bellNoticeVisible }: NoticesProps) {
  return (
    <div class="notices">
      {speechUnavailable && (
        <div class="notice speech-unavailable">
          Speech isn't working. Messages will appear as text.
        </div>
      )}
      
      {bellNoticeVisible && (
        <div class="notice bell">
          Calling for help
        </div>
      )}
    </div>
  );
}
```

---

## DOM Structure and CSS Classes

### Structure

```html
<div class="app">
  <div class="notices">
    <!-- Notices for family -->
  </div>

  <div class="patient-display">
    <div class="board [rest|ring|alphabet|hold]">
      <!-- Board content varies by layer -->
      <div class="centre-label" aria-live="polite">
        <!-- Current option label -->
      </div>
    </div>

    <div class="last-message">
      <!-- Last spoken message in large text -->
    </div>
  </div>

  <div class="carer-controls">
    <button>Slow</button>
    <button>Medium</button>
    <button>Fast</button>
    <button>Pause / Resume</button>
  </div>
</div>
```

### CSS Classes

**`.app`:** Main container, flex column.

**`.notices`:** Fixed at top, high z-index, clear background.

**`.notice`:** Individual notice, padding, border, non-flashing.

**`.patient-display`:** Large, centred, fills most of viewport.

**`.board`:** Main board area.

**`.centre-label`:** Large text (4rem+), readable from 2m, centred.

**`.ring-options`:** Circular layout for needs/follow-up options.

**`.ring-option`:** Individual option in ring.

**`.ring-option.highlighted`:** Border + text decoration, not colour alone.

**`.options-grid`:** Grid or list for alphabet/letters.

**`.option.highlighted`:** Border + background, not colour alone.

**`.draft`:** Spelled text shown above alphabet layer.

**`.held-message`:** Very large text (5rem+) for hold layer.

**`.last-message`:** Persistent large text for the last spoken message.

**`.carer-controls`:** Fixed at bottom, visually separate, smaller text.

**Accessibility:**

- Use `rem` units for all text sizing.
- Minimum contrast 4.5:1 for text.
- `@media (prefers-reduced-motion: reduce)` removes all transitions and animations.
- `.highlighted` uses border and position changes, not colour alone.

---

## Timer Approach

**Requirements:**

- One `setInterval` at a time.
- Clear and recreate on speed change.
- Stop when document hidden, resume when visible.

**Implementation in App.tsx:**

```tsx
useEffect(() => {
  if (paused) return;

  let intervalId: number | undefined;

  const tick = () => {
    if (!document.hidden) {
      dispatch({ type: 'TICK' });
    }
  };

  intervalId = setInterval(tick, sweepStep);

  // Also listen to visibilitychange to pause/resume
  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    } else {
      if (intervalId === undefined) {
        intervalId = setInterval(tick, sweepStep);
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [sweepStep, paused]);
```

---

## Test Plan

### T1. Filter Property Tests (`tests/filter.property.test.ts`)

**Approach:**

```typescript
import * as fc from 'fast-check';
import { createSignalFilter } from '../src/core/filter';

describe('createSignalFilter properties', () => {
  it('first signal is always accepted', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (timestamp) => {
        const filter = createSignalFilter({ refractoryMs: 500 });
        expect(filter.accept(timestamp)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('no two accepted signals closer than refractoryMs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 2, maxLength: 100 }),
        fc.integer({ min: 100, max: 1000 }),
        (timestamps, refractoryMs) => {
          const sorted = [...timestamps].sort((a, b) => a - b);
          const filter = createSignalFilter({ refractoryMs });
          
          const accepted: number[] = [];
          sorted.forEach(ts => {
            if (filter.accept(ts)) {
              accepted.push(ts);
            }
          });

          // Check all gaps between accepted timestamps
          for (let i = 1; i < accepted.length; i++) {
            expect(accepted[i] - accepted[i - 1]).toBeGreaterThanOrEqual(refractoryMs);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});
```

### T2. Ticker Tests (`tests/ticker.test.ts`)

**Approach:**

- Mock `setInterval` and `clearInterval` with Vitest's `vi.useFakeTimers()`.
- Create a test harness that mimics App's timer logic.
- Advance time with `vi.advanceTimersByTime()` and count ticks.

### T3. Keyboard Tests (`tests/keyboard.test.ts`)

**Approach:**

- Create a jsdom environment.
- Instantiate `createKeyboardSource()`.
- Dispatch synthetic `KeyboardEvent` instances.
- Assert `onSelect` is called correctly.

### T4. Speaker Tests (`tests/speaker.test.ts`)

**Approach:**

- Mock `window.speechSynthesis` and `SpeechSynthesisUtterance`.
- Test `say()` calls `cancel()` and `speak()`.
- Test `available()` returns correct value.

### T5. Integration Test (`tests/app.test.tsx`)

**Approach:**

```typescript
import { render } from 'preact';
import { App } from '../src/ui/App';
import { vi } from 'vitest';

describe('App integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock speechSynthesis
    global.speechSynthesis = { /* ... */ };
  });

  it('picks Pain → Chest → Bad and speaks the message', () => {
    const container = document.createElement('div');
    render(<App />, container);

    // Wake from rest
    dispatchSpaceKey();
    
    // Advance to Pain
    vi.advanceTimersByTime(1500 * 0); // Pain is at index 0
    dispatchSpaceKey();

    // Advance to Chest
    vi.advanceTimersByTime(1500 * 1); // Chest is second option
    dispatchSpaceKey();

    // Advance to Bad
    vi.advanceTimersByTime(1500 * 2); // Bad is third option
    dispatchSpaceKey();

    // Advance one more tick to trigger speak
    vi.advanceTimersByTime(1500);

    // Assert
    expect(container.textContent).toContain("Pain in my chest. It's bad.");
    expect(mockSpeak).toHaveBeenCalledWith("Pain in my chest. It's bad.");
  });
});
```

---

## Dependency Graph

```
App.tsx
  ├─ imports: sweep.ts, board-content.ts, filter.ts, keyboard.ts, speaker.ts
  ├─ imports: Board.tsx, Notices.tsx
  └─ uses: optionsFor(), initialState(), next()

Board.tsx
  ├─ imports: types.ts, sweep.ts
  └─ uses: optionsFor()

filter.ts
  └─ exports: createSignalFilter()

keyboard.ts
  └─ exports: createKeyboardSource()

speaker.ts
  └─ exports: createSpeaker()
```

---

## Open Questions

None. All requirements are clear and all interfaces are defined.

---

## Risks and Mitigations

**Risk:** Web Speech API may not load voices synchronously.  
**Mitigation:** Call `speechSynthesis.getVoices()` and listen to `voiceschanged` event if empty. Default to first voice if no English voice found.

**Risk:** Space keypress triggers both board select and button click.  
**Mitigation:** Use `stopImmediatePropagation()` when target is a button, and listen at document level.

**Risk:** Timer stacking after speed changes.  
**Mitigation:** Always `clearInterval()` before `setInterval()`.

---

## Next Steps

1. Create `src/core/filter.ts` with property tests.
2. Create `src/input/keyboard.ts` and tests.
3. Create `src/output/speaker.ts` and tests.
4. Create `src/ui/Board.tsx`, `src/ui/Notices.tsx`, `src/ui/themes.css`.
5. Create `src/ui/App.tsx` with timer and reducer.
6. Write `tests/app.test.tsx` integration test.
7. Run `npm test` and `npm run build`.
8. Manual verification: open in browser, press Space, navigate, hear message.
