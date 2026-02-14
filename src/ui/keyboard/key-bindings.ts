import { KEY_MAPPING, noteToFrequency } from '../../audio/note-utils';
import type { Synthesizer } from '../../audio/synthesizer';
import { store } from '../../state/store';

export function setupKeyBindings(synth: Synthesizer): void {
  const activeKeys = new Set<string>();

  document.addEventListener('keydown', (e) => {
    if (store.get('mode') !== 'synth') return;
    const noteId = KEY_MAPPING[e.code];
    if (!noteId || e.repeat || activeKeys.has(e.code)) return;

    activeKeys.add(e.code);
    const freq = noteToFrequency(noteId);
    synth.noteOn(freq, noteId);

    // Highlight key on piano
    const keyEl = document.querySelector(`[data-note="${noteId}"]`);
    keyEl?.classList.add('pressed');

    e.preventDefault();
  });

  document.addEventListener('keyup', (e) => {
    if (store.get('mode') !== 'synth') return;
    const noteId = KEY_MAPPING[e.code];
    if (!noteId) return;

    activeKeys.delete(e.code);
    synth.noteOff(noteId);

    const keyEl = document.querySelector(`[data-note="${noteId}"]`);
    keyEl?.classList.remove('pressed');

    e.preventDefault();
  });
}
