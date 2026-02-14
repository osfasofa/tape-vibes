import { WHITE_NOTES, BLACK_NOTES, noteToFrequency } from '../../audio/note-utils';
import type { Synthesizer } from '../../audio/synthesizer';

export function buildPiano(container: HTMLElement, synth: Synthesizer): void {
  container.innerHTML = '';

  // Build 3 octaves (C3 to B5)
  for (let octave = 3; octave <= 5; octave++) {
    const octaveDiv = document.createElement('div');
    octaveDiv.className = 'piano-octave';

    // White keys
    WHITE_NOTES.forEach((note) => {
      const noteId = `${note}${octave}`;
      const key = createKey(noteId, 'white', synth);
      octaveDiv.appendChild(key);
    });

    // Black keys (positioned absolutely over white keys)
    const blackPositions = [0, 1, 3, 4, 5]; // positions relative to white keys
    BLACK_NOTES.forEach((note, idx) => {
      const noteId = `${note}${octave}`;
      const key = createKey(noteId, 'black', synth);
      key.style.left = `${blackPositions[idx] * 36 + 24}px`;
      octaveDiv.appendChild(key);
    });

    container.appendChild(octaveDiv);
  }
}

function createKey(noteId: string, type: 'white' | 'black', synth: Synthesizer): HTMLElement {
  const key = document.createElement('div');
  key.className = `piano-key ${type}`;
  key.dataset.note = noteId;

  const label = document.createElement('span');
  label.className = 'piano-key-label';
  label.textContent = noteId;
  key.appendChild(label);

  const freq = noteToFrequency(noteId);

  const noteOn = () => {
    synth.noteOn(freq, noteId);
    key.classList.add('pressed');
  };

  const noteOff = () => {
    synth.noteOff(noteId);
    key.classList.remove('pressed');
  };

  key.addEventListener('mousedown', (e) => { noteOn(); e.preventDefault(); });
  key.addEventListener('mouseup', noteOff);
  key.addEventListener('mouseleave', noteOff);
  key.addEventListener('touchstart', (e) => { noteOn(); e.preventDefault(); });
  key.addEventListener('touchend', noteOff);

  return key;
}
