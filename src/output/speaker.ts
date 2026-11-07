/**
 * Web Speech wrapper with error handling.
 */

export interface Speaker {
  say(text: string): void;
  available(): boolean;
}

export function createSpeaker(opts?: { onError?: () => void }): Speaker {
  const onError = opts?.onError ?? (() => {});

  return {
    available(): boolean {
      return typeof window !== 'undefined' && 'speechSynthesis' in window;
    },

    say(text: string): void {
      if (!this.available()) {
        onError();
        return;
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Set up error handler
        utterance.onerror = () => {
          onError();
        };

        // Select English voice
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find((v) => v.lang.startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        onError();
      }
    }
  };
}
