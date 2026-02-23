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

interface JuceBridgeGlobal {
  onParam(id: string, value: number): void;
  onWaveform(values: number[]): void;
  onSpectrogram(values: number[]): void;
}

type Listener = (value: number) => void;
type AnalyzerListener = (values: number[]) => void;

const listeners = new Map<string, Set<Listener>>();
const lastParamValues = new Map<string, number>();
const waveformListeners = new Set<AnalyzerListener>();
const spectrogramListeners = new Set<AnalyzerListener>();

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
