import { COLORS, SIZES, FONTS } from './theme';
import { SAMPLE_RATE } from '../../constants';
import type { TransportState } from '../../types';

export class TransportDisplay {
  private blinkOn = true;
  private lastBlink = 0;

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    headPosition: number,
    state: TransportState,
    speed: number
  ): void {
    // Position counter (MM:SS.ms)
    const totalSeconds = headPosition / SAMPLE_RATE;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 100);

    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

    ctx.font = `bold 28px ${FONTS.display}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.phosphorAmber;
    ctx.shadowColor = COLORS.phosphorAmber;
    ctx.shadowBlur = 10;
    ctx.fillText(timeStr, w / 2, SIZES.positionCounterY);
    ctx.shadowBlur = 0;

    // Transport state indicator
    const now = performance.now();
    if (now - this.lastBlink > 500) {
      this.blinkOn = !this.blinkOn;
      this.lastBlink = now;
    }

    ctx.font = `bold 12px ${FONTS.display}`;
    ctx.textAlign = 'center';

    let stateLabel = '';
    let stateColor = COLORS.phosphorGreen;

    switch (state) {
      case 'playing':
        stateLabel = 'PLAY';
        stateColor = COLORS.phosphorGreen;
        break;
      case 'recording':
        stateLabel = 'REC';
        stateColor = COLORS.recordRed;
        if (!this.blinkOn) stateColor = '#440000';
        break;
      case 'stopped':
        stateLabel = 'STOP';
        stateColor = COLORS.phosphorDim;
        break;
      case 'tape_stopping':
        stateLabel = 'STOPPING';
        stateColor = COLORS.phosphorDim;
        break;
      case 'rewinding':
        stateLabel = 'REW';
        stateColor = COLORS.phosphorAmber;
        break;
      case 'fast_forward':
        stateLabel = 'FF';
        stateColor = COLORS.phosphorAmber;
        break;
    }

    ctx.fillStyle = stateColor;
    ctx.shadowColor = stateColor;
    ctx.shadowBlur = 6;
    ctx.fillText(stateLabel, w / 2 - 60, SIZES.transportIndicatorY);
    ctx.shadowBlur = 0;

    // Speed display
    ctx.font = `11px ${FONTS.display}`;
    ctx.fillStyle = COLORS.phosphorDim;
    ctx.fillText(`SPD ${speed.toFixed(2)}x`, w / 2 + 60, SIZES.transportIndicatorY);
  }
}
