# Planchette Implementation Plan

> **How to use this plan:** build this in Kiro, not Claude Code. The hackathon can disqualify projects with insufficient Kiro use, so this plan contains no implementation code. Each task gives you the Kiro spec to create, its requirements and properties, the interfaces that connect tasks, and how to check the result. Tick the checkboxes as you go.

**Goal:** A browser talking board that lets someone with sudden speech loss communicate through one signal, with an optional Arduino knock box.

**Architecture:** Every input becomes one `select` event. A pure state machine turns ticks and selects into board state and effects, and the display and outputs only react to those. Prediction uses a local word list, improved by one serverless AI function.

**Tech Stack:** TypeScript, Preact, Vite, vite-plugin-pwa, Vitest, fast-check, Playwright, @mediapipe/tasks-vision, Web Serial, Web Speech, AWS Lambda, Amazon Bedrock, GitHub Pages, Arduino.

**Spec:** `docs/superpowers/specs/2026-11-07-planchette-design.md`

## Global Constraints

- Submission deadline is 2026-12-04 2:00 PM PT (2026-12-05 3:30 AM IST). Aim to submit by 2026-12-03.
- All application code comes from Kiro. `/.kiro` stays in the repo root and must never be ignored.
- The trademarked name of the commercial board game never appears in the product, repo, or video. Use "talking board".
- No clinical claims. Planchette is a communication aid, not a medical device.
- Video is never uploaded or recorded in normal use. Only spelled text goes to the AI service.
- Tone is warm and elegant, never horror.
- Judges must be able to use everything from a URL, with no hardware and no login.
- Default sweep step is 1.5 seconds, range 0.8 to 4 seconds.
- Default long blink is 400 ms or longer. Default refractory period is 500 ms. AI timeout is 800 ms.

## Working Habits

- Keep `docs/kiro-journal.md`. After each task, add a few lines on what Kiro did well, what you corrected, and any bug a property test caught. This becomes your write-up, so make it true and specific.
- Commit after each task. Your commit history is evidence the project was built during the Submission Period.
- Hooks fire only for changes made by the agent, not manual edits, so run `npm test` yourself after editing by hand.
- Agent-prompt hooks use credits, and shell-command hooks don't. Prefer shell commands.
- Property-based testing is an IDE feature, and Kiro's docs name no library, so `tech.md` tells it to use fast-check.

## File Structure

```text
.kiro/steering/          product, tech, structure, accessibility, tone
.kiro/hooks/             test and bundle hooks
.kiro/settings/mcp.json  replay MCP server
src/core/types.ts        shared types
src/core/sweep.ts        pure state machine
src/core/board-content.ts needs, follow-ups, wording, bell rules
src/core/filter.ts       refractory filter
src/input/keyboard.ts    spacebar input
src/input/camera.ts      MediaPipe wrapper
src/input/detectors.ts   pure blink and nod detectors
src/input/serial.ts      Web Serial wrapper and line parser
src/output/speaker.ts    speech
src/output/bell.ts       bell through box or laptop chime
src/predict/local.ts     word-list suggestions
src/predict/remote.ts    AI client with timeout
src/predict/words.ts     hospital-focused word list
src/ui/App.tsx           wiring
src/ui/Board.tsx         needs and follow-up rings
src/ui/Arcs.tsx          alphabet arcs
src/ui/Setup.tsx         setup flow
src/ui/Notices.tsx       family-facing notices
src/ui/themes.css        Parlour and Daylight
src/record.ts            trace recording mode
traces/                  recorded signal traces
tests/                   unit, property, replay and e2e tests
infra/template.yaml      Lambda and Function URL
infra/suggest.mjs        AI function
firmware/knock-box/      Arduino sketch
tools/replay-mcp/        replay MCP server
docs/test-results.md     go or no-go results
docs/kiro-journal.md     notes for the write-up
```

## Shared Interfaces

These are the contracts between tasks. Give them to Kiro as design input. Kiro writes the code.

```ts
type Layer = 'rest' | 'needs' | 'followup' | 'alphabet' | 'letters' | 'hold';

interface BoardOption {
  id: string;
  label: string;
  say?: string;      // sentence fragment added to the message
  goto?: string;     // next BoardNode id; no goto means the message is complete
  bell?: boolean;    // ring the bell once this message is spoken
  action?: 'spell' | 'back';
}

interface BoardNode { id: string; options: BoardOption[]; }
type Board = Record<string, BoardNode>;

interface Suggestion { text: string; kind: 'word' | 'sentence'; }

interface SweepState {
  layer: Layer;
  nodeId: string;            // current BoardNode for needs and followup
  index: number;             // highlighted option
  fragments: string[];       // follow-up message built so far
  draft: string;             // spelled text
  groupIndex: number | null; // open letter group
  suggestions: Suggestion[];
  held: { text: string; bell: boolean } | null;
  lastMessage: string | null;
  idleSweeps: number;
}

type SweepEvent =
  | { type: 'tick' }
  | { type: 'select' }
  | { type: 'suggestions'; items: Suggestion[] };

type Effect =
  | { type: 'speak'; text: string }
  | { type: 'bell' }
  | { type: 'requestSuggestions'; draft: string };

function initialState(board: Board): SweepState;
function next(state: SweepState, event: SweepEvent, board: Board):
  { state: SweepState; effects: Effect[] };

function createSignalFilter(opts: { refractoryMs: number }):
  { accept(timestampMs: number): boolean };

interface SignalSource { start(onSelect: () => void): void; stop(): void; }

function createBlinkDetector(opts: { closeThreshold: number; minMs: number }):
  { update(left: number, right: number, timestampMs: number): boolean };
function createNodDetector(opts: { minDelta: number; maxMs: number }):
  { update(noseY: number, timestampMs: number): boolean };

type SerialLine = 'KNOCK' | 'ALIVE' | 'UNKNOWN';
function parseSerialLine(line: string): SerialLine;

interface Predictor { suggest(draft: string): Promise<Suggestion[]>; }

interface Trace {
  kind: 'blink' | 'nod' | 'knock';
  expectedSelects: number;
  samples: Array<{ t: number; left?: number; right?: number; noseY?: number }>;
}
```

---

## Week 1: Foundations and the build test

### Task 0: Accounts and repo (you, Nov 7 to 8)

- [ ] Request Kiro credits with the form on the Resources tab, using your Kiro user ID.
- [ ] Install Kiro IDE and sign in. Redeem the credits when the code arrives.
- [ ] Create a public GitHub repo named `planchette` with an MIT license, and confirm the license shows in the About section.
- [ ] Copy `docs/superpowers/specs/` and this plan into the repo.
- [ ] Add `.gitignore` entries for `node_modules/`, `dist/`, and `.superpowers/`. Do not add `.kiro`.
- [ ] Create `docs/kiro-journal.md` and `docs/test-results.md`.
- [ ] Confirm you can create an AWS account and set a budget alert of a few dollars. If you can't, tell Claude so we can change the AI host.
- [ ] Commit: `chore: set up project`

**Check:** the repo is public, shows the license, and opens in Kiro.

### Task 1: Steering (Nov 8)

Create these in `.kiro/steering/`. Ask Kiro to draft them from the design spec, then correct them yourself.

| File | Inclusion | Must say |
|---|---|---|
| `product.md` | always | Who the user is, what the product is, what's out of scope |
| `tech.md` | always | The stack above. fast-check for property tests, Vitest for tests, no new dependency without asking |
| `structure.md` | always | The file structure above. Sweep logic is pure and has no DOM access |
| `accessibility.md` | `fileMatch` on `src/ui/**` | Large text readable from a bed, strong contrast, reduced-motion support, no flashing |
| `tone.md` | `fileMatch` on `src/**` and `docs/**` | Warm, never horror. No trademarked game name. No clinical claims. Include examples of what not to write |

Reference the spec from `product.md` with `#[[file:docs/superpowers/specs/2026-11-07-planchette-design.md]]`.

- [ ] Create the five files.
- [ ] Ask Kiro "What is out of scope, and what word must never be used?" and confirm it answers correctly.
- [ ] Commit: `docs: add Kiro steering`

### Task 2: Project skeleton and hooks (Nov 8)

- [ ] In Kiro chat, ask it to scaffold Preact, TypeScript and Vite with Vitest, fast-check and Playwright, and to add `npm test`, `npm run build` and `npm run typecheck`.
- [ ] Add `.kiro/hooks/run-tests.json`, a shell hook on File Save matching `\.(ts|tsx)$` that runs `npm test`. Create it from the IDE's hook UI so the trigger name is correct.
- [ ] Add `.kiro/hooks/bundle-check.json`, a shell hook on Agent Stop that runs `npm run build`.
- [ ] Commit: `chore: add skeleton and hooks`

**Check:** `npm test` and `npm run build` pass, and a Kiro edit to a `.ts` file triggers the test hook.

### Task 3: Spec `sweep-logic` (Nov 9 to 10)

Create a Feature spec, Requirements-First. This is your best Kiro showcase, so take your time on it.

**Files:** `src/core/types.ts`, `src/core/sweep.ts`, `src/core/board-content.ts`, `tests/sweep.test.ts`, `tests/sweep.property.test.ts`

**Interfaces:** produces `Layer`, `Board`, `SweepState`, `SweepEvent`, `Effect`, `initialState`, `next`.

**Requirements to give Kiro:**

- WHEN the state is at rest and a tick arrives THE SYSTEM SHALL change nothing and produce no effects.
- WHEN the state is at rest and a select arrives THE SYSTEM SHALL open the needs ring at the first option, or the alphabet layer if a draft exists.
- WHEN a tick arrives in an active layer THE SYSTEM SHALL move to the next option and wrap at the end.
- WHEN two full sweeps pass with no select THE SYSTEM SHALL return to rest and keep any draft.
- WHEN a select chooses an option with `goto` THE SYSTEM SHALL add its `say` fragment and open that node.
- WHEN a select chooses an option with no `goto` THE SYSTEM SHALL move to hold with the full message.
- WHEN a select chooses Back THE SYSTEM SHALL return to the previous node and remove the last fragment.
- WHEN a select chooses Spell THE SYSTEM SHALL open the alphabet layer.
- WHEN the alphabet layer is active THE SYSTEM SHALL sweep suggestions, then six letter groups, then Speak, Delete, Space and Needs.
- WHEN a select chooses a letter group THE SYSTEM SHALL sweep that group's letters.
- WHEN a full letter sweep passes with no select THE SYSTEM SHALL return to the alphabet layer.
- WHEN a select chooses a letter THE SYSTEM SHALL add it to the draft and emit `requestSuggestions`.
- WHEN a select chooses a word suggestion THE SYSTEM SHALL complete the current word and add a space.
- WHEN a select chooses a sentence suggestion or Speak THE SYSTEM SHALL move to hold.
- WHEN a tick arrives during hold THE SYSTEM SHALL emit `speak`, emit `bell` if required, set `lastMessage`, clear the draft and return to needs.
- WHEN a select arrives during hold THE SYSTEM SHALL cancel the message and emit nothing.

**Board content:** use the needs table in the spec exactly, with nine options. Pain's Very bad, Breathing, and Call someone set `bell: true`.

**Properties (`tests/sweep.property.test.ts`):** generate random sequences of ticks and selects with fast-check.

1. Every option on every node can be reached by ticks alone.
2. From any reachable state, some sequence of events returns to needs.
3. `speak` is only ever emitted by a tick during hold.
4. A select during hold produces no `speak`, then or on the next tick.
5. At rest, any number of ticks leaves the state unchanged.
6. Each top-level need takes one select, and any follow-up result takes at most three.
7. `index` is always a valid option for the current layer.

- [ ] Create the spec, and review requirements, design and tasks before running them.
- [ ] Run the tasks.
- [ ] Run the property tests, and record any bug they catch in the journal.
- [ ] Commit: `feat: add sweep logic with property tests`

**Check:** `npm test` passes. Then deliberately break the Back behaviour, confirm a property fails, and restore it.

### Task 4: Spec `playable-needs-ring` (Nov 10 to 11)

**Files:** `src/core/filter.ts`, `src/input/keyboard.ts`, `src/output/speaker.ts`, `src/ui/App.tsx`, `src/ui/Board.tsx`, `src/ui/Notices.tsx`, `src/ui/themes.css`, `tests/filter.property.test.ts`

**Interfaces:** consumes `next`, `initialState`, `Effect`. Produces `createSignalFilter`, `SignalSource`.

**Requirements:**

- WHEN the app runs THE SYSTEM SHALL send a tick every sweep step, using a settable step length.
- WHEN the spacebar is pressed THE SYSTEM SHALL send it through the signal filter as a select.
- WHEN a select arrives within the refractory period THE SYSTEM SHALL ignore it.
- WHEN a `speak` effect arrives THE SYSTEM SHALL speak the text and show it in large text.
- WHEN speech is unavailable THE SYSTEM SHALL keep the large text and show a notice.
- WHEN the state changes THE SYSTEM SHALL show the highlighted option large in the centre.

Use the plain Daylight look for now. Parlour comes in Task 11.

**Property:** for any timestamps, no two accepted selects are closer than `refractoryMs`, and the first select is always accepted.

- [ ] Create and run the spec.
- [ ] Commit: `feat: add playable needs ring`

**Check:** in `npm run dev`, wake with the spacebar and pick Pain, Chest, Bad. You should hear "Pain in my chest. It's bad."

### Task 5: Spec `camera-signals` and the build test (Nov 11 to 13)

This is the first go or no-go gate.

**Files:** `src/input/detectors.ts`, `src/input/camera.ts`, `src/record.ts`, `traces/*.json`, `tests/detectors.test.ts`, `tests/replay.test.ts`

**Interfaces:** consumes `SignalSource`, `createSignalFilter`. Produces `createBlinkDetector`, `createNodDetector`, `Trace`.

**Requirements:**

- WHEN both blink scores stay above the threshold for `minMs` THE SYSTEM SHALL report one signal.
- WHEN a blink is shorter than `minMs` THE SYSTEM SHALL report nothing.
- WHEN one eye closes alone THE SYSTEM SHALL report nothing.
- WHEN the nose moves down by `minDelta` and back within `maxMs` THE SYSTEM SHALL report one signal.
- WHEN no face is found for two seconds THE SYSTEM SHALL pause the sweep and show a notice.
- WHEN the app opens with `?record=1` THE SYSTEM SHALL capture samples and let you download a `Trace`. Normal mode never records.

Detectors must be pure, taking numbers and timestamps, so recorded traces can replay them. Use the `eyeBlinkLeft` and `eyeBlinkRight` blendshape scores from Face Landmarker.

- [ ] Create and run the spec.
- [ ] Record at least 5 blink traces and 5 nod traces, including normal blinks that must not count.
- [ ] Add `tests/replay.test.ts` to run each trace and compare with `expectedSelects`.
- [ ] Run the build test without using your hands, and record the numbers in `docs/test-results.md`:
  - Pick a need in under 15 seconds.
  - Intended selection at least 9 times out of 10.
- [ ] Commit: `feat: add camera signals and replay tests`

**Decision:** "I need water" in under 30 seconds is tested after Task 6. If picking a need fails, tune the detectors. If it still fails by Nov 16, switch to the fallback.

### Task 6: Spec `spelling` (Nov 12 to 15)

**Files:** `src/ui/Arcs.tsx`, `src/predict/local.ts`, `src/predict/words.ts`, `tests/predict.test.ts`

**Interfaces:** consumes `Suggestion`, `SweepState`. Produces `Predictor`.

**Requirements:**

- WHEN the alphabet layer is open THE SYSTEM SHALL show A to M and N to Z as two arcs in alphabetical order.
- WHEN a group or letter is highlighted THE SYSTEM SHALL mark it clearly and show the draft above the arcs.
- WHEN the draft changes THE SYSTEM SHALL offer up to three word suggestions from the local list.
- WHEN the draft is empty THE SYSTEM SHALL offer common starters such as "I need" and "Please".

Write `words.ts` as about 300 words a hospital patient would use, ordered by likely usefulness. Add a few sentence suggestions, so "I need water" is offered once "I nee" is spelled.

- [ ] Create and run the spec.
- [ ] Run the third build-test measure and record it: "I need water" in under 30 seconds.
- [ ] Commit: `feat: add alphabet arcs and local prediction`

---

## Week 2: AI, setup, hardware and the human test

### Task 7: Spec `ai-suggestions` (Nov 15 to 16)

**Files:** `infra/suggest.mjs`, `infra/template.yaml`, `src/predict/remote.ts`, `tests/remote.test.ts`

**Interfaces:** consumes `Predictor`, `Suggestion`. Produces a combined `Predictor` that merges AI and local results.

**Requirements:**

- WHEN the draft changes THE SYSTEM SHALL request up to three sentence suggestions from `POST /suggest` with `{ "text": draft }`.
- WHEN no response arrives within 800 ms THE SYSTEM SHALL use local suggestions only.
- WHEN a response arrives after the timeout THE SYSTEM SHALL ignore it.
- WHEN the network fails THE SYSTEM SHALL use local suggestions and show no error to the patient.
- WHEN the function receives text over 200 characters THE SYSTEM SHALL reject it.
- WHEN the function runs THE SYSTEM SHALL not log the text.

Deploy with a Lambda Function URL, CORS limited to your GitHub Pages origin, reserved concurrency of 2 to cap cost, and the Bedrock Converse API with the fastest Claude Haiku model available in your region. Set the AWS budget alert first.

- [ ] Create and run the spec with a mocked server in tests.
- [ ] Deploy and test with the real model.
- [ ] Commit: `feat: add AI suggestions`

**Check:** with the network off, spelling still works with word suggestions.

### Task 8: Spec `bedside-setup` (Nov 16 to 17)

**Files:** `src/ui/Setup.tsx`, `tests/setup.test.ts`

**Requirements:**

- WHEN the app opens for the first time THE SYSTEM SHALL explain in plain words what it does, that video stays on the laptop, and that spelled text goes to an AI service.
- WHEN setup runs THE SYSTEM SHALL offer blink, nod, knock and spacebar, and ask for the signal twice to test it.
- WHEN a signal is confirmed THE SYSTEM SHALL let the family member choose slow, medium or fast.
- WHEN setup finishes THE SYSTEM SHALL save settings on that laptop.
- WHEN settings exist THE SYSTEM SHALL skip setup and offer a way to redo it.

- [ ] Create and run the spec.
- [ ] Time a stranger or friend through setup and record it. The target is under one minute.
- [ ] Commit: `feat: add bedside setup`

### Task 9: Spec `knock-box` (when you're back at the hostel, finish by Nov 20)

Send Claude a photo or list of the kit first, so sensor choices can be confirmed.

**Files:** `firmware/knock-box/knock-box.ino`, `src/input/serial.ts`, `src/output/bell.ts`, `tests/serial.test.ts`

**Interfaces:** consumes `SignalSource`. Produces `parseSerialLine`, `SerialLine`.

**Requirements:**

- WHEN the sensor passes its threshold THE SYSTEM SHALL send `KNOCK` once, then ignore further hits briefly.
- WHEN one second has passed THE SYSTEM SHALL send `ALIVE`.
- WHEN `BELL` is received THE SYSTEM SHALL sound the buzzer in a short pattern.
- WHEN `SILENCE` is received THE SYSTEM SHALL stop the buzzer.
- WHEN the family member clicks Connect THE SYSTEM SHALL open the port through Web Serial.
- WHEN no `ALIVE` arrives for three seconds THE SYSTEM SHALL show a notice and keep the other inputs working.
- WHEN a `bell` effect arrives and no box is connected THE SYSTEM SHALL play a chime on the laptop.

Use 9600 baud. Keep the threshold as a named constant at the top of the sketch. Record knock traces and add them to the replay test. Wire everything at USB power only, and keep the sensor away from anything medical.

- [ ] Create and run the spec.
- [ ] Measure 20 deliberate knocks and record the hit rate and false triggers in `docs/test-results.md`.
- [ ] If it's unreliable by Nov 20, swap to a push button.
- [ ] Commit: `feat: add knock box`

### Task 10: Human test (you, by Nov 21)

This is the second go or no-go gate. Start asking people in week 1, because replies take time.

- [ ] Contact your college hospital, a speech therapy department, or local AAC groups.
- [ ] Ask at least one AAC user, speech therapist or clinician to try it. Never test on a real patient without their care team's agreement.
- [ ] Ask these questions:
  - Would this help someone who has just lost their speech?
  - What's missing from the needs ring, and is the wording right?
  - Is the talking-board theme acceptable?
  - What would stop a family from using it?
- [ ] Record their answers in `docs/test-results.md`, and get permission before quoting them.

**Decision:** if they object to the theme, change the theme and keep the product. If they say it isn't useful, switch to the fallback.

---

## Week 3: Polish

### Task 11: Spec `parlour-design` (Nov 21 to 24)

**Files:** `src/ui/themes.css`, `src/ui/Board.tsx`, `src/ui/Arcs.tsx`

Base it on the approved mockups, Parlour and Classic arcs, in `.superpowers/brainstorm/`. The design must be original, not a copy of a commercial board.

**Requirements:**

- WHEN the app opens THE SYSTEM SHALL use Parlour by default.
- WHEN a carer switches theme THE SYSTEM SHALL change to Daylight at once and remember the choice.
- WHEN the sweep moves THE SYSTEM SHALL glide the planchette to the next option.
- WHEN reduced motion is requested THE SYSTEM SHALL move without gliding.
- WHEN a message is spoken THE SYSTEM SHALL keep it on screen, readable from across the room.

- [ ] Create and run the spec.
- [ ] Check it from 2 metres away, in dim light, and while lying down.
- [ ] Commit: `feat: add Parlour design`

### Task 12: Spec `offline-and-notices` (Nov 24 to 25)

**Files:** `vite.config.ts`, `src/ui/Notices.tsx`, `tests/e2e/offline.spec.ts`

**Requirements:**

- WHEN the app has loaded once THE SYSTEM SHALL work offline, including the MediaPipe model files.
- WHEN offline THE SYSTEM SHALL keep the needs ring, follow-ups, spelling and word suggestions working.
- WHEN the browser lacks Web Serial THE SYSTEM SHALL hide Connect and keep everything else working.
- WHEN the camera is refused THE SYSTEM SHALL offer spacebar or knock box instead.

- [ ] Create and run the spec.
- [ ] Test with the network disabled, and check whether the laptop's speech voice works offline.
- [ ] Commit: `feat: add offline support and notices`

### Task 13: Replay MCP server (Nov 25 to 27)

**Files:** `tools/replay-mcp/server.mjs`, `.kiro/settings/mcp.json`

**Interfaces:** consumes `Trace`, the detectors, and `createSignalFilter`.

Create a local stdio MCP server with one tool, `run_replay`, taking an optional trace name and returning trace name, expected selects, actual selects, and pass or fail. Configure it like this:

```json
{
  "mcpServers": {
    "planchette-replay": {
      "command": "node",
      "args": ["tools/replay-mcp/server.mjs"],
      "autoApprove": ["run_replay"]
    }
  }
}
```

- [ ] Build it in Kiro, and confirm the tool appears in the MCP panel.
- [ ] Ask Kiro to change a detector threshold, use `run_replay` to see the effect, and choose the best value. Save this exchange for the write-up.
- [ ] Commit: `feat: add replay MCP server`

### Task 14: End-to-end tests and deploy (Nov 27 to 28)

**Files:** `tests/e2e/*.spec.ts`, `.github/workflows/deploy.yml`

- [ ] Ask Kiro for Playwright tests of the spacebar flows: wake, Pain to Very bad with bell, Spell, cancel during hold, rest after two sweeps.
- [ ] Deploy to GitHub Pages with HTTPS and update the Lambda CORS origin.
- [ ] Open the public URL on another laptop and run the full flow.
- [ ] Commit: `chore: add e2e tests and deploy`

**Check:** `npm test`, `npm run typecheck`, `npm run build`, and `npx playwright test` all pass.

---

## Week 4: Submission

### Task 15: Submission materials (you, Nov 28 to Dec 3)

Write the blog and social posts yourself. The Social Blitz prize is judged partly on original thoughts versus AI writing.

- [ ] Fix the highest-impact issues from Task 10 first.
- [ ] Search for trademark conflicts with the name "Planchette".
- [ ] Write the README: what it is, try-it link, setup, hardware build, and pre-existing tools used.
- [ ] Record a video under three minutes with no copyrighted music, covering:
  - The problem, in one human moment.
  - The twist: this object was always called a talking board.
  - A full hands-free message with blink.
  - The knock box and bell working on real hardware.
  - How Kiro built it: specs, property tests, hooks, steering and replay MCP.
- [ ] Upload the video to YouTube as public.
- [ ] Write the Devpost description and Kiro write-up from `docs/kiro-journal.md`. Say that early research and design used Claude Code.
- [ ] Add student details: LinkedIn, student email, year and degree, school name.
- [ ] Publish the blog post, mentioning Kiroween 2026. Publish a social post starting with `#KiroweenHackathon26`.
- [ ] Check `/.kiro` is in the public repo root, and the license shows in the About section.
- [ ] Open the repo and live URL in a private window.
- [ ] Submit by Dec 3, in case of problems.

## Stretch, only if everything above is done

In this order: Hindi needs ring, head-steering mode, Crew bot running nightly replay benchmarks, self-moving physical planchette.
