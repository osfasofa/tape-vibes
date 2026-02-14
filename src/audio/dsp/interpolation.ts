export function linearInterpolate(a: number, b: number, frac: number): number {
  return a * (1 - frac) + b * frac;
}

export function cubicInterpolate(
  y0: number,
  y1: number,
  y2: number,
  y3: number,
  frac: number
): number {
  const c0 = y1;
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

  return c0 + c1 * frac + c2 * frac * frac + c3 * frac * frac * frac;
}
