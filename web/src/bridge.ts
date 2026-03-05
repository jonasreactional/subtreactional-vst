/**
 * bridge.ts — thin wrapper around the JUCE ↔ JS parameter bridge.
 *
 * C++ → JS:  C++ calls  window.__juce.onParam(id, value)
 * JS → C++:  we navigate to  juce://param?id=<id>&v=<value>
 *            which C++ intercepts in pageAboutToLoad() and cancels
 */

declare global {
  interface Window {
    __juce: JuceBridgeGlobal;
  }
}

export interface ModAssignmentInfo {
  type: 'lfo' | 'macro';
  idx: number;
  param: string;
  depth: number;
}

export interface PresetInfo {
  name: string;
  author: string;
  description: string;
  category: string;
  source: 'factory' | 'user';
  idx?: number;       // factory presets
  path?: string;      // user presets
}

interface JuceBridgeGlobal {
  onParam(id: string, value: number): void;
  onWaveform(values: number[]): void;
  onSpectrogram(values: number[]): void;
  onLFO(values: number[]): void;
  onModAssignments(assignments: ModAssignmentInfo[]): void;
  onPresets(presets: PresetInfo[]): void;
  onVersion(version: string): void;
}

type Listener = (value: number) => void;
type AnalyzerListener = (values: number[]) => void;
type LFOListener = (values: number[]) => void;
type ModAssignmentsListener = (assignments: ModAssignmentInfo[]) => void;
type PresetsListener = (presets: PresetInfo[]) => void;
type VersionListener = (version: string) => void;

const listeners = new Map<string, Set<Listener>>();
const lastParamValues = new Map<string, number>();
const waveformListeners = new Set<AnalyzerListener>();
const spectrogramListeners = new Set<AnalyzerListener>();
const lfoListeners = new Set<LFOListener>();
const modAssignmentsListeners = new Set<ModAssignmentsListener>();
let lastModAssignments: ModAssignmentInfo[] | undefined;
const presetsListeners = new Set<PresetsListener>();
const versionListeners = new Set<VersionListener>();
let lastVersion: string | undefined;

// Install the global that C++ will call
window.__juce = {
  onParam(id: string, value: number) {
    lastParamValues.set(id, value);
    listeners.get(id)?.forEach((fn) => fn(value));
  },
  onWaveform(values: number[]) {
    waveformListeners.forEach((fn) => fn(values));
  },
  onSpectrogram(values: number[]) {
    spectrogramListeners.forEach((fn) => fn(values));
  },
  onLFO(values: number[]) {
    lfoListeners.forEach((fn) => fn(values));
  },
  onModAssignments(assignments: ModAssignmentInfo[]) {
    lastModAssignments = assignments;
    modAssignmentsListeners.forEach((fn) => fn(assignments));
  },
  onPresets(presets: PresetInfo[]) {
    presetsListeners.forEach((fn) => fn(presets));
  },
  onVersion(version: string) {
    lastVersion = version;
    versionListeners.forEach((fn) => fn(version));
  },
};

/** Send a parameter change to C++ (normalised 0..1 for sliders, integer index for combos). */
export function setParam(id: string, value: number): void {
  window.location.href = `juce://param?id=${encodeURIComponent(id)}&v=${value}`;
}

/** Subscribe to parameter changes pushed from C++. Returns an unsubscribe function. */
export function onParam(id: string, fn: Listener): () => void {
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id)!.add(fn);

  const last = lastParamValues.get(id);
  if (last !== undefined) fn(last);

  return () => listeners.get(id)!.delete(fn);
}

/** Notify C++ that JS is fully booted and ready to receive initial state. */
export function notifyHostReady(): void {
  window.location.href = 'juce://ready';
}

/** Subscribe to waveform analyzer frames. Returns an unsubscribe function. */
export function onWaveform(fn: AnalyzerListener): () => void {
  waveformListeners.add(fn);
  return () => waveformListeners.delete(fn);
}

/** Subscribe to spectrogram analyzer frames. Returns an unsubscribe function. */
export function onSpectrogram(fn: AnalyzerListener): () => void {
  spectrogramListeners.add(fn);
  return () => spectrogramListeners.delete(fn);
}

/** Subscribe to LFO output values pushed from C++ (~30 Hz). Returns an unsubscribe function. */
export function onLFO(fn: LFOListener): () => void {
  lfoListeners.add(fn);
  return () => lfoListeners.delete(fn);
}

/** Subscribe to full mod-assignment state pushed from C++ on page load.
 *  If a snapshot has already been received, the callback fires immediately. */
export function onModAssignments(fn: ModAssignmentsListener): () => void {
  modAssignmentsListeners.add(fn);
  if (lastModAssignments !== undefined) fn(lastModAssignments);
  return () => modAssignmentsListeners.delete(fn);
}

/** Send a modulation assignment to C++ */
export function sendModAdd(type: 'lfo' | 'macro', idx: number, paramName: string, depth: number): void {
  window.location.href = `juce://mod_add?src=${type}&idx=${idx}&param=${encodeURIComponent(paramName)}&depth=${depth}`;
}

/** Remove a modulation assignment */
export function sendModRemove(type: 'lfo' | 'macro', idx: number, paramName: string): void {
  window.location.href = `juce://mod_remove?src=${type}&idx=${idx}&param=${encodeURIComponent(paramName)}`;
}

/** Update depth of an existing modulation assignment */
export function sendModSetDepth(type: 'lfo' | 'macro', idx: number, paramName: string, depth: number): void {
  window.location.href = `juce://mod_depth?src=${type}&idx=${idx}&param=${encodeURIComponent(paramName)}&depth=${depth}`;
}

/** Subscribe to preset list pushed from C++. Returns unsubscribe function. */
export function onPresets(fn: PresetsListener): () => void {
  presetsListeners.add(fn);
  return () => presetsListeners.delete(fn);
}

/** Load a factory preset by index */
export function sendLoadFactoryPreset(idx: number): void {
  window.location.href = `juce://preset_load_factory?idx=${idx}`;
}

/** Load a user preset by file path */
export function sendLoadUserPreset(path: string): void {
  window.location.href = `juce://preset_load_user?path=${encodeURIComponent(path)}`;
}

/** Subscribe to the plugin version string pushed from C++ on page load.
 *  If the version has already been received, the callback fires immediately. */
export function onVersion(fn: VersionListener): () => void {
  versionListeners.add(fn);
  if (lastVersion !== undefined) fn(lastVersion);
  return () => versionListeners.delete(fn);
}

/** Save current patch as a user preset */
export function sendSavePreset(name: string, author: string, desc: string): void {
  window.location.href =
    `juce://preset_save?name=${encodeURIComponent(name)}&author=${encodeURIComponent(author)}&desc=${encodeURIComponent(desc)}`;
}
