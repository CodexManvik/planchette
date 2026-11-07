import { SweepState, Board, OptionItem } from '../core/types.js';
import { optionsFor } from '../core/sweep.js';

interface BoardProps {
  state: SweepState;
  board: Board;
}

export function Board({ state, board }: BoardProps) {
  const options = optionsFor(state, board);
  const currentOption = options[state.index];

  if (state.layer === 'rest') {
    return (
      <div class="board rest">
        <div class="message">Resting. Press space to start.</div>
      </div>
    );
  }

  if (state.layer === 'hold') {
    return (
      <div class="board hold">
        <div class="held-message">{state.held!.text}</div>
        <div class="instruction">Speaking next. Press space to cancel.</div>
      </div>
    );
  }

  if (state.layer === 'needs' || state.layer === 'followup') {
    return (
      <div class="board ring">
        <div class="centre-label" aria-live="polite">
          {currentOption?.kind === 'board' ? currentOption.option.label : ''}
        </div>

        <div class="ring-options">
          {options.map((item, i) => {
            if (item.kind !== 'board') return null;
            const highlighted = i === state.index;
            return (
              <div
                key={item.option.id}
                class={`ring-option ${highlighted ? 'highlighted' : ''}`}
              >
                {item.option.label}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (state.layer === 'alphabet' || state.layer === 'letters') {
    return (
      <div class="board alphabet">
        <div class="draft">{state.draft || '(empty)'}</div>

        <div class="centre-label" aria-live="polite">
          {getLabelForOption(currentOption)}
        </div>

        <div class="options-grid">
          {options.map((item, i) => {
            const highlighted = i === state.index;
            return (
              <div
                key={i}
                class={`option ${highlighted ? 'highlighted' : ''}`}
              >
                {getLabelForOption(item)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

function getLabelForOption(item: OptionItem | undefined): string {
  if (!item) return '';
  if (item.kind === 'suggestion') return item.suggestion.text;
  if (item.kind === 'group') return item.letters.join('–');
  if (item.kind === 'letter') return item.letter;
  if (item.kind === 'control') return item.label;
  if (item.kind === 'board') return item.option.label;
  return '';
}
