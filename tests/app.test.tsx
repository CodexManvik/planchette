import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../src/ui/App.js';
import { Speaker } from '../src/output/speaker.js';

describe('App integration', () => {
  let container: HTMLElement;
  let mockSpeaker: Speaker;
  let speakCalls: string[] = [];
  let clock: number;
  const stepMs = 1500;

  // Test helpers
  const now = () => clock;

  const press = () => {
    clock += 600;
    act(() => {
      const keydown = new KeyboardEvent('keydown', {
        code: 'Space',
        key: ' ',
        repeat: false,
        bubbles: true
      });
      const keyup = new KeyboardEvent('keyup', {
        code: 'Space',
        key: ' ',
        bubbles: true
      });
      document.dispatchEvent(keydown);
      document.dispatchEvent(keyup);
    });
  };

  const tick = (n: number) => {
    act(() => {
      for (let i = 0; i < n; i++) {
        vi.advanceTimersByTime(stepMs);
      }
    });
  };

  const highlighted = (): string => {
    const highlightedElem = container.querySelector('.highlighted');
    if (highlightedElem) {
      return highlightedElem.textContent || '';
    }
    // Fall back to centre label if no highlighted element
    const centreLabel = container.querySelector('.centre-label');
    return centreLabel?.textContent || '';
  };

  // Store original globals
  let originalSpeechSynthesis: typeof window.speechSynthesis;
  let originalSpeechSynthesisUtterance: typeof globalThis.SpeechSynthesisUtterance;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    container = document.createElement('div');
    document.body.appendChild(container);

    speakCalls = [];
    mockSpeaker = {
      say(text: string) {
        speakCalls.push(text);
      },
      available() {
        return true;
      }
    };

    // Save originals
    originalSpeechSynthesis = window.speechSynthesis;
    originalSpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance;
  });

  afterEach(() => {
    // Unmount to clean up event listeners
    act(() => {
      render(null, container);
    });
    document.body.removeChild(container);

    // Restore mocked globals
    if (window.speechSynthesis !== originalSpeechSynthesis) {
      (window as any).speechSynthesis = originalSpeechSynthesis;
    }
    if (globalThis.SpeechSynthesisUtterance !== originalSpeechSynthesisUtterance) {
      (globalThis as any).SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
    }

    vi.useRealTimers();
  });

  it('happy path: wake, select Pain > Chest > Bad, then speak', () => {
    act(() => {
      render(<App speaker={mockSpeaker} now={now} initialStepMs={stepMs} />, container);
    });

    // Wake from rest
    press();

    // Select Pain (index 0, no tick needed)
    press();

    // Tick to Chest (index 1)
    tick(1);
    press();

    // Tick to Bad (index 1)
    tick(1);
    press();

    // Tick to hold/speak
    tick(1);

    // Assert speech happened exactly once
    expect(speakCalls).toEqual(["Pain in my chest. It's bad."]);
    expect(container.textContent).toContain("Pain in my chest. It's bad.");
  });

  it('repeated speech: speaks only once with default speaker', () => {
    // Install fake browser speech synthesis
    const speakFn = vi.fn();
    (window as any).speechSynthesis = {
      speak: speakFn,
      cancel: vi.fn(),
      getVoices: () => []
    };
    class FakeSpeechSynthesisUtterance {
      text = '';
      constructor(text?: string) {
        if (text) this.text = text;
      }
    }
    (globalThis as any).SpeechSynthesisUtterance = FakeSpeechSynthesisUtterance;

    // Render without speaker prop to use default
    act(() => {
      render(<App now={now} initialStepMs={stepMs} />, container);
    });

    // Walk: wake, Pain, tick, Chest, tick, Bad, tick to speak
    press();
    press();
    tick(1);
    press();
    tick(1);
    press();
    tick(1);

    // Tick 10 more times
    tick(10);

    // Assert speak was called exactly once
    expect(speakFn).toHaveBeenCalledTimes(1);
  });

  it('filter blocks rapid repeated presses', () => {
    act(() => {
      render(<App speaker={mockSpeaker} now={now} initialStepMs={stepMs} />, container);
    });

    // Wake from rest
    press();

    // We should be at needs layer, Pain (index 0)
    const layer = container.textContent;
    expect(layer).toContain('Pain');

    // Advance clock by only 100ms and dispatch another Space keydown (not via press())
    clock += 100;
    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        key: ' ',
        repeat: false,
        bubbles: true
      });
      document.dispatchEvent(event);
    });

    // Should still be at needs layer, Pain
    expect(container.textContent).toContain('Pain');
    // Follow-up layer should not have opened
    expect(container.textContent).not.toContain('Chest');
    expect(container.textContent).not.toContain('Head');

    // Tick once to trigger a re-render
    tick(1);

    // Advance clock by another 100ms and try again
    clock += 100;
    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        key: ' ',
        repeat: false,
        bubbles: true
      });
      document.dispatchEvent(event);
    });

    // Should still not have counted (total elapsed is 200ms + 1 tick, still within refractory)
    expect(container.textContent).not.toContain('Chest');
    expect(container.textContent).not.toContain('Head');
  });

  it('bell notice appears and clears after 10 seconds from second ring', () => {
    // 1. Render and wake
    act(() => {
      render(<App speaker={mockSpeaker} now={now} initialStepMs={stepMs} />, container);
    });
    press();

    // 2. Tick to Breathing (index 1), select it, tick to speak (bell 1)
    tick(1);
    press();
    tick(1);
    expect(container.textContent).toContain('Calling for help');
    expect(speakCalls).toContain("I can't breathe well.");

    // 3. Tick to Breathing, select, tick to speak (bell 2, ~3 seconds after bell 1)
    tick(1);
    press();
    tick(1);
    expect(speakCalls).toContain("I can't breathe well.");

    // 4. Advance 9000 ms (total ~12 seconds after bell 1)
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(container.textContent).toContain('Calling for help');

    // 5. Advance another 1000 ms (total 10+ seconds after bell 2)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.textContent).not.toContain('Calling for help');
  });

  it('renders and initializes in rest state', () => {
    act(() => {
      render(<App speaker={mockSpeaker} now={now} initialStepMs={stepMs} />, container);
    });

    // Initial state: rest
    expect(container.textContent).toContain('Resting');
    expect(container.textContent).toContain('Slow');
    expect(container.textContent).toContain('Medium');
  });

  it('displays speech unavailable notice when speaker unavailable', () => {
    const unavailableSpeaker: Speaker = {
      say() {},
      available() {
        return false;
      }
    };

    act(() => {
      render(<App speaker={unavailableSpeaker} now={now} initialStepMs={stepMs} />, container);
    });

    // Should show speech unavailable notice
    expect(container.textContent).toContain(
      "Speech isn't working. Messages will appear as text."
    );
  });

  it('pause button toggles pause state', () => {
    act(() => {
      render(<App speaker={mockSpeaker} now={now} initialStepMs={stepMs} />, container);
    });

    // Find pause button
    const buttons = container.querySelectorAll('button');
    const pauseButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('Pause')
    );

    expect(pauseButton).toBeDefined();
    expect(pauseButton?.textContent).toBe('Pause');

    // Click pause
    act(() => {
      pauseButton?.click();
    });

    // Button should now say Resume
    expect(pauseButton?.textContent).toBe('Resume');

    // Click resume
    act(() => {
      pauseButton?.click();
    });

    // Button should say Pause again
    expect(pauseButton?.textContent).toBe('Pause');
  });
});
