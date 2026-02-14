export interface KnobConfig {
  element: HTMLElement;
  min: number;
  max: number;
  value: number;
  step: number;
  label: string;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

export function createKnob(config: KnobConfig): { setValue: (v: number) => void } {
  const { element, min, max, step, format, onChange } = config;
  let value = config.value;

  const indicator = element.querySelector('.knob-indicator') as HTMLElement;
  const valueDisplay = element.querySelector('.knob-value') as HTMLElement;

  function update(): void {
    const normalized = (value - min) / (max - min);
    const angle = -135 + normalized * 270; // -135 to +135 degrees
    if (indicator) indicator.style.transform = `rotate(${angle}deg)`;
    if (valueDisplay) valueDisplay.textContent = format(value);
  }

  // Mouse drag
  let dragging = false;
  let dragStartY = 0;
  let dragStartValue = 0;

  element.addEventListener('mousedown', (e) => {
    dragging = true;
    dragStartY = e.clientY;
    dragStartValue = value;
    element.classList.add('active');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dy = dragStartY - e.clientY;
    const range = max - min;
    const sensitivity = range / 150;
    value = Math.round(
      Math.max(min, Math.min(max, dragStartValue + dy * sensitivity)) / step
    ) * step;
    update();
    onChange(value);
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      element.classList.remove('active');
    }
  });

  // Scroll wheel
  element.addEventListener('wheel', (e) => {
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    value = Math.round(
      Math.max(min, Math.min(max, value + direction * step)) / step
    ) * step;
    update();
    onChange(value);
  });

  update();

  return {
    setValue(v: number) {
      value = Math.max(min, Math.min(max, v));
      update();
    },
  };
}
