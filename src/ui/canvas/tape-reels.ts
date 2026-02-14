import { COLORS, SIZES } from './theme';

export class TapeReels {
  private angle = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, speed: number, headPosition: number, tapeLength: number): void {
    const leftX = w / 2 - SIZES.reelSpacing / 2;
    const rightX = w / 2 + SIZES.reelSpacing / 2;
    const y = 130;

    // Update rotation based on speed
    this.angle += speed * 0.03;

    // Tape progress (0-1)
    const progress = headPosition / tapeLength;

    // Left reel gets smaller as tape plays, right reel gets bigger
    const leftRadius = SIZES.reelRadius * (1 - progress * 0.4);
    const rightRadius = SIZES.reelRadius * (0.6 + progress * 0.4);

    this.drawReel(ctx, leftX, y, leftRadius, this.angle);
    this.drawReel(ctx, rightX, y, rightRadius, -this.angle);

    // Draw tape ribbon between reels
    this.drawTapeRibbon(ctx, leftX, rightX, y, leftRadius, rightRadius);
  }

  private drawReel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    radius: number, angle: number
  ): void {
    ctx.save();
    ctx.translate(x, y);

    // Outer ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      -radius * 0.2, -radius * 0.2, 0,
      0, 0, radius
    );
    gradient.addColorStop(0, COLORS.reelHighlight);
    gradient.addColorStop(0.7, COLORS.reelMetal);
    gradient.addColorStop(1, '#333');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Reel ring border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner hub
    ctx.beginPath();
    ctx.arc(0, 0, SIZES.reelInnerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Spokes (3 spokes, rotating)
    ctx.rotate(angle);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.moveTo(0, SIZES.reelInnerRadius);
      ctx.lineTo(-6, radius - 5);
      ctx.lineTo(6, radius - 5);
      ctx.closePath();
      ctx.fillStyle = '#3a3a3a';
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    }

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#666';
    ctx.fill();

    ctx.restore();
  }

  private drawTapeRibbon(
    ctx: CanvasRenderingContext2D,
    leftX: number, rightX: number,
    y: number,
    leftR: number, rightR: number
  ): void {
    const headY = SIZES.tapeHeadY;

    ctx.strokeStyle = COLORS.tapeRibbon;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Left reel to tape head
    ctx.beginPath();
    ctx.moveTo(leftX + leftR, y);
    ctx.quadraticCurveTo(leftX + leftR + 20, headY - 10, (leftX + rightX) / 2 - 30, headY);
    ctx.stroke();

    // Tape head to right reel
    ctx.beginPath();
    ctx.moveTo((leftX + rightX) / 2 + 30, headY);
    ctx.quadraticCurveTo(rightX - rightR - 20, headY - 10, rightX - rightR, y);
    ctx.stroke();

    // Tape head (metallic vertical bar)
    const headX = (leftX + rightX) / 2;
    ctx.fillStyle = '#666';
    ctx.fillRect(headX - 15, headY - 8, 30, 16);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(headX - 15, headY - 8, 30, 16);

    // Tape head gap (the recording/playback gap)
    ctx.fillStyle = COLORS.phosphorAmber;
    ctx.shadowColor = COLORS.phosphorAmber;
    ctx.shadowBlur = 6;
    ctx.fillRect(headX - 1, headY - 6, 2, 12);
    ctx.shadowBlur = 0;
  }
}
