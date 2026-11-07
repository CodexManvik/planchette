import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { createSignalFilter } from '../src/core/filter.js';

describe('createSignalFilter properties', () => {
  it('first signal is always accepted', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (timestamp) => {
        const filter = createSignalFilter({ refractoryMs: 500 });
        expect(filter.accept(timestamp)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('no two accepted signals closer than refractoryMs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100000 }), {
          minLength: 2,
          maxLength: 100
        }),
        fc.integer({ min: 100, max: 1000 }),
        (timestamps, refractoryMs) => {
          const sorted = [...timestamps].sort((a, b) => a - b);
          const filter = createSignalFilter({ refractoryMs });

          const accepted: number[] = [];
          sorted.forEach((ts) => {
            if (filter.accept(ts)) {
              accepted.push(ts);
            }
          });

          // Check all gaps between accepted timestamps
          for (let i = 1; i < accepted.length; i++) {
            expect(accepted[i] - accepted[i - 1]).toBeGreaterThanOrEqual(
              refractoryMs
            );
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});
