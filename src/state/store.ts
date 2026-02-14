import { NUM_TRACKS } from '../constants';
import type { StoreState, TransportState, AppMode, TrackState, EffectParams } from '../types';

type Listener<K extends keyof StoreState> = (value: StoreState[K]) => void;

export class Store {
  private state: StoreState;
  private listeners = new Map<keyof StoreState, Set<Listener<any>>>();

  constructor() {
    const tracks: TrackState[] = Array.from({ length: NUM_TRACKS }, (_, i) => ({
      armed: i === 0,
      muted: false,
      level: 0.8,
      pan: 0,
    }));

    this.state = {
      transport: 'stopped',
      mode: 'tape',
      headPosition: 0,
      speed: 1.0,
      tracks,
      loopIn: 0,
      loopOut: 0,
      loopEnabled: false,
      effects: {
        speed: 1.0,
        saturation: 0.2,
        flutterAmount: 0.005,
        flutterRate: 6.0,
        stereoWidth: 1.0,
        reverse: false,
      },
      peaks: [0, 0, 0, 0],
    };
  }

  get<K extends keyof StoreState>(key: K): StoreState[K] {
    return this.state[key];
  }

  set<K extends keyof StoreState>(key: K, value: StoreState[K]): void {
    this.state[key] = value;
    this.notify(key);
  }

  on<K extends keyof StoreState>(key: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    return () => this.listeners.get(key)?.delete(listener);
  }

  private notify<K extends keyof StoreState>(key: K): void {
    this.listeners.get(key)?.forEach((fn) => fn(this.state[key]));
  }

  getArmedTrack(): number {
    return this.state.tracks.findIndex((t) => t.armed);
  }

  setTransport(state: TransportState): void {
    this.set('transport', state);
  }

  setMode(mode: AppMode): void {
    this.set('mode', mode);
  }

  updateTrack(index: number, partial: Partial<TrackState>): void {
    const tracks = [...this.state.tracks];
    tracks[index] = { ...tracks[index], ...partial };
    this.set('tracks', tracks);
  }

  armTrack(index: number): void {
    const tracks = this.state.tracks.map((t, i) => ({
      ...t,
      armed: i === index,
    }));
    this.set('tracks', tracks);
  }

  updateEffects(partial: Partial<EffectParams>): void {
    this.set('effects', { ...this.state.effects, ...partial });
  }
}

export const store = new Store();
