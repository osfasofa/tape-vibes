import { store } from '../../state/store';
import type { AppMode } from '../../types';

export function setupModeSwitcher(): void {
  const modes: AppMode[] = ['tape', 'synth', 'mixer'];

  modes.forEach((mode) => {
    const btn = document.getElementById(`mode-${mode}`);
    if (btn) {
      btn.addEventListener('click', () => {
        store.setMode(mode);
      });
    }
  });

  store.on('mode', (mode) => {
    modes.forEach((m) => {
      const btn = document.getElementById(`mode-${m}`);
      if (btn) btn.classList.toggle('active', m === mode);
    });

    // Show/hide mode panels
    document.getElementById('tape-panel')?.classList.toggle('hidden', mode !== 'tape');
    document.getElementById('synth-panel')?.classList.toggle('hidden', mode !== 'synth');
    document.getElementById('mixer-panel')?.classList.toggle('hidden', mode !== 'mixer');
  });
}
