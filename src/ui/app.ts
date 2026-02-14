import type { TapeEngine } from '../audio/tape-engine';
import type { Synthesizer } from '../audio/synthesizer';
import { CanvasRenderer } from './canvas/renderer';
import { setupTransport } from './controls/transport';
import { setupTrackControls } from './controls/track-controls';
import { setupModeSwitcher } from './controls/mode-switcher';
import { createKnob } from './controls/knobs';
import { buildPiano } from './keyboard/piano';
import { setupKeyBindings } from './keyboard/key-bindings';
import { setupFileImport, importFile } from '../input/file-import';
import { store } from '../state/store';
import { saveTape, listTapes } from '../persistence/tape-storage';
import { SAMPLE_RATE } from '../constants';
import type { TapeProject } from '../types';

export function initApp(engine: TapeEngine, synth: Synthesizer): void {
  const canvas = document.getElementById('tape-display') as HTMLCanvasElement;
  const renderer = new CanvasRenderer(canvas, engine);
  renderer.start();

  setupTransport(engine);
  setupTrackControls(engine);
  setupModeSwitcher();

  // Knobs
  createKnob({
    element: document.getElementById('knob-speed')!,
    min: 0.1, max: 3.0, value: 1.0, step: 0.01,
    label: 'SPEED',
    format: (v) => `${v.toFixed(2)}x`,
    onChange: (v) => engine.setSpeed(v),
  });

  createKnob({
    element: document.getElementById('knob-saturation')!,
    min: 0, max: 1.0, value: 0.2, step: 0.01,
    label: 'SAT',
    format: (v) => `${(v * 100).toFixed(0)}%`,
    onChange: (v) => engine.setSaturation(v),
  });

  createKnob({
    element: document.getElementById('knob-flutter')!,
    min: 0, max: 0.05, value: 0.005, step: 0.001,
    label: 'FLUTTER',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    onChange: (v) => engine.setFlutter(v, store.get('effects').flutterRate),
  });

  createKnob({
    element: document.getElementById('knob-stereo')!,
    min: 0, max: 2.0, value: 1.0, step: 0.1,
    label: 'WIDTH',
    format: (v) => `${(v * 100).toFixed(0)}%`,
    onChange: (v) => engine.setStereoWidth(v),
  });

  // Synth controls knobs
  createKnob({
    element: document.getElementById('knob-cutoff')!,
    min: 100, max: 8000, value: 2000, step: 50,
    label: 'CUTOFF',
    format: (v) => `${v}Hz`,
    onChange: (v) => synth.setCutoff(v),
  });

  createKnob({
    element: document.getElementById('knob-resonance')!,
    min: 0, max: 30, value: 5, step: 0.5,
    label: 'RES',
    format: (v) => v.toFixed(1),
    onChange: (v) => synth.setResonance(v),
  });

  // Piano
  const pianoContainer = document.getElementById('piano')!;
  buildPiano(pianoContainer, synth);
  setupKeyBindings(synth);

  // Waveform selector
  const waveformSelect = document.getElementById('synth-waveform') as HTMLSelectElement;
  if (waveformSelect) {
    waveformSelect.addEventListener('change', () => {
      synth.setWaveform(waveformSelect.value as any);
    });
  }

  // ADSR sliders
  ['attack', 'decay', 'sustain', 'release'].forEach((param) => {
    const slider = document.getElementById(`synth-${param}`) as HTMLInputElement;
    const display = document.getElementById(`synth-${param}-val`) as HTMLElement;
    if (slider && display) {
      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        (synth.envelope as any)[param] = val;
        display.textContent = param === 'sustain'
          ? `${(val * 100).toFixed(0)}%`
          : `${val.toFixed(2)}s`;
      });
    }
  });

  // File import via drag-drop on the canvas
  setupFileImport(
    engine,
    canvas,
    () => store.getArmedTrack(),
    () => Math.floor(store.get('headPosition'))
  );

  // Mic input button
  const micBtn = document.getElementById('btn-mic');
  if (micBtn) {
    let micInput: import('../input/mic-input').MicInput | null = null;

    micBtn.addEventListener('click', async () => {
      const { MicInput } = await import('../input/mic-input');
      const ctx = engine.getContext();
      const inputNode = engine.getInputNode();

      if (!ctx || !inputNode) return;

      if (micInput?.isActive()) {
        micInput.disconnect();
        micInput = null;
        micBtn.classList.remove('active');
      } else {
        micInput = new MicInput();
        await micInput.connect(ctx, inputNode);
        micBtn.classList.add('active');
      }
    });
  }

  // Mixer faders
  for (let t = 0; t < 4; t++) {
    const fader = document.getElementById(`mixer-level-${t}`) as HTMLInputElement;
    if (fader) {
      fader.addEventListener('input', () => {
        engine.setTrackLevel(t, parseFloat(fader.value));
      });
    }
  }

  // Reverse toggle
  const reverseBtn = document.getElementById('btn-reverse');
  if (reverseBtn) {
    reverseBtn.addEventListener('click', () => {
      const current = store.get('effects').reverse;
      engine.setReverse(!current);
      reverseBtn.classList.toggle('active', !current);
    });
  }

  // Save tape
  const saveBtn = document.getElementById('btn-save');
  const tapeNameEl = document.getElementById('tape-name');
  let currentTapeId: number | undefined;

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const tracks: TapeProject['tracks'] = [];
      for (let t = 0; t < 4; t++) {
        const data = await engine.requestTapeData(t);
        const trackState = store.get('tracks')[t];
        tracks.push({
          data: data.buffer as ArrayBuffer,
          level: trackState.level,
          pan: trackState.pan,
          muted: trackState.muted,
        });
      }

      const tape: TapeProject = {
        id: currentTapeId,
        name: `Tape ${new Date().toLocaleTimeString()}`,
        createdAt: currentTapeId ? new Date() : new Date(),
        updatedAt: new Date(),
        bpm: 120,
        tracks,
        loopIn: store.get('loopIn'),
        loopOut: store.get('loopOut'),
        headPosition: store.get('headPosition'),
      };

      currentTapeId = await saveTape(tape);
      if (tapeNameEl) tapeNameEl.textContent = `Saved: ${tape.name}`;
    });
  }

  // Load tape
  const loadBtn = document.getElementById('btn-load');
  if (loadBtn) {
    loadBtn.addEventListener('click', async () => {
      const tapes = await listTapes();
      if (tapes.length === 0) {
        if (tapeNameEl) tapeNameEl.textContent = 'No saved tapes';
        return;
      }
      // Load the most recent tape
      const tape = tapes[tapes.length - 1];
      engine.stop();

      for (let t = 0; t < 4; t++) {
        const trackData = tape.tracks[t];
        if (trackData?.data) {
          const float32 = new Float32Array(trackData.data);
          engine.importAudio(t, float32, 0);
          engine.setTrackLevel(t, trackData.level);
          engine.setTrackMute(t, trackData.muted);
        }
      }

      engine.seek(tape.headPosition || 0);
      currentTapeId = tape.id;
      if (tapeNameEl) tapeNameEl.textContent = `Loaded: ${tape.name}`;
    });
  }

  // Clear track
  const clearBtn = document.getElementById('btn-clear-track');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const armed = store.getArmedTrack();
      engine.clearTrack(armed);
      if (tapeNameEl) tapeNameEl.textContent = `Cleared T${armed + 1}`;
    });
  }

  // Export (WAV bounce)
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      if (tapeNameEl) tapeNameEl.textContent = 'Exporting...';

      // Get all track data and mix to stereo
      const trackDatas: Float32Array[] = [];
      for (let t = 0; t < 4; t++) {
        trackDatas.push(await engine.requestTapeData(t));
      }

      // Find last non-silent sample
      let endSample = 0;
      for (const data of trackDatas) {
        for (let i = data.length - 1; i >= 0; i--) {
          if (Math.abs(data[i]) > 0.0001) {
            endSample = Math.max(endSample, i + 1);
            break;
          }
        }
      }

      if (endSample === 0) {
        if (tapeNameEl) tapeNameEl.textContent = 'Nothing to export';
        return;
      }

      // Mix to mono (or stereo with pan)
      const mixed = new Float32Array(endSample);
      const tracks = store.get('tracks');
      for (let t = 0; t < 4; t++) {
        if (tracks[t].muted) continue;
        const level = tracks[t].level;
        for (let i = 0; i < endSample; i++) {
          mixed[i] += trackDatas[t][i] * level;
        }
      }

      // Encode to WAV
      const wav = encodeWav(mixed, SAMPLE_RATE);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tape-vibes-export.wav';
      a.click();
      URL.revokeObjectURL(url);

      if (tapeNameEl) tapeNameEl.textContent = 'Exported!';
    });
  }

  // File import button
  const importBtn = document.getElementById('btn-import-file');
  const fileInput = document.getElementById('file-import') as HTMLInputElement;
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) {
        await importFile(engine, file, store.getArmedTrack(), Math.floor(store.get('headPosition')));
        if (tapeNameEl) tapeNameEl.textContent = `Imported: ${file.name}`;
        fileInput.value = '';
      }
    });
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples (Float32 → Int16)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
