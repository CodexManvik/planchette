/**
 * Synthetic trace generator for detector testing.
 * Uses a seeded random number generator for determinism.
 * Generates six baseline traces in traces/ directory.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tracesDir = path.join(__dirname, '../traces');

// Seeded random number generator (linear congruential generator)
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  intRange(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

// Ensure traces directory exists
if (!fs.existsSync(tracesDir)) {
  fs.mkdirSync(tracesDir, { recursive: true });
}

/**
 * Generate blink-two-deliberate.json
 * Two 700ms closures at ~30fps (33ms per frame)
 * Expected: 2 selects
 */
function generateBlinkTwoDeliberate() {
  const samples = [];
  const rng = new SeededRandom(12345);
  let time = 0;
  
  // First closure: 0–700ms, frame time ~33ms
  for (let i = 0; i < 22; i++) {
    const left = 0.6 + rng.range(-0.05, 0.05);
    const right = 0.6 + rng.range(-0.05, 0.05);
    samples.push({ t: time, left, right });
    time += 33;
  }
  
  // Eyes open: 700–1000ms
  for (let i = 0; i < 10; i++) {
    const left = 0.2 + rng.range(-0.05, 0.05);
    const right = 0.2 + rng.range(-0.05, 0.05);
    samples.push({ t: time, left, right });
    time += 33;
  }
  
  // Second closure: 1000–1700ms
  for (let i = 0; i < 22; i++) {
    const left = 0.6 + rng.range(-0.05, 0.05);
    const right = 0.6 + rng.range(-0.05, 0.05);
    samples.push({ t: time, left, right });
    time += 33;
  }
  
  // Eyes open: 1700–2000ms
  for (let i = 0; i < 10; i++) {
    const left = 0.2 + rng.range(-0.05, 0.05);
    const right = 0.2 + rng.range(-0.05, 0.05);
    samples.push({ t: time, left, right });
    time += 33;
  }
  
  return {
    kind: 'blink',
    expectedSelects: 2,
    samples: samples.slice(0, Math.floor(samples.length / 30 * 30)) // Keep under 200KB by sampling at 30fps
  };
}

/**
 * Generate blink-normal-only.json
 * Ten closures of 150–250ms (all under 400ms minimum)
 * Expected: 0 selects
 */
function generateBlinkNormalOnly() {
  const samples = [];
  const rng = new SeededRandom(23456);
  let time = 0;
  
  for (let blinkIdx = 0; blinkIdx < 10; blinkIdx++) {
    // Duration between 150–250ms
    const duration = rng.intRange(150, 250);
    
    // Closed
    for (let ms = 0; ms < duration; ms += 33) {
      const left = 0.6 + rng.range(-0.05, 0.05);
      const right = 0.6 + rng.range(-0.05, 0.05);
      samples.push({ t: time, left, right });
      time += 33;
    }
    
    // Open for 300ms
    for (let ms = 0; ms < 300; ms += 33) {
      const left = 0.2 + rng.range(-0.05, 0.05);
      const right = 0.2 + rng.range(-0.05, 0.05);
      samples.push({ t: time, left, right });
      time += 33;
    }
  }
  
  return {
    kind: 'blink',
    expectedSelects: 0,
    samples: samples.slice(0, Math.floor(samples.length / 30 * 30))
  };
}

/**
 * Generate blink-asleep.json
 * One 5s closure (well over 2000ms maximum)
 * Expected: 0 selects
 */
function generateBlinkAsleep() {
  const samples = [];
  const rng = new SeededRandom(34567);
  let time = 0;
  
  // Closed for 5s
  for (let ms = 0; ms < 5000; ms += 33) {
    const left = 0.6 + rng.range(-0.05, 0.05);
    const right = 0.6 + rng.range(-0.05, 0.05);
    samples.push({ t: time, left, right });
    time += 33;
  }
  
  // Open again
  for (let ms = 0; ms < 500; ms += 33) {
    const left = 0.2 + rng.range(-0.05, 0.05);
    const right = 0.2 + rng.range(-0.05, 0.05);
    samples.push({ t: time, left, right });
    time += 33;
  }
  
  return {
    kind: 'blink',
    expectedSelects: 0,
    samples: samples.slice(0, Math.floor(samples.length / 30 * 30))
  };
}

/**
 * Generate blink-one-eye.json
 * Only left eye closes, right stays open
 * Expected: 0 selects
 */
function generateBlinkOneEye() {
  const samples = [];
  const rng = new SeededRandom(45678);
  let time = 0;
  
  // Left eye closes for 700ms, right stays open
  for (let ms = 0; ms < 700; ms += 33) {
    const left = 0.6 + rng.range(-0.05, 0.05);
    const right = 0.2 + rng.range(-0.05, 0.05);
    samples.push({ t: time, left, right });
    time += 33;
  }
  
  // Left eye opens but right stays open (was already open)
  for (let ms = 0; ms < 500; ms += 33) {
    const left = 0.2 + rng.range(-0.05, 0.05);
    const right = 0.2 + rng.range(-0.05, 0.05);
    samples.push({ t: time, left, right });
    time += 33;
  }
  
  return {
    kind: 'blink',
    expectedSelects: 0,
    samples: samples.slice(0, Math.floor(samples.length / 30 * 30))
  };
}

/**
 * Generate nod-two.json
 * Two nods: each dips noseY by 0.08, lasts ~600ms
 * Expected: 2 selects
 */
function generateNodTwo() {
  const samples = [];
  const rng = new SeededRandom(56789);
  let time = 0;
  
  // Establish baseline: 500ms at 0.5
  for (let ms = 0; ms < 500; ms += 33) {
    const noseY = 0.5 + rng.range(-0.01, 0.01);
    samples.push({ t: time, noseY });
    time += 33;
  }
  
  // First nod: dip down to 0.58, back up
  // Down phase: 200ms
  for (let ms = 0; ms < 200; ms += 33) {
    const progress = ms / 200;
    const noseY = 0.5 + 0.08 * progress + rng.range(-0.01, 0.01);
    samples.push({ t: time, noseY });
    time += 33;
  }
  // Up phase: 400ms back to baseline
  for (let ms = 0; ms < 400; ms += 33) {
    const progress = 1 - (ms / 400);
    const noseY = 0.5 + 0.08 * progress + rng.range(-0.01, 0.01);
    samples.push({ t: time, noseY });
    time += 33;
  }
  
  // Rest between nods: 300ms
  for (let ms = 0; ms < 300; ms += 33) {
    const noseY = 0.5 + rng.range(-0.01, 0.01);
    samples.push({ t: time, noseY });
    time += 33;
  }
  
  // Second nod: same pattern
  for (let ms = 0; ms < 200; ms += 33) {
    const progress = ms / 200;
    const noseY = 0.5 + 0.08 * progress + rng.range(-0.01, 0.01);
    samples.push({ t: time, noseY });
    time += 33;
  }
  for (let ms = 0; ms < 400; ms += 33) {
    const progress = 1 - (ms / 400);
    const noseY = 0.5 + 0.08 * progress + rng.range(-0.01, 0.01);
    samples.push({ t: time, noseY });
    time += 33;
  }
  
  return {
    kind: 'nod',
    expectedSelects: 2,
    samples: samples.slice(0, Math.floor(samples.length / 30 * 30))
  };
}

/**
 * Generate nod-drift.json
 * Slow drift of 0.1 over 20s (no deliberate nods)
 * Expected: 0 selects
 */
function generateNodDrift() {
  const samples = [];
  const rng = new SeededRandom(67890);
  let time = 0;
  
  // Slow upward drift from 0.5 to 0.6 over 20s
  const duration = 20000;
  for (let ms = 0; ms < duration; ms += 33) {
    const progress = ms / duration;
    const drift = 0.5 + 0.1 * progress;
    const noseY = drift + rng.range(-0.01, 0.01);
    samples.push({ t: time, noseY });
    time += 33;
  }
  
  return {
    kind: 'nod',
    expectedSelects: 0,
    samples: samples.slice(0, Math.floor(samples.length / 30 * 30))
  };
}

// Generate all traces
const traces = [
  { filename: 'blink-two-deliberate.json', data: generateBlinkTwoDeliberate() },
  { filename: 'blink-normal-only.json', data: generateBlinkNormalOnly() },
  { filename: 'blink-asleep.json', data: generateBlinkAsleep() },
  { filename: 'blink-one-eye.json', data: generateBlinkOneEye() },
  { filename: 'nod-two.json', data: generateNodTwo() },
  { filename: 'nod-drift.json', data: generateNodDrift() }
];

// Write traces to files
traces.forEach(({ filename, data }) => {
  const filepath = path.join(tracesDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  const size = fs.statSync(filepath).size;
  console.log(`Generated ${filename} (${(size / 1024).toFixed(1)} KB)`);
});

console.log(`\nGenerated ${traces.length} traces in ${tracesDir}`);
