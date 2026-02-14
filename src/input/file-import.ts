import type { TapeEngine } from '../audio/tape-engine';

export function setupFileImport(
  engine: TapeEngine,
  dropTarget: HTMLElement,
  getTrack: () => number,
  getOffset: () => number
): void {
  // Drag and drop
  dropTarget.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropTarget.classList.add('drag-over');
  });

  dropTarget.addEventListener('dragleave', () => {
    dropTarget.classList.remove('drag-over');
  });

  dropTarget.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropTarget.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file) await importFile(engine, file, getTrack(), getOffset());
  });
}

export async function importFile(
  engine: TapeEngine,
  file: File,
  track: number,
  offset: number
): Promise<void> {
  const ctx = engine.getContext();
  if (!ctx) return;

  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  // Mix to mono
  const mono = new Float32Array(audioBuffer.length);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < audioBuffer.length; i++) {
      mono[i] += channelData[i] / audioBuffer.numberOfChannels;
    }
  }

  engine.importAudio(track, mono, offset);
}
