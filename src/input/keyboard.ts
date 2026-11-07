/**
 * Keyboard source for spacebar input.
 * Handles keydown and keyup to prevent button activation.
 */

export interface SignalSource {
  start(onSelect: () => void): void;
  stop(): void;
}

export function createKeyboardSource(): SignalSource {
  let handlers: {
    keydown: ((e: KeyboardEvent) => void) | null;
    keyup: ((e: KeyboardEvent) => void) | null;
  } = {
    keydown: null,
    keyup: null
  };

  return {
    start(onSelect) {
      handlers.keydown = (e: KeyboardEvent) => {
        // AC 3.3: Space keydown, ignore auto-repeat
        if ((e.code === 'Space' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          onSelect();
        }
      };

      handlers.keyup = (e: KeyboardEvent) => {
        // AC 3.4: Space keyup, prevent button activation
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
        }
      };

      document.addEventListener('keydown', handlers.keydown);
      document.addEventListener('keyup', handlers.keyup);
    },

    stop() {
      if (handlers.keydown) {
        document.removeEventListener('keydown', handlers.keydown);
        handlers.keydown = null;
      }
      if (handlers.keyup) {
        document.removeEventListener('keyup', handlers.keyup);
        handlers.keyup = null;
      }
    }
  };
}
