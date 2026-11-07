import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createKeyboardSource } from '../src/input/keyboard.js';

describe('createKeyboardSource', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('Space keydown triggers onSelect once', () => {
    const onSelect = vi.fn();
    const source = createKeyboardSource();
    source.start(onSelect);

    const event = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      repeat: false
    });
    document.dispatchEvent(event);

    expect(onSelect).toHaveBeenCalledTimes(1);

    source.stop();
  });

  it('auto-repeat events are ignored', () => {
    const onSelect = vi.fn();
    const source = createKeyboardSource();
    source.start(onSelect);

    const event = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      repeat: true
    });
    document.dispatchEvent(event);

    expect(onSelect).not.toHaveBeenCalled();

    source.stop();
  });

  it('preventDefault is called on keydown', () => {
    const onSelect = vi.fn();
    const source = createKeyboardSource();
    source.start(onSelect);

    const event = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      repeat: false
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();

    source.stop();
  });

  it('preventDefault is called on keyup', () => {
    const onSelect = vi.fn();
    const source = createKeyboardSource();
    source.start(onSelect);

    const event = new KeyboardEvent('keyup', {
      code: 'Space',
      key: ' '
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();

    source.stop();
  });

  it('focused button click handler does not run when Space is pressed and released', () => {
    const onSelect = vi.fn();
    const buttonClickHandler = vi.fn();

    const button = document.createElement('button');
    button.onclick = buttonClickHandler;
    container.appendChild(button);

    const source = createKeyboardSource();
    source.start(onSelect);

    // Focus the button
    button.focus();
    expect(document.activeElement).toBe(button);

    // Press Space
    const keydownEvent = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      repeat: false,
      bubbles: true
    });
    document.dispatchEvent(keydownEvent);

    // Release Space
    const keyupEvent = new KeyboardEvent('keyup', {
      code: 'Space',
      key: ' ',
      bubbles: true
    });
    document.dispatchEvent(keyupEvent);

    // The button click handler should not have been called
    expect(buttonClickHandler).not.toHaveBeenCalled();
    // But onSelect should have been called
    expect(onSelect).toHaveBeenCalledTimes(1);

    source.stop();
  });

  it('works with both event.code and event.key', () => {
    const onSelect = vi.fn();
    const source = createKeyboardSource();
    source.start(onSelect);

    // Test with event.key = ' '
    const event1 = new KeyboardEvent('keydown', {
      key: ' ',
      repeat: false
    });
    document.dispatchEvent(event1);

    expect(onSelect).toHaveBeenCalledTimes(1);

    source.stop();
  });
});
