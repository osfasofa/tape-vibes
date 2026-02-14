export type TransportState =
  | 'stopped'
  | 'playing'
  | 'recording'
  | 'tape_stopping'
  | 'rewinding'
  | 'fast_forward';

export type AppMode = 'tape' | 'synth' | 'mixer';

export interface TrackState {
  armed: boolean;
  muted: boolean;
  level: number; // 0-1
  pan: number; // -1 to 1
}

// Main → Worklet messages
export type MainToWorkletMessage =
  | { type: 'transport'; state: TransportState }
  | { type: 'seek'; position: number }
  | { type: 'set-speed'; speed: number }
  | { type: 'set-arm'; track: number; armed: boolean }
  | { type: 'set-track-level'; track: number; level: number }
  | { type: 'set-track-pan'; track: number; pan: number }
  | { type: 'set-track-mute'; track: number; muted: boolean }
  | { type: 'set-loop'; loopIn: number; loopOut: number; enabled: boolean }
  | { type: 'set-saturation'; amount: number }
  | { type: 'set-flutter'; amount: number; rate: number }
  | { type: 'set-stereo-width'; width: number }
  | { type: 'set-reverse'; reverse: boolean }
  | { type: 'import-audio'; track: number; data: Float32Array; offset: number }
  | { type: 'request-waveform'; track: number; start: number; end: number; width: number }
  | { type: 'clear-track'; track: number }
  | { type: 'request-tape-data'; track: number }
  | { type: 'tape-stop-effect' };

// Worklet → Main messages
export type WorkletToMainMessage =
  | { type: 'position'; position: number; state: TransportState; speed: number }
  | { type: 'levels'; peaks: number[] }
  | { type: 'waveform'; track: number; data: Float32Array }
  | { type: 'state-change'; state: TransportState }
  | { type: 'tape-data'; track: number; data: Float32Array }
  | { type: 'ready' };

export interface TapeProject {
  id?: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  bpm: number;
  tracks: TapeTrackData[];
  loopIn: number;
  loopOut: number;
  headPosition: number;
}

export interface TapeTrackData {
  data: ArrayBuffer;
  level: number;
  pan: number;
  muted: boolean;
}

export interface EffectParams {
  speed: number;
  saturation: number;
  flutterAmount: number;
  flutterRate: number;
  stereoWidth: number;
  reverse: boolean;
}

export interface StoreState {
  transport: TransportState;
  mode: AppMode;
  headPosition: number;
  speed: number;
  tracks: TrackState[];
  loopIn: number;
  loopOut: number;
  loopEnabled: boolean;
  effects: EffectParams;
  peaks: number[];
}
