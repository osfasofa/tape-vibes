export const COLORS = {
  // Hardware body
  body: '#1a1a1a',
  panel: '#2a2520',

  // Display
  displayBg: '#0a0a08',
  phosphorAmber: '#ff6a00',
  phosphorDim: '#994400',
  phosphorGreen: '#00ff41',
  recordRed: '#ff2020',

  // Track colors
  track: ['#ff6a00', '#00ff41', '#40a0ff', '#ff4080'] as const,

  // Text
  textPrimary: '#ddd0c0',
  textSecondary: '#6a6050',

  // Tape
  tapeRibbon: '#2d1810',
  reelMetal: '#4a4a4a',
  reelHighlight: '#6a6a6a',

  // UI
  knobBg: '#333333',
  buttonBg: '#3a3530',
  buttonActive: '#4a4540',
};

export const SIZES = {
  reelRadius: 70,
  reelInnerRadius: 20,
  reelSpacing: 220,
  tapeHeadY: 190,
  waveformHeight: 30,
  waveformY: 250,
  waveformGap: 8,
  positionCounterY: 40,
  transportIndicatorY: 65,
  scanlineOpacity: 0.04,
};

export const FONTS = {
  display: '"Space Mono", "IBM Plex Mono", monospace',
  label: '"Space Mono", "IBM Plex Mono", monospace',
};
