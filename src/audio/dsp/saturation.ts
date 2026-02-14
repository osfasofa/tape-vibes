export function tapeSaturation(sample: number, amount: number): number {
  if (amount === 0) return sample;

  const drive = 1 + amount * 4;
  const driven = sample * drive;

  if (driven > 1) {
    return 1 - Math.exp(-(driven - 1));
  } else if (driven < -1) {
    return -1 + Math.exp(driven + 1);
  }
  return driven;
}
