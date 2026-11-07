/**
 * Pure detector state machines for blink, nod, and face tracking loss.
 * No DOM access, no MediaPipe imports, no side effects.
 */

/**
 * Blink detector state machine.
 * Fires once when eyes close and reopen within a valid duration window.
 *
 * State machine:
 * - OPEN: eyes are open (both scores < openThreshold)
 * - CLOSED: eyes are closed (both scores >= closeThreshold)
 *
 * Hysteresis prevents flickering near thresholds.
 * Duration validation (minMs–maxMs) distinguishes deliberate blinks from naps.
 */
export interface BlinkDetector {
  update(left: number, right: number, timestampMs: number): boolean;
}

export function createBlinkDetector(opts: {
  closeThreshold?: number;
  openThreshold?: number;
  minMs?: number;
  maxMs?: number;
} = {}): BlinkDetector {
  const closeThreshold = opts.closeThreshold ?? 0.5;
  const openThreshold = opts.openThreshold ?? 0.3;
  const minMs = opts.minMs ?? 400;
  const maxMs = opts.maxMs ?? 2000;

  let eyesOpen = true;
  let closedAtMs: number | null = null;

  return {
    update(left: number, right: number, timestampMs: number): boolean {
      const bothClosed = left >= closeThreshold && right >= closeThreshold;
      const bothOpen = left < openThreshold && right < openThreshold;

      if (eyesOpen && bothClosed) {
        // Transition from open to closed
        eyesOpen = false;
        closedAtMs = timestampMs;
        return false;
      }

      if (!eyesOpen && bothOpen && closedAtMs !== null) {
        // Transition from closed to open
        const duration = timestampMs - closedAtMs;
        eyesOpen = true;
        closedAtMs = null;

        // Fire signal only if duration is in valid range
        return duration >= minMs && duration <= maxMs;
      }

      return false;
    }
  };
}

/**
 * Nod detector state machine.
 * Fires once when noseY dips below baseline and returns within maxMs.
 *
 * State machine:
 * - IDLE: no nod in progress, baseline adapts via EMA
 * - NODDING: nod in progress, baseline frozen
 *
 * Baseline adaptation (EMA with alpha=0.05) allows drift compensation
 * without firing spurious signals.
 */
export interface NodDetector {
  update(noseY: number, timestampMs: number): boolean;
}

export function createNodDetector(opts: {
  minDelta?: number;
  maxMs?: number;
} = {}): NodDetector {
  const minDelta = opts.minDelta ?? 0.04;
  const maxMs = opts.maxMs ?? 1200;
  const alpha = 0.05;

  let baseline: number | null = null;
  let initialized = false;
  let nodding = false;
  let nodStartMs: number | null = null;

  return {
    update(noseY: number, timestampMs: number): boolean {
      // Initialize baseline from first sample
      if (!initialized) {
        baseline = noseY;
        initialized = true;
        return false;
      }

      if (!nodding) {
        // Update baseline during idle (EMA)
        baseline = alpha * noseY + (1 - alpha) * baseline!;

        // Check if nod starts
        if (noseY > baseline + minDelta) {
          nodding = true;
          nodStartMs = timestampMs;
        }

        return false;
      }

      // In nodding state
      const duration = timestampMs - nodStartMs!;

      // Check if nod returns
      if (noseY <= baseline! + minDelta / 2) {
        nodding = false;
        nodStartMs = null;

        // Fire signal only if duration is within maxMs
        return duration <= maxMs;
      }

      // Check if nod timeout exceeded
      if (duration > maxMs) {
        nodding = false;
        nodStartMs = null;
        // Update baseline to current noseY so future samples don't trigger false nods
        baseline = noseY;
      }

      return false;
    }
  };
}

/**
 * Face watch helper for tracking face loss and recovery.
 * Fires events exactly once at transitions.
 *
 * State machine:
 * - VISIBLE: face is currently visible
 * - LOST_PENDING: face invisible for < lostAfterMs
 * - LOST: face invisible for >= lostAfterMs, notified once
 */
export interface FaceWatch {
  update(faceVisible: boolean, nowMs: number): 'lost' | 'found' | null;
}

export function createFaceWatch(opts: {
  lostAfterMs?: number;
} = {}): FaceWatch {
  const lostAfterMs = opts.lostAfterMs ?? 2000;

  let startOfAbsenceMs: number | null = null;
  let notifiedLost = false;

  return {
    update(faceVisible: boolean, nowMs: number): 'lost' | 'found' | null {
      if (faceVisible) {
        // Face is visible
        if (startOfAbsenceMs !== null && notifiedLost) {
          // Face was lost and notified, now found
          startOfAbsenceMs = null;
          notifiedLost = false;
          return 'found';
        }
        // Face came back before we notified lost
        startOfAbsenceMs = null;
        notifiedLost = false;
        return null;
      }

      // Face is not visible
      if (startOfAbsenceMs === null) {
        // Mark start of absence
        startOfAbsenceMs = nowMs;
        return null;
      }

      // Check if we should fire 'lost'
      if (!notifiedLost && nowMs - startOfAbsenceMs >= lostAfterMs) {
        notifiedLost = true;
        return 'lost';
      }

      return null;
    }
  };
}
