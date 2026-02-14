interface Voice {
  osc: OscillatorNode;
  gainNode: GainNode;
  frequency: number;
}

export type WaveformType = 'sawtooth' | 'square' | 'sine' | 'triangle';

export class Synthesizer {
  private voices = new Map<string, Voice>();
  private masterGain: GainNode;
  private filter: BiquadFilterNode;
  private ctx: AudioContext;

  envelope = { attack: 0.1, decay: 0.3, sustain: 0.6, release: 0.8 };
  waveform: WaveformType = 'sawtooth';

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.filter = ctx.createBiquadFilter();

    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.filter.Q.value = 5;

    this.filter.connect(this.masterGain);
    this.masterGain.gain.value = 0.3;
  }

  connect(destination: AudioNode): void {
    this.masterGain.connect(destination);
  }

  disconnect(): void {
    this.masterGain.disconnect();
  }

  noteOn(frequency: number, noteId: string): void {
    if (this.voices.has(noteId)) {
      this.noteOff(noteId);
    }

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = this.waveform;
    osc.frequency.value = frequency;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0;

    osc.connect(gainNode);
    gainNode.connect(this.filter);

    const { attack, decay, sustain } = this.envelope;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.8, now + attack);
    gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);

    osc.start(now);
    this.voices.set(noteId, { osc, gainNode, frequency });
  }

  noteOff(noteId: string): void {
    const voice = this.voices.get(noteId);
    if (!voice) return;

    const now = this.ctx.currentTime;
    const { osc, gainNode } = voice;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + this.envelope.release);

    osc.stop(now + this.envelope.release + 0.1);

    setTimeout(() => {
      this.voices.delete(noteId);
    }, (this.envelope.release + 0.1) * 1000);
  }

  setWaveform(wf: WaveformType): void {
    this.waveform = wf;
  }

  setCutoff(value: number): void {
    this.filter.frequency.value = value;
  }

  setResonance(value: number): void {
    this.filter.Q.value = value;
  }

  panic(): void {
    this.voices.forEach((voice) => {
      voice.osc.stop();
    });
    this.voices.clear();
  }
}
