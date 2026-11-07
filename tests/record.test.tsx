import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { RecordPanel } from '../src/record.js';
import { CameraSample } from '../src/input/camera.js';

describe('RecordPanel (issue #4: no global hack)', () => {
  let container: HTMLElement;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock URL methods
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    act(() => {
      render(null, container);
    });
    document.body.removeChild(container);

    // Restore URL methods
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;

    vi.restoreAllMocks();
  });

  it('should register sink callback when recording starts and unregister on stop', () => {
    const registerSinkFn = vi.fn();

    act(() => {
      render(
        <RecordPanel onRegisterSink={registerSinkFn} />,
        container
      );
    });

    // Initial render: recording is false, so sink should be null
    expect(registerSinkFn).toHaveBeenCalledWith(null);
    registerSinkFn.mockClear();

    // Click Start recording
    const buttons = container.querySelectorAll('button');
    const startButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('Start recording')
    ) as HTMLButtonElement;

    act(() => {
      startButton.click();
    });

    // Now sink should be registered (not null)
    expect(registerSinkFn).toHaveBeenCalledWith(expect.any(Function));
    const sink = registerSinkFn.mock.calls[0][0];

    registerSinkFn.mockClear();

    // Click Stop recording
    const stopButton = container.querySelectorAll('button')[0] as HTMLButtonElement;
    expect(stopButton.textContent).toBe('Stop recording');

    act(() => {
      stopButton.click();
    });

    // Sink should be unregistered (null)
    expect(registerSinkFn).toHaveBeenCalledWith(null);
  });

  it('should collect samples when recording and sink is called', () => {
    let sink: ((sample: CameraSample) => void) | null = null;

    const registerSinkFn = vi.fn((s) => {
      sink = s;
    });

    act(() => {
      render(
        <RecordPanel onRegisterSink={registerSinkFn} />,
        container
      );
    });

    // Start recording
    const buttons = container.querySelectorAll('button');
    const startButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('Start recording')
    ) as HTMLButtonElement;

    act(() => {
      startButton.click();
    });

    // Sink should now be a function
    expect(sink).toBeDefined();
    expect(typeof sink).toBe('function');

    // Feed samples through sink
    act(() => {
      sink!({ t: 0, left: 0.1, right: 0.2 });
      sink!({ t: 10, left: 0.15, right: 0.25 });
    });

    // Should show samples collected
    expect(container.textContent).toContain('Recording... 2 samples');
  });

  it('should not collect samples when not recording', () => {
    let sink: ((sample: CameraSample) => void) | null = null;

    const registerSinkFn = vi.fn((s) => {
      sink = s;
    });

    act(() => {
      render(
        <RecordPanel onRegisterSink={registerSinkFn} />,
        container
      );
    });

    // Recording is false, so sink should be null
    expect(sink).toBeNull();

    // Sample should have no effect (sink is null, so we can't send one)
    // Just verify the UI shows the expected state
    expect(container.textContent).toContain('Start recording');
  });

  it('should not use window.__recordSample global', () => {
    // Verify window.__recordSample is not set
    const windowAny = window as any;
    delete windowAny.__recordSample;

    const registerSinkFn = vi.fn();

    act(() => {
      render(
        <RecordPanel onRegisterSink={registerSinkFn} />,
        container
      );
    });

    // window.__recordSample should not be set
    expect(windowAny.__recordSample).toBeUndefined();
  });

  it('should work without onRegisterSink prop (graceful degradation)', () => {
    act(() => {
      render(
        <RecordPanel />,
        container
      );
    });

    // Should render without error
    expect(container.textContent).toContain('Recording Mode');
    expect(container.textContent).toContain('Start recording');
  });

  it('should download trace as JSON when stopping', () => {
    let sink: ((sample: CameraSample) => void) | null = null;
    const registerSinkFn = vi.fn((s) => {
      sink = s;
    });

    // Spy on anchor click
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    act(() => {
      render(
        <RecordPanel onRegisterSink={registerSinkFn} />,
        container
      );
    });

    // Start recording
    const buttons = container.querySelectorAll('button');
    const startButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('Start recording')
    ) as HTMLButtonElement;

    act(() => {
      startButton.click();
    });

    // Send a sample
    act(() => {
      sink!({ t: 5, noseY: 0.4 });
    });

    // Stop recording
    const stopButton = container.querySelectorAll('button')[0] as HTMLButtonElement;
    act(() => {
      stopButton.click();
    });

    // Should have created object URL and initiated download
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();

    clickSpy.mockRestore();
  });
});
