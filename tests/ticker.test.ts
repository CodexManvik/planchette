import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTicker } from '../src/ui/ticker.js';

describe('createTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks at the correct interval', () => {
    const onTick = vi.fn();
    const ticker = createTicker({ stepMs: 1500, onTick });

    ticker.start();
    vi.advanceTimersByTime(1500);
    expect(onTick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1500);
    expect(onTick).toHaveBeenCalledTimes(2);

    ticker.stop();
  });

  it('setStep clamps to 800-4000 and restarts interval', () => {
    const onTick = vi.fn();
    const ticker = createTicker({ stepMs: 1500, onTick });

    ticker.start();
    vi.advanceTimersByTime(1500);
    expect(onTick).toHaveBeenCalledTimes(1);

    // Change step to something outside range
    ticker.setStep(500); // Should clamp to 800
    vi.advanceTimersByTime(800);
    expect(onTick).toHaveBeenCalledTimes(2);

    // Test upper clamp
    ticker.setStep(5000); // Should clamp to 4000
    vi.advanceTimersByTime(4000);
    expect(onTick).toHaveBeenCalledTimes(3);

    ticker.stop();
  });

  it('pause stops ticks', () => {
    const onTick = vi.fn();
    const ticker = createTicker({ stepMs: 1500, onTick });

    ticker.start();
    vi.advanceTimersByTime(1500);
    expect(onTick).toHaveBeenCalledTimes(1);

    ticker.pause();
    vi.advanceTimersByTime(1500);
    expect(onTick).toHaveBeenCalledTimes(1); // No additional tick

    ticker.resume();
    vi.advanceTimersByTime(1500);
    expect(onTick).toHaveBeenCalledTimes(2);

    ticker.stop();
  });

  it('stops ticking when document is hidden', () => {
    const onTick = vi.fn();
    const mockDoc = {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any as Document;

    const ticker = createTicker({ stepMs: 1500, onTick, doc: mockDoc });

    ticker.start();
    vi.advanceTimersByTime(1500);
    expect(onTick).toHaveBeenCalledTimes(1);

    // Simulate document becoming hidden
    Object.defineProperty(mockDoc, 'hidden', { value: true, writable: true });
    vi.advanceTimersByTime(1500);
    expect(onTick).toHaveBeenCalledTimes(1); // No additional tick

    // Simulate document becoming visible
    Object.defineProperty(mockDoc, 'hidden', { value: false, writable: true });
    vi.advanceTimersByTime(1500);
    expect(onTick).toHaveBeenCalledTimes(2);

    ticker.stop();
  });

  it('isRunning returns correct state', () => {
    const onTick = vi.fn();
    const ticker = createTicker({ stepMs: 1500, onTick });

    expect(ticker.isRunning()).toBe(false);

    ticker.start();
    expect(ticker.isRunning()).toBe(true);

    ticker.pause();
    expect(ticker.isRunning()).toBe(false);

    ticker.resume();
    expect(ticker.isRunning()).toBe(true);

    ticker.stop();
    expect(ticker.isRunning()).toBe(false);
  });
});
