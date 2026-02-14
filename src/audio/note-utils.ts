const NOTE_MAP: Record<string, number> = {
  C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4,
  'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2,
};

export function noteToFrequency(note: string): number {
  const noteName = note.slice(0, -1);
  const octave = parseInt(note.slice(-1));
  const semitones = NOTE_MAP[noteName] + (octave - 4) * 12;
  return 440 * Math.pow(2, semitones / 12);
}

export const KEY_MAPPING: Record<string, string> = {
  KeyQ: 'C3', Digit2: 'C#3', KeyW: 'D3', Digit3: 'D#3', KeyE: 'E3',
  KeyR: 'F3', Digit5: 'F#3', KeyT: 'G3', Digit6: 'G#3', KeyY: 'A3', Digit7: 'A#3', KeyU: 'B3',
  KeyI: 'C4', Digit9: 'C#4', KeyO: 'D4', Digit0: 'D#4', KeyP: 'E4',
  KeyZ: 'C4', KeyS: 'C#4', KeyX: 'D4', KeyD: 'D#4', KeyC: 'E4',
  KeyV: 'F4', KeyG: 'F#4', KeyB: 'G4', KeyH: 'G#4', KeyN: 'A4', KeyJ: 'A#4', KeyM: 'B4',
};

export const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const BLACK_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'];
export const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
