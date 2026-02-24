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

interface JuceBridgeGlobal {
  onParam(id: string, value: number): void;
  onWaveform(values: number[]): void;
  onSpectrogram(values: number[]): void;
  onModAssignments(assignments: ModAssignmentInfo[]): void;
}

type Listener = (value: number) => void;
type AnalyzerListener = (values: number[]) => void;
type ModAssignmentsListener = (assignments: ModAssignmentInfo[]) => void;

const listeners = new Map<string, Set<Listener>>();
const lastParamValues = new Map<string, number>();
const waveformListeners = new Set<AnalyzerListener>();
const spectrogramListeners = new Set<AnalyzerListener>();
const modAssignmentsListeners = new Set<ModAssignmentsListener>();

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
  onModAssignments(assignments: ModAssignmentInfo[]) {
    modAssignmentsListeners.forEach((fn) => fn(assignments));
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

/** Subscribe to full mod-assignment state pushed from C++ on page load. */
export function onModAssignments(fn: ModAssignmentsListener): () => void {
  modAssignmentsListeners.add(fn);
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
