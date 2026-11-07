import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createBlinkDetector, createNodDetector, createFaceWatch } from '../src/input/detectors';

describe('createBlinkDetector', () => {
  describe('basic behavior', () => {
    it('fires once for 700ms closure (default range 400–2000ms)', () => {
      const detector = createBlinkDetector({});
      
      // Simulate eyes closing at t=0, reopening at t=700
      // At 30fps (~33ms per frame)
      detector.update(0.6, 0.6, 0);      // closed
      detector.update(0.6, 0.6, 33);     // closed
      detector.update(0.6, 0.6, 66);     // closed
      detector.update(0.6, 0.6, 100);    // closed
      
      // Jump to near end of valid range
      expect(detector.update(0.6, 0.6, 700)).toBe(false);  // still closed
      
      // Reopen
      const fired = detector.update(0.2, 0.2, 733);
      expect(fired).toBe(true);
      
      // Should not fire again
      expect(detector.update(0.2, 0.2, 766)).toBe(false);
    });

    it('ignores closures shorter than minMs (400ms default)', () => {
      const detector = createBlinkDetector({});
      
      detector.update(0.6, 0.6, 0);    // close
      expect(detector.update(0.2, 0.2, 300)).toBe(false);  // reopen too soon
      
      // Can close again
      detector.update(0.6, 0.6, 350);
      expect(detector.update(0.2, 0.2, 750)).toBe(true);  // valid duration
    });

    it('ignores closures longer than maxMs (2000ms default)', () => {
      const detector = createBlinkDetector({});
      
      detector.update(0.6, 0.6, 0);     // close
      expect(detector.update(0.2, 0.2, 2500)).toBe(false);  // too long
    });

    it('ignores single-eye closures', () => {
      const detector = createBlinkDetector({});
      
      // Left eye closes, right stays open
      detector.update(0.6, 0.1, 0);     // left >= threshold, right < threshold
      detector.update(0.6, 0.1, 100);
      detector.update(0.6, 0.1, 500);
      expect(detector.update(0.2, 0.1, 700)).toBe(false);  // not both open
      
      // Both eyes open
      expect(detector.update(0.2, 0.2, 733)).toBe(false);  // was not both closed
    });

    it('uses hysteresis correctly', () => {
      const detector = createBlinkDetector({
        closeThreshold: 0.5,
        openThreshold: 0.3
      });
      
      // Flicker near closeThreshold should not trigger transition
      detector.update(0.4, 0.4, 0);      // both < closeThreshold, stays open
      detector.update(0.51, 0.51, 33);   // both > closeThreshold, closes
      detector.update(0.49, 0.49, 66);   // flicker below closeThreshold
      detector.update(0.51, 0.51, 100);  // flicker back above
      detector.update(0.51, 0.51, 133);
      
      // (0.4, 0.4) should NOT open because openThreshold is 0.3
      expect(detector.update(0.4, 0.4, 533)).toBe(false);
      
      // Need to go below openThreshold to open
      expect(detector.update(0.2, 0.2, 566)).toBe(true);  // valid closure time
    });

    it('handles irregular timestamps', () => {
      const detector = createBlinkDetector({});
      
      detector.update(0.6, 0.6, 100);    // close
      detector.update(0.6, 0.6, 150);
      detector.update(0.6, 0.6, 140);    // time went backward
      detector.update(0.6, 0.6, 600);
      
      // Duration is still 600 - 100 = 500ms
      expect(detector.update(0.2, 0.2, 610)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('fires at exactly minMs boundary', () => {
      const detector = createBlinkDetector({ minMs: 400, maxMs: 2000 });
      
      detector.update(0.6, 0.6, 0);
      expect(detector.update(0.2, 0.2, 400)).toBe(true);
    });

    it('fires at exactly maxMs boundary', () => {
      const detector = createBlinkDetector({ minMs: 400, maxMs: 2000 });
      
      detector.update(0.6, 0.6, 0);
      expect(detector.update(0.2, 0.2, 2000)).toBe(true);
    });

    it('does not fire just before minMs', () => {
      const detector = createBlinkDetector({ minMs: 400, maxMs: 2000 });
      
      detector.update(0.6, 0.6, 0);
      expect(detector.update(0.2, 0.2, 399)).toBe(false);
    });

    it('does not fire just after maxMs', () => {
      const detector = createBlinkDetector({ minMs: 400, maxMs: 2000 });
      
      detector.update(0.6, 0.6, 0);
      expect(detector.update(0.2, 0.2, 2001)).toBe(false);
    });
  });

  describe('property tests', () => {
    it('fires at most once per closure (fast-check)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              closed: fc.boolean(),
              timestamp: fc.nat()
            }),
            { minLength: 1, maxLength: 100 }
          ),
          (samples) => {
            const detector = createBlinkDetector({});
            let fireCount = 0;
            
            for (const sample of samples) {
              const left = sample.closed ? 0.6 : 0.2;
              const right = sample.closed ? 0.6 : 0.2;
              if (detector.update(left, right, sample.timestamp)) {
                fireCount++;
              }
            }
            
            expect(fireCount).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('never fires when both eyes are not open (fast-check)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              left: fc.float({ min: 0, max: 1 }),
              right: fc.float({ min: 0, max: 1 }),
              timestamp: fc.nat()
            }),
            { minLength: 1, maxLength: 100 }
          ),
          (samples) => {
            const detector = createBlinkDetector({});
            
            for (const sample of samples) {
              const fired = detector.update(sample.left, sample.right, sample.timestamp);
              
              // If fired, both eyes must have just opened
              if (fired) {
                expect(sample.left).toBeLessThan(0.3);
                expect(sample.right).toBeLessThan(0.3);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('createNodDetector', () => {
  describe('basic behavior', () => {
    it('fires once for quick nod within maxMs', () => {
      const detector = createNodDetector({});
      
      // First sample sets baseline
      detector.update(0.5, 0);
      
      // Establish baseline with several idle samples
      detector.update(0.5, 33);
      detector.update(0.5, 66);
      
      // Nod down to 0.58 (0.5 + 0.08 > 0.04 minDelta)
      detector.update(0.58, 100);  // start nod
      detector.update(0.58, 200);
      
      // Return within minDelta/2 of baseline
      // baseline now ~0.495, minDelta/2 = 0.02, so return if <= 0.515
      const fired = detector.update(0.51, 600);
      expect(fired).toBe(true);
    });

    it('ignores movements longer than maxMs', () => {
      const detector = createNodDetector({ maxMs: 1200 });
      
      detector.update(0.5, 0);
      detector.update(0.5, 33);
      
      // Nod that lasts > 1200ms
      detector.update(0.58, 100);
      detector.update(0.58, 200);
      detector.update(0.58, 1500);  // over limit
      
      // Returning now should not fire
      expect(detector.update(0.51, 1600)).toBe(false);
    });

    it('does not fire on first sample', () => {
      const detector = createNodDetector({});
      
      // First update sets baseline and returns false
      expect(detector.update(0.5, 0)).toBe(false);
    });

    it('updates baseline during idle', () => {
      const detector = createNodDetector({});
      
      detector.update(0.5, 0);   // baseline = 0.5
      
      // Slowly drift baseline upward by 0.001 per frame
      // With alpha=0.05, this should be slow enough to avoid triggering a nod
      for (let i = 0; i < 100; i++) {
        const noseY = 0.5 + (0.001 * i);
        const fired = detector.update(noseY, i * 10);
        expect(fired).toBe(false);  // no nod should fire during drift
      }
      
      // After drift, baseline should be around 0.6
      // Now a real nod: dip to 0.66 (0.04 below the drifted baseline) and return to 0.6
      detector.update(0.66, 1000);  // nod starts
      detector.update(0.66, 1100);
      
      // Return to drifted baseline within minDelta/2
      const fired = detector.update(0.60, 1200);
      expect(fired).toBe(true);
    });

    it('freezes baseline during nod', () => {
      const detector = createNodDetector({});
      
      detector.update(0.5, 0);   // baseline = 0.5
      detector.update(0.5, 33);
      
      // Start nod
      detector.update(0.58, 100);
      
      // While nodding, try to change baseline with samples
      detector.update(0.59, 200);
      detector.update(0.57, 300);
      
      // Return and check baseline is still ~0.5
      const fired = detector.update(0.51, 600);
      expect(fired).toBe(true);
    });

    it('slow drift adapts baseline without firing', () => {
      const detector = createNodDetector({});
      
      detector.update(0.5, 0);
      
      // Slowly drift upward (alpha = 0.05, so slow movement)
      for (let i = 0; i < 100; i++) {
        const offset = Math.min(0.1 * (i / 100), 0.1); // gradual 0.1 increase
        const noseY = 0.5 + offset;
        
        // Never exceeds minDelta (0.04) at any point
        const fired = detector.update(noseY, i * 10);
        expect(fired).toBe(false);
      }
    });

    it('handles irregular timestamps', () => {
      const detector = createNodDetector({});
      
      detector.update(0.5, 100);  // baseline = 0.5
      detector.update(0.5, 150);
      detector.update(0.5, 140);  // time went backward
      
      // Start nod
      detector.update(0.58, 200);
      
      // Duration calculation should still work (200 - 100 = 100ms)
      expect(detector.update(0.51, 210)).toBe(true);
    });

    it('recovers after a quick posture change (re-anchors baseline on timeout)', () => {
      const detector = createNodDetector({});
      
      // Step 1: For 1000ms, noseY = 0.5. Sets baseline at about 0.5.
      for (let t = 0; t <= 1000; t += 33) {
        const fired = detector.update(0.5, t);
        expect(fired).toBe(false);
      }
      
      // Step 2: From 1000ms to 4000ms, noseY = 0.6. Quick slump stays lower.
      // Assert update() never returns true during this period.
      for (let t = 1033; t <= 4000; t += 33) {
        const fired = detector.update(0.6, t);
        expect(fired).toBe(false);
      }
      
      // Steps 3-5: Collect rise, return, and hold results in one array.
      const results = [];
      
      // Step 3: From 4000ms to 4300ms, noseY rises in a straight line to 0.66.
      // Then from 4300ms to 4600ms, returns to 0.6.
      results.push(detector.update(0.61, 4033));
      results.push(detector.update(0.62, 4066));
      results.push(detector.update(0.63, 4099));
      results.push(detector.update(0.64, 4132));
      results.push(detector.update(0.65, 4165));
      results.push(detector.update(0.66, 4198));  // peak at ~4300ms
      results.push(detector.update(0.65, 4231));
      results.push(detector.update(0.64, 4264));
      results.push(detector.update(0.63, 4297));
      results.push(detector.update(0.62, 4330));
      results.push(detector.update(0.6, 4363));  // return to 0.6 by ~4600ms
      
      // Step 5: Hold 0.6 until 5000ms.
      for (let t = 4396; t <= 5000; t += 33) {
        results.push(detector.update(0.6, t));
      }
      
      // Assert exactly one true was returned during steps 3, 4, and 5.
      const trueCount = results.filter(r => r === true).length;
      expect(trueCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('fires at exactly maxMs boundary', () => {
      const detector = createNodDetector({ maxMs: 1200 });
      
      detector.update(0.5, 0);
      detector.update(0.5, 33);
      
      detector.update(0.58, 100);
      expect(detector.update(0.51, 1300)).toBe(true);  // exactly 1200ms
    });

    it('does not fire just after maxMs', () => {
      const detector = createNodDetector({ maxMs: 1200 });
      
      detector.update(0.5, 0);
      detector.update(0.5, 33);
      
      detector.update(0.58, 100);
      expect(detector.update(0.51, 1301)).toBe(false);
    });

    it('requires movement to exceed minDelta threshold', () => {
      const detector = createNodDetector({ minDelta: 0.04 });
      
      detector.update(0.5, 0);
      detector.update(0.5, 33);
      
      // Move by less than minDelta
      detector.update(0.53, 100);  // 0.03 < 0.04, no nod
      
      expect(detector.update(0.5, 300)).toBe(false);
    });

    it('requires return within minDelta/2 to fire', () => {
      const detector = createNodDetector({ minDelta: 0.04 });
      
      detector.update(0.5, 0);
      detector.update(0.5, 33);
      
      // Nod down
      detector.update(0.58, 100);
      
      // Return partway but not to minDelta/2
      const fired = detector.update(0.535, 600);  // > 0.5 + 0.02
      expect(fired).toBe(false);
    });
  });
});

describe('createFaceWatch', () => {
  describe('basic behavior', () => {
    it('fires "lost" after lostAfterMs without face', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      expect(watch.update(false, 0)).toBe(null);
      expect(watch.update(false, 1000)).toBe(null);
      expect(watch.update(false, 2100)).toBe('lost');
    });

    it('fires "found" when face returns', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      watch.update(false, 0);
      watch.update(false, 2100);  // lost
      
      expect(watch.update(true, 2200)).toBe('found');
    });

    it('does not repeat "lost" event', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      watch.update(false, 0);
      watch.update(false, 2100);  // lost
      
      expect(watch.update(false, 2200)).toBe(null);  // no repeat
      expect(watch.update(false, 5000)).toBe(null);
    });

    it('does not repeat "found" event', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      watch.update(false, 0);
      watch.update(false, 2100);  // lost
      watch.update(true, 2200);   // found
      
      expect(watch.update(true, 2300)).toBe(null);  // no repeat
    });

    it('handles face visible from start', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      expect(watch.update(true, 0)).toBe(null);
      expect(watch.update(true, 1000)).toBe(null);
      expect(watch.update(true, 5000)).toBe(null);
    });

    it('handles irregular timestamps', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      watch.update(false, 100);
      watch.update(false, 50);    // time went backward
      watch.update(false, 2200);
      
      // Should fire lost at 2200 threshold
      expect(watch.update(false, 2300)).toBe(null);  // no repeat
    });

    it('handles face becoming visible before lostAfterMs', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      watch.update(false, 0);
      expect(watch.update(true, 1000)).toBe(null);  // face returns before lost fires
      
      // Now face is visible, stays visible
      expect(watch.update(true, 3000)).toBe(null);
    });

    it('can lose and find multiple times', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      // First loss and recovery
      watch.update(false, 0);
      watch.update(false, 2100);  // lost
      expect(watch.update(true, 2200)).toBe('found');
      
      // Face visible for a while
      watch.update(true, 3000);
      
      // Second loss and recovery
      watch.update(false, 3500);
      expect(watch.update(false, 5600)).toBe('lost');
      expect(watch.update(true, 5700)).toBe('found');
    });
  });

  describe('edge cases', () => {
    it('fires lost at exactly lostAfterMs', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      watch.update(false, 0);
      expect(watch.update(false, 2000)).toBe('lost');
    });

    it('does not fire lost before lostAfterMs', () => {
      const watch = createFaceWatch({ lostAfterMs: 2000 });
      
      watch.update(false, 0);
      expect(watch.update(false, 1999)).toBe(null);
    });
  });
});
