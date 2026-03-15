# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A mobile-only static web application for dice rolling that uses device motion sensors. The dice have a unique probability distribution: 1/3 chance for 0, 1, or 2 points each. Users can roll 1-8 dice simultaneously by shaking their phone.

## Running the Project

This is a pure static website with no build system. To run locally:

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js (if npx is available)
npx serve .

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in a browser. Note: Device motion sensors only work on mobile devices or mobile emulation in browser dev tools.

## Architecture

### Screen Flow
1. **Initial Screen** (`#initial-screen`) - User selects number of dice (1-8) and taps start
2. **Shake Screen** (`#shake-screen`) - Displays dice, listens for device motion
3. **Not Supported Screen** (`#not-supported`) - Shown if device lacks required sensors

### Key Modules in `app.js`

- **State Management** (`state` object, lines 2-12) - Central state for selected dice count, current screen, shake status, audio context
- **Device Motion Detection** (`handleMotion`, line 186) - Uses `DeviceMotionEvent` to detect shake start/end via acceleration magnitude thresholds
- **Audio Generation** (lines 327-413) - Uses Web Audio API to synthesize shake noise and landing sounds at runtime
- **Dice Rendering** (`generateDice`, line 144) - Creates dice DOM elements with 3x3 dot grid; CSS shows/hides dots based on `data-value` attribute

### Important Constraints

- **Mobile-only**: App checks for mobile user agent and `DeviceMotionEvent` support on init
- **iOS 13+**: Requires explicit permission request for device motion (`DeviceMotionEvent.requestPermission()`)
- **No external dependencies**: All audio is synthesized via Web Audio API; no audio files needed

## Product Requirements

See `prd.md` for full Chinese requirements. Key points:
- Dice values: 0, 1, or 2 (equal 1/3 probability each)
- Shake detection must determine start and end of motion
- Results show each die's value and total sum