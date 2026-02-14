import { store } from '../state/store';
import type {
  MainToWorkletMessage,
  WorkletToMainMessage,
} from '../types';
import { SAMPLE_RATE } from '../constants';
import workletUrl from './tape-engine.worklet.ts?url';

export class TapeEngine {
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private inputGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private _ready = false;
  get isReady(): boolean { return this._ready; }

  // Waveform request callbacks
  private waveformCallbacks = new Map<
    number,
    (data: Float32Array) => void
  >();
  private tapeDataCallbacks = new Map<
    number,
    (data: Float32Array) => void
  >();

  async init(): Promise<AudioContext> {
    if (this.ctx) return this.ctx;

    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });

    // Load worklet
    await this.ctx.audioWorklet.addModule(workletUrl);

    // Create nodes
    this.workletNode = new AudioWorkletNode(this.ctx, 'tape-engine', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    this.inputGain = this.ctx.createGain();
    this.inputGain.gain.value = 1.0;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    // Audio graph: inputGain → worklet → masterGain → destination
    this.inputGain.connect(this.workletNode);
    this.workletNode.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Listen for messages from worklet
    this.workletNode.port.onmessage = (e: MessageEvent) => {
      this.handleWorkletMessage(e.data);
    };

    return this.ctx;
  }

  private handleWorkletMessage(msg: WorkletToMainMessage): void {
    switch (msg.type) {
      case 'ready':
        this._ready = true;
        break;
      case 'position':
        store.set('headPosition', msg.position);
        if (msg.state !== store.get('transport')) {
          store.setTransport(msg.state);
        }
        break;
      case 'levels':
        store.set('peaks', msg.peaks);
        break;
      case 'state-change':
        store.setTransport(msg.state);
        break;
      case 'waveform': {
        const cb = this.waveformCallbacks.get(msg.track);
        if (cb) {
          cb(msg.data);
          this.waveformCallbacks.delete(msg.track);
        }
        break;
      }
      case 'tape-data': {
        const cb = this.tapeDataCallbacks.get(msg.track);
        if (cb) {
          cb(msg.data);
          this.tapeDataCallbacks.delete(msg.track);
        }
        break;
      }
    }
  }

  private send(msg: MainToWorkletMessage): void {
    this.workletNode?.port.postMessage(msg);
  }

  // Transport controls
  play(): void {
    this.ensureRunning();
    this.send({ type: 'transport', state: 'playing' });
  }

  stop(): void {
    this.send({ type: 'transport', state: 'stopped' });
  }

  record(): void {
    this.ensureRunning();
    this.send({ type: 'transport', state: 'recording' });
  }

  rewind(): void {
    this.send({ type: 'transport', state: 'rewinding' });
  }

  fastForward(): void {
    this.send({ type: 'transport', state: 'fast_forward' });
  }

  tapeStop(): void {
    this.send({ type: 'tape-stop-effect' });
  }

  seek(position: number): void {
    this.send({ type: 'seek', position });
  }

  // Parameter controls
  setSpeed(speed: number): void {
    this.send({ type: 'set-speed', speed });
    store.updateEffects({ speed });
  }

  setArm(track: number): void {
    this.send({ type: 'set-arm', track, armed: true });
    store.armTrack(track);
  }

  setTrackLevel(track: number, level: number): void {
    this.send({ type: 'set-track-level', track, level });
    store.updateTrack(track, { level });
  }

  setTrackPan(track: number, pan: number): void {
    this.send({ type: 'set-track-pan', track, pan });
    store.updateTrack(track, { pan });
  }

  setTrackMute(track: number, muted: boolean): void {
    this.send({ type: 'set-track-mute', track, muted });
    store.updateTrack(track, { muted });
  }

  setLoop(loopIn: number, loopOut: number, enabled: boolean): void {
    this.send({ type: 'set-loop', loopIn, loopOut, enabled });
    store.set('loopIn', loopIn);
    store.set('loopOut', loopOut);
    store.set('loopEnabled', enabled);
  }

  setSaturation(amount: number): void {
    this.send({ type: 'set-saturation', amount });
    store.updateEffects({ saturation: amount });
  }

  setFlutter(amount: number, rate: number): void {
    this.send({ type: 'set-flutter', amount, rate });
    store.updateEffects({ flutterAmount: amount, flutterRate: rate });
  }

  setStereoWidth(width: number): void {
    this.send({ type: 'set-stereo-width', width });
    store.updateEffects({ stereoWidth: width });
  }

  setReverse(reverse: boolean): void {
    this.send({ type: 'set-reverse', reverse });
    store.updateEffects({ reverse });
  }

  // Audio import (uses Transferable for zero-copy)
  importAudio(track: number, data: Float32Array, offset = 0): void {
    const copy = new Float32Array(data);
    this.workletNode?.port.postMessage(
      { type: 'import-audio', track, data: copy, offset },
      [copy.buffer]
    );
  }

  clearTrack(track: number): void {
    this.send({ type: 'clear-track', track });
  }

  // Waveform data request
  requestWaveform(
    track: number,
    start: number,
    end: number,
    width: number
  ): Promise<Float32Array> {
    return new Promise((resolve) => {
      this.waveformCallbacks.set(track, resolve);
      this.send({ type: 'request-waveform', track, start, end, width });
    });
  }

  // Request full tape data (for saving)
  requestTapeData(track: number): Promise<Float32Array> {
    return new Promise((resolve) => {
      this.tapeDataCallbacks.set(track, resolve);
      this.send({ type: 'request-tape-data', track });
    });
  }

  // Connect an input source (synth, mic, etc.)
  getInputNode(): GainNode | null {
    return this.inputGain;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  private ensureRunning(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }
}
