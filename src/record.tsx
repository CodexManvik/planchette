/**
 * Recording mode UI and trace download.
 * Only active when URL contains ?record=1
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { CameraSample } from './input/camera.js';

export interface Trace {
  kind: 'blink' | 'nod' | 'knock';
  expectedSelects: number;
  samples: Array<{
    t: number;
    left?: number;
    right?: number;
    noseY?: number;
  }>;
}

export interface RecordPanelProps {
  onRegisterSink?: (sink: ((sample: CameraSample) => void) | null) => void;
}

export function RecordPanel(props?: RecordPanelProps) {
  const [recording, setRecording] = useState(false);
  const [kind, setKind] = useState<'blink' | 'nod' | 'knock'>('blink');
  const [expectedSelects, setExpectedSelects] = useState(2);
  const [samples, setSamples] = useState<CameraSample[]>([]);

  const handleStart = () => {
    setSamples([]);
    setRecording(true);
  };

  const handleStop = () => {
    setRecording(false);

    const trace: Trace = {
      kind,
      expectedSelects,
      samples
    };

    // Create blob and download
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kind}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSample = (sample: CameraSample) => {
    if (recording) {
      setSamples(prev => [...prev, sample]);
    }
  };

  // Register sink when recording starts, unregister when it stops
  if (props?.onRegisterSink) {
    props.onRegisterSink(recording ? handleSample : null);
  }

  return h('div', { class: 'record-panel' },
    h('h2', null, 'Recording Mode'),
    h('label', null,
      'Kind: ',
      h('select',
        {
          value: kind,
          onChange: (e: Event) => {
            const target = e.target as HTMLSelectElement;
            setKind(target.value as 'blink' | 'nod' | 'knock');
          },
          disabled: recording
        },
        h('option', { value: 'blink' }, 'Blink'),
        h('option', { value: 'nod' }, 'Nod'),
        h('option', { value: 'knock' }, 'Knock')
      )
    ),
    h('label', null,
      'Expected selects: ',
      h('input',
        {
          type: 'number',
          min: '0',
          max: '100',
          value: expectedSelects,
          onChange: (e: Event) => {
            const target = e.target as HTMLInputElement;
            setExpectedSelects(parseInt(target.value, 10) || 0);
          },
          disabled: recording
        }
      )
    ),
    !recording && h('button', { onClick: handleStart, disabled: false }, 'Start recording'),
    recording && [
      h('button', { onClick: handleStop }, 'Stop recording'),
      h('p', null, `Recording... ${samples.length} samples`)
    ]
  );
}
