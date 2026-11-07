import { Board } from './types.js';

export const board: Board = {
  needs: {
    id: 'needs',
    options: [
      { id: 'pain', label: 'Pain', goto: 'pain-location' },
      { id: 'breathing', label: 'Breathing', say: "I can't breathe well.", bell: true },
      { id: 'thirsty', label: 'Thirsty', goto: 'thirsty-choice' },
      { id: 'toilet', label: 'Toilet', say: 'I need the toilet.' },
      { id: 'hot-cold', label: 'Hot or cold', goto: 'temp-choice' },
      { id: 'call', label: 'Call someone', goto: 'call-choice' },
      { id: 'yes', label: 'Yes', say: 'Yes.' },
      { id: 'no', label: 'No', say: 'No.' },
      { id: 'spell', label: 'Spell', action: 'spell' }
    ]
  },

  'pain-location': {
    id: 'pain-location',
    options: [
      { id: 'loc-head', label: 'Head', say: 'Pain in my head.', goto: 'pain-severity' },
      { id: 'loc-chest', label: 'Chest', say: 'Pain in my chest.', goto: 'pain-severity' },
      { id: 'loc-stomach', label: 'Stomach', say: 'Pain in my stomach.', goto: 'pain-severity' },
      { id: 'loc-back-body', label: 'My back', say: 'Pain in my back.', goto: 'pain-severity' },
      { id: 'loc-limb', label: 'Arm or leg', say: 'Pain in my arm or leg.', goto: 'pain-severity' },
      { id: 'loc-other', label: 'Other', say: 'Pain somewhere else.', goto: 'pain-severity' },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  },

  'pain-severity': {
    id: 'pain-severity',
    options: [
      { id: 'sev-little', label: 'A little', say: 'It hurts a little.' },
      { id: 'sev-bad', label: 'Bad', say: "It's bad." },
      { id: 'sev-very', label: 'Very bad', say: "It's very bad.", bell: true },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  },

  'thirsty-choice': {
    id: 'thirsty-choice',
    options: [
      { id: 'water', label: 'Water', say: 'Please bring me water.' },
      { id: 'wet-mouth', label: 'Wet my mouth', say: 'Please wet my mouth.' },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  },

  'temp-choice': {
    id: 'temp-choice',
    options: [
      { id: 'too-hot', label: 'Too hot', say: "I'm too hot." },
      { id: 'too-cold', label: 'Too cold', say: "I'm too cold." },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  },

  'call-choice': {
    id: 'call-choice',
    options: [
      { id: 'call-nurse', label: 'Nurse or doctor', say: 'Please get the nurse or doctor.', bell: true },
      { id: 'call-family', label: 'Family', say: 'Please get my family.', bell: true },
      { id: 'loc-back', label: 'Go back', action: 'back' }
    ]
  }
};
