// Synthesizer class for generating audio
class Synthesizer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.voices = new Map(); // Track active voices
        this.masterGain = audioContext.createGain();
        this.filter = audioContext.createBiquadFilter();
        
        // Setup filter
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 2000;
        this.filter.Q.value = 5;
        
        // Audio chain: voices -> filter -> master gain
        this.filter.connect(this.masterGain);
        this.masterGain.gain.value = 0.3;
        
        // ADSR parameters
        this.envelope = {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.6,
            release: 0.8
        };
        
        this.waveform = 'sawtooth';
    }
    
    connect(destination) {
        this.masterGain.connect(destination);
    }
    
    disconnect() {
        this.masterGain.disconnect();
    }
    
    noteOn(frequency, noteId = frequency) {
        // Don't play the same note twice
        if (this.voices.has(noteId)) {
            this.noteOff(noteId);
        }
        
        const now = this.audioContext.currentTime;
        
        // Create oscillator
        const osc = this.audioContext.createOscillator();
        osc.type = this.waveform;
        osc.frequency.value = frequency;
        
        // Create gain envelope
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0;
        
        // Connect: osc -> gain -> filter
        osc.connect(gainNode);
        gainNode.connect(this.filter);
        
        // ADSR envelope
        const { attack, decay, sustain } = this.envelope;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.8, now + attack);
        gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);
        
        // Start oscillator
        osc.start(now);
        
        // Store voice
        this.voices.set(noteId, { osc, gainNode, frequency });
    }
    
    noteOff(noteId) {
        const voice = this.voices.get(noteId);
        if (!voice) return;
        
        const now = this.audioContext.currentTime;
        const { osc, gainNode } = voice;
        
        // Release envelope
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + this.envelope.release);
        
        // Stop oscillator after release
        osc.stop(now + this.envelope.release + 0.1);
        
        // Clean up
        setTimeout(() => {
            this.voices.delete(noteId);
        }, (this.envelope.release + 0.1) * 1000);
    }
    
    updateParameter(param, value) {
        switch (param) {
            case 'waveform':
                this.waveform = value;
                break;
            case 'attack':
            case 'decay':
            case 'sustain':
            case 'release':
                this.envelope[param] = value;
                break;
            case 'cutoff':
                this.filter.frequency.value = value;
                break;
            case 'resonance':
                this.filter.Q.value = value;
                break;
        }
    }
    
    panic() {
        // Stop all voices immediately
        this.voices.forEach((voice, noteId) => {
            voice.osc.stop();
            this.voices.delete(noteId);
        });
    }
}

class TapeSpeedSimulator {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.sourceNode = null;
        this.tapeNode = null;
        this.isPlaying = false;
        this.synthesizer = null;
        this.synthMode = false;
        this.keyMap = {}; // For computer keyboard mapping
        
        this.setupUI();
        this.setupAudioContext();
    }

    async setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await this.audioContext.audioWorklet.addModule('./tape-processor.js');
            
            // Create synthesizer
            this.synthesizer = new Synthesizer(this.audioContext);
            
            // Display audio context info
            const sampleRate = this.audioContext.sampleRate;
            const baseLatency = this.audioContext.baseLatency || 'unknown';
            
            this.updateStatus(`Audio ready: ${sampleRate}Hz sample rate, ${baseLatency}s latency`);
            this.setupKeyboard();
        } catch (error) {
            this.updateStatus('Error setting up audio: ' + error.message);
        }
    }

    setupUI() {
        // File input
        document.getElementById('audioFile').addEventListener('change', (e) => {
            this.loadAudioFile(e.target.files[0]);
        });

        document.getElementById('loadDemo').addEventListener('click', () => {
            this.generateDemoAudio();
        });

        // Playback controls
        document.getElementById('play').addEventListener('click', () => {
            this.play();
        });

        document.getElementById('stop').addEventListener('click', () => {
            this.stop();
        });

        document.getElementById('tapeStop').addEventListener('click', () => {
            this.tapeStopEffect();
        });

        document.getElementById('synthMode').addEventListener('click', () => {
            this.toggleSynthMode();
        });

        // Parameter controls
        this.setupSlider('speed', (value) => {
            if (this.tapeNode) {
                this.tapeNode.parameters.get('speed').value = value;
            }
        }, (value) => `${value.toFixed(2)}x`);

        this.setupSlider('flutter', (value) => {
            if (this.tapeNode) {
                this.tapeNode.parameters.get('flutterAmount').value = value;
            }
        }, (value) => `${(value * 100).toFixed(1)}%`);

        this.setupSlider('flutterRate', (value) => {
            if (this.tapeNode) {
                this.tapeNode.parameters.get('flutterRate').value = value;
            }
        }, (value) => `${value.toFixed(1)} Hz`);

        this.setupSlider('saturation', (value) => {
            if (this.tapeNode) {
                this.tapeNode.parameters.get('saturation').value = value;
            }
        }, (value) => `${(value * 100).toFixed(0)}%`);

        this.setupSlider('crosstalk', (value) => {
            if (this.tapeNode) {
                this.tapeNode.parameters.get('crosstalk').value = value;
            }
        }, (value) => `${(value * 100).toFixed(0)}%`);

        this.setupSlider('stereoWidth', (value) => {
            if (this.tapeNode) {
                this.tapeNode.parameters.get('stereoWidth').value = value;
            }
        }, (value) => `${(value * 100).toFixed(0)}%`);

        // Interpolation selector
        document.getElementById('interpolation').addEventListener('change', (e) => {
            if (this.tapeNode) {
                const value = e.target.value === 'cubic' ? 1 : 0;
                this.tapeNode.parameters.get('interpolationType').value = value;
            }
        });

        // Synthesizer controls
        this.setupSynthControls();
    }

    setupSlider(id, callback, formatter) {
        const slider = document.getElementById(id);
        const display = document.getElementById(id + 'Value');
        
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            callback(value);
            display.textContent = formatter(value);
        });

        // Initialize display
        display.textContent = formatter(parseFloat(slider.value));
    }

    async loadAudioFile(file) {
        if (!file) return;
        
        this.updateStatus('Loading audio file...');
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.updateStatus(`Loaded: ${file.name} (${this.audioBuffer.duration.toFixed(1)}s)`);
            this.enableControls(true);
        } catch (error) {
            this.updateStatus('Error loading audio: ' + error.message);
        }
    }

    generateDemoAudio() {
        this.updateStatus('Generating high-quality stereo demo...');
        
        const sampleRate = this.audioContext.sampleRate;
        const duration = 8; // 8 seconds for more content
        const length = sampleRate * duration;
        
        // Create stereo buffer
        this.audioBuffer = this.audioContext.createBuffer(2, length, sampleRate);
        const leftChannel = this.audioBuffer.getChannelData(0);
        const rightChannel = this.audioBuffer.getChannelData(1);
        
        // Generate high-quality stereo content
        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            
            // Musical progression: A minor chord sequence
            const chordPhase = Math.floor(time / 2) % 4; // Change chord every 2 seconds
            const chords = [
                [220, 261.63, 329.63],    // A minor (A3, C4, E4)
                [246.94, 293.66, 369.99], // B diminished (B3, D4, F4) 
                [261.63, 329.63, 392.00], // C major (C4, E4, G4)
                [293.66, 369.99, 440.00]  // D minor (D4, F4, A4)
            ];
            
            const currentChord = chords[chordPhase];
            
            // Left channel: Rich harmonic content
            let leftSample = 0;
            currentChord.forEach((freq, idx) => {
                const fundamental = Math.sin(2 * Math.PI * freq * time);
                const harmonic2 = Math.sin(2 * Math.PI * freq * 2 * time) * 0.3;
                const harmonic3 = Math.sin(2 * Math.PI * freq * 3 * time) * 0.15;
                
                leftSample += (fundamental + harmonic2 + harmonic3) * (0.4 - idx * 0.1);
            });
            
            // Right channel: Melody line with different harmonics
            let rightSample = 0;
            const melodyFreqs = [440, 493.88, 523.25, 587.33]; // A4, B4, C5, D5
            const melodyIdx = Math.floor((time * 2) % 4);
            const melodyFreq = melodyFreqs[melodyIdx];
            
            rightSample += Math.sin(2 * Math.PI * melodyFreq * time) * 0.4;
            rightSample += Math.sin(2 * Math.PI * melodyFreq * 1.5 * time) * 0.2; // Harmonic
            rightSample += Math.sin(2 * Math.PI * melodyFreq * 0.5 * time) * 0.1; // Sub-harmonic
            
            // Add some high-frequency content for clarity
            const highFreq = 2000 + Math.sin(2 * Math.PI * 0.5 * time) * 500;
            rightSample += Math.sin(2 * Math.PI * highFreq * time) * 0.05;
            
            // Smooth envelopes
            const noteTime = (time % 2);
            const noteEnvelope = Math.exp(-noteTime * 1.5) * (1 - Math.exp(-noteTime * 20));
            const masterEnvelope = 1 - Math.exp(-time * 0.5); // Fade in
            
            // Stereo positioning with subtle movement
            const stereoLFO = Math.sin(2 * Math.PI * 0.1 * time) * 0.2;
            
            leftChannel[i] = leftSample * noteEnvelope * masterEnvelope * (0.8 + stereoLFO);
            rightChannel[i] = rightSample * noteEnvelope * masterEnvelope * (0.8 - stereoLFO);
            
            // Add some reverb-like ambience
            if (i > sampleRate * 0.1) { // After 100ms
                const delayIdx = Math.floor(i - sampleRate * 0.08); // 80ms delay
                leftChannel[i] += leftChannel[delayIdx] * 0.15;
                rightChannel[i] += rightChannel[delayIdx] * 0.15;
            }
        }
        
        this.updateStatus(`HiFi demo generated: ${sampleRate}Hz, 8s chord progression`);
        this.enableControls(true);
    }

    async play() {
        if (!this.audioBuffer) return;
        
        if (this.isPlaying) {
            this.stop();
        }
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create source node
            this.sourceNode = this.audioContext.createBufferSource();
            this.sourceNode.buffer = this.audioBuffer;
            this.sourceNode.loop = true;
            
            // Create tape processor node
            this.tapeNode = new AudioWorkletNode(this.audioContext, 'tape-processor');
            
            // Set initial parameters
            const speedSlider = document.getElementById('speed');
            const flutterSlider = document.getElementById('flutter');
            const flutterRateSlider = document.getElementById('flutterRate');
            const saturationSlider = document.getElementById('saturation');
            const crosstalkSlider = document.getElementById('crosstalk');
            const stereoWidthSlider = document.getElementById('stereoWidth');
            const interpolationSelect = document.getElementById('interpolation');
            
            this.tapeNode.parameters.get('speed').value = parseFloat(speedSlider.value);
            this.tapeNode.parameters.get('flutterAmount').value = parseFloat(flutterSlider.value);
            this.tapeNode.parameters.get('flutterRate').value = parseFloat(flutterRateSlider.value);
            this.tapeNode.parameters.get('saturation').value = parseFloat(saturationSlider.value);
            this.tapeNode.parameters.get('crosstalk').value = parseFloat(crosstalkSlider.value);
            this.tapeNode.parameters.get('stereoWidth').value = parseFloat(stereoWidthSlider.value);
            this.tapeNode.parameters.get('interpolationType').value = interpolationSelect.value === 'cubic' ? 1 : 0;
            
            // Connect audio graph
            this.sourceNode.connect(this.tapeNode);
            this.tapeNode.connect(this.audioContext.destination);
            
            // Start playback
            this.sourceNode.start();
            this.isPlaying = true;
            
            this.updatePlayButton();
            this.updateStatus('Playing with tape effect...');
            
        } catch (error) {
            this.updateStatus('Error playing audio: ' + error.message);
        }
    }

    stop() {
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        
        if (this.tapeNode) {
            this.tapeNode.disconnect();
            this.tapeNode = null;
        }
        
        this.isPlaying = false;
        this.updatePlayButton();
        this.updateStatus('Stopped');
    }

    tapeStopEffect() {
        if (this.tapeNode && this.isPlaying) {
            this.tapeNode.port.postMessage({ type: 'tapeStop' });
            this.updateStatus('Tape stop effect activated...');
        }
    }

    updatePlayButton() {
        const playButton = document.getElementById('play');
        const stopButton = document.getElementById('stop');
        const tapeStopButton = document.getElementById('tapeStop');
        
        playButton.disabled = this.isPlaying;
        stopButton.disabled = !this.isPlaying;
        tapeStopButton.disabled = !this.isPlaying;
    }

    enableControls(enabled) {
        document.getElementById('play').disabled = !enabled;
        document.getElementById('synthMode').disabled = !enabled;
        this.updatePlayButton();
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }

    setupSynthControls() {
        // Waveform selector
        document.getElementById('waveform').addEventListener('change', (e) => {
            if (this.synthesizer) {
                this.synthesizer.updateParameter('waveform', e.target.value);
            }
        });

        // ADSR controls
        this.setupSlider('attack', (value) => {
            if (this.synthesizer) {
                this.synthesizer.updateParameter('attack', value);
            }
        }, (value) => `${value.toFixed(2)}s`);

        this.setupSlider('decay', (value) => {
            if (this.synthesizer) {
                this.synthesizer.updateParameter('decay', value);
            }
        }, (value) => `${value.toFixed(2)}s`);

        this.setupSlider('sustain', (value) => {
            if (this.synthesizer) {
                this.synthesizer.updateParameter('sustain', value);
            }
        }, (value) => `${(value * 100).toFixed(0)}%`);

        this.setupSlider('release', (value) => {
            if (this.synthesizer) {
                this.synthesizer.updateParameter('release', value);
            }
        }, (value) => `${value.toFixed(2)}s`);

        // Filter controls
        this.setupSlider('cutoff', (value) => {
            if (this.synthesizer) {
                this.synthesizer.updateParameter('cutoff', value);
            }
        }, (value) => `${value}Hz`);

        this.setupSlider('resonance', (value) => {
            if (this.synthesizer) {
                this.synthesizer.updateParameter('resonance', value);
            }
        }, (value) => `${value}`);
    }

    setupKeyboard() {
        const keyboard = document.getElementById('keyboard');
        
        // Piano layout: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const blackKeys = ['C#', 'D#', 'F#', 'G#', 'A#'];
        
        // Computer keyboard mapping
        const keyMapping = {
            'KeyQ': 'C3', 'Digit2': 'C#3', 'KeyW': 'D3', 'Digit3': 'D#3', 'KeyE': 'E3',
            'KeyR': 'F3', 'Digit5': 'F#3', 'KeyT': 'G3', 'Digit6': 'G#3', 'KeyY': 'A3', 'Digit7': 'A#3', 'KeyU': 'B3',
            'KeyI': 'C4', 'Digit9': 'C#4', 'KeyO': 'D4', 'Digit0': 'D#4', 'KeyP': 'E4',
            'KeyZ': 'C4', 'KeyS': 'C#4', 'KeyX': 'D4', 'KeyD': 'D#4', 'KeyC': 'E4',
            'KeyV': 'F4', 'KeyG': 'F#4', 'KeyB': 'G4', 'KeyH': 'G#4', 'KeyN': 'A4', 'KeyJ': 'A#4', 'KeyM': 'B4'
        };

        this.keyMap = keyMapping;

        // Generate keyboard for 3 octaves (C3 to B5)
        for (let octave = 3; octave <= 5; octave++) {
            // Create white keys first
            whiteKeys.forEach(note => {
                const noteId = `${note}${octave}`;
                const frequency = this.noteToFrequency(noteId);
                const key = this.createKey(noteId, frequency, 'white');
                keyboard.appendChild(key);
            });
        }

        // Add black keys over white keys
        for (let octave = 3; octave <= 5; octave++) {
            const whiteKeyElements = [...keyboard.querySelectorAll('.key.white')];
            const octaveStart = (octave - 3) * 7; // 7 white keys per octave
            
            blackKeys.forEach((note, idx) => {
                const noteId = `${note}${octave}`;
                const frequency = this.noteToFrequency(noteId);
                const key = this.createKey(noteId, frequency, 'black');
                
                // Position black keys relative to white keys
                const positions = [0.5, 1.5, 3.5, 4.5, 5.5]; // Between white keys
                const whiteKeyIndex = octaveStart + positions[idx];
                
                if (whiteKeyElements[whiteKeyIndex]) {
                    key.style.position = 'absolute';
                    key.style.left = `${whiteKeyElements[whiteKeyIndex].offsetLeft + 27}px`;
                    keyboard.appendChild(key);
                }
            });
        }

        // Add computer keyboard support
        document.addEventListener('keydown', (e) => {
            if (this.synthMode && this.keyMap[e.code] && !e.repeat) {
                const noteId = this.keyMap[e.code];
                const frequency = this.noteToFrequency(noteId);
                this.playNote(noteId, frequency);
                this.highlightKey(noteId, true);
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (this.synthMode && this.keyMap[e.code]) {
                const noteId = this.keyMap[e.code];
                this.stopNote(noteId);
                this.highlightKey(noteId, false);
                e.preventDefault();
            }
        });
    }

    createKey(noteId, frequency, type) {
        const key = document.createElement('div');
        key.className = `key ${type}`;
        key.dataset.note = noteId;
        key.dataset.frequency = frequency;

        // Add note label
        const label = document.createElement('div');
        label.className = 'key-label';
        label.textContent = noteId;
        key.appendChild(label);

        // Mouse events
        key.addEventListener('mousedown', (e) => {
            if (this.synthMode) {
                this.playNote(noteId, frequency);
                this.highlightKey(noteId, true);
                e.preventDefault();
            }
        });

        key.addEventListener('mouseup', () => {
            if (this.synthMode) {
                this.stopNote(noteId);
                this.highlightKey(noteId, false);
            }
        });

        key.addEventListener('mouseleave', () => {
            if (this.synthMode) {
                this.stopNote(noteId);
                this.highlightKey(noteId, false);
            }
        });

        // Touch events for mobile
        key.addEventListener('touchstart', (e) => {
            if (this.synthMode) {
                this.playNote(noteId, frequency);
                this.highlightKey(noteId, true);
                e.preventDefault();
            }
        });

        key.addEventListener('touchend', () => {
            if (this.synthMode) {
                this.stopNote(noteId);
                this.highlightKey(noteId, false);
            }
        });

        return key;
    }

    noteToFrequency(note) {
        // Convert note name to frequency (A4 = 440Hz)
        const noteMap = {
            'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4,
            'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2
        };
        
        const noteName = note.slice(0, -1);
        const octave = parseInt(note.slice(-1));
        
        const semitones = noteMap[noteName] + (octave - 4) * 12;
        return 440 * Math.pow(2, semitones / 12);
    }

    playNote(noteId, frequency) {
        if (this.synthesizer) {
            this.synthesizer.noteOn(frequency, noteId);
        }
    }

    stopNote(noteId) {
        if (this.synthesizer) {
            this.synthesizer.noteOff(noteId);
        }
    }

    highlightKey(noteId, pressed) {
        const key = document.querySelector(`[data-note="${noteId}"]`);
        if (key) {
            if (pressed) {
                key.classList.add('pressed');
            } else {
                key.classList.remove('pressed');
            }
        }
    }

    toggleSynthMode() {
        this.synthMode = !this.synthMode;
        const synthControls = document.getElementById('synthControls');
        const keyboardContainer = document.getElementById('keyboardContainer');
        const synthButton = document.getElementById('synthMode');
        
        if (this.synthMode) {
            // Stop any playing audio
            if (this.isPlaying) {
                this.stop();
            }
            
            // Show synth interface
            synthControls.style.display = 'block';
            keyboardContainer.style.display = 'block';
            synthButton.textContent = '🎵 Audio Mode';
            
            // Connect synthesizer to tape processor
            this.setupSynthAudio();
            
            this.updateStatus('Synthesizer mode active - Play the keyboard!');
        } else {
            // Hide synth interface
            synthControls.style.display = 'none';
            keyboardContainer.style.display = 'none';
            synthButton.textContent = '🎹 Synth Mode';
            
            // Disconnect synthesizer
            if (this.synthesizer) {
                this.synthesizer.panic();
                this.synthesizer.disconnect();
            }
            
            this.updateStatus('Audio file mode active');
        }
    }

    async setupSynthAudio() {
        if (!this.synthesizer || !this.audioContext) return;
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create tape processor node
            this.tapeNode = new AudioWorkletNode(this.audioContext, 'tape-processor');
            
            // Set current tape parameters
            this.setTapeParameters();
            
            // Connect synthesizer -> tape processor -> destination
            this.synthesizer.connect(this.tapeNode);
            this.tapeNode.connect(this.audioContext.destination);
            
        } catch (error) {
            this.updateStatus('Error setting up synth audio: ' + error.message);
        }
    }

    setTapeParameters() {
        if (!this.tapeNode) return;
        
        const speedSlider = document.getElementById('speed');
        const flutterSlider = document.getElementById('flutter');
        const flutterRateSlider = document.getElementById('flutterRate');
        const saturationSlider = document.getElementById('saturation');
        const crosstalkSlider = document.getElementById('crosstalk');
        const stereoWidthSlider = document.getElementById('stereoWidth');
        const interpolationSelect = document.getElementById('interpolation');
        
        this.tapeNode.parameters.get('speed').value = parseFloat(speedSlider.value);
        this.tapeNode.parameters.get('flutterAmount').value = parseFloat(flutterSlider.value);
        this.tapeNode.parameters.get('flutterRate').value = parseFloat(flutterRateSlider.value);
        this.tapeNode.parameters.get('saturation').value = parseFloat(saturationSlider.value);
        this.tapeNode.parameters.get('crosstalk').value = parseFloat(crosstalkSlider.value);
        this.tapeNode.parameters.get('stereoWidth').value = parseFloat(stereoWidthSlider.value);
        this.tapeNode.parameters.get('interpolationType').value = interpolationSelect.value === 'cubic' ? 1 : 0;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TapeSpeedSimulator();
}); 