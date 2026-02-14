// tape-engine.worklet.ts — AudioWorkletProcessor
// Tape data lives here. This is the single owner of the 4-track tape buffer.

// AudioWorklet globals (not in standard lib.dom.d.ts)
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}
declare function registerProcessor(name: string, ctor: typeof AudioWorkletProcessor): void;
declare const sampleRate: number;

const SAMPLE_RATE = 44100;
const TAPE_DURATION = 360; // 6 minutes
const TAPE_LENGTH = SAMPLE_RATE * TAPE_DURATION;
const NUM_TRACKS = 4;
const POSITION_REPORT_SAMPLES = Math.floor(SAMPLE_RATE / 30); // ~30Hz

// Inline DSP functions (worklet can't import from main thread modules)

function linearInterpolate(a: number, b: number, frac: number): number {
  return a * (1 - frac) + b * frac;
}

function cubicInterpolate(
  y0: number, y1: number, y2: number, y3: number, frac: number
): number {
  const c0 = y1;
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return c0 + c1 * frac + c2 * frac * frac + c3 * frac * frac * frac;
}

function tapeSaturation(sample: number, amount: number): number {
  if (amount === 0) return sample;
  const drive = 1 + amount * 4;
  const driven = sample * drive;
  if (driven > 1) return 1 - Math.exp(-(driven - 1));
  if (driven < -1) return -1 + Math.exp(driven + 1);
  return driven;
}

type TransportState = 'stopped' | 'playing' | 'recording' | 'tape_stopping' | 'rewinding' | 'fast_forward';

class TapeEngineProcessor extends AudioWorkletProcessor {
  // Tape data: 4 mono tracks
  private tracks: Float32Array[];
  private trackLevels: number[] = [0.8, 0.8, 0.8, 0.8];
  private trackPans: number[] = [0, 0, 0, 0];
  private trackMuted: boolean[] = [false, false, false, false];
  private armedTrack = 0;

  // Transport
  private state: TransportState = 'stopped';
  private headPosition = 0; // fractional sample position
  private speed = 1.0;
  private reverse = false;

  // Loop
  private loopIn = 0;
  private loopOut = 0;
  private loopEnabled = false;

  // Effects
  private saturation = 0.2;
  private flutterAmount = 0.005;
  private flutterRate = 6.0;
  private stereoWidth = 1.0;

  // LFO phases
  private flutterPhase = 0;
  private wowPhase = 0;

  // Tape stop
  private tapeStopSpeed = 1.0;

  // Reporting
  private samplesSinceReport = 0;

  // Peak levels for meters
  private trackPeaks: number[] = [0, 0, 0, 0];

  constructor() {
    super();

    // Allocate tape buffers (4 mono tracks × 15,876,000 samples)
    this.tracks = Array.from({ length: NUM_TRACKS }, () =>
      new Float32Array(TAPE_LENGTH)
    );

    this.port.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
    this.port.postMessage({ type: 'ready' });
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'transport':
        this.setTransportState(msg.state);
        break;
      case 'seek':
        this.headPosition = Math.max(0, Math.min(TAPE_LENGTH - 1, msg.position));
        break;
      case 'set-speed':
        this.speed = Math.max(0.01, Math.min(4.0, msg.speed));
        break;
      case 'set-arm':
        if (msg.track >= 0 && msg.track < NUM_TRACKS) {
          this.armedTrack = msg.track;
        }
        break;
      case 'set-track-level':
        if (msg.track >= 0 && msg.track < NUM_TRACKS) {
          this.trackLevels[msg.track] = msg.level;
        }
        break;
      case 'set-track-pan':
        if (msg.track >= 0 && msg.track < NUM_TRACKS) {
          this.trackPans[msg.track] = msg.pan;
        }
        break;
      case 'set-track-mute':
        if (msg.track >= 0 && msg.track < NUM_TRACKS) {
          this.trackMuted[msg.track] = msg.muted;
        }
        break;
      case 'set-loop':
        this.loopIn = msg.loopIn;
        this.loopOut = msg.loopOut;
        this.loopEnabled = msg.enabled;
        break;
      case 'set-saturation':
        this.saturation = msg.amount;
        break;
      case 'set-flutter':
        this.flutterAmount = msg.amount;
        this.flutterRate = msg.rate;
        break;
      case 'set-stereo-width':
        this.stereoWidth = msg.width;
        break;
      case 'set-reverse':
        this.reverse = msg.reverse;
        break;
      case 'tape-stop-effect':
        if (this.state === 'playing' || this.state === 'recording') {
          this.state = 'tape_stopping';
          this.tapeStopSpeed = this.speed;
          this.port.postMessage({ type: 'state-change', state: this.state });
        }
        break;
      case 'import-audio':
        this.importAudio(msg.track, msg.data, msg.offset);
        break;
      case 'request-waveform':
        this.sendWaveform(msg.track, msg.start, msg.end, msg.width);
        break;
      case 'clear-track':
        if (msg.track >= 0 && msg.track < NUM_TRACKS) {
          this.tracks[msg.track].fill(0);
        }
        break;
      case 'request-tape-data': {
        const track = msg.track;
        if (track >= 0 && track < NUM_TRACKS) {
          const copy = new Float32Array(this.tracks[track]);
          this.port.postMessage(
            { type: 'tape-data', track, data: copy },
            [copy.buffer]
          );
        }
        break;
      }
    }
  }

  private setTransportState(newState: TransportState): void {
    const prev = this.state;

    if (newState === 'stopped') {
      this.state = 'stopped';
    } else if (newState === 'playing') {
      if (prev === 'stopped' || prev === 'rewinding' || prev === 'fast_forward') {
        this.state = 'playing';
      }
    } else if (newState === 'recording') {
      if (prev === 'stopped' || prev === 'playing') {
        this.state = 'recording';
      }
    } else if (newState === 'rewinding') {
      if (prev === 'stopped') {
        this.state = 'rewinding';
      }
    } else if (newState === 'fast_forward') {
      if (prev === 'stopped') {
        this.state = 'fast_forward';
      }
    }

    this.port.postMessage({ type: 'state-change', state: this.state });
  }

  private importAudio(track: number, data: Float32Array, offset: number): void {
    if (track < 0 || track >= NUM_TRACKS) return;
    const tape = this.tracks[track];
    const len = Math.min(data.length, TAPE_LENGTH - offset);
    for (let i = 0; i < len; i++) {
      tape[offset + i] = data[i];
    }
  }

  private sendWaveform(track: number, start: number, end: number, width: number): void {
    if (track < 0 || track >= NUM_TRACKS) return;
    const tape = this.tracks[track];
    const result = new Float32Array(width);
    const samplesPerPixel = (end - start) / width;

    for (let i = 0; i < width; i++) {
      const from = Math.floor(start + i * samplesPerPixel);
      const to = Math.floor(start + (i + 1) * samplesPerPixel);
      let peak = 0;
      for (let j = from; j < to && j < TAPE_LENGTH; j++) {
        const abs = Math.abs(tape[j]);
        if (abs > peak) peak = abs;
      }
      result[i] = peak;
    }

    this.port.postMessage(
      { type: 'waveform', track, data: result },
      [result.buffer]
    );
  }

  private readSample(track: number, position: number): number {
    const tape = this.tracks[track];
    const len = TAPE_LENGTH;

    const idx = Math.floor(position);
    const frac = position - idx;

    if (frac < 0.0001) {
      // No interpolation needed
      const i = ((idx % len) + len) % len;
      return tape[i];
    }

    // Catmull-Rom interpolation using 4 neighboring samples
    const i0 = (((idx - 1) % len) + len) % len;
    const i1 = ((idx % len) + len) % len;
    const i2 = (((idx + 1) % len) + len) % len;
    const i3 = (((idx + 2) % len) + len) % len;

    return cubicInterpolate(tape[i0], tape[i1], tape[i2], tape[i3], frac);
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const outL = output[0];
    const outR = output[1];
    const blockSize = outL.length;

    // Get mono input (sum to mono if stereo)
    const input = inputs[0];
    const hasInput = input && input.length > 0 && input[0] && input[0].length > 0;

    for (let i = 0; i < blockSize; i++) {
      let inputSample = 0;
      if (hasInput) {
        if (input.length === 1) {
          inputSample = input[0][i];
        } else {
          inputSample = (input[0][i] + input[1][i]) * 0.5;
        }
      }

      // Compute effective speed
      let effectiveSpeed = this.speed;

      if (this.state === 'tape_stopping') {
        this.tapeStopSpeed *= 0.9997; // Exponential decay
        effectiveSpeed = this.tapeStopSpeed;
        if (this.tapeStopSpeed < 0.001) {
          this.state = 'stopped';
          this.tapeStopSpeed = this.speed;
          this.port.postMessage({ type: 'state-change', state: this.state });
        }
      } else if (this.state === 'rewinding') {
        effectiveSpeed = -8.0;
      } else if (this.state === 'fast_forward') {
        effectiveSpeed = 8.0;
      } else if (this.state === 'stopped') {
        // Output silence when stopped
        outL[i] = 0;
        outR[i] = 0;
        continue;
      }

      // Add wow & flutter modulation
      const flutter = this.flutterAmount * Math.sin(this.flutterPhase);
      const wow = this.flutterAmount * 0.3 * Math.sin(this.wowPhase);
      this.flutterPhase += (2 * Math.PI * this.flutterRate) / SAMPLE_RATE;
      this.wowPhase += (2 * Math.PI * 1.2) / SAMPLE_RATE;
      if (this.flutterPhase > 2 * Math.PI) this.flutterPhase -= 2 * Math.PI;
      if (this.wowPhase > 2 * Math.PI) this.wowPhase -= 2 * Math.PI;

      const finalSpeed = this.reverse
        ? -(effectiveSpeed + flutter + wow)
        : effectiveSpeed + flutter + wow;

      // Record: write input to armed track (overdub — add to existing)
      if (this.state === 'recording' && hasInput) {
        const writePos = Math.floor(this.headPosition);
        if (writePos >= 0 && writePos < TAPE_LENGTH) {
          this.tracks[this.armedTrack][writePos] += inputSample;
        }
      }

      // Playback: read and mix all 4 tracks
      let mixL = 0;
      let mixR = 0;

      for (let t = 0; t < NUM_TRACKS; t++) {
        if (this.trackMuted[t]) continue;

        let sample = this.readSample(t, this.headPosition);

        // Per-track saturation
        sample = tapeSaturation(sample, this.saturation);

        // Per-track level
        sample *= this.trackLevels[t];

        // Track peak for meters
        const abs = Math.abs(sample);
        if (abs > this.trackPeaks[t]) this.trackPeaks[t] = abs;

        // Pan to stereo (constant power)
        const pan = this.trackPans[t];
        const panAngle = (pan + 1) * 0.25 * Math.PI; // 0 to PI/2
        const panL = Math.cos(panAngle);
        const panR = Math.sin(panAngle);

        mixL += sample * panL;
        mixR += sample * panR;
      }

      // Stereo width (Mid/Side processing)
      const mid = (mixL + mixR) * 0.5;
      const side = (mixL - mixR) * 0.5 * this.stereoWidth;
      mixL = mid + side;
      mixR = mid - side;

      // Final clamp
      outL[i] = Math.max(-1, Math.min(1, mixL));
      outR[i] = Math.max(-1, Math.min(1, mixR));

      // Advance head position
      this.headPosition += finalSpeed;

      // Loop / boundary handling
      if (this.loopEnabled && this.loopOut > this.loopIn) {
        if (this.headPosition >= this.loopOut) {
          this.headPosition = this.loopIn + (this.headPosition - this.loopOut);
        } else if (this.headPosition < this.loopIn) {
          this.headPosition = this.loopOut - (this.loopIn - this.headPosition);
        }
      } else {
        if (this.headPosition >= TAPE_LENGTH) {
          this.headPosition = TAPE_LENGTH - 1;
          this.state = 'stopped';
          this.port.postMessage({ type: 'state-change', state: this.state });
        } else if (this.headPosition < 0) {
          this.headPosition = 0;
          if (this.state === 'rewinding') {
            this.state = 'stopped';
            this.port.postMessage({ type: 'state-change', state: this.state });
          }
        }
      }

      // Position reporting (~30Hz)
      this.samplesSinceReport++;
      if (this.samplesSinceReport >= POSITION_REPORT_SAMPLES) {
        this.samplesSinceReport = 0;
        this.port.postMessage({
          type: 'position',
          position: this.headPosition,
          state: this.state,
          speed: effectiveSpeed,
        });
        this.port.postMessage({
          type: 'levels',
          peaks: [...this.trackPeaks],
        });
        // Decay peaks
        for (let t = 0; t < NUM_TRACKS; t++) {
          this.trackPeaks[t] *= 0.8;
        }
      }
    }

    return true;
  }
}

registerProcessor('tape-engine', TapeEngineProcessor);
