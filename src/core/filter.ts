/**
 * Signal filter with refractory period.
 * Ensures one physical action produces exactly one select, even with noisy timing.
 */

export interface SignalFilter {
  accept(timestampMs: number): boolean;
}

export function createSignalFilter(opts: { refractoryMs: number }): SignalFilter {
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
