# Camera Signals: Design

**Spec:** camera-signals  
**Version:** 1.0  
**Date:** 2026-11-07

## Architecture

```
MediaPipe Face Landmarker (browser)
         ↓ (blendshapes, landmarks, timestamps)
    Detectors (pure functions)
         ↓ (boolean signals)
    Camera Source (SignalSource)
         ↓ (onSelect callback)
    Signal Filter (500ms refractory)
         ↓ (filtered select)
    App dispatch({ type: 'select' })
```

**Key insight:** Detectors are pure state machines taking numbers and timestamps. This allows replay tests to run without MediaPipe or a camera.

## File Exports

### src/input/mediapipe-config.ts

```typescript
export const WASM_BASE: string;
export const MODEL_URL: string;
```

Constants for MediaPipe initialization. Offline loading added in future spec.

### src/input/detectors.ts

Pure detector state machines. No DOM, no MediaPipe, no side effects.

```typescript
export interface BlinkDetector {
  update(left: number, right: number, timestampMs: number): boolean;
}

export function createBlinkDetector(opts: {
  closeThreshold?: number;  // default 0.5
  openThreshold?: number;   // default 0.3
  minMs?: number;           // default 400
  maxMs?: number;           // default 2000
}): BlinkDetector;

export interface NodDetector {
  update(noseY: number, timestampMs: number): boolean;
}

export function createNodDetector(opts: {
  minDelta?: number;  // default 0.04
  maxMs?: number;     // default 1200
}): NodDetector;

export interface FaceWatch {
  update(faceVisible: boolean, nowMs: number): 'lost' | 'found' | null;
}

export function createFaceWatch(opts: {
  lostAfterMs?: number;  // default 2000
}): FaceWatch;
```

### src/input/camera.ts

MediaPipe wrapper implementing SignalSource.

```typescript
import { SignalSource } from './keyboard.js';

export type CameraMode = 'blink' | 'nod';

export interface CameraCallbacks {
  onSelect: () => void;
  onFaceLost?: () => void;
  onFaceFound?: () => void;
  onError?: (message: string) => void;
  onSample?: (sample: CameraSample) => void;  // only connected in record mode
}

export interface CameraSample {
  t: number;      // ms since recording start
  left?: number;  // eyeBlinkLeft score
  right?: number; // eyeBlinkRight score
  noseY?: number; // nose tip y coordinate
}

export function createCameraSource(opts: {
  mode: CameraMode;
  onSelect: () => void;
  onFaceLost?: () => void;
  onFaceFound?: () => void;
  onError?: (message: string) => void;
  onSample?: (sample: CameraSample) => void;
}): SignalSource;
```

### src/record.ts

Recording mode UI and trace download. Only active with ?record=1.

```typescript
export interface Trace {
  kind: 'blink' | 'nod' | 'knock';
  expectedSelects: number;
  samples: Array<{
    t: number;
    left?: number;
    right?: number;
    noseY?: number;
  }>;
}

export function RecordPanel(): JSX.Element;
```

Component shown when `window.location.search.includes('record=1')`.

### tests/detectors.test.ts

Unit tests for all detector requirements.

```typescript
describe('createBlinkDetector', () => {
  it('fires once when eyes close for 400–2000ms');
  it('ignores closures < 400ms');
  it('ignores closures > 2000ms');
  it('ignores single-eye closures');
  it('uses hysteresis correctly');
  it('handles irregular timestamps');
  
  // fast-check properties
  it('fires at most once per closure');
  it('never fires when both eyes are not open');
});

describe('createNodDetector', () => {
  it('fires once for quick nod within maxMs');
  it('ignores slow drift');
  it('updates baseline during idle');
  it('freezes baseline during nod');
  it('handles irregular timestamps');
});
```

### tests/replay.test.ts

Loads every traces/*.json and verifies expectedSelects.

```typescript
describe('replay traces', () => {
  const traceFiles = fs.readdirSync('traces/').filter(f => f.endsWith('.json'));
  
  traceFiles.forEach(filename => {
    it(`replays ${filename}`, () => {
      const trace: Trace = JSON.parse(fs.readFileSync(`traces/${filename}`, 'utf8'));
      
      if (trace.kind === 'knock') {
        // Skip until knock-box spec
        return;
      }
      
      const detector = trace.kind === 'blink'
        ? createBlinkDetector({})
        : createNodDetector({});
      
      const filter = createSignalFilter({ refractoryMs: 500 });
      
      let selectCount = 0;
      trace.samples.forEach(sample => {
        const fired = trace.kind === 'blink'
          ? detector.update(sample.left!, sample.right!, sample.t)
          : detector.update(sample.noseY!, sample.t);
        
        if (fired && filter.accept(sample.t)) {
          selectCount++;
        }
      });
      
      expect(selectCount).toBe(trace.expectedSelects);
    });
  });
});
```

### scripts/make-synthetic-traces.mjs

Generates deterministic synthetic traces for baseline coverage.

```javascript
import { randomSeed } from 'some-deterministic-random-lib';

function makeBlinkTwoDeliberate() {
  // Two 700ms closures at ~30fps (~33ms per frame) with small noise
  // Expected: 2 selects
}

function makeBlinkNormalOnly() {
  // Ten closures of 150–250ms
  // Expected: 0 selects
}

// ... other generators
```

## Detector State Machines

### Blink Detector State

| State | Transition | Next State | Output |
|---|---|---|---|
| OPEN | both >= closeThreshold | CLOSED | false |
| CLOSED | both < openThreshold, duration in [minMs, maxMs] | OPEN | **true** |
| CLOSED | both < openThreshold, duration < minMs | OPEN | false |
| CLOSED | both < openThreshold, duration > maxMs | OPEN | false |
| CLOSED | only one < openThreshold | CLOSED | false |
| OPEN | only one >= closeThreshold | OPEN | false |

**Internal state:**
- `eyesOpen: boolean`
- `closedAtMs: number | null`

**Logic:**
1. If both scores >= closeThreshold and eyesOpen is true, set eyesOpen = false and closedAtMs = now.
2. If both scores < openThreshold and eyesOpen is false:
   - Compute duration = now - closedAtMs.
   - If duration in [minMs, maxMs], fire signal.
   - Set eyesOpen = true, closedAtMs = null.

### Nod Detector State

| State | Transition | Next State | Output |
|---|---|---|---|
| INIT | first update | IDLE | false |
| IDLE | noseY > baseline + minDelta | NODDING | false |
| NODDING | noseY <= baseline + minDelta / 2, duration <= maxMs | IDLE | **true** |
| NODDING | duration > maxMs | IDLE | false |
| IDLE | (every frame) | IDLE (update baseline) | false |

**Internal state:**
- `baseline: number | null` (null until first sample, then exponential moving average)
- `nodding: boolean`
- `nodStartMs: number | null`
- `initialized: boolean`

**Baseline update (when not nodding and initialized):**
```
baseline = alpha * noseY + (1 - alpha) * baseline
```
where alpha = 0.05.

**Logic:**
1. On first update: Set baseline to noseY, set initialized = true, return false.
2. If not nodding:
   - Update baseline (if initialized).
   - If noseY > baseline + minDelta, enter nodding, set nodStartMs = now.
3. If nodding:
   - If noseY <= baseline + minDelta / 2 and duration <= maxMs, fire signal and exit nodding.
   - If duration > maxMs, exit nodding without firing.

## Frame Loop (camera.ts)

```typescript
let landmarker: FaceLandmarker;
let videoElement: HTMLVideoElement;
let detector: BlinkDetector | NodDetector;
let frameLoopId: number | null = null;
let faceWatch: FaceWatch;
let recordingStartMs: number | null = null;
let lastVideoTime: number = -1;
let lastTimestamp: number = -1;
let stopRequested: boolean = false;

async function start(onSelect: () => void): Promise<void> {
  stopRequested = false;

  // 1. Get camera stream
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }
    });
    videoElement.srcObject = stream;
    await videoElement.play();
  } catch (err) {
    opts.onError?.(`Permission denied or camera unavailable`);
    return;
  }

  // 2. Load landmarker
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      outputFaceBlendshapes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
      modelAssetPath: MODEL_URL
    });
  } catch (err) {
    if (stopRequested) return;
    opts.onError?.(`Model failed to load`);
    stop();
    return;
  }

  if (stopRequested) return;

  // 3. Create detector and face watch
  detector = opts.mode === 'blink'
    ? createBlinkDetector({})
    : createNodDetector({});
  faceWatch = createFaceWatch({ lostAfterMs: 2000 });

  // 4. Start frame loop
  recordingStartMs = performance.now();
  frameLoop();
}

function frameLoop(): void {
  if (stopRequested) return;

  frameLoopId = requestAnimationFrame(frameLoop);

  // Skip frame if video is not ready
  if (videoElement.readyState < 2) return;

  // Skip frame if currentTime hasn't changed
  if (videoElement.currentTime === lastVideoTime) return;
  lastVideoTime = videoElement.currentTime;

  let now = performance.now();
  
  // Ensure strictly increasing timestamp
  if (now <= lastTimestamp) {
    now = lastTimestamp + 1;
  }
  lastTimestamp = now;

  const result = landmarker.detectForVideo(videoElement, now);

  // Check face tracking
  const faceVisible = result.faceLandmarks.length > 0;
  const faceEvent = faceWatch.update(faceVisible, now);
  
  if (faceEvent === 'lost') {
    opts.onFaceLost?.();
  } else if (faceEvent === 'found') {
    opts.onFaceFound?.();
  }

  if (!faceVisible) return;

  // Extract features
  const blendshapes = result.faceBlendshapes[0];
  const leftScore = blendshapes.categories.find(c => c.categoryName === 'eyeBlinkLeft')?.score ?? 0;
  const rightScore = blendshapes.categories.find(c => c.categoryName === 'eyeBlinkRight')?.score ?? 0;
  const noseY = result.faceLandmarks[0][1].y;

  // Record sample if connected
  if (opts.onSample && recordingStartMs !== null) {
    const t = now - recordingStartMs;
    opts.onSample(opts.mode === 'blink'
      ? { t, left: leftScore, right: rightScore }
      : { t, noseY }
    );
  }

  // Feed detector
  const fired = opts.mode === 'blink'
    ? detector.update(leftScore, rightScore, now)
    : detector.update(noseY, now);

  if (fired) {
    onSelect();
  }
}

function stop(): void {
  stopRequested = true;
  if (frameLoopId !== null) {
    cancelAnimationFrame(frameLoopId);
    frameLoopId = null;
  }
  if (landmarker) {
    landmarker.close();
  }
  if (videoElement.srcObject) {
    (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
  }
}
```

## Timing and Thresholds

### Blink Detection

| Parameter | Default | Range | Justification |
|---|---|---|---|
| closeThreshold | 0.5 | 0.3–0.7 | MediaPipe blink scores are well-calibrated; 0.5 is halfway closed |
| openThreshold | 0.3 | 0.2–0.4 | Hysteresis gap prevents flicker |
| minMs | 400 | 300–600 | Normal blinks are 100–300ms; deliberate blinks 400ms+ |
| maxMs | 2000 | 1500–3000 | Longer closures indicate rest, not communication |

### Nod Detection

| Parameter | Default | Range | Justification |
|---|---|---|---|
| minDelta | 0.04 | 0.03–0.08 | Normalized coordinates; 0.04 is ~4% of screen height |
| maxMs | 1200 | 800–1500 | Quick deliberate nod; slower movements are drift |
| alpha | 0.05 | fixed | Slow baseline adaptation; ~20 frames (0.67s) to 63% convergence at 30fps |

### Face Tracking Loss

| Parameter | Value | Justification |
|---|---|---|
| lostThreshold | 2000ms | Brief losses due to head turn or poor lighting shouldn't pause |

## App Integration Changes

### New State in App.tsx

```typescript
type SignalMode = 'spacebar' | 'blink' | 'nod';

const [signalMode, setSignalMode] = useState<SignalMode>('spacebar');
const [faceLost, setFaceLost] = useState(false);
const [cameraError, setCameraError] = useState<string | null>(null);
```

### Camera Source Lifecycle

```typescript
const cameraSourceRef = useRef<SignalSource | null>(null);

useEffect(() => {
  if (signalMode === 'spacebar') {
    cameraSourceRef.current?.stop();
    cameraSourceRef.current = null;
    return;
  }

  const filter = createSignalFilter({ refractoryMs: 500 });
  const source = createCameraSource({
    mode: signalMode as CameraMode,
    onSelect: () => {
      const timestamp = nowRef.current();
      if (filter.accept(timestamp)) {
        dispatch({ type: 'select' });
      }
    },
    onFaceLost: () => {
      setFaceLost(true);
      tickerRef.current?.pause();
    },
    onFaceFound: () => {
      setFaceLost(false);
      tickerRef.current?.resume();
    },
    onError: (message) => {
      setCameraError(message);
      setSignalMode('spacebar');
    }
  });

  source.start(() => {});  // onSelect passed via opts, not start()
  cameraSourceRef.current = source;

  return () => source.stop();
}, [signalMode]);
```

### Notices.tsx Changes

```typescript
export interface NoticesProps {
  speechUnavailable: boolean;
  bellNoticeVisible: boolean;
  faceLost: boolean;
  cameraError: string | null;
}

export function Notices(props: NoticesProps) {
  return (
    <div class="notices">
      {props.speechUnavailable && (
        <div class="notice speech-unavailable">
          Speech isn't working. Messages will appear as text.
        </div>
      )}

      {props.bellNoticeVisible && (
        <div class="notice bell">
          Calling for help
        </div>
      )}

      {props.faceLost && (
        <div class="notice face-lost">
          I can't see your face. Move the camera or the patient into view.
        </div>
      )}

      {props.cameraError && (
        <div class="notice camera-error">
          Camera isn't available: {props.cameraError}. You can keep using the spacebar.
        </div>
      )}
    </div>
  );
}
```

### Signal Mode Controls

```typescript
<div class="signal-controls">
  <label>
    <input
      type="radio"
      name="signal"
      value="spacebar"
      checked={signalMode === 'spacebar'}
      onChange={(e) => setSignalMode(e.currentTarget.value as SignalMode)}
    />
    Spacebar only
  </label>
  <label>
    <input
      type="radio"
      name="signal"
      value="blink"
      checked={signalMode === 'blink'}
      onChange={(e) => setSignalMode(e.currentTarget.value as SignalMode)}
    />
    Blink
  </label>
  <label>
    <input
      type="radio"
      name="signal"
      value="nod"
      checked={signalMode === 'nod'}
      onChange={(e) => setSignalMode(e.currentTarget.value as SignalMode)}
    />
    Nod
  </label>
  {signalMode !== 'spacebar' && (
    <span class="camera-indicator">Camera on</span>
  )}
</div>
```

## Recording Mode Design

### URL Detection

```typescript
const recordMode = window.location.search.includes('record=1');
```

### RecordPanel Component

```tsx
export function RecordPanel() {
  const [recording, setRecording] = useState(false);
  const [kind, setKind] = useState<'blink' | 'nod' | 'knock'>('blink');
  const [expectedSelects, setExpectedSelects] = useState(2);
  const [samples, setSamples] = useState<CameraSample[]>([]);

  const handleStart = () => {
    setSamples([]);
    setRecording(true);
    // Camera source will call onSample for each frame
  };

  const handleStop = () => {
    setRecording(false);
    const trace: Trace = {
      kind,
      expectedSelects,
      samples
    };
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kind}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="record-panel">
      <h2>Recording Mode</h2>
      <label>
        Kind:
        <select value={kind} onChange={(e) => setKind(e.currentTarget.value as any)}>
          <option value="blink">Blink</option>
          <option value="nod">Nod</option>
          <option value="knock">Knock</option>
        </select>
      </label>
      <label>
        Expected selects:
        <input
          type="number"
          value={expectedSelects}
          onChange={(e) => setExpectedSelects(parseInt(e.currentTarget.value, 10))}
        />
      </label>
      {!recording && <button onClick={handleStart}>Start recording</button>}
      {recording && <button onClick={handleStop}>Stop recording</button>}
      {recording && <p>Recording... {samples.length} samples</p>}
    </div>
  );
}
```

### Integration with Camera Source

When recording mode is active, pass onSample to createCameraSource:

```typescript
const source = createCameraSource({
  mode: signalMode as CameraMode,
  onSelect,
  onFaceLost,
  onFaceFound,
  onError,
  onSample: recordMode ? handleSample : undefined
});
```

## Test Plan

### Unit Tests (tests/detectors.test.ts)

**Coverage:**
- ✅ Blink fires once per deliberate closure (400–2000ms)
- ✅ Blink ignores short closures (< 400ms)
- ✅ Blink ignores long closures (> 2000ms)
- ✅ Blink ignores single-eye closures
- ✅ Blink hysteresis at threshold boundaries
- ✅ Nod fires once per quick nod
- ✅ Nod ignores slow drift
- ✅ Nod baseline adapts during idle
- ✅ Nod baseline freezes during nod
- ✅ Irregular timestamps handled correctly

### Property Tests (tests/detectors.test.ts)

**fast-check generators:**
```typescript
const sampleSequenceArb = fc.array(
  fc.record({
    left: fc.float({ min: 0, max: 1 }),
    right: fc.float({ min: 0, max: 1 }),
    timestampMs: fc.nat()
  }),
  { minLength: 1, maxLength: 1000 }
);
```

**Properties:**
1. Blink detector fires at most once per closure.
2. Blink detector never fires when both eyes are not open.

### Replay Tests (tests/replay.test.ts)

**Synthetic traces:**
- blink-two-deliberate.json → 2 selects
- blink-normal-only.json → 0 selects
- blink-asleep.json → 0 selects
- blink-one-eye.json → 0 selects
- nod-two.json → 2 selects
- nod-drift.json → 0 selects

**Real traces:** Recorded during manual testing, stored in traces/.

### Integration Tests (tests/app.test.tsx)

**Mock camera source:**
```typescript
const mockCameraSource = (): SignalSource => ({
  start: vi.fn(),
  stop: vi.fn()
});
```

**Test cases:**
- ✅ Switching to blink mode starts camera source
- ✅ Switching back to spacebar stops camera source
- ✅ Face lost pauses ticker and shows notice
- ✅ Face found resumes ticker and hides notice
- ✅ Camera error shows notice and keeps spacebar working
- ✅ Existing needs ring tests still pass

### Manual Testing Checklist

- [ ] Deliberate long blink (700ms) triggers select
- [ ] Normal blink (200ms) does not trigger
- [ ] One eye closing does not trigger
- [ ] Deliberate nod triggers select
- [ ] Slow head drift does not trigger
- [ ] Face lost after 2s shows notice and pauses
- [ ] Face found resumes and hides notice
- [ ] Camera permission denied shows helpful notice
- [ ] Spacebar continues working in all camera modes
- [ ] Recording mode captures and downloads trace

## Open Questions

None. All design decisions confirmed in requirements.

## Future Work

- Offline model loading (separate spec)
- Custom calibration UI in setup flow (separate spec)
- Head-steering mode (separate spec)
- Camera settings (resolution, framerate) if needed for performance
