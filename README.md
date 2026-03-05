# Subtreactional VST

A VST3 synthesizer plugin built on the [subtreactional](https://github.com/jonasreactional/subtreactional) engine with a web-based UI.

![subtreactional_screenshot](https://github.com/user-attachments/assets/a5edbb97-9fbf-4f01-8647-bf5801260df5)

## Features

- Full subtractive synth: 2 oscillators, multimode filter, dual ADSR envelopes
- 4 chained FX slots: delay, chorus, flanger, phaser, VHS, reverb, distortion, 3-band EQ
- 4 LFOs and 4 macros with drag-and-drop modulation assignment to any parameter
- Real-time waveform and spectrogram visualizer
- Preset browser with factory presets (Bass, Lead, Pad, Pluck) and user preset save/load
- JSON patch drag-and-drop import
- Web UI served via embedded HTML (release) or Vite dev server (debug)

## Building

### Prerequisites

- CMake 3.22+
- C++17 compiler (Xcode, MSVC, GCC)
- Node.js 18+ (for the web UI)

### Debug build (with live-reloading UI)

```bash
# Start the Vite dev server
cd web && npm install && npm run dev &

# Build the plugin
cmake -B build
cmake --build build
```

The debug build loads the UI from `http://localhost:5173`.

### Release build

```bash
# Build the web UI
cd web && npm install && npm run build && cd ..

# Build the plugin
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

The release build embeds `web/dist/index.html` as binary data.

### Build & install (macOS)

The `build.sh` script configures, builds, and copies the VST3 to `/Library/Audio/Plug-Ins/VST3/` (requires sudo for the install step):

```bash
./build.sh           # Debug build
./build.sh Release   # Release build
```

### Manual output

The built VST3 bundle is at:
```
build/SubtreactionalVST_artefacts/<Debug|Release>/VST3/Subtreactional.vst3
```

## Versioning & releasing

The plugin version is defined in `CMakeLists.txt` and displayed in the plugin UI at runtime:

```cmake
project(SubtreactionalVST VERSION 0.1.0)
```

### Branch workflow

- `develop` — day-to-day work
- `main` — stable releases; every push triggers a CI build and produces downloadable artifacts

### Cutting a release

1. Bump the version in `CMakeLists.txt`
2. Merge `develop` → `main`
3. Tag the commit and push:

```bash
git tag v0.1.0
git push origin v0.1.0
```

CI will build for macOS, Linux, and Windows automatically on the `main` push.

### Manual CI build

Any branch can be built manually from the GitHub Actions UI:
**Actions → Build → Run workflow** (select branch).

## Architecture

```
Source/                    JUCE plugin code
  PluginProcessor.cpp/h      Audio processor, parameter mapping, state save/load
  PluginEditor.cpp/h         Editor with timer-driven UI updates
  JuceBridge.cpp/h           WebView ↔ C++ bridge (juce:// URL protocol)
web/src/                   Web UI (TypeScript)
  main.ts                    Knobs, FX routing, mod matrix, preset browser
  bridge.ts                  JS ↔ C++ parameter bridge
external/
  subtreactional/            DSP engine (git submodule)
  JUCE/                      JUCE framework (git submodule)
presets/                   Factory presets (JSON)
```

### C++ ↔ JS bridge

Communication uses URL-based messaging:

- **JS → C++**: `window.location.href = "juce://param?id=<id>&v=<value>"`
- **C++ → JS**: `goToURL("javascript:window.__juce.onParam(...)"`

Parameter IDs use underscores in APVTS (`filter_cutoff`) mapped to dot notation in the synth engine (`filter.cutoff`).

## Presets

Factory presets live in `presets/` organized by category. User presets are saved to:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Reactional/Subtreactional/Presets/` |
| Windows | `%APPDATA%/Reactional/Subtreactional/Presets/` |
| Linux | `~/.config/Reactional/Subtreactional/Presets/` |