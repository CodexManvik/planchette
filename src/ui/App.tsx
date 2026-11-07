import { useReducer, useEffect, useState, useCallback, useRef } from 'preact/hooks';
import { SweepEvent } from '../core/types.js';
import { initialState } from '../core/sweep.js';
import { board } from '../core/board-content.js';
import { reduce, AppModel } from './model.js';
import { Speaker, createSpeaker } from '../output/speaker.js';
import { SignalSource, createKeyboardSource } from '../input/keyboard.js';
import { createSignalFilter } from '../core/filter.js';
import { createTicker } from './ticker.js';
import { Board } from './Board.js';
import { Notices } from './Notices.js';
import { createCameraSource, CameraSample } from '../input/camera.js';
import { RecordPanel } from '../record.js';
import './themes.css';

export type SignalMode = 'spacebar' | 'blink' | 'nod';

export interface AppProps {
  speaker?: Speaker;
  now?: () => number;
  initialStepMs?: number;
  createCamera?: typeof createCameraSource;
}

export function App(props?: AppProps) {
  const initialStepMs = props?.initialStepMs ?? 1500;

  const [model, dispatch] = useReducer(
    (model: AppModel, event: SweepEvent) => reduce(model, event, board),
    { sweep: initialState(board), pending: [], seq: 0 }
  );

  const [bellNoticeVisible, setBellNoticeVisible] = useState(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState<string | null>(null);
  const [carerPaused, setCarerPaused] = useState(false);
  const [faceLost, setFaceLost] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [signalMode, setSignalMode] = useState<SignalMode>('spacebar');
  const [recordMode] = useState(() => typeof window !== 'undefined' && window.location.search.includes('record=1'));

  // Memoize speaker once on first render
  const speakerRef = useRef<Speaker | null>(null);
  if (!speakerRef.current) {
    speakerRef.current =
      props?.speaker ??
      createSpeaker({
        onError: () => setSpeechUnavailable(true)
      });
  }

  const [speechUnavailable, setSpeechUnavailable] = useState(() => !speakerRef.current!.available());

  // Keep now in a ref so keyboard source is created once
  const nowRef = useRef(props?.now ?? (() => performance.now()));

  // Keep ticker in a ref
  const tickerRef = useRef<ReturnType<typeof createTicker> | null>(null);

  // Keep camera source in a ref
  const cameraSourceRef = useRef<SignalSource | null>(null);

  // Keep bell timeout id in a ref for cleanup
  const bellTimeoutRef = useRef<number | undefined>(undefined);

  // Keep track of last processed seq to avoid repeating effects
  const lastProcessedSeqRef = useRef(-1);

  // Keep record sample sink callback in a ref
  const recordSinkRef = useRef<((sample: CameraSample) => void) | null>(null);

  // Use dependency-injected createCamera or default
  const createCamera = props?.createCamera ?? createCameraSource;

  // Initialize ticker
  useEffect(() => {
    const t = createTicker({
      stepMs: initialStepMs,
      onTick: () => dispatch({ type: 'tick' }),
      doc: document
    });
    t.start();
    tickerRef.current = t;

    return () => t.stop();
  }, [initialStepMs]);

  // Keyboard input with signal filter (created once on mount)
  useEffect(() => {
    const filter = createSignalFilter({ refractoryMs: 500 });
    const source = createKeyboardSource();

    source.start(() => {
      const timestamp = nowRef.current();
      if (filter.accept(timestamp)) {
        dispatch({ type: 'select' });
      }
    });

    return () => source.stop();
  }, []);

  // Camera source lifecycle
  useEffect(() => {
    if (signalMode === 'spacebar') {
      // Stop camera if running
      if (cameraSourceRef.current) {
        cameraSourceRef.current.stop();
        cameraSourceRef.current = null;
      }
      return;
    }

    // Start camera source
    const filter = createSignalFilter({ refractoryMs: 500 });

    const source = createCamera({
      mode: signalMode as 'blink' | 'nod',
      onSelect: () => {
        const timestamp = nowRef.current();
        if (filter.accept(timestamp)) {
          dispatch({ type: 'select' });
        }
      },
      onFaceLost: () => {
        setFaceLost(true);
      },
      onFaceFound: () => {
        setFaceLost(false);
      },
      onError: (message: string) => {
        setCameraError(message);
        setSignalMode('spacebar');
      },
      onSample: recordMode ? (sample) => {
        recordSinkRef.current?.(sample);
      } : undefined
    });

    source.start(() => {});
    cameraSourceRef.current = source;

    return () => {
      source.stop();
      cameraSourceRef.current = null;
    };
  }, [signalMode, recordMode, createCamera]);

  // Sync paused state with ticker (either carerPaused or faceLost)
  useEffect(() => {
    if (tickerRef.current) {
      const shouldPause = carerPaused || faceLost;
      if (shouldPause) {
        tickerRef.current.pause();
      } else {
        tickerRef.current.resume();
      }
    }
  }, [carerPaused, faceLost]);

  // Process effects only when seq changes
  useEffect(() => {
    if (model.seq === lastProcessedSeqRef.current) {
      return;
    }

    lastProcessedSeqRef.current = model.seq;

    model.pending.forEach((effect) => {
      if (effect.type === 'speak') {
        speakerRef.current!.say(effect.text);
        setLastSpokenMessage(effect.text);
      }
      if (effect.type === 'bell') {
        setBellNoticeVisible(true);
        // Clear any existing timeout before setting a new one
        if (bellTimeoutRef.current !== undefined) {
          clearTimeout(bellTimeoutRef.current);
        }
        bellTimeoutRef.current = setTimeout(() => {
          setBellNoticeVisible(false);
          bellTimeoutRef.current = undefined;
        }, 10000) as unknown as number;
      }
      if (effect.type === 'requestSuggestions') {
        // Ignored for now
      }
    });
  }, [model.seq]);

  // Clean up bell timeout on unmount
  useEffect(() => {
    return () => {
      if (bellTimeoutRef.current !== undefined) {
        clearTimeout(bellTimeoutRef.current);
      }
      if (cameraSourceRef.current) {
        cameraSourceRef.current.stop();
      }
    };
  }, []);

  const handleSpeedChange = useCallback((ms: number) => {
    if (tickerRef.current) {
      tickerRef.current.setStep(ms);
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    setCarerPaused(!carerPaused);
  }, [carerPaused]);

  const handleRegisterRecordSink = useCallback((sink: ((sample: CameraSample) => void) | null) => {
    recordSinkRef.current = sink;
  }, []);

  return (
    <div class="app">
      <Notices
        speechUnavailable={speechUnavailable}
        bellNoticeVisible={bellNoticeVisible}
        faceLost={faceLost}
        cameraError={cameraError}
      />

      {recordMode && <RecordPanel onRegisterSink={handleRegisterRecordSink} />}

      <div class="patient-display">
        <Board state={model.sweep} board={board} />
        {lastSpokenMessage && (
          <div class="last-message">{lastSpokenMessage}</div>
        )}
      </div>

      <div class="carer-controls">
        <fieldset>
          <legend>Signal</legend>
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
        </fieldset>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleSpeedChange(2500)}
        >
          Slow
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleSpeedChange(1500)}
        >
          Medium
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleSpeedChange(1000)}
        >
          Fast
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleTogglePause}
        >
          {carerPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  );
}
