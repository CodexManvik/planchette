/**
 * Real ticker module with pause, step control, and visibility awareness.
 */

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
  let currentStepMs = opts.stepMs;

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
    currentStepMs = clamp(ms);
    intervalId = setInterval(tick, currentStepMs) as unknown as number;
  };

  const handleVisibilityChange = () => {
    // The tick function itself checks doc.hidden, so no action needed here
    // The interval continues running but tick() is a no-op when hidden
  };

  return {
    start() {
      startInterval(currentStepMs);
      doc.addEventListener('visibilitychange', handleVisibilityChange);
    },

    stop() {
      doc.removeEventListener('visibilitychange', handleVisibilityChange);
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
