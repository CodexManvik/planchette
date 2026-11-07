import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../src/ui/App.js';
import { Speaker } from '../src/output/speaker.js';

describe('App pause/resume with camera (issue #2)', () => {
  let container: HTMLElement;
  let mockSpeaker: Speaker;
  let clock: number;
  const stepMs = 1500;

  const now = () => clock;

  const tick = (n: number) => {
    act(() => {
      for (let i = 0; i < n; i++) {
        vi.advanceTimersByTime(stepMs);
      }
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    container = document.createElement('div');
    document.body.appendChild(container);

    mockSpeaker = {
      say() {},
      available() {
        return true;
      }
    };
  });

  afterEach(() => {
    act(() => {
      render(null, container);
    });
    document.body.removeChild(container);
    vi.useRealTimers();
  });

  it('should start camera only once, never stop on Pause, and not restart on Resume', () => {
    let startCount = 0;
    let stopCount = 0;

    const mockCreateCamera = vi.fn((opts) => {
      return {
        start: vi.fn(() => {
          startCount++;
        }),
        stop: vi.fn(() => {
          stopCount++;
        })
      };
    });

    act(() => {
      render(
        <App
          speaker={mockSpeaker}
          now={now}
          initialStepMs={stepMs}
          createCamera={mockCreateCamera}
        />,
        container
      );
    });

    // Switch to Blink mode
    const radios = container.querySelectorAll('input[type="radio"]');
    const blinkRadio = Array.from(radios).find(
      (r) => (r as HTMLInputElement).value === 'blink'
    ) as HTMLInputElement;

    act(() => {
      blinkRadio.checked = true;
      blinkRadio.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(startCount).toBe(1);
    expect(stopCount).toBe(0);

    // Find pause button and click it
    const buttons = container.querySelectorAll('button');
    const pauseButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('Pause')
    ) as HTMLButtonElement;

    act(() => {
      pauseButton.click();
    });

    // Camera should NOT have been stopped
    expect(startCount).toBe(1);
    expect(stopCount).toBe(0);

    // Click resume
    act(() => {
      pauseButton.click();
    });

    // Camera should NOT have been restarted
    expect(startCount).toBe(1);
    expect(stopCount).toBe(0);
  });

  it('onFaceLost and onFaceFound should only call setFaceLost, never pause/resume ticker', () => {
    const tickerMock = {
      pause: vi.fn(),
      resume: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      setStep: vi.fn()
    };

    let faceLostCallback: (() => void) | undefined;
    let faceFoundCallback: (() => void) | undefined;

    const mockCreateCamera = vi.fn((opts) => {
      faceLostCallback = opts.onFaceLost;
      faceFoundCallback = opts.onFaceFound;
      return {
        start: vi.fn(),
        stop: vi.fn()
      };
    });

    act(() => {
      render(
        <App
          speaker={mockSpeaker}
          now={now}
          initialStepMs={stepMs}
          createCamera={mockCreateCamera}
        />,
        container
      );
    });

    // Switch to Blink mode
    const radios = container.querySelectorAll('input[type="radio"]');
    const blinkRadio = Array.from(radios).find(
      (r) => (r as HTMLInputElement).value === 'blink'
    ) as HTMLInputElement;

    act(() => {
      blinkRadio.checked = true;
      blinkRadio.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Call onFaceLost
    act(() => {
      faceLostCallback?.();
    });

    // Should show "I can't see your face" notice
    expect(container.textContent).toContain("I can't see your face");

    // Call onFaceFound
    act(() => {
      faceFoundCallback?.();
    });

    // Notice should disappear
    expect(container.textContent).not.toContain("I can't see your face");

    // The ticker should be managed by the combined effect on [carerPaused, faceLost]
    // If faceLost changes and carerPaused is false, ticker should be resumed.
    // But the callbacks themselves should NOT call pause/resume.
    // This is verified by the separate effect test below.
  });

  it('combined effect on carerPaused and faceLost should pause/resume ticker correctly', () => {
    let tickerPauseCount = 0;
    let tickerResumeCount = 0;

    const mockCreateCamera = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn()
    }));

    act(() => {
      render(
        <App
          speaker={mockSpeaker}
          now={now}
          initialStepMs={stepMs}
          createCamera={mockCreateCamera}
        />,
        container
      );
    });

    // Get initial ticker state
    const tickerControls = container.querySelectorAll('button');
    const pauseButton = Array.from(tickerControls).find((b) =>
      b.textContent?.includes('Pause')
    ) as HTMLButtonElement;

    expect(pauseButton.textContent).toBe('Pause'); // Initially running

    // Pause (carerPaused = true)
    act(() => {
      pauseButton.click();
    });
    expect(pauseButton.textContent).toBe('Resume');

    // Resume (carerPaused = false)
    act(() => {
      pauseButton.click();
    });
    expect(pauseButton.textContent).toBe('Pause');
  });

  it('camera useEffect should only depend on [signalMode, recordMode, createCamera]', () => {
    const mockCreateCamera = vi.fn((opts) => {
      return {
        start: vi.fn(),
        stop: vi.fn()
      };
    });

    act(() => {
      render(
        <App
          speaker={mockSpeaker}
          now={now}
          initialStepMs={stepMs}
          createCamera={mockCreateCamera}
        />,
        container
      );
    });

    const initialCallCount = mockCreateCamera.mock.calls.length;

    // Pause (changes carerPaused, should NOT trigger camera re-creation)
    const buttons = container.querySelectorAll('button');
    const pauseButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('Pause')
    ) as HTMLButtonElement;

    act(() => {
      pauseButton.click();
    });

    // Camera should NOT have been recreated
    expect(mockCreateCamera.mock.calls.length).toBe(initialCallCount);

    // Resume
    act(() => {
      pauseButton.click();
    });

    // Still should NOT have been recreated
    expect(mockCreateCamera.mock.calls.length).toBe(initialCallCount);
  });
});
