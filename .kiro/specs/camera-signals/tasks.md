# Camera Signals: Tasks

**Spec:** camera-signals  
**Version:** 1.0  
**Date:** 2026-11-07

## Task Checklist

### Task 1: MediaPipe Configuration Constants

- [x] Create `src/input/mediapipe-config.ts`
- [x] Export `WASM_BASE` constant pointing to CDN WASM files
- [x] Export `MODEL_URL` constant pointing to face_landmarker.task
- [x] Add comment: offline loading will be added in a future spec

**Requirements:** None yet; foundation for Task 2 and 3.

**Check:** File exports two string constants.

---

### Task 2: Blink Detector (Pure Function)

- [x] Create `src/input/detectors.ts`
- [x] Implement `createBlinkDetector` with default parameters
- [x] Track internal state: eyesOpen, closedAtMs
- [x] Implement hysteresis: close at closeThreshold, open at openThreshold
- [x] Fire signal once when eyes reopen after minMs–maxMs closure
- [x] Require both eyes closed/open (single-eye closures ignored)
- [x] Handle irregular timestamps correctly

**Requirements:** FR-1.1 through FR-1.7

**Check:** Manual test with synthetic data:
```typescript
const detector = createBlinkDetector({});
// Simulate 700ms closure at 30fps
detector.update(0.6, 0.6, 0);    // closed
detector.update(0.6, 0.6, 33);   // closed
// ... continue for 700ms
detector.update(0.2, 0.2, 700);  // open → should return true
```

---

### Task 2.5: Face Watch Helper (Pure Function)

- [x] Add `createFaceWatch` to `src/input/detectors.ts`
- [x] Implement with method `update(faceVisible: boolean, nowMs: number)` returning 'lost', 'found', or null
- [x] Set timestamp at the moment first called, so a camera that never sees a face triggers 'lost' after lostAfterMs
- [x] Fire 'lost' exactly once after lostAfterMs without face
- [x] Fire 'found' exactly once when face returns
- [x] Handle irregular timestamps correctly

**Requirements:** FR-1.8, FR-3.6

**Check:** Manual test:
```typescript
const watch = createFaceWatch({ lostAfterMs: 2000 });
watch.update(false, 0);        // null
watch.update(false, 1000);     // null
watch.update(false, 2100);     // 'lost'
watch.update(false, 2200);     // null (no repeat)
watch.update(true, 2300);      // 'found'
watch.update(true, 2400);      // null (no repeat)
```

---

### Task 3: Nod Detector (Pure Function)

- [x] Add `createNodDetector` to `src/input/detectors.ts`
- [x] Track internal state: baseline, nodding, nodStartMs, initialized
- [x] Set baseline from the first sample and don't fire on the first sample
- [x] Update baseline with exponential moving average (alpha = 0.05) while idle
- [x] Start nod when noseY > baseline + minDelta
- [x] Fire signal when noseY returns within minDelta / 2, duration <= maxMs
- [x] Freeze baseline during nod tracking
- [x] Handle irregular timestamps correctly

**Requirements:** FR-2.1 through FR-2.7

**Check:** Manual test with synthetic data:
```typescript
const detector = createNodDetector({});
// First sample sets baseline at 0.5, returns false
detector.update(0.5, 0);
detector.update(0.5, 33);
// Nod down to 0.58
detector.update(0.58, 100);  // start nod
detector.update(0.52, 600);  // return → should fire
```

---

### Task 4: Blink Detector Unit Tests

- [x] Create `tests/detectors.test.ts`
- [x] Test: fires once for 400–2000ms closure (FR-1.3)
- [x] Test: ignores closures < 400ms (FR-1.4)
- [x] Test: ignores closures > 2000ms (FR-1.5)
- [x] Test: ignores single-eye closures (FR-1.6)
- [x] Test: hysteresis at threshold boundaries (FR-8.4)
- [x] Test: handles irregular timestamps (FR-1.7)

**Requirements:** FR-1, FR-8.1, FR-8.4

**Check:** `npm test tests/detectors.test.ts` passes.

---

### Task 5: Nod Detector Unit Tests

- [x] Add nod tests to `tests/detectors.test.ts`
- [x] Test: fires once for quick nod within maxMs (FR-2.2)
- [x] Test: ignores movements > maxMs (FR-2.3)
- [x] Test: baseline adapts during idle (FR-2.4, FR-8.5)
- [x] Test: baseline freezes during nod (FR-2.5)
- [x] Test: slow drift adapts baseline, doesn't fire (FR-2.6)
- [x] Test: handles irregular timestamps
- [x] Test: doesn't fire on first sample (FR-2.7)

**Requirements:** FR-2, FR-8.1, FR-8.5

**Check:** `npm test tests/detectors.test.ts` passes all nod tests.

---

### Task 6: Face Watch Unit Tests

- [x] Add face watch tests to `tests/detectors.test.ts`
- [x] Test: fires 'lost' exactly once after lostAfterMs (FR-1.8)
- [x] Test: fires 'found' exactly once when face returns (FR-1.8)
- [x] Test: handles irregular timestamps (FR-1.8)
- [x] Test: doesn't repeat events (FR-1.8)

**Requirements:** FR-1.8

**Check:** `npm test tests/detectors.test.ts` passes all face watch tests.

---

### Task 7: Blink Detector Property Tests

- [x] Add fast-check tests to `tests/detectors.test.ts`
- [x] Property: detector fires at most once per closure (FR-8.2)
- [x] Property: never fires when both eyes are not open (FR-8.3)
- [x] Use fast-check generators for sample sequences with varied scores and timestamps

**Requirements:** FR-8.2, FR-8.3

**Check:** Property tests pass and catch a deliberately injected bug.

---

### Task 8: Synthetic Trace Generator Script

- [x] Create `scripts/make-synthetic-traces.mjs`
- [x] Add seeded random number generator
- [x] Generate `blink-two-deliberate.json`: two 700ms closures at ~30fps, expectedSelects = 2
- [x] Generate `blink-normal-only.json`: ten 150–250ms closures, expectedSelects = 0
- [x] Generate `blink-asleep.json`: one 5s closure, expectedSelects = 0
- [x] Generate `blink-one-eye.json`: left eye only, expectedSelects = 0
- [x] Generate `nod-two.json`: two 0.08 dips in 600ms, expectedSelects = 2
- [x] Generate `nod-drift.json`: slow 0.1 drift over 20s, expectedSelects = 0
- [x] Write traces to `traces/` directory

**Requirements:** FR-7.1, FR-7.2

**Check:** Run script, inspect generated JSON files for correct structure.

---

### Task 9: Replay Test Implementation

- [x] Create `tests/replay.test.ts`
- [x] Load all `traces/*.json` files
- [x] For each trace, instantiate the correct detector
- [x] Feed samples through detector and signal filter (500ms refractory)
- [x] Count accepted selects
- [x] Assert count equals expectedSelects
- [x] Skip traces with kind 'knock' (FR-6.5)

**Requirements:** FR-6.1 through FR-6.5

**Check:** `npm test tests/replay.test.ts` passes with all synthetic traces.

---

### Task 10: Camera Source Implementation

- [x] Create `src/input/camera.ts`
- [x] Import MediaPipe FilesetResolver, FaceLandmarker from @mediapipe/tasks-vision
- [x] Import WASM_BASE, MODEL_URL from mediapipe-config.ts
- [x] Implement `createCameraSource({ mode, onSelect, onFaceLost, onFaceFound, onError, onSample })`
- [x] In `start()`: request camera with getUserMedia, load landmarker, create detector, start frame loop
- [x] In frame loop: skip frame if video.readyState < 2 or video.currentTime unchanged
- [x] Pass strictly increasing timestamp to detectForVideo (bump by 1 if needed)
- [x] Call onFaceLost after 2000ms without face (FR-3.6)
- [x] Call onFaceFound when face returns (FR-3.7)
- [x] Call onSelect when detector fires (FR-3.3)
- [x] Call onSample when connected (for recording mode)
- [x] In `stop()`: stop media tracks, cancel frame loop, close landmarker
- [x] On errors: call onError with plain message, don't throw (FR-3.4, FR-3.5)
- [x] Handle stop() called while start() is still loading

**Requirements:** FR-3.1 through FR-3.9

**Check:** Manual test with console logs to verify frame loop runs and blendshapes are extracted.

---

### Task 11: App Integration – Camera Dependency Injection

- [x] Update `src/ui/App.tsx` to accept optional prop `createCamera` (default: createCameraSource)
- [x] Ensure App tests can pass a fake camera with no MediaPipe
- [x] Ensure App tests never import @mediapipe/tasks-vision
- [x] If needed, use dynamic import inside camera.ts

**Requirements:** NFR-4.4, NFR-4.6

**Check:** App.tsx compiles and accepts createCamera prop.

---

### Task 12: App Integration – Pause Reasons and State

- [x] In `src/ui/App.tsx`, add two separate state flags: `carerPaused` and `faceLost`
- [x] One effect: call ticker.pause() when either flag is true, ticker.resume() only when both are false
- [x] Pause and Resume button shows only the carer's choice (`carerPaused`)
- [x] Pass createCamera prop for dependency injection
- [x] Add App test: carer pauses, face lost, face found, ticker still paused

**Requirements:** FR-4.4, FR-4.6

**Check:** Logic correctly pauses/resumes with combined flags, button shows carer state only.

---

### Task 13: App Integration – Signal Mode Selector

- [x] Update `src/ui/App.tsx` to add signal mode state: 'spacebar' | 'blink' | 'nod'
- [x] Add radio buttons in carer controls for mode selection
- [x] Show "Camera on" indicator when mode is not 'spacebar' (FR-4.8)
- [x] Ensure spacebar continues working in all modes (FR-4.10)

**Requirements:** FR-4.1, FR-4.8, FR-4.10

**Check:** UI renders signal mode controls.

---

### Task 14: App Integration – Camera Source Lifecycle

- [x] In `src/ui/App.tsx`, add useEffect for camera source lifecycle
- [x] When mode changes to blink or nod: create camera source with filter, start it
- [x] When mode changes to spacebar: stop camera source if running
- [x] Pass onSelect callback that dispatches { type: 'select' } through signal filter
- [x] Pass onFaceLost callback that sets faceLost state and pauses ticker (FR-4.4)
- [x] Pass onFaceFound callback that clears faceLost state and checks if can resume (FR-4.6)
- [x] Pass onError callback that shows notice and falls back to spacebar (FR-4.7)
- [x] Clean up camera source on unmount

**Requirements:** FR-4.1 through FR-4.4, FR-4.6, FR-4.7, FR-4.9

**Check:** Switching modes starts/stops camera source without errors.

---

### Task 15: App Integration – Face Lost and Camera Error Notices

- [x] Update `src/ui/Notices.tsx` to accept faceLost and cameraError props
- [x] Add face-lost notice: "I can't see your face. Move the camera or the patient into view." (FR-4.5)
- [x] Add camera-error notice: "Camera isn't available: {reason}. You can keep using the spacebar." (FR-4.7)
- [x] Pass faceLost and cameraError state from App.tsx to Notices

**Requirements:** FR-4.5, FR-4.7

**Check:** Mock onFaceLost and onError, verify notices appear.

---

### Task 16: Recording Mode – RecordPanel Component

- [x] Create `src/record.tsx`
- [x] Implement `RecordPanel` component with kind selector, expectedSelects input, Start/Stop buttons
- [x] On Start: clear samples array, set recording = true
- [x] While recording: accept samples via callback, display count
- [x] On Stop: create Trace JSON, trigger download with filename `{kind}-{timestamp}.json`

**Requirements:** FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-5.5, FR-5.6

**Check:** Component renders, buttons work, download triggers.

---

### Task 17: Recording Mode – App Integration

- [x] In `src/ui/App.tsx`, detect `window.location.search.includes('record=1')`
- [x] If record mode, render RecordPanel
- [x] If record mode and camera source is active, pass onSample callback to createCameraSource
- [x] onSample stores samples in RecordPanel's state
- [x] If not record mode, do NOT pass onSample (FR-5.7)

**Requirements:** FR-5.7

**Check:** Visit `/?record=1`, verify RecordPanel appears. Visit `/`, verify it doesn't appear.

---

### Task 18: App Tests – Mock Camera Source

- [x] Update `tests/app.test.tsx` to mock camera.ts
- [x] Mock createCameraSource to return { start: vi.fn(), stop: vi.fn() }
- [x] Test: switching to blink mode calls start
- [x] Test: switching to spacebar calls stop
- [x] Test: carer pauses, face lost, face found, ticker still paused
- [x] Test: existing needs ring tests still pass

**Requirements:** NFR-4.4, NFR-4.6

**Check:** `npm test tests/app.test.ts` passes all tests including new camera integration tests.

---

### Task 19: Manual Testing and Real Trace Collection

- [ ] Open app in browser with camera enabled
- [ ] Test deliberate long blink triggers select
- [ ] Test normal blink does not trigger
- [ ] Test single-eye closure does not trigger
- [ ] Test deliberate nod triggers select
- [ ] Test slow head drift does not trigger
- [ ] Record at least 5 real blink traces with varied conditions
- [ ] Record at least 5 real nod traces with varied conditions
- [ ] Commit real traces to `traces/` directory
- [ ] Verify replay tests pass with real traces

**Requirements:** Acceptance Criteria

**Check:** All manual tests pass, real traces replay correctly.

---

### Task 20: Face Tracking Loss Manual Test

- [ ] Open app in camera mode
- [ ] Turn head away from camera for 3 seconds
- [ ] Verify face-lost notice appears after 2 seconds
- [ ] Verify ticker is paused (selection doesn't move)
- [ ] Turn head back to camera
- [ ] Verify face-found, notice hides, ticker resumes

**Requirements:** FR-3.6, FR-3.7, FR-4.4, FR-4.5, FR-4.6

**Check:** Notice and pause behavior work as specified.

---

### Task 21: Camera Error Manual Test

- [ ] Deny camera permission in browser
- [ ] Verify camera error notice appears with helpful message
- [ ] Verify spacebar input continues to work
- [ ] Allow camera permission and reload
- [ ] Verify camera works

**Requirements:** FR-3.4, FR-4.7, FR-4.10

**Check:** Error handling is graceful, spacebar remains functional.

---

### Task 22: Final Integration Test

- [ ] Run full test suite: `npm test`
- [ ] Run type check: `npm run typecheck`
- [ ] Run build: `npm run build`
- [ ] Verify all tests pass
- [ ] Verify no TypeScript errors
- [ ] Verify build succeeds

**Requirements:** All FR, NFR, acceptance criteria

**Check:** All checks pass, no regressions in existing functionality.

---

### Task 23: Documentation and Trace Commit

- [ ] Add comments to detector implementations explaining state machine
- [ ] Add JSDoc comments to public functions in camera.ts
- [ ] Commit all synthetic traces to `traces/`
- [ ] Commit at least 5 real blink and 5 real nod traces
- [ ] Update `docs/kiro-journal.md` with what worked well, what was corrected, and any bugs caught by property tests

**Requirements:** None (documentation task)

**Check:** Code is well-documented, traces are committed, journal is updated.

---

## Summary

**Total tasks:** 23  
**Estimated time:** 2–3 days (Nov 11 to 13)  
**Dependencies:** Keyboard input, signal filter, and App structure must already exist  
**Risk:** Face tracking reliability on low-quality webcams; mitigate with clear notices and fallback to spacebar
