# Camera Signals: Requirements

**Spec:** camera-signals  
**Version:** 1.0  
**Date:** 2026-11-07

## Overview

Enable patients to control Planchette through long blinks or nods, detected by MediaPipe Face Landmarker running in the browser. Camera signals must feed the existing signal filter and dispatch system, maintaining privacy by processing video on-device only.

## Scope

**In scope:**
- Blink detection using eyeBlinkLeft and eyeBlinkRight blendshapes
- Nod detection using nose-tip y-coordinate movement
- Face tracking loss detection and recovery
- Camera permission handling and error reporting
- Signal source integration with existing filter and dispatch
- Recording mode for trace capture (?record=1)
- Replay tests for detector accuracy

**Out of scope (future specs):**
- Offline model loading
- Head-steering mode
- Custom calibration UI (covered by setup spec)
- Camera settings controls (resolution, framerate)

## Dependencies

- **Consumes:** `SignalSource` interface (keyboard.ts), `createSignalFilter` (filter.ts), SweepEvent dispatch pattern (App.tsx)
- **Produces:** `createBlinkDetector`, `createNodDetector`, `createCameraSource`, recording mode, Trace format
- **External:** @mediapipe/tasks-vision 1.1.1 (already installed)

## Functional Requirements (EARS Format)

### FR-1: Blink Detection

**FR-1.1:** WHEN both eye blink scores are >= closeThreshold THE SYSTEM SHALL mark the eyes as closed.

**FR-1.2:** WHEN both eye blink scores return to < openThreshold THE SYSTEM SHALL mark the eyes as open.

**FR-1.3:** WHEN the eyes close and then reopen, and the closure duration is >= minMs and <= maxMs THE SYSTEM SHALL fire one blink signal at the moment the eyes reopen.

**FR-1.4:** WHEN a closure is shorter than minMs THE SYSTEM SHALL NOT fire a signal.

**FR-1.5:** WHEN a closure is longer than maxMs THE SYSTEM SHALL NOT fire a signal.

**FR-1.6:** WHEN only one eye closes THE SYSTEM SHALL NOT fire a signal.

**FR-1.7:** WHEN samples arrive at irregular intervals THE SYSTEM SHALL compute duration correctly using timestamps.

**Default parameters:**
- `closeThreshold`: 0.5
- `openThreshold`: 0.3
- `minMs`: 400
- `maxMs`: 2000

**Rationale:** Hysteresis (different open/close thresholds) prevents flickering scores from causing false triggers. The duration window distinguishes deliberate long blinks from normal blinks (too short) and falling asleep (too long).

### FR-1.8: Face Watch Helper

**FR-1.8:** THE SYSTEM SHALL provide a pure helper function `createFaceWatch({ lostAfterMs })` with method `update(faceVisible: boolean, nowMs: number)` returning 'lost', 'found', or null. This allows App and tests to track face loss independently. The timestamp SHALL be set at the moment the frame loop starts, so a camera that never sees a face triggers 'lost' after the specified duration.

### FR-2: Nod Detection

**FR-2.1:** WHEN noseY exceeds baseline + minDelta THE SYSTEM SHALL start tracking a nod.

**FR-2.2:** WHEN noseY returns within minDelta / 2 of baseline during a tracked nod THE SYSTEM SHALL fire one nod signal.

**FR-2.3:** WHEN a nod movement exceeds maxMs THE SYSTEM SHALL NOT fire a signal.

**FR-2.4:** WHILE no nod is in progress THE SYSTEM SHALL update the baseline as an exponential moving average with alpha 0.05.

**FR-2.5:** WHILE a nod is in progress THE SYSTEM SHALL NOT update the baseline.

**FR-2.6:** WHEN the patient slowly drifts (e.g., sinking into pillow) THE SYSTEM SHALL adapt the baseline and NOT fire.

**FR-2.7:** THE SYSTEM SHALL set the baseline from the first sample and SHALL NOT fire a signal on the first sample. This prevents spurious signals during initialization.

**Default parameters:**
- `minDelta`: 0.04 (normalized coordinate space)
- `maxMs`: 1200

**Rationale:** The adaptive baseline allows the detector to handle slow position drift while rejecting it as a signal. The movement must be quick enough (under maxMs) to count as deliberate.

### FR-3: Camera Source Integration

**FR-3.1:** WHEN start() is called with mode 'blink' THE SYSTEM SHALL load the face landmarker and run the blink detector.

**FR-3.2:** WHEN start() is called with mode 'nod' THE SYSTEM SHALL load the face landmarker and run the nod detector.

**FR-3.3:** WHEN a detector fires THE SYSTEM SHALL call onSelect() once.

**FR-3.4:** WHEN getUserMedia is denied THE SYSTEM SHALL call onError with a plain message and NOT throw.

**FR-3.5:** WHEN the landmarker fails to load THE SYSTEM SHALL call onError with a plain message and NOT throw.

**FR-3.6:** WHEN no face is detected for 2000 ms THE SYSTEM SHALL call onFaceLost() once. The timestamp used to measure this interval SHALL be set at the moment the frame loop starts, so that a camera that never sees a face still calls onFaceLost after 2000 ms.

**FR-3.7:** WHEN a face is detected after being lost THE SYSTEM SHALL call onFaceFound() once.

**FR-3.8:** WHEN stop() is called THE SYSTEM SHALL stop all media tracks, cancel the frame loop, and close the landmarker.

**FR-3.9:** AT ALL TIMES video frames SHALL remain on-device and NEVER be stored or uploaded.

**Frame loop improvements:**
- Skip a frame when video.readyState < 2 or video.currentTime hasn't changed since the last frame.
- Pass a strictly increasing timestamp to detectForVideo, using performance.now() and bumping it by 1 if it didn't increase.
- Stop the frame loop if stop() is called while start() is still loading.

### FR-4: App Integration

**FR-4.1:** WHEN the carer selects Blink or Nod mode THE SYSTEM SHALL start the camera source.

**FR-4.2:** WHEN the camera source fires onSelect THE SYSTEM SHALL pass it through the existing signal filter (500ms refractory).

**FR-4.3:** WHEN the camera source fires onSelect and the filter accepts THE SYSTEM SHALL dispatch { type: 'select' }.

**FR-4.4:** The App SHALL maintain two separate flags: `carerPaused` (set by the carer) and `faceLost` (set by face tracking). WHEN either flag is true THE SYSTEM SHALL pause the ticker. WHEN both are false THE SYSTEM SHALL resume the ticker.

**FR-4.5:** WHEN the face is lost THE SYSTEM SHALL show a notice: "I can't see your face. Move the camera or the patient into view."

**FR-4.6:** The Pause and Resume button SHALL show only the carer's choice (`carerPaused`), NOT the combined state. WHEN the face is found again THE SYSTEM SHALL clear `faceLost` and hide the face-lost notice. If `carerPaused` is still true, the ticker remains paused.

**FR-4.7:** WHEN the camera reports an error THE SYSTEM SHALL show a notice: "Camera isn't available: <reason>. You can keep using the spacebar."

**FR-4.8:** WHILE the camera is active THE SYSTEM SHALL show a "Camera on" indicator.

**FR-4.9:** WHEN Spacebar only mode is selected THE SYSTEM SHALL stop the camera source if running.

**FR-4.10:** AT ALL TIMES the spacebar SHALL continue to work regardless of camera mode.

**Rationale:** The ticker must pause during face loss to avoid unintended selections. Clear, specific notices help the family member resolve the issue.

### FR-5: Recording Mode

**FR-5.1:** WHEN the URL contains ?record=1 THE SYSTEM SHALL show a recording panel.

**FR-5.2:** WHEN Start recording is clicked THE SYSTEM SHALL begin storing samples with timestamps relative to start.

**FR-5.3:** WHILE recording blink mode THE SYSTEM SHALL store { t, left, right } for each frame.

**FR-5.4:** WHILE recording nod mode THE SYSTEM SHALL store { t, noseY } for each frame.

**FR-5.5:** WHEN Stop recording is clicked THE SYSTEM SHALL offer a JSON download named <kind>-<timestamp>.json.

**FR-5.6:** THE downloaded file SHALL contain { kind, expectedSelects, samples }.

**FR-5.7:** WHEN the URL does NOT contain ?record=1 THE SYSTEM SHALL NOT connect onSample and SHALL NOT store anything.

**Rationale:** Recording mode enables trace collection for replay tests and threshold tuning. It is disabled by default to prevent accidental data capture.

### FR-6: Replay Tests

**FR-6.1:** FOR EACH trace file in traces/*.json THE SYSTEM SHALL load and replay it.

**FR-6.2:** WHEN replaying a trace THE SYSTEM SHALL feed samples through the correct detector.

**FR-6.3:** WHEN replaying a trace THE SYSTEM SHALL pass detector outputs through createSignalFilter({ refractoryMs: 500 }).

**FR-6.4:** AFTER replaying a trace THE SYSTEM SHALL assert the number of accepted selects equals expectedSelects.

**FR-6.5:** WHEN a trace has kind 'knock' THE SYSTEM SHALL skip it until the knock-box spec.

**Rationale:** Replay tests ensure detector changes don't break existing signal accuracy. Synthetic traces provide deterministic baseline coverage.

### FR-7: Synthetic Traces

The system SHALL include these synthetic traces, generated by scripts/make-synthetic-traces.mjs:

| Trace name | Description | Expected selects |
|---|---|---|
| blink-two-deliberate.json | Two 700ms closures at ~30fps with noise | 2 |
| blink-normal-only.json | Ten closures of 150–250ms | 0 |
| blink-asleep.json | One 5s closure | 0 |
| blink-one-eye.json | Only left eye closing | 0 |
| nod-two.json | Two dips of 0.08 lasting 600ms | 2 |
| nod-drift.json | Slow drift of 0.1 over 20s | 0 |

**FR-7.1:** THE generator script SHALL use a seeded random number generator for determinism.

**FR-7.2:** THE traces SHALL be committed to the repository.

### FR-8: Detector Unit Tests

**FR-8.1:** Tests SHALL cover every requirement in FR-1 and FR-2.

**FR-8.2:** Tests SHALL include a fast-check property: for any sample sequence, the blink detector fires at most once per closure.

**FR-8.3:** Tests SHALL include a fast-check property: the blink detector never fires on a sample where both eyes are not open.

**FR-8.4:** Tests SHALL verify hysteresis behavior at threshold boundaries.

**FR-8.5:** Tests SHALL verify baseline adaptation during idle periods for nod detector.

## Non-Functional Requirements

### NFR-1: Performance

**NFR-1.1:** Frame processing SHALL complete within 16ms (60fps budget) on typical hardware.

**NFR-1.2:** Landmarker initialization SHALL complete within 3 seconds on typical hardware.

### NFR-2: Privacy

**NFR-2.1:** Video frames SHALL NOT be stored in memory beyond the current frame.

**NFR-2.2:** Video frames SHALL NOT be uploaded to any server.

**NFR-2.3:** Recording mode samples SHALL contain only numeric values, never image data.

### NFR-3: Reliability

**NFR-3.1:** Lost tracking for < 2000ms SHALL NOT trigger onFaceLost.

**NFR-3.2:** Camera source SHALL recover automatically when face tracking returns.

**NFR-3.3:** All errors SHALL be handled gracefully without crashing the app.

### NFR-4: Testing

**NFR-4.4:** Camera source SHALL be mockable in App.tsx tests.

**NFR-4.5:** Detectors SHALL NOT import browser APIs or MediaPipe (must remain pure).

**NFR-4.6:** Tests SHALL NOT load MediaPipe models.

## MediaPipe Configuration

**Constants file:** `src/input/mediapipe-config.ts`

```typescript
export const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Offline loading will be added in a future spec
```

**Initialization:**
```typescript
const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
const landmarker = await FaceLandmarker.createFromOptions(vision, {
  outputFaceBlendshapes: true,
  runningMode: 'VIDEO',
  numFaces: 1,
  modelAssetPath: MODEL_URL
});
```

**Frame processing:**
```typescript
const result = landmarker.detectForVideo(videoElement, timestampMs);
```

**Blendshapes:** `result.faceBlendshapes[0]` contains categories with `categoryName` and `score`. Use `eyeBlinkLeft` and `eyeBlinkRight`.

**Landmarks:** `result.faceLandmarks[0][1]` is the nose tip with `{ x, y, z }`. Use `y` (larger = lower on screen).

## Acceptance Criteria

- [ ] Blink detector fires exactly once per deliberate blink (400–2000ms, both eyes).
- [ ] Blink detector ignores normal blinks (< 400ms).
- [ ] Blink detector ignores long closures (> 2000ms, e.g., sleeping).
- [ ] Blink detector ignores single-eye closures.
- [ ] Nod detector fires exactly once per quick nod (< 1200ms).
- [ ] Nod detector adapts to slow drift without firing.
- [ ] Camera source calls onFaceLost after 2s without a face.
- [ ] Camera source calls onFaceFound when tracking resumes.
- [ ] App pauses ticker while face is lost and shows clear notice.
- [ ] App resumes ticker when face is found.
- [ ] Camera errors show helpful notice without breaking spacebar input.
- [ ] Recording mode captures samples and downloads JSON trace.
- [ ] Normal mode never records or stores video.
- [ ] All replay tests pass with expected select counts.
- [ ] All detector unit tests pass.
- [ ] All detector property tests pass.
- [ ] Existing App.tsx tests still pass with camera source mocked.

## Constraints

- Must use @mediapipe/tasks-vision 1.1.1 (already installed, do not upgrade).
- Detectors must be pure functions (no DOM, no MediaPipe imports).
- Camera source must implement the SignalSource interface.
- Must work with existing 500ms refractory filter.
- Must integrate with existing App.tsx dispatch and ticker.
- Recording mode is opt-in via URL parameter only.

## References

- Task 5 in docs/superpowers/plans/2026-11-07-planchette.md
- Error handling section in docs/superpowers/specs/2026-11-07-planchette-design.md
- Privacy section in docs/superpowers/specs/2026-11-07-planchette-design.md
- Existing keyboard.ts SignalSource implementation
- Existing filter.ts refractory period implementation
