import { useReducer, useEffect, useState, useCallback, useRef } from 'preact/hooks';
import { SweepEvent } from '../core/types.js';
import { initialState } from '../core/sweep.js';
import { board } from '../core/board-content.js';
import { reduce, AppModel } from './model.js';
import { Speaker, createSpeaker } from '../output/speaker.js';
import { createKeyboardSource } from '../input/keyboard.js';
import { createSignalFilter } from '../core/filter.js';
import { createTicker } from './ticker.js';
import { Board } from './Board.js';
import { Notices } from './Notices.js';
import './themes.css';

export interface AppProps {
  speaker?: Speaker;
  now?: () => number;
  initialStepMs?: number;
}

export function App(props?: AppProps) {
  const initialStepMs = props?.initialStepMs ?? 1500;

  const [model, dispatch] = useReducer(
    (model: AppModel, event: SweepEvent) => reduce(model, event, board),
    { sweep: initialState(board), pending: [], seq: 0 }
  );

  const [bellNoticeVisible, setBellNoticeVisible] = useState(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

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

  // Keep bell timeout id in a ref for cleanup
  const bellTimeoutRef = useRef<number | undefined>(undefined);

  // Keep track of last processed seq to avoid repeating effects
  const lastProcessedSeqRef = useRef(-1);

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
    };
  }, []);

  // Sync paused state with ticker
  useEffect(() => {
    if (tickerRef.current) {
      if (paused) {
        tickerRef.current.pause();
      } else {
        tickerRef.current.resume();
      }
    }
  }, [paused]);

  const handleSpeedChange = useCallback((ms: number) => {
    if (tickerRef.current) {
      tickerRef.current.setStep(ms);
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    setPaused(!paused);
  }, [paused]);

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
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  );
}
