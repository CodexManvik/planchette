# Planchette design

Date: 2026-11-07
Hackathon: Kiroween 2026, Resurrection category, plus Best Student Project: Resurrection
Entrant: solo student
Submission deadline: 2026-12-04 2:00 PM PT (2026-12-05 3:30 AM IST)

## Summary

Planchette is a talking board in the browser for people who suddenly can't speak, such as someone on a ventilator, recovering from surgery, or just after a stroke. A family member opens a link at the bedside. The patient answers a moving planchette with one signal: a long blink, a nod, or a knock on an Arduino sensor.

The pitch: the object is literally called a talking board, and here it helps someone who can't speak to talk.

## Users

- **Primary user:** a patient with sudden speech loss who is weak, tired, possibly frightened, and untrained.
- **Secondary user:** a family member or carer who sets it up and reads or hears the messages.
- **Later, not in this version:** long-term AAC users such as people with ALS.

## Product flow

### 1. Setup

Target: under one minute. The family member opens the link in Chrome or Edge and allows the camera. The board then finds a signal the patient can do reliably, sets the sweep speed, and tells the family member that spelled text goes to an AI service while video stays on the laptop. Settings are remembered on that laptop.

### 2. Rest

The sweep stays still until a wake signal arrives, so the board doesn't speak or select anything while the patient sleeps. After two full sweeps with no select, it returns to rest.

### 3. Needs ring

The planchette sweeps nine choices, and one select picks the highlighted one.

| Need | Follow-up | Example result | Bell rings automatically |
|---|---|---|---|
| Pain | Where (Head, Chest, Stomach, Back, Arm or leg, Other), then how bad (A little, Bad, Very bad) | "Pain in my chest. It's bad." | Only for Very bad |
| Breathing | None | "I can't breathe well." | Yes |
| Thirsty | Water, or Wet my mouth | "Please wet my mouth." | No |
| Toilet | None | "I need the toilet." | No |
| Hot or cold | Too hot, or Too cold | "I'm too cold." | No |
| Call someone | Nurse or doctor, or Family | "Please get the nurse or doctor." | Yes |
| Yes | None | "Yes." | No |
| No | None | "No." | No |
| Spell | Opens the alphabet layer | Whatever the patient spells | No |

Every follow-up level also has Back. The wording must be reviewed by a speech therapist or clinician before the demo if one is available.

### 4. Alphabet layer

The layout is two classic arcs: A to M above, N to Z below. Letters stay in alphabetical order. The sweep order is:

1. Up to three AI or word-list suggestions.
2. Six letter groups: A to D, E to H, I to M, N to R, S to V, W to Z.
3. Controls: Speak, Delete, Space, Needs.

Selecting a group sweeps its letters one at a time. If a full letter sweep passes with no select, the sweep returns to the alphabet layer. Word suggestions are added to the draft, and sentence suggestions go straight to Speak.

### 5. Speak

The message is held for one sweep step, shown in large text, and a second select cancels it. It is then spoken aloud and stays on screen, readable from across the room. The patient or board can ring the bell when nobody is watching.

## Visual design

- **Default:** Parlour, an aged wooden talking board with serif lettering. This is an original design, not a copy of any commercial board.
- **Alternative:** Daylight, plain and high contrast, one tap away.
- **Tone:** warm and elegant, never horror. No skulls, gore, or jokes about death.
- **Readability:** the current option also appears large in the centre, readable from a bed.
- **Motion:** respects reduced-motion settings.
- **Mockups:** stored in `.superpowers/brainstorm/`.

## Architecture

The core path is: inputs, one `select` event, sweep logic, display and output.

| Unit | Responsibility | Depends on |
|---|---|---|
| Camera input | Detects long blinks and nods with MediaPipe in the browser, and reports lost tracking | Webcam |
| Serial input | Reads the Arduino over Web Serial and detects disconnection | Knock box |
| Keyboard input | Sends a select from the spacebar for testing, carers and judges | None |
| Signal filter | Applies calibrated thresholds and a refractory period so one action counts once | Inputs |
| Sweep logic | Pure state machine: `next(state, event)` for ticks and selects, with no display code | Board content |
| Board content | One data file with needs, follow-ups, wording and bell rules | None |
| Predictor | Returns suggestions from a local word list, improved by AI when available | Serverless function |
| Display | Draws Parlour or Daylight from sweep state | Sweep logic |
| Output | Speech, large text and bell | Serial input, browser speech |
| Setup | Calibrates signal and speed, and stores settings | All inputs |

### Stack

- TypeScript web app using Preact, built with Vite, delivered as an installable PWA.
- MediaPipe Face Landmarker running in the browser. Video is never uploaded.
- Browser speech synthesis, using voices already on the laptop.
- AWS Lambda calling the fastest available Claude Haiku model on Amazon Bedrock, used only for suggestions. The key stays on the server.
- GitHub Pages hosting with a public HTTPS URL and no login. Camera and Web Serial both need HTTPS.

### Default settings

| Setting | Default | Range |
|---|---|---|
| Sweep step | 1.5 seconds | 0.8 to 4 seconds |
| Long blink | 400 ms or longer, then calibrated | Set during setup |
| Refractory period | 500 ms | Set during setup |
| AI suggestion timeout | 800 ms | Fixed |

### Arduino knock box

- A small sketch reads a sensor chosen from the kit, with a piezo knock sensor preferred.
- Serial messages from the box are `KNOCK` and a regular `ALIVE`.
- Messages to the box are `BELL` and `SILENCE`.
- It uses a buzzer, or a real bell if the kit allows it. With no box attached, the bell plays as a chime on the laptop.
- The app stays fully usable with no box attached, so judges only need a URL.
- If the sensor isn't reliable by the end of week 2, the box falls back to a push button.

## Error handling

- **Accidental signals:** normal blinks don't count, and the refractory period blocks repeats.
- **Mistaken messages:** the one-step hold allows cancelling before speech.
- **No connection:** the needs ring, follow-ups, spelling and word-list suggestions work offline.
- **Slow AI:** after 800 ms the sweep continues with word-list suggestions.
- **Lost face tracking:** the board pauses and shows a clear notice to the family member.
- **Arduino unplugged:** missing `ALIVE` messages trigger a notice, and the camera and keyboard keep working.
- **Speech unavailable:** large text remains, and the family member sees a notice.

## Privacy, safety and claims

- Video is processed on the device and never uploaded or recorded.
- Only spelled text goes to the AI service, and no account or patient identity is collected.
- Planchette is a communication aid, not a medical device, and doesn't replace a hospital nurse-call system.
- We make no clinical claims. The SpeakFaster result comes from two ALS users typing with eye gaze, so it can be cited as background only.
- The name of the commercial board game is not used in the product, repo, or video, because it's a Hasbro trademark. Use "talking board". Check the name "Planchette" before submitting.
- Anyone shown in the video gives consent, and nobody is presented as a real patient unless they are one and agree.

## Out of scope for this version

- Head-steering mode.
- The patient's own voice.
- Listening to the room for context.
- Self-moving physical planchette.
- Hindi and other languages, though all wording stays in the board content file.

These are added only after everything in this document works.

## Testing

### Property tests on sweep logic

- Every option is reachable from every layer.
- Every state has a path back to Needs.
- A single select chooses a need, and any follow-up result takes at most three selects.
- A message is never spoken without a select.
- A cancel during the hold always stops speech.
- At rest, ticks never change the selection or output.

### Filter and replay tests

- One physical action produces exactly one select, across varied timing.
- Recorded blink, nod and knock traces produce the expected selects.
- Threshold changes are checked against the recorded traces.

### End-to-end and manual tests

- Browser tests of the full flow using the spacebar input.
- Offline run with the network disabled.
- Hardware test with the knock box connected and then unplugged.
- Speech voice check on the demo laptop, including offline.

## Go or no-go tests

### Build test, by 2026-11-13

Hands-free in the browser, with no use of hands:
- Pick a need in under 15 seconds.
- Make the intended selection at least 9 times out of 10.
- Produce "I need water" in under 30 seconds with suggestions.

If this fails, tune the signals or lean on the knock box. If it still fails by 2026-11-16, switch to the fallback.

### Human test, by 2026-11-21

Get feedback from at least one AAC user, speech therapist, or clinician. If they object to the theme, change the theme and keep the product. If they say it isn't useful, switch to the fallback.

**Fallback:** Hexbreaker, a browser extension that exposes and removes dark patterns.

## Building in Kiro

The hackathon requires a project really built with Kiro, so the code must be produced there, not in Claude Code. This document is an input to that work. Early research and design used Claude Code, and the write-up will say so.

| Kiro feature | Planned use |
|---|---|
| Specs | One spec each for sweep logic, signal filter, predictor, display, setup, and knock box |
| Property-based testing | The sweep logic properties above |
| Steering | Accessibility rules, tone rules, and "no clinical claims" |
| Hooks | Run tests on save, and check accessibility and bundle size |
| Custom MCP server | Replays recorded traces so Kiro can see accuracy or speed change |
| Crew | Optional stretch: a bot that runs replay benchmarks nightly |

## Timeline

| Dates | Focus |
|---|---|
| Nov 7 to 13 | Request credits, set up Kiro and repo, build sweep logic and needs ring, run the build test, contact a reviewer |
| Nov 14 to 20 | Alphabet layer, predictor, speech, setup, knock box |
| Nov 21 to 27 | Parlour polish, Daylight, offline support, replay MCP server |
| Nov 28 to Dec 3 | Fixes, demo video, write-up, blog post, social post, submit early |

## Submission checklist

- Public GitHub repo with an open source license shown in the About section.
- `/.kiro` at the repo root and not ignored. `.superpowers/` is ignored.
- Working public URL with no login.
- YouTube demo under three minutes with no copyrighted music.
- Description and a write-up of how Kiro was used.
- Student details: LinkedIn, student email, year and degree, school name.
- Optional blog post and social post starting with `#KiroweenHackathon26`.
