import { COLORS, SIZES } from './theme';
import { SAMPLE_RATE, TAPE_LENGTH } from '../../constants';

export class WaveformDisplay {
  // Cached waveform data per track (decimated peaks)
  private waveformData: (Float32Array | null)[] = [null, null, null, null];
  private visibleWindowSamples = SAMPLE_RATE * 10; // 10 seconds visible

  setWaveformData(track: number, data: Float32Array): void {
    this.waveformData[track] = data;
  }

  setVisibleWindow(seconds: number): void {
    this.visibleWindowSamples = SAMPLE_RATE * seconds;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    headPosition: number,
    trackMuted: boolean[],
    armedTrack: number,
    isRecording: boolean
  ): void {
    const numTracks = 4;
    const totalHeight = SIZES.waveformHeight * numTracks + SIZES.waveformGap * (numTracks - 1);
    const startY = SIZES.waveformY;

    // Visible window centered on head position
    const halfWindow = this.visibleWindowSamples / 2;
    const viewStart = headPosition - halfWindow;
    const viewEnd = headPosition + halfWindow;

    for (let t = 0; t < numTracks; t++) {
      const trackY = startY + t * (SIZES.waveformHeight + SIZES.waveformGap);
      const color = COLORS.track[t];
      const dimmed = trackMuted[t];

      // Track background
      ctx.fillStyle = dimmed ? '#0d0d0b' : '#111110';
      ctx.fillRect(20, trackY, w - 40, SIZES.waveformHeight);

      // Track label
      ctx.font = '9px "Space Mono", monospace';
      ctx.fillStyle = dimmed ? COLORS.textSecondary : color;
      ctx.textAlign = 'left';
      ctx.fillText(`T${t + 1}`, 4, trackY + SIZES.waveformHeight / 2 + 3);

      // Armed indicator
      if (t === armedTrack) {
        ctx.fillStyle = isRecording ? COLORS.recordRed : COLORS.phosphorDim;
        ctx.shadowColor = isRecording ? COLORS.recordRed : 'transparent';
        ctx.shadowBlur = isRecording ? 6 : 0;
        ctx.beginPath();
        ctx.arc(15, trackY + SIZES.waveformHeight / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw waveform
      const data = this.waveformData[t];
      if (!data || data.length === 0) continue;

      ctx.strokeStyle = dimmed ? COLORS.textSecondary : color;
      ctx.globalAlpha = dimmed ? 0.3 : 0.8;
      ctx.lineWidth = 1;

      const drawWidth = w - 40;
      const centerY = trackY + SIZES.waveformHeight / 2;
      const halfH = SIZES.waveformHeight / 2 - 2;

      ctx.beginPath();
      for (let px = 0; px < drawWidth; px++) {
        const samplePos = viewStart + (px / drawWidth) * (viewEnd - viewStart);
        const dataIdx = Math.floor((samplePos / TAPE_LENGTH) * data.length);

        let peak = 0;
        if (dataIdx >= 0 && dataIdx < data.length) {
          peak = data[dataIdx];
        }

        const y = centerY - peak * halfH;
        if (px === 0) ctx.moveTo(20 + px, y);
        else ctx.lineTo(20 + px, y);
      }
      // Mirror for bottom half
      for (let px = drawWidth - 1; px >= 0; px--) {
        const samplePos = viewStart + (px / drawWidth) * (viewEnd - viewStart);
        const dataIdx = Math.floor((samplePos / TAPE_LENGTH) * data.length);

        let peak = 0;
        if (dataIdx >= 0 && dataIdx < data.length) {
          peak = data[dataIdx];
        }

        const y = centerY + peak * halfH;
        ctx.lineTo(20 + px, y);
      }
      ctx.closePath();
      ctx.fillStyle = dimmed ? COLORS.textSecondary : color;
      ctx.globalAlpha = dimmed ? 0.1 : 0.15;
      ctx.fill();
      ctx.globalAlpha = dimmed ? 0.3 : 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw tape head position line (center)
    const headX = w / 2;
    ctx.strokeStyle = COLORS.phosphorAmber;
    ctx.shadowColor = COLORS.phosphorAmber;
    ctx.shadowBlur = 4;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX, startY - 4);
    ctx.lineTo(headX, startY + totalHeight + 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Small head triangle
    ctx.fillStyle = COLORS.phosphorAmber;
    ctx.beginPath();
    ctx.moveTo(headX - 4, startY - 4);
    ctx.lineTo(headX + 4, startY - 4);
    ctx.lineTo(headX, startY);
    ctx.closePath();
    ctx.fill();
  }
}
