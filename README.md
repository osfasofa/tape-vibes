# 🎵 Tape Speed Effect Simulator

A real-time audio processor that simulates vintage tape machine effects including speed changes, wow & flutter, tape saturation, and classic tape stop effects. Features both audio file processing and a built-in synthesizer with visual keyboard.

## ✨ Features

### 🎛️ Tape Effects
- **Variable Speed Control** (0.01x - 4.0x playback speed)
- **Wow & Flutter** simulation with adjustable rate and depth
- **Tape Saturation** for authentic analog warmth
- **Tape Stop Effect** - classic tape machine power-down sound
- **Stereo Effects** with channel crosstalk and width control
- **High-Quality Interpolation** (Linear and Cubic options)

### 🎹 Built-in Synthesizer
- **Virtual Keyboard** with realistic 3D styling
- **Multiple Waveforms** (Sawtooth, Square, Sine, Triangle)
- **ADSR Envelope** control (Attack, Decay, Sustain, Release)
- **Low-pass Filter** with cutoff and resonance
- **Computer Keyboard Support** for playing notes

### 🎵 Audio Processing
- **File Upload Support** (WAV, MP3, etc.)
- **Demo Audio Generator** with customizable parameters
- **Real-time Processing** using Web Audio API
- **Low-latency AudioWorklet** processing

## 🚀 Quick Start

### Online Usage
1. Open `index.html` in a modern web browser
2. **For Audio Files:**
   - Click "Choose File" and select an audio file
   - Adjust tape parameters using the sliders
   - Hit "Play" to hear the processed audio
3. **For Synthesizer:**
   - Click "Toggle Synth Mode"
   - Use the on-screen keyboard or your computer keyboard
   - Adjust synth and tape parameters in real-time

### Computer Keyboard Mapping
```
Keys: A S D F G H J K L ; '
Notes: C C# D D# E F F# G G# A A#
```

## 🛠️ Technical Details

- **Built with:** Vanilla JavaScript, Web Audio API, AudioWorklet
- **Browser Requirements:** Modern browsers with AudioWorklet support
- **No Dependencies:** Pure client-side application
- **Audio Processing:** 44.1kHz sample rate, stereo support

## 🌐 Hosting Options

This is a static web application that can be hosted anywhere:

### Free Options:
- **GitHub Pages** (Recommended)
- **Netlify** - Drag & drop deployment
- **Vercel** - Frontend-focused hosting
- **Surge.sh** - Command line deployment
- **Firebase Hosting** - Google's platform

### Local Development:
```bash
# Serve locally (Python 3)
python -m http.server 8000

# Or with Node.js
npx serve .
```

Then open `http://localhost:8000`

## 📁 File Structure

```
sfx/
├── index.html           # Main application UI
├── main.js             # Core application logic
├── tape-processor.js   # AudioWorklet processor
└── README.md          # This file
```

## 🎚️ Controls Reference

| Parameter | Range | Description |
|-----------|--------|-------------|
| **Speed** | 0.01x - 4.0x | Playback speed multiplier |
| **Flutter** | 0% - 20% | Wow & flutter intensity |
| **Flutter Rate** | 0.1 - 20 Hz | Speed of flutter modulation |
| **Saturation** | 0% - 100% | Tape saturation amount |
| **Crosstalk** | 0% - 30% | Stereo channel bleeding |
| **Stereo Width** | 0% - 200% | Stereo field width |

### Synthesizer Controls
| Parameter | Range | Description |
|-----------|--------|-------------|
| **Waveform** | Saw/Square/Sine/Triangle | Oscillator waveform |
| **Attack** | 0.01 - 2.0s | Envelope attack time |
| **Decay** | 0.01 - 2.0s | Envelope decay time |
| **Sustain** | 0% - 100% | Sustain level |
| **Release** | 0.01 - 3.0s | Release time |
| **Cutoff** | 100 - 8000 Hz | Filter cutoff frequency |
| **Resonance** | 0.1 - 20 | Filter resonance |

## 🎯 Use Cases

- **Music Production** - Add vintage tape character to digital recordings
- **Sound Design** - Create retro/lo-fi effects for media
- **Education** - Learn about analog tape machine behavior
- **Performance** - Live tape stop effects and synthesis
- **Experimentation** - Explore extreme speed and modulation effects

## 🔧 Browser Compatibility

- **Chrome/Edge** ✅ Full support
- **Firefox** ✅ Full support  
- **Safari** ✅ Full support (iOS 14.5+)

*Note: Requires browsers with AudioWorklet support*

## 📝 License

Open source - feel free to modify and distribute!

---

**Enjoy creating vintage tape magic! 🎪** 