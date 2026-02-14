export const SAMPLE_RATE = 44100;
export const TAPE_DURATION_SECONDS = 360; // 6 minutes
export const TAPE_LENGTH = SAMPLE_RATE * TAPE_DURATION_SECONDS; // 15,876,000 samples
export const NUM_TRACKS = 4;
export const BLOCK_SIZE = 128; // AudioWorklet render quantum

export const POSITION_REPORT_INTERVAL = 33; // ~30Hz position updates (ms)
export const LEVEL_REPORT_INTERVAL = 33; // ~30Hz level updates (ms)

export const MAX_SPEED = 4.0;
export const MIN_SPEED = 0.01;
export const REWIND_SPEED = 8.0;
export const FF_SPEED = 8.0;

export const TAPE_STOP_DURATION = 2.0; // seconds for tape stop effect
