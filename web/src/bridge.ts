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
}

type Listener = (value: number) => void;

const listeners = new Map<string, Set<Listener>>();

// Install the global that C++ will call
window.__juce = {
  onParam(id: string, value: number) {
    listeners.get(id)?.forEach((fn) => fn(value));
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
  return () => listeners.get(id)!.delete(fn);
}
