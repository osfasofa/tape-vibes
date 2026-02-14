import { store } from '../../state/store';
import { TAPE_LENGTH } from '../../constants';
import { COLORS, SIZES } from './theme';
import { TapeReels } from './tape-reels';
import { WaveformDisplay } from './waveform';
import { TransportDisplay } from './transport-display';
import type { TapeEngine } from '../../audio/tape-engine';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId = 0;

  private reels = new TapeReels();
  private waveform = new WaveformDisplay();
  private transportDisplay = new TransportDisplay();
  private engine: TapeEngine;

  // Waveform update throttle
  private lastWaveformRequest = 0;
  private waveformInterval = 500; // ms between requests

  constructor(canvas: HTMLCanvasElement, engine: TapeEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.engine = engine;
    this.resize();

    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  start(): void {
    const frame = () => {
      this.draw();
      this.animId = requestAnimationFrame(frame);
    };
    this.animId = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.animId);
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    // Clear with display background
    ctx.fillStyle = COLORS.displayBg;
    ctx.fillRect(0, 0, w, h);

    const headPosition = store.get('headPosition');
    const transport = store.get('transport');
    const speed = store.get('effects').speed;
    const tracks = store.get('tracks');
    const armedTrack = store.getArmedTrack();
    const isRecording = transport === 'recording';

    const effectiveSpeed = transport === 'stopped' ? 0 : speed;

    // Draw layers
    this.transportDisplay.draw(ctx, w, headPosition, transport, speed);

    this.reels.draw(ctx, w, effectiveSpeed, headPosition, TAPE_LENGTH);

    this.waveform.draw(
      ctx, w, headPosition,
      tracks.map((t) => t.muted),
      armedTrack,
      isRecording
    );

    // Draw level meters
    this.drawLevelMeters(ctx, w, h);

    // Scanline overlay
    this.drawScanlines(ctx, w, h);

    // CRT vignette
    this.drawVignette(ctx, w, h);

    // Request waveform data periodically
    this.maybeRequestWaveforms(w);
  }

  private drawLevelMeters(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const peaks = store.get('peaks');
    const meterWidth = 4;
    const meterHeight = 60;
    const startX = w - 30;
    const startY = h - meterHeight - 15;

    for (let t = 0; t < 4; t++) {
      const x = startX + t * (meterWidth + 3);
      const level = peaks[t] || 0;
      const filledHeight = level * meterHeight;

      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(x, startY, meterWidth, meterHeight);

      // Filled portion
      const color = COLORS.track[t];
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.fillRect(x, startY + meterHeight - filledHeight, meterWidth, filledHeight);
      ctx.shadowBlur = 0;
    }
  }

  private drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = `rgba(0, 0, 0, ${SIZES.scanlineOpacity})`;
    for (let y = 0; y < h; y += 2) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  private drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  private maybeRequestWaveforms(displayWidth: number): void {
    const now = performance.now();
    if (now - this.lastWaveformRequest < this.waveformInterval) return;
    this.lastWaveformRequest = now;

    const pixelWidth = Math.floor(displayWidth - 40);
    if (pixelWidth <= 0) return;

    for (let t = 0; t < 4; t++) {
      this.engine
        .requestWaveform(t, 0, TAPE_LENGTH, pixelWidth)
        .then((data) => this.waveform.setWaveformData(t, data));
    }
  }

  getWaveformDisplay(): WaveformDisplay {
    return this.waveform;
  }
}
