---
inclusion: always
---

# File Structure

```text
.kiro/
  steering/         product, tech, structure, accessibility, tone
  hooks/            test and bundle automation
  settings/
    mcp.json        replay MCP server config

src/
  core/
    types.ts        shared types (Layer, Board, SweepState, Effect, etc.)
    sweep.ts        pure state machine: initialState(), next()
    board-content.ts needs, follow-ups, wording, bell rules
    filter.ts       refractory period signal filter
  
  input/
    keyboard.ts     spacebar input for testing
    camera.ts       MediaPipe Face Landmarker wrapper
    detectors.ts    pure blink and nod detectors
    serial.ts       Web Serial wrapper and line parser
  
  output/
    speaker.ts      Web Speech text-to-speech
    bell.ts         Arduino bell or laptop chime
  
  predict/
    local.ts        word-list suggestions
    remote.ts       AI client with 800ms timeout
    words.ts        hospital-focused word list (~300 words)
  
  ui/
    App.tsx         main wiring component
    Board.tsx       needs ring and follow-ups
    Arcs.tsx        letter arcs for spelling
    Setup.tsx       bedside setup flow
    Notices.tsx     family-facing error and status notices
    themes.css      Parlour and Daylight designs
  
  record.ts         trace recording mode (?record=1)

traces/             recorded blink, nod, and knock signal traces
tests/
  sweep.test.ts
  sweep.property.test.ts
  filter.property.test.ts
  detectors.test.ts
  replay.test.ts
  predict.test.ts
  remote.test.ts
  setup.test.ts
  serial.test.ts
  e2e/
    flows.spec.ts   Playwright end-to-end tests

infra/
  template.yaml     Lambda and Function URL CloudFormation
  suggest.mjs       AI suggestion function (Claude Haiku via Bedrock)

firmware/
  knock-box/
    knock-box.ino   Arduino sensor sketch

tools/
  replay-mcp/
    server.mjs      local MCP server for trace replay testing

docs/
  test-results.md   go/no-go test measurements
  kiro-journal.md   notes on Kiro's effectiveness, bugs caught, corrections made
```

## Core Rules

- **`src/core` is pure logic.** No DOM access, no browser APIs, no side effects. Everything in `src/core` must be testable with unit and property tests.
- **All other modules depend on `src/core`.** UI, input handlers, and output drivers consume the types and functions from sweep logic and content.
- **Interfaces are contracts.** Pass them to Kiro before implementation so tasks don't drift.
