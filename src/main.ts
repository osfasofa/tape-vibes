import { TapeEngine } from './audio/tape-engine';
import { Synthesizer } from './audio/synthesizer';
import { initApp } from './ui/app';

async function boot(): Promise<void> {
  const engine = new TapeEngine();
  const ctx = await engine.init();

  const synth = new Synthesizer(ctx);
  const inputNode = engine.getInputNode();
  if (inputNode) {
    synth.connect(inputNode);
  }

  // Also connect synth directly to destination for monitoring when not recording
  const masterGain = engine.getMasterGain();
  if (masterGain) {
    const monitorGain = ctx.createGain();
    monitorGain.gain.value = 0; // Start muted, enable when in synth mode
    synth.connect(monitorGain);
    monitorGain.connect(ctx.destination);

    // Store for later access
    (window as any).__synthMonitor = monitorGain;
  }

  initApp(engine, synth);

  // Resume audio context on first user interaction
  const resume = () => {
    if (ctx.state === 'suspended') ctx.resume();
    document.removeEventListener('click', resume);
    document.removeEventListener('keydown', resume);
  };
  document.addEventListener('click', resume);
  document.addEventListener('keydown', resume);
}

boot();
