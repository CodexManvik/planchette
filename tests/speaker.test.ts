import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSpeaker } from '../src/output/speaker.js';

describe('createSpeaker', () => {
  let mockSpeechSynthesis: any;
  let originalSpeechSynthesis: SpeechSynthesis | undefined;
  let mockUtterances: any[] = [];

  beforeEach(() => {
    originalSpeechSynthesis = (window as any).speechSynthesis;
    mockUtterances = [];

    mockSpeechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn((utterance) => {
        mockUtterances.push(utterance);
      }),
      getVoices: vi.fn(() => [])
    };

    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSpeechSynthesis,
      configurable: true,
      writable: true
    });

    // Mock SpeechSynthesisUtterance global
    if (typeof SpeechSynthesisUtterance === 'undefined') {
      (global as any).SpeechSynthesisUtterance = class {
        text: string;
        voice: SpeechSynthesisVoice | null = null;
        onerror: ((event: any) => void) | null = null;

        constructor(text: string) {
          this.text = text;
        }
      };
    }
  });

  afterEach(() => {
    if (originalSpeechSynthesis !== undefined) {
      Object.defineProperty(window, 'speechSynthesis', {
        value: originalSpeechSynthesis,
        configurable: true,
        writable: true
      });
    } else {
      delete (window as any).speechSynthesis;
    }
  });

  it('available() returns true when speechSynthesis exists', () => {
    const speaker = createSpeaker();
    expect(speaker.available()).toBe(true);
  });

  it('available() returns false when speechSynthesis does not exist', () => {
    delete (window as any).speechSynthesis;
    const speaker = createSpeaker();
    expect(speaker.available()).toBe(false);
  });

  it('say() cancels before speaking', () => {
    const speaker = createSpeaker();
    speaker.say('Hello');

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    expect(mockUtterances.length).toBe(1);
    expect(mockUtterances[0].text).toBe('Hello');
  });

  it('say() calls onError when speech synthesis is unavailable', () => {
    const onError = vi.fn();
    delete (window as any).speechSynthesis;
    const speaker = createSpeaker({ onError });

    speaker.say('Hello');
    expect(onError).toHaveBeenCalled();
  });

  it('say() calls onError when speak throws', () => {
    const onError = vi.fn();
    mockSpeechSynthesis.speak.mockImplementation(() => {
      throw new Error('Speech error');
    });

    const speaker = createSpeaker({ onError });
    speaker.say('Hello');

    expect(onError).toHaveBeenCalled();
  });

  it('say() calls onError on utterance error', () => {
    const onError = vi.fn();

    const speaker = createSpeaker({ onError });
    speaker.say('Hello');

    // Trigger the error handler on the utterance
    if (mockUtterances.length > 0 && mockUtterances[0].onerror) {
      mockUtterances[0].onerror();
    }

    expect(onError).toHaveBeenCalled();
  });

  it('selects English voice from available voices', () => {
    const englishVoice = {
      lang: 'en-US',
      name: 'English US',
      default: true,
      localService: true,
      voiceURI: 'en-US'
    } as SpeechSynthesisVoice;

    mockSpeechSynthesis.getVoices.mockReturnValue([englishVoice]);

    const speaker = createSpeaker();
    speaker.say('Hello');

    expect(mockUtterances.length).toBe(1);
    expect(mockUtterances[0].voice).toBe(englishVoice);
  });
});
