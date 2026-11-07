import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createBlinkDetector, createNodDetector, BlinkDetector, NodDetector } from '../src/input/detectors';
import { createSignalFilter } from '../src/core/filter';

interface Trace {
  kind: 'blink' | 'nod' | 'knock';
  expectedSelects: number;
  samples: Array<{
    t: number;
    left?: number;
    right?: number;
    noseY?: number;
  }>;
}

describe('replay traces', () => {
  const tracesDir = path.join(__dirname, '../traces');
  
  // Load all trace files
  const traceFiles = fs.readdirSync(tracesDir).filter(f => f.endsWith('.json'));
  
  traceFiles.forEach(filename => {
    it(`replays ${filename}`, () => {
      const traceContent = fs.readFileSync(path.join(tracesDir, filename), 'utf8');
      const trace: Trace = JSON.parse(traceContent);
      
      // Skip knock traces (not yet implemented)
      if (trace.kind === 'knock') {
        return;
      }
      
      // Create appropriate detector with correct type
      let blinkDetector: BlinkDetector | null = null;
      let nodDetector: NodDetector | null = null;
      
      if (trace.kind === 'blink') {
        blinkDetector = createBlinkDetector({});
      } else {
        nodDetector = createNodDetector({});
      }
      
      // Create signal filter with 500ms refractory period
      const filter = createSignalFilter({ refractoryMs: 500 });
      
      // Replay samples and count accepted selects
      let selectCount = 0;
      trace.samples.forEach(sample => {
        let fired = false;
        
        if (trace.kind === 'blink') {
          if (sample.left === undefined || sample.right === undefined) {
            throw new Error(`Blink trace missing left or right field in sample at t=${sample.t}`);
          }
          fired = blinkDetector!.update(sample.left, sample.right, sample.t);
        } else {
          if (sample.noseY === undefined) {
            throw new Error(`Nod trace missing noseY field in sample at t=${sample.t}`);
          }
          fired = nodDetector!.update(sample.noseY, sample.t);
        }
        
        if (fired && filter.accept(sample.t)) {
          selectCount++;
        }
      });
      
      expect(selectCount).toBe(trace.expectedSelects);
    });
  });
});
