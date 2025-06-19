class TapeProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            {
                name: 'speed',
                defaultValue: 1.0,
                minValue: 0.01,
                maxValue: 4.0,
                automationRate: 'k-rate'
            },
            {
                name: 'flutterAmount',
                defaultValue: 0.01,
                minValue: 0.0,
                maxValue: 0.2,
                automationRate: 'k-rate'
            },
            {
                name: 'flutterRate',
                defaultValue: 6.0,
                minValue: 0.1,
                maxValue: 20.0,
                automationRate: 'k-rate'
            },
            {
                name: 'interpolationType',
                defaultValue: 0, // 0 = linear, 1 = cubic
                minValue: 0,
                maxValue: 1,
                automationRate: 'k-rate'
            },
            {
                name: 'saturation',
                defaultValue: 0.2,
                minValue: 0.0,
                maxValue: 1.0,
                automationRate: 'k-rate'
            },
            {
                name: 'crosstalk',
                defaultValue: 0.05,
                minValue: 0.0,
                maxValue: 0.3,
                automationRate: 'k-rate'
            },
            {
                name: 'stereoWidth',
                defaultValue: 1.0,
                minValue: 0.0,
                maxValue: 2.0,
                automationRate: 'k-rate'
            }
        ];
    }

    constructor() {
        super();
        // Separate phase tracking for each channel
        this.phase = [0, 0];
        this.flutterPhase = [0, 0];
        this.wowPhase = [0, 0];
        
        // Buffer to store input samples for interpolation (per channel)
        this.inputBuffer = [null, null];
        this.bufferSize = 0;
        
        // Tape stop effect state
        this.tapeStopActive = false;
        this.tapeStopStartTime = 0;
        this.tapeStopDuration = 3.0; // seconds
        
        // Stereo tape effects
        this.channelDelay = [0, 0.03]; // Very slight timing difference (0.05ms)
        this.crosstalk = 0.02; // 2% channel crosstalk
        
        // Listen for tape stop messages
        this.port.onmessage = (event) => {
            if (event.data.type === 'tapeStop') {
                this.tapeStopActive = true;
                this.tapeStopStartTime = currentTime;
            }
        };
    }

    // Linear interpolation between two samples
    linearInterpolate(a, b, frac) {
        return a * (1 - frac) + b * frac;
    }

    // Cubic (Hermite) interpolation for smoother results with better quality
    cubicInterpolate(y0, y1, y2, y3, frac) {
        // Catmull-Rom spline interpolation for better quality
        const c0 = y1;
        const c1 = 0.5 * (y2 - y0);
        const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
        const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

        return c0 + c1 * frac + c2 * frac * frac + c3 * frac * frac * frac;
    }

    // Tape saturation simulation (soft clipping)
    tapeSaturation(sample, amount) {
        if (amount === 0) return sample;
        
        const drive = 1 + amount * 4;
        const driven = sample * drive;
        
        // Soft clipping curve
        if (driven > 1) {
            return 1 - Math.exp(-(driven - 1));
        } else if (driven < -1) {
            return -1 + Math.exp(driven + 1);
        }
        return driven;
    }

    getSample(index, interpolationType, channel) {
        if (this.bufferSize === 0 || !this.inputBuffer[channel]) return 0;
        
        // Ensure index is positive and within bounds
        index = ((index % this.bufferSize) + this.bufferSize) % this.bufferSize;
        
        const buffer = this.inputBuffer[channel];
        
        if (interpolationType === 0) {
            // Linear interpolation
            const indexA = Math.floor(index);
            const indexB = (indexA + 1) % this.bufferSize;
            const frac = index - indexA;
            
            const sampleA = buffer[indexA];
            const sampleB = buffer[indexB];
            
            // Safety check for valid samples
            if (isNaN(sampleA) || isNaN(sampleB)) return 0;
            
            return this.linearInterpolate(sampleA, sampleB, frac);
        } else {
            // Cubic interpolation with proper boundary handling
            const indexFloor = Math.floor(index);
            const frac = index - indexFloor;
            
            const idx0 = (indexFloor - 1 + this.bufferSize) % this.bufferSize;
            const idx1 = indexFloor % this.bufferSize;
            const idx2 = (indexFloor + 1) % this.bufferSize;
            const idx3 = (indexFloor + 2) % this.bufferSize;
            
            const y0 = buffer[idx0];
            const y1 = buffer[idx1];
            const y2 = buffer[idx2];
            const y3 = buffer[idx3];
            
            // Safety check for valid samples
            if (isNaN(y0) || isNaN(y1) || isNaN(y2) || isNaN(y3)) return 0;
            
            return this.cubicInterpolate(y0, y1, y2, y3, frac);
        }
    }

    process(inputs, outputs, parameters) {

        const input = inputs[0];
        const output = outputs[0];
        
        // Determine number of channels (mono or stereo)
        const numChannels = Math.max(input ? input.length : 0, output ? output.length : 0);
        const channels = Math.min(numChannels, 2); // Support up to 2 channels
        
        if (!input || input.length === 0 || !input[0]) {
            // Fill with silence if no input
            for (let ch = 0; ch < channels; ch++) {
                if (output && output[ch]) {
                    output[ch].fill(0);
                }
            }
            return true;
        }
        
        // Update input buffers for each channel
        for (let ch = 0; ch < channels; ch++) {
            const inputChannel = input[ch] || input[0]; // Fallback to mono if needed
            
            if (!this.inputBuffer[ch] || this.inputBuffer[ch].length !== inputChannel.length) {
                this.inputBuffer[ch] = new Float32Array(inputChannel.length);
            }
            
            // Copy input to our buffer
            for (let i = 0; i < inputChannel.length; i++) {
                this.inputBuffer[ch][i] = inputChannel[i] || 0;
            }
        }
        
        this.bufferSize = input[0].length;
        const blockSize = output[0].length;
        const speed = Math.max(0.01, parameters.speed[0]);
        const flutterAmount = parameters.flutterAmount[0];
        const flutterRate = Math.max(0.1, parameters.flutterRate[0]);
        const interpolationType = Math.round(parameters.interpolationType[0]);
        const saturation = Math.max(0, Math.min(1, parameters.saturation[0]));
        const crosstalk = Math.max(0, Math.min(0.3, parameters.crosstalk[0]));
        const stereoWidth = Math.max(0, Math.min(2, parameters.stereoWidth[0]));
        
        for (let i = 0; i < blockSize; i++) {
            let currentSpeed = speed;
            
            // Handle tape stop effect
            if (this.tapeStopActive) {
                const elapsed = currentTime - this.tapeStopStartTime;
                if (elapsed < this.tapeStopDuration) {
                    const progress = elapsed / this.tapeStopDuration;
                    currentSpeed = speed * Math.exp(-progress * 6);
                    if (currentSpeed < 0.001) currentSpeed = 0.001;
                } else {
                    this.tapeStopActive = false;
                    currentSpeed = 0.001;
                }
            }
            
            // Process each channel with slight variations for realism
            const channelSamples = [];
            
            for (let ch = 0; ch < channels; ch++) {
                // Slightly different flutter per channel for stereo width
                const flutterOffset = 0;//ch * 0.1; // Small phase offset
                const flutter = flutterAmount * Math.sin(this.flutterPhase[ch] + flutterOffset);
                const wow = flutterAmount * 0.3 * Math.sin(this.wowPhase[ch] + flutterOffset);
                
                this.flutterPhase[ch] += 2 * Math.PI * flutterRate / sampleRate;
                this.wowPhase[ch] += 2 * Math.PI * (1.2 + ch * 0.1) / sampleRate; // Slightly different wow rates
                
                // Wrap phases
                if (this.flutterPhase[ch] > 2 * Math.PI) this.flutterPhase[ch] -= 2 * Math.PI;
                if (this.wowPhase[ch] > 2 * Math.PI) this.wowPhase[ch] -= 2 * Math.PI;
                
                // Apply speed modulation
                const finalSpeed = Math.max(0.001, Math.min(4.0, currentSpeed + flutter + wow));
                
                // Add small channel delay (tape head alignment imperfection)
                const delayOffset = this.channelDelay[ch] * sampleRate * finalSpeed;
                const delayedPhase = this.phase[ch] - delayOffset;
                
                // Get interpolated sample
                let sample = this.getSample(delayedPhase, interpolationType, ch);
                
                // Safety check
                if (!isFinite(sample)) sample = 0;
                
                // Apply tape saturation
                sample = this.tapeSaturation(sample, saturation);
                
                // Store for crosstalk calculations
                channelSamples[ch] = sample;
                
                // Advance phase
                this.phase[ch] += finalSpeed;
                this.phase[ch] = this.phase[ch] % this.bufferSize;
            }
            
            // Apply stereo processing
            let processedSamples = [...channelSamples];
            
            // First apply stereo width (Mid/Side processing)
            if (channels === 2) {
                const left = channelSamples[0];
                const right = channelSamples[1];
                const mid = (left + right) * 0.5;
                const side = (left - right) * 0.5 * stereoWidth;
                
                processedSamples[0] = mid + side; // Left
                processedSamples[1] = mid - side; // Right
            }
            
            // Then apply channel crosstalk
            for (let ch = 0; ch < channels; ch++) {
                let finalSample = processedSamples[ch];
                
                // Add subtle crosstalk from other channel(s)
                if (channels === 2) {
                    const otherChannel = 1 - ch;
                    finalSample += processedSamples[otherChannel] * crosstalk * 0.5; // Reduce crosstalk intensity
                }
                
                // Final safety clamp
                finalSample = Math.max(-1, Math.min(1, finalSample));
                
                if (output[ch]) {
                    output[ch][i] = finalSample;
                }
            }
        }
        
        return true;
    }
}

registerProcessor('tape-processor', TapeProcessor); 