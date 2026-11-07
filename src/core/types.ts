// Sweep logic types - pure data structures with no side effects

export type Layer = 'rest' | 'needs' | 'followup' | 'alphabet' | 'letters' | 'hold';

export interface BoardOption {
  id: string; // unique option identifier
  label: string; // display text
  say?: string; // sentence fragment added to message
  goto?: string; // next BoardNode id; no goto means message is complete
  bell?: boolean; // ring bell when this message is spoken
  action?: 'spell' | 'back';
}

export interface BoardNode {
  id: string;
  options: BoardOption[];
}

export type Board = Record<string, BoardNode>;

export interface Suggestion {
  text: string;
  kind: 'word' | 'sentence';
}

export interface SweepState {
  layer: Layer;
  nodeId: string; // current BoardNode for needs and followup
  path: string[]; // parent BoardNode ids, used by Back
  index: number; // highlighted option
  fragments: string[]; // follow-up message built so far
  draft: string; // spelled text
  groupIndex: number | null; // open letter group (0–5)
  suggestions: Suggestion[];
  held: { text: string; bell: boolean; source: 'board' | 'draft' } | null;
  lastMessage: string | null;
  idleSweeps: number;
}

export type SweepEvent =
  | { type: 'tick' }
  | { type: 'select' }
  | { type: 'suggestions'; items: Suggestion[]; forDraft: string };

export type Effect =
  | { type: 'speak'; text: string }
  | { type: 'bell' }
  | { type: 'requestSuggestions'; draft: string };

// Letter groups for alphabet layer
export const LETTER_GROUPS: string[][] = [
  ['A', 'B', 'C', 'D'],
  ['E', 'F', 'G', 'H'],
  ['I', 'J', 'K', 'L', 'M'],
  ['N', 'O', 'P', 'Q', 'R'],
  ['S', 'T', 'U', 'V'],
  ['W', 'X', 'Y', 'Z']
];

// Control option identifiers
export const CTRL_SPEAK = 'speak';
export const CTRL_DELETE = 'delete';
export const CTRL_SPACE = 'space';
export const CTRL_NEEDS = 'needs';

// Root node identifier
export const ROOT_NODE_ID = 'needs';

// OptionItem represents items that can appear in optionsFor()
export type OptionItem =
  | { kind: 'suggestion'; suggestion: Suggestion; index: number }
  | { kind: 'group'; groupIndex: number; letters: string[] }
  | { kind: 'letter'; letter: string }
  | { kind: 'control'; id: string; label: string }
  | { kind: 'board'; option: BoardOption }
  | { kind: 'placeholder' };
