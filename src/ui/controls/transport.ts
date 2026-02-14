import type { TapeEngine } from '../../audio/tape-engine';
import { store } from '../../state/store';

export function setupTransport(engine: TapeEngine): void {
  const btn = (id: string) => document.getElementById(id) as HTMLButtonElement;

  btn('btn-play').addEventListener('click', () => engine.play());
  btn('btn-stop').addEventListener('click', () => engine.stop());
  btn('btn-record').addEventListener('click', () => engine.record());
  btn('btn-rewind').addEventListener('click', () => engine.rewind());
  btn('btn-ffwd').addEventListener('click', () => engine.fastForward());
  btn('btn-tape-stop').addEventListener('click', () => engine.tapeStop());

  // Update button states based on transport
  store.on('transport', (state) => {
    btn('btn-play').classList.toggle('active', state === 'playing');
    btn('btn-stop').classList.toggle('active', state === 'stopped');
    btn('btn-record').classList.toggle('active', state === 'recording');
    btn('btn-rewind').classList.toggle('active', state === 'rewinding');
    btn('btn-ffwd').classList.toggle('active', state === 'fast_forward');

    // Record LED
    const recLed = btn('btn-record').querySelector('.led');
    if (recLed) {
      recLed.classList.toggle('on', state === 'recording');
    }
  });

  // Keyboard shortcuts for transport
  document.addEventListener('keydown', (e) => {
    if (store.get('mode') === 'synth') return; // Don't intercept in synth mode

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (store.get('transport') === 'stopped') engine.play();
        else engine.stop();
        break;
      case 'KeyR':
        if (!e.repeat) engine.record();
        break;
    }
  });
}
