export function applyStereoWidth(
  left: number,
  right: number,
  width: number
): [number, number] {
  const mid = (left + right) * 0.5;
  const side = (left - right) * 0.5 * width;

  return [mid + side, mid - side];
}
