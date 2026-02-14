import type { TapeEngine } from '../../audio/tape-engine';
import { store } from '../../state/store';

export function setupTrackControls(engine: TapeEngine): void {
  for (let t = 0; t < 4; t++) {
    const armBtn = document.getElementById(`track-arm-${t}`) as HTMLButtonElement;
    const muteBtn = document.getElementById(`track-mute-${t}`) as HTMLButtonElement;

    if (armBtn) {
      armBtn.addEventListener('click', () => engine.setArm(t));
    }
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const tracks = store.get('tracks');
        engine.setTrackMute(t, !tracks[t].muted);
      });
    }
  }

  // Update track button states
  store.on('tracks', (tracks) => {
    for (let t = 0; t < 4; t++) {
      const armBtn = document.getElementById(`track-arm-${t}`);
      const muteBtn = document.getElementById(`track-mute-${t}`);

      if (armBtn) armBtn.classList.toggle('armed', tracks[t].armed);
      if (muteBtn) muteBtn.classList.toggle('muted', tracks[t].muted);
    }
  });
}
