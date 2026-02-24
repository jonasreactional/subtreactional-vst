import { setParam, onParam, onWaveform, onSpectrogram, notifyHostReady } from './bridge';

// ---------------------------------------------------------------------------
// Parameter definitions — mirrors PluginProcessor.cpp kParams
// ---------------------------------------------------------------------------

interface ParamDef {
  id: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  step?: number;
  type: 'slider' | 'combo';
  options?: string[];
}

const OSC_TYPES = ['Off', 'Saw', 'Square', 'Sine', 'Tri', 'Noise'];
const FILTER_TYPES = ['Off', 'LP', 'HP', 'BP'];
const FX_TYPES = ['Off', 'Delay', 'Chorus', 'Reverb', 'Distortion'];
const LFO_SHAPES = ['Sine', 'Tri', 'Saw', 'Square'];
const LFO_DESTS = ['Off', 'Pitch', 'Cutoff', 'Amp', 'PWM'];
const VOICE_COUNTS = Array.from({ length: 16 }, (_, i) => String(i + 1)); // '1' to '16'

const PARAMS: ParamDef[] = [
  // OSC 1
  { id: 'osc1_type',         label: 'OSC1 Type',  min: 0, max: 5, defaultValue: 1, type: 'combo', options: OSC_TYPES },
  { id: 'osc1_level',        label: 'Level',      min: 0, max: 1, defaultValue: 0.7, type: 'slider' },
  { id: 'osc1_detune',       label: 'Detune',     min: -50, max: 50, defaultValue: 0, type: 'slider' },
  { id: 'osc1_octave',       label: 'Octave',     min: -2, max: 2, defaultValue: 0, step: 1, type: 'slider' },
  { id: 'osc1_pulse_width',  label: 'Pulse',      min: 0, max: 1, defaultValue: 0.5, type: 'slider' },
  // OSC 2
  { id: 'osc2_type',         label: 'OSC2 Type',  min: 0, max: 5, defaultValue: 0, type: 'combo', options: OSC_TYPES },
  { id: 'osc2_level',        label: 'Level',      min: 0, max: 1, defaultValue: 0, type: 'slider' },
  { id: 'osc2_detune',       label: 'Detune',     min: -50, max: 50, defaultValue: 0, type: 'slider' },
  { id: 'osc2_octave',       label: 'Octave',     min: -2, max: 2, defaultValue: 0, step: 1, type: 'slider' },
  { id: 'osc2_pulse_width',  label: 'Pulse',      min: 0, max: 1, defaultValue: 0.5, type: 'slider' },
  // Sub Oscillator
  { id: 'sub_level',         label: 'Sub',        min: 0, max: 1, defaultValue: 0, type: 'slider' },
  // Filter
  { id: 'filter_type',       label: 'Type',       min: 0, max: 3, defaultValue: 1, type: 'combo', options: FILTER_TYPES },
  { id: 'filter_cutoff',     label: 'Cutoff',     min: 20, max: 20000, defaultValue: 2000, type: 'slider' },
  { id: 'filter_resonance',  label: 'Res',        min: 0, max: 1, defaultValue: 0.3, type: 'slider' },
  { id: 'filter_env_amount', label: 'Env Amt',    min: 0, max: 1, defaultValue: 0, type: 'slider' },
  { id: 'filter_vel_amount', label: 'Vel Amt',    min: 0, max: 1, defaultValue: 0, type: 'slider' },
  // Ring Modulation
  { id: 'ring_mod',          label: 'Ring Mod',   min: 0, max: 1, defaultValue: 0, type: 'slider' },
  // Filter envelope
  { id: 'fenv_attack',  label: 'Atk', min: 1, max: 5000, defaultValue: 10,  type: 'slider' },
  { id: 'fenv_decay',   label: 'Dec', min: 1, max: 5000, defaultValue: 300, type: 'slider' },
  { id: 'fenv_sustain', label: 'Sus', min: 0, max: 1,    defaultValue: 0,   type: 'slider' },
  { id: 'fenv_release', label: 'Rel', min: 1, max: 5000, defaultValue: 200, type: 'slider' },
  // Amp envelope
  { id: 'aenv_attack',  label: 'Atk', min: 1, max: 5000, defaultValue: 10,  type: 'slider' },
  { id: 'aenv_decay',   label: 'Dec', min: 1, max: 5000, defaultValue: 200, type: 'slider' },
  { id: 'aenv_sustain', label: 'Sus', min: 0, max: 1,    defaultValue: 0.7, type: 'slider' },
  { id: 'aenv_release', label: 'Rel', min: 1, max: 5000, defaultValue: 500, type: 'slider' },
  // FX slots
  ...([0, 1, 2, 3] as const).flatMap((i) => [
    { id: `fx${i}_type`,            label: `FX${i} Type`,  min: 0, max: 4,    defaultValue: 0,   type: 'combo' as const, options: FX_TYPES },
    { id: `fx${i}_mix`,             label: 'Mix',          min: 0, max: 1,    defaultValue: 0.3, type: 'slider' as const },
    { id: `fx${i}_delay_time`,      label: 'Dly Time',     min: 10, max: 1000, defaultValue: 250, type: 'slider' as const },
    { id: `fx${i}_delay_feedback`,  label: 'Dly Fb',       min: 0, max: 0.99, defaultValue: 0.3, type: 'slider' as const },
    { id: `fx${i}_chorus_rate`,     label: 'Chr Rate',     min: 0.1, max: 10, defaultValue: 0.5, type: 'slider' as const },
    { id: `fx${i}_chorus_depth`,    label: 'Chr Depth',    min: 0, max: 1,    defaultValue: 0.4, type: 'slider' as const },
    { id: `fx${i}_reverb_t60`,      label: 'Rvb T60',      min: 0.1, max: 10, defaultValue: 2.0, type: 'slider' as const },
    { id: `fx${i}_distortion_drive`, label: 'Dist',        min: 0, max: 10,   defaultValue: 1.0, type: 'slider' as const },
  ]),
  // Master
  { id: 'master_volume',       label: 'Master', min: 0, max: 1, defaultValue: 0.8, type: 'slider' },
  { id: 'pitch_bend_range',    label: 'Pitch Bend', min: 0, max: 24, defaultValue: 2, step: 1, type: 'slider' },
  { id: 'portamento_time',     label: 'Portamento', min: 0, max: 1000, defaultValue: 0, type: 'slider' },
  // Voice count
  { id: 'num_voices', label: 'Voices', min: 1, max: 16, defaultValue: 8, step: 1, type: 'slider' },
  // LFO
  { id: 'lfo_rate',  label: 'Rate', min: 0.1, max: 20, defaultValue: 1, type: 'slider' },
  { id: 'lfo_depth', label: 'Depth', min: 0, max: 1, defaultValue: 0, type: 'slider' },
  { id: 'lfo_shape', label: 'Shape', min: 0, max: 3, defaultValue: 0, type: 'combo', options: LFO_SHAPES },
  { id: 'lfo_dest',  label: 'Dest', min: 0, max: 4, defaultValue: 0, type: 'combo', options: LFO_DESTS },
];

// ---------------------------------------------------------------------------
// Design tokens — ported from ge_core-webapp/src/styling.js
// ---------------------------------------------------------------------------

const C = {
  offWhite:        '#ECECEC',
  offDark:         '#000000',
  offDark1:        '#121212',
  offDark2:        '#1A1D22',
  offDark3:        '#22252A',
  offDark4:        '#2D3239',
  offDark5:        '#3A4049',
  purple:          '#825CED',
  orange:          '#F38E30',
  gradStart:       '#825CED',
  gradEnd:         '#3603FF',
  white48:         'rgba(236,236,236,0.48)',
  white24:         'rgba(236,236,236,0.24)',
  white8:          'rgba(236,236,236,0.08)',
  purpleGlow:      'rgba(130,92,237,0.48)',
};

// ---------------------------------------------------------------------------
// Global styles
// ---------------------------------------------------------------------------

const linkEl = document.createElement('link');
linkEl.rel = 'stylesheet';
linkEl.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
document.head.appendChild(linkEl);

const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${C.offDark1};
    color: ${C.offWhite};
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 12px;
    overflow: hidden;
    width: 860px;
    height: 480px;
    user-select: none;
    -webkit-user-select: none;
  }

  #app {
    display: flex;
    flex-direction: column;
    width: 860px;
    height: 480px;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: ${C.offDark2};
    border-bottom: 1px solid ${C.offDark3};
    height: 32px;
    padding: 0 14px;
    flex-shrink: 0;
  }

  .header-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: ${C.offWhite};
  }

  .header-accent {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${C.purple};
    box-shadow: 0 0 8px ${C.purpleGlow};
  }

  .main-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    padding: 6px;
    gap: 6px;
  }

  /* Left column: OSC + Filter + Envelopes + FX */
  .left-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-height: 0;
  }

  /* Top row of left col: OSC1 + OSC2 + Filter */
  .top-row {
    display: flex;
    gap: 6px;
  }

  /* Bottom row of left col: FilterEnv + AmpEnv */
  .env-row {
    display: flex;
    gap: 6px;
  }

  /* Right column: Master */
  .right-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 0 0 auto;
  }

  .fx-grid {
    display: flex;
    gap: 6px;
    flex: 1;
    min-height: 0;
  }

  .panel {
    background: ${C.offDark2};
    border: 1px solid ${C.offDark3};
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .panel-title {
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: ${C.white48};
    padding-bottom: 5px;
    border-bottom: 1px solid ${C.offDark3};
    flex-shrink: 0;
  }

  .knobs-row {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    justify-content: center;
    flex-wrap: wrap;
  }

  .knob-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .knob-label {
    font-size: 9px;
    color: ${C.white48};
    text-align: center;
    white-space: nowrap;
    letter-spacing: 0.5px;
  }

  /* Knob canvas container */
  .knob-container {
    position: relative;
    cursor: ns-resize;
    flex-shrink: 0;
  }

  /* Dropdown */
  .dropdown-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .dropdown-label {
    display: none;
    font-size: 9px;
    color: ${C.white48};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dropdown {
    position: relative;
    width: 100%;
  }

  .dropdown-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: ${C.offDark};
    border: 1px solid ${C.offDark3};
    border-radius: 4px;
    height: 24px;
    padding: 0 8px;
    cursor: pointer;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 11px;
    color: ${C.offWhite};
    width: 100%;
  }

  .dropdown-btn:hover {
    border-color: ${C.offDark5};
  }

  .dropdown-chevron {
    font-size: 8px;
    color: ${C.white48};
    transition: transform 0.15s ease;
  }

  .dropdown-chevron.open {
    transform: rotate(180deg);
  }

  .dropdown-panel {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    background: ${C.offDark2};
    border: 1px solid ${C.offDark3};
    border-radius: 4px;
    z-index: 100;
    max-height: 100px;
    overflow-y: auto;
    display: none;
  }

  .dropdown-panel.open {
    display: block;
  }

  .dropdown-panel.open-upward {
    top: auto;
    bottom: calc(100% + 2px);
  }

  .dropdown-option {
    padding: 5px 8px;
    font-size: 11px;
    color: ${C.offWhite};
    cursor: pointer;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .dropdown-option:hover,
  .dropdown-option.selected {
    background: ${C.offDark3};
  }

  /* FX panel layout */
  .fx-rack {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    flex: 1;
    min-width: 0;
  }

  .fx-row-wrap {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }

  .fx-side-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    justify-items: center;
    gap: 8px 6px;
    padding: 8px 6px;
    min-width: 116px;
    width: 25%;
    height: 100%;
    flex: 0 0 auto;
  }

  .fx-rack-grid {
    display: flex;
    gap: 8px;
  }

  .fx-rack-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .fx-slot {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 64px;
  }

  .fx-slot-label {
    flex: 0 0 16px;
    font-size: 9px;
    letter-spacing: 0.5px;
    color: ${C.white48};
    text-transform: uppercase;
    text-align: center;
  }

  .fx-slot-main {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .fx-slot-params {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .fx-param-group {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
  }

  .master-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 4px;
    height: 100%;
    padding: 6px 10px;
  }

  /* Divider between OSC/Filter and Envelopes */
  .divider {
    height: 1px;
    background: ${C.offDark3};
  }

  .analyzer-panel {
    padding-bottom: 0px;
    
  }

  .analyzer-views {
    display: flex;
    gap: 6 px;
  }

  .analyzer-view {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .analyzer-canvas-wrap {
    width: 82px;
    height: 82px;
    flex: 0 0 auto;
    border: 1px solid ${C.offDark3};
    border-radius: 10px;
    background: ${C.offDark};
    overflow: hidden;
  }

  .analyzer-label {
    font-size: 9px;
    color: ${C.white48};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .analyzer-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
`;
document.head.appendChild(style);

// ---------------------------------------------------------------------------
// SVG Knob component
// ---------------------------------------------------------------------------

interface KnobOptions {
  size: number;
  min: number;
  max: number;
  defaultValue: number; // display-range default
  label: string;
}

interface KnobControl {
  el: HTMLElement;
  setValue: (normValue: number) => void;
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg - 90) * Math.PI / 180;
  return [
    cx - r * Math.cos(rad),
    cy - r * Math.sin(rad),
  ];
}

function makeArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polarToCartesian(cx, cy, r, startDeg);
  const [ex, ey] = polarToCartesian(cx, cy, r, endDeg);
  const delta = ((endDeg - startDeg) + 360) % 360;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} L ${cx} ${cy} Z`;
}

function valueToKnobAngle(normValue: number): number {
  // normValue 0..1: rotate from 7 o'clock (210°) to 4 o'clock (480° = 120°).
  // Takes the long clockwise path around the circle (through 12 o'clock).
  return 210 + normValue * 270;
}

function createKnob(opts: KnobOptions): KnobControl {
  const { size, min, max, defaultValue, label } = opts;
  const normDefault = (defaultValue - min) / (max - min);

  const wrap = document.createElement('div');
  wrap.className = 'knob-wrap';

  const container = document.createElement('div');
  container.className = 'knob-container';
  container.style.width = `${size}px`;
  container.style.height = `${size}px`;

  // SVG for arc fill + gutter ring
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.overflow = 'visible';

  // Gradient def
  const defs = document.createElementNS(svgNS, 'defs');
  const gradId = `kg-${Math.random().toString(36).slice(2)}`;
  const grad = document.createElementNS(svgNS, 'linearGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('x1', '0%');
  grad.setAttribute('y1', '0%');
  grad.setAttribute('x2', '100%');
  grad.setAttribute('y2', '100%');
  const stop1 = document.createElementNS(svgNS, 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', C.gradStart);
  const stop2 = document.createElementNS(svgNS, 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', C.gradEnd);
  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const cx = size / 2;
  const cy = size / 2;
  const arcR = size / 2 - 1;

  // Gutter background circle
  const gutterCircle = document.createElementNS(svgNS, 'circle');
  gutterCircle.setAttribute('cx', String(cx));
  gutterCircle.setAttribute('cy', String(cy));
  gutterCircle.setAttribute('r', String(arcR));
  gutterCircle.setAttribute('fill', C.offDark);
  gutterCircle.setAttribute('stroke', C.offDark);
  gutterCircle.setAttribute('stroke-width', '1');
  svg.appendChild(gutterCircle);

  // Arc fill path
  const arcPath = document.createElementNS(svgNS, 'path');
  arcPath.setAttribute('fill', `url(#${gradId})`);
  svg.appendChild(arcPath);

  container.appendChild(svg);

  // Rotating knob button disc
  const buttonSize = size * 0.76;
  const buttonOffset = (size - buttonSize) / 2;
  const button = document.createElement('div');
  button.style.cssText = `
    position: absolute;
    width: ${buttonSize}px;
    height: ${buttonSize}px;
    top: ${buttonOffset}px;
    left: ${buttonOffset}px;
    border-radius: 50%;
    background: ${C.offDark2};
    border: 1px solid ${C.offDark3};
    filter: drop-shadow(0px 0px 16px ${C.purpleGlow}) drop-shadow(0px 4px 4px rgba(0,0,0,0.25));
    pointer-events: none;
  `;

  // Position indicator line
  const indW = 2;
  const indH = Math.round(size * 0.16);
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: absolute;
    width: ${indW}px;
    height: ${indH}px;
    background: ${C.offWhite};
    border-radius: 1px;
    top: 4px;
    left: ${(buttonSize - indW) / 2}px;
    transform-origin: center ${buttonSize / 2 - 4}px;
    pointer-events: none;
  `;
  button.appendChild(indicator);
  container.appendChild(button);

  // Value label
  const valLabel = document.createElement('div');
  valLabel.style.cssText = `
    position: absolute;
    width: 100%;
    text-align: center;
    bottom: -1px;
    font-size: 8px;
    color: ${C.white48};
    pointer-events: none;
    font-family: 'Inter', system-ui, sans-serif;
  `;
  container.appendChild(valLabel);

  wrap.appendChild(container);

  const lbl = document.createElement('div');
  lbl.className = 'knob-label';
  lbl.textContent = label;
  wrap.appendChild(lbl);

  // Animation state
  let currentNorm = normDefault;
  let targetNorm = normDefault;
  let rafId = 0;

  function formatVal(norm: number): string {
    const raw = min + norm * (max - min);
    if (max - min >= 100) return raw.toFixed(0);
    if (max - min >= 1) return raw.toFixed(1);
    return raw.toFixed(2);
  }

  function renderKnob(norm: number) {
    const cssAngle = valueToKnobAngle(norm);

    // Arc fill in arc space (0=bottom, counter-clockwise from 45°=7 o'clock to 315°=4 o'clock)
    const minArcAngle = 45;
    const endArcAngle = 45 + norm * 270;

    if (norm < 0.01) {
      arcPath.setAttribute('d', '');
    } else {
      arcPath.setAttribute('d', makeArcPath(cx, cy, arcR * 0.88, minArcAngle, endArcAngle));
    }

    // Rotate button so indicator points at current knob position.
    // cssAngle is a CSS degree (0=top, clockwise). Indicator starts at top of disc.
    button.style.transform = `rotate(${cssAngle}deg)`;

    valLabel.textContent = formatVal(norm);
  }

  function animate() {
    const diff = targetNorm - currentNorm;
    if (Math.abs(diff) > 0.001) {
      currentNorm += diff * 0.2;
      renderKnob(currentNorm);
      rafId = requestAnimationFrame(animate);
    } else {
      currentNorm = targetNorm;
      renderKnob(currentNorm);
      rafId = 0;
    }
  }

  function setTarget(norm: number) {
    targetNorm = Math.max(0, Math.min(1, norm));
    if (rafId === 0) {
      rafId = requestAnimationFrame(animate);
    }
  }

  // Init
  renderKnob(normDefault);

  return {
    el: wrap,
    setValue(normValue: number) {
      setTarget(normValue);
    },
  };
}

// ---------------------------------------------------------------------------
// Dropdown component
// ---------------------------------------------------------------------------

interface DropdownOptions {
  options: string[];
  defaultIndex: number;
  label: string;
  width?: number;
}

interface DropdownControl {
  el: HTMLElement;
  setIndex: (idx: number) => void;
  onChange: (cb: (idx: number) => void) => void;
}

function createDropdown(opts: DropdownOptions): DropdownControl {
  const { options, defaultIndex, label, width = 72 } = opts;
  let currentIndex = defaultIndex;
  let changeCallback: ((idx: number) => void) | null = null;

  const wrap = document.createElement('div');
  wrap.className = 'dropdown-wrap';
  wrap.style.width = `${width}px`;

  const lbl = document.createElement('div');
  lbl.className = 'dropdown-label';
  lbl.textContent = label;
  wrap.appendChild(lbl);

  const container = document.createElement('div');
  container.className = 'dropdown';

  const btn = document.createElement('button');
  btn.className = 'dropdown-btn';
  btn.type = 'button';

  const valueSpan = document.createElement('span');
  valueSpan.textContent = options[defaultIndex] ?? '';

  const chevron = document.createElement('span');
  chevron.className = 'dropdown-chevron';
  chevron.textContent = '▼';

  btn.appendChild(valueSpan);
  btn.appendChild(chevron);

  const panel = document.createElement('div');
  panel.className = 'dropdown-panel';

  options.forEach((opt, idx) => {
    const item = document.createElement('div');
    item.className = 'dropdown-option' + (idx === defaultIndex ? ' selected' : '');
    item.textContent = opt;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      currentIndex = idx;
      valueSpan.textContent = opt;
      panel.querySelectorAll('.dropdown-option').forEach((el, i) => {
        el.classList.toggle('selected', i === idx);
      });
      closePanel();
      changeCallback?.(idx);
    });
    panel.appendChild(item);
  });

  function openPanel() {
    // Detect overflow and determine if dropdown should open upward
    const rect = btn.getBoundingClientRect();
    const panelMaxHeight = 100; // matches .dropdown-panel max-height
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // If not enough space below but more space above, open upward
    const shouldOpenUpward = spaceBelow < panelMaxHeight && spaceAbove > spaceBelow;
    
    panel.classList.add('open');
    panel.classList.toggle('open-upward', shouldOpenUpward);
    chevron.classList.add('open');
  }

  function closePanel() {
    panel.classList.remove('open', 'open-upward');
    chevron.classList.remove('open');
  }

  btn.addEventListener('click', () => {
    if (panel.classList.contains('open')) {
      closePanel();
    } else {
      openPanel();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!container.contains(e.target as Node)) {
      closePanel();
    }
  });

  container.appendChild(btn);
  container.appendChild(panel);
  wrap.appendChild(container);

  return {
    el: wrap,
    setIndex(idx: number) {
      currentIndex = idx;
      valueSpan.textContent = options[idx] ?? '';
      panel.querySelectorAll('.dropdown-option').forEach((el, i) => {
        el.classList.toggle('selected', i === idx);
      });
    },
    onChange(cb: (idx: number) => void) {
      changeCallback = cb;
    },
  };
}

// ---------------------------------------------------------------------------
// Layout construction
// ---------------------------------------------------------------------------

const app = document.getElementById('app')!;

// Header
const header = document.createElement('div');
header.className = 'header';
const headerTitle = document.createElement('div');
headerTitle.className = 'header-title';
headerTitle.textContent = 'Subtreactional';
const headerAccent = document.createElement('div');
headerAccent.className = 'header-accent';
header.appendChild(headerTitle);
header.appendChild(headerAccent);
app.appendChild(header);

// Main layout
const mainLayout = document.createElement('div');
mainLayout.className = 'main-layout';
app.appendChild(mainLayout);

const paramMap = new Map(PARAMS.map((p) => [p.id, p]));

// Helper: create a knob for a slider param + wire it
function buildKnob(id: string, size: number): HTMLElement {
  const def = paramMap.get(id)!;
  const normDefault = (def.defaultValue - def.min) / (def.max - def.min);
  const knob = createKnob({ size, min: def.min, max: def.max, defaultValue: def.defaultValue, label: def.label });

  knob.setValue(normDefault);

  knob.el.querySelector('.knob-container')!.addEventListener('mousedown', () => {
    // drag handling calls setParam via onMouseMove — captured below
  });

  // Patch: wire drag to setParam
  const container = knob.el.querySelector('.knob-container') as HTMLElement;
  let dragStartY = 0;
  let dragStartNorm = normDefault;
  let currentNormRef = normDefault;

  function onDragMove(e: MouseEvent) {
    const dy = dragStartY - e.clientY;
    const delta = dy / 200;
    const newNorm = Math.max(0, Math.min(1, dragStartNorm + delta));
    currentNormRef = newNorm;
    knob.setValue(newNorm);
    setParam(id, newNorm);
  }

  function onDragUp() {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragUp);
  }

  container.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragStartY = e.clientY;
    dragStartNorm = currentNormRef;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragUp);
  });

  container.addEventListener('dblclick', () => {
    const normDefault2 = (def.defaultValue - def.min) / (def.max - def.min);
    currentNormRef = normDefault2;
    knob.setValue(normDefault2);
    setParam(id, normDefault2);
  });

  onParam(id, (v) => {
    currentNormRef = v;
    knob.setValue(v);
  });

  return knob.el;
}

// Helper: create a dropdown for a combo param + wire it
function buildDropdown(id: string, width?: number): HTMLElement {
  const def = paramMap.get(id)!;
  const opts = def.options!;
  const dd = createDropdown({ options: opts, defaultIndex: def.defaultValue, label: def.label, width });

  dd.onChange((idx) => {
    const norm = opts.length > 1 ? idx / (opts.length - 1) : 0;
    setParam(id, norm);
  });

  onParam(id, (v) => {
    const idx = Math.round(v * (opts.length - 1));
    dd.setIndex(idx);
  });

  return dd.el;
}

// Helper: create a panel with title
function makePanel(title: string, extraClass?: string): { panel: HTMLElement; body: HTMLElement } {
  const panel = document.createElement('div');
  panel.className = 'panel' + (extraClass ? ` ${extraClass}` : '');

  const titleEl = document.createElement('div');
  titleEl.className = 'panel-title';
  titleEl.textContent = title;
  panel.appendChild(titleEl);

  return { panel, body: panel };
}

function makeKnobsRow(...els: HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'knobs-row';
  els.forEach(el => row.appendChild(el));
  return row;
}

function makeAnalyzerPanel(): HTMLElement {
  const { panel } = makePanel('Analyzer', 'analyzer-panel');

  const views = document.createElement('div');
  views.className = 'analyzer-views';
  panel.appendChild(views);

  function makeAnalyzerView(label: string): { wrap: HTMLElement; canvasWrap: HTMLElement; canvas: HTMLCanvasElement } {
    const wrap = document.createElement('div');
    wrap.className = 'analyzer-view';

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'analyzer-canvas-wrap';

    const canvas = document.createElement('canvas');
    canvas.className = 'analyzer-canvas';
    canvasWrap.appendChild(canvas);

    const labelEl = document.createElement('div');
    labelEl.className = 'analyzer-label';
    labelEl.textContent = label;

    wrap.appendChild(canvasWrap);
    wrap.appendChild(labelEl);
    return { wrap, canvasWrap, canvas };
  }

  const waveformView = makeAnalyzerView(''); // no title for now, could be "Waveform"
  const spectrogramView = makeAnalyzerView(''); // no title for now, could be "Spectrogram"
  views.appendChild(waveformView.wrap);
  views.appendChild(spectrogramView.wrap);

  const waveformCtx = waveformView.canvas.getContext('2d');
  const spectrogramCtx = spectrogramView.canvas.getContext('2d');
  if (!waveformCtx || !spectrogramCtx) return panel;
  const waveformRenderCtx = waveformCtx;
  const spectrogramRenderCtx = spectrogramCtx;

  let waveformValues: number[] = Array.from({ length: 256 }, () => 0);
  let spectrogramValues: number[] = Array.from({ length: 96 }, () => 0);

  let imageWidth = 0;
  let imageHeight = 0;
  let spectrogramImage: Uint8ClampedArray | null = null;

  function ensureCanvasSize(canvasWrap: HTMLElement, canvas: HTMLCanvasElement): [number, number] {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvasWrap.getBoundingClientRect();
    const w = Math.max(2, Math.floor(rect.width * dpr));
    const h = Math.max(2, Math.floor(rect.height * dpr));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    return [w, h];
  }

  function ensureSpectrogramSize() {
    const [w, h] = ensureCanvasSize(spectrogramView.canvasWrap, spectrogramView.canvas);
    if (w !== imageWidth || h !== imageHeight || !spectrogramImage) {
      imageWidth = w;
      imageHeight = h;
      spectrogramImage = new Uint8ClampedArray(imageWidth * imageHeight * 4);
    }
  }

  function blendHex(a: string, b: string, t: number): [number, number, number] {
    const parse = (hex: string) => {
      const raw = hex.startsWith('#') ? hex.slice(1) : hex;
      return [
        Number.parseInt(raw.slice(0, 2), 16),
        Number.parseInt(raw.slice(2, 4), 16),
        Number.parseInt(raw.slice(4, 6), 16),
      ] as const;
    };
    const [ar, ag, ab] = parse(a);
    const [br, bg, bb] = parse(b);
    return [
      Math.round(ar + (br - ar) * t),
      Math.round(ag + (bg - ag) * t),
      Math.round(ab + (bb - ab) * t),
    ];
  }

  function spectrumColor(value: number): [number, number, number] {
    const v = Math.max(0, Math.min(1, value));
    if (v < 0.4) {
      return blendHex(C.offDark1, C.purple, v / 0.4);
    }
    if (v < 0.75) {
      return blendHex(C.purple, C.orange, (v - 0.4) / 0.35);
    }
    return blendHex(C.orange, C.offWhite, (v - 0.75) / 0.25);
  }

  function pushSpectrogramColumn() {
    ensureSpectrogramSize();
    if (!spectrogramImage || imageWidth < 2 || imageHeight < 2) return;

    for (let y = 0; y < imageHeight; y++) {
      const rowStart = y * imageWidth * 4;
      spectrogramImage.copyWithin(rowStart, rowStart + 4, rowStart + imageWidth * 4);

      const normY = 1 - (y / Math.max(1, imageHeight - 1));
      const binIndex = Math.min(
        spectrogramValues.length - 1,
        Math.max(0, Math.round(normY * (spectrogramValues.length - 1))),
      );
      const [r, g, b] = spectrumColor(spectrogramValues[binIndex] ?? 0);

      const pixel = rowStart + (imageWidth - 1) * 4;
      spectrogramImage[pixel + 0] = r;
      spectrogramImage[pixel + 1] = g;
      spectrogramImage[pixel + 2] = b;
      spectrogramImage[pixel + 3] = 255;
    }
  }

  function drawWaveform() {
    const [w, h] = ensureCanvasSize(waveformView.canvasWrap, waveformView.canvas);
    if (w <= 2 || h <= 2) return;

    waveformRenderCtx.clearRect(0, 0, w, h);

    waveformRenderCtx.strokeStyle = C.white24;
    waveformRenderCtx.lineWidth = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    waveformRenderCtx.beginPath();
    waveformRenderCtx.moveTo(0, h * 0.5);
    waveformRenderCtx.lineTo(w, h * 0.5);
    waveformRenderCtx.stroke();

    waveformRenderCtx.strokeStyle = C.purple;
    waveformRenderCtx.lineWidth = Math.max(1.2, (window.devicePixelRatio || 1) * 1.1);
    waveformRenderCtx.beginPath();

    const count = waveformValues.length;
    for (let i = 0; i < count; i++) {
      const x = (i / Math.max(1, count - 1)) * (w - 1);
      const y = (0.5 - (waveformValues[i] ?? 0) * 0.45) * (h - 1);
      if (i === 0) waveformRenderCtx.moveTo(x, y);
      else waveformRenderCtx.lineTo(x, y);
    }
    waveformRenderCtx.stroke();
  }

  function drawSpectrogram() {
    ensureSpectrogramSize();
    if (!spectrogramImage) return;
    const image = spectrogramRenderCtx.createImageData(imageWidth, imageHeight);
    image.data.set(spectrogramImage);
    spectrogramRenderCtx.putImageData(image, 0, 0);
  }

  function render() {
    drawWaveform();
    drawSpectrogram();
    requestAnimationFrame(render);
  }

  onWaveform((values) => {
    waveformValues = values;
  });

  onSpectrogram((values) => {
    spectrogramValues = values;
    pushSpectrogramColumn();
  });

  render();
  return panel;
}

// ---------------------------------------------------------------------------
// Left column
// ---------------------------------------------------------------------------
const leftCol = document.createElement('div');
leftCol.className = 'left-col';
mainLayout.appendChild(leftCol);

// Top row: OSC1, OSC2, Filter
const topRow = document.createElement('div');
topRow.className = 'top-row';
leftCol.appendChild(topRow);

// OSC 1
{
  const { panel } = makePanel('OSC 1');
  panel.style.minWidth = '210px';
  panel.appendChild(buildDropdown('osc1_type', 92));
  panel.appendChild(makeKnobsRow(
    buildKnob('osc1_level', 40),
    buildKnob('osc1_detune', 40),
    buildKnob('osc1_octave', 40),
    buildKnob('osc1_pulse_width', 40),
  ));
  topRow.appendChild(panel);
}

// OSC 2
{
  const { panel } = makePanel('OSC 2');
  panel.style.minWidth = '210px';
  panel.appendChild(buildDropdown('osc2_type', 92));
  panel.appendChild(makeKnobsRow(
    buildKnob('osc2_level', 40),
    buildKnob('osc2_detune', 40),
    buildKnob('osc2_octave', 40),
    buildKnob('osc2_pulse_width', 40),
  ));
  topRow.appendChild(panel);
}

// Sub + Ring Mod
{
  const { panel } = makePanel('Mod');
  panel.style.minWidth = '90px';
  panel.appendChild(makeKnobsRow(
    buildKnob('sub_level', 30),
  ));
    panel.appendChild(makeKnobsRow(
    buildKnob('ring_mod', 30),
  ));
  topRow.appendChild(panel);
}

// Filter
{
  const { panel } = makePanel('Filter');
  panel.style.minWidth = '220px';
  panel.appendChild(buildDropdown('filter_type', 92));
  panel.appendChild(makeKnobsRow(
    buildKnob('filter_cutoff', 44),
    buildKnob('filter_resonance', 44),
    buildKnob('filter_env_amount', 44),
    buildKnob('filter_vel_amount', 44),
  ));
  topRow.appendChild(panel);
}

// Env row: Filter Env + Amp Env
const envRow = document.createElement('div');
envRow.className = 'env-row';
leftCol.appendChild(envRow);

// Filter Env
{
  const { panel } = makePanel('Filter Env');
  panel.style.minWidth = '210px';
  panel.style.minHeight = '120px';
  panel.appendChild(makeKnobsRow(
    buildKnob('fenv_attack', 40),
    buildKnob('fenv_decay', 40),
    buildKnob('fenv_sustain', 40),
    buildKnob('fenv_release', 40),
  ));
  envRow.appendChild(panel);
}

// Amp Env
{
  const { panel } = makePanel('Amp Env');
  panel.style.minWidth = '210px';
  panel.appendChild(makeKnobsRow(
    buildKnob('aenv_attack', 40),
    buildKnob('aenv_decay', 40),
    buildKnob('aenv_sustain', 40),
    buildKnob('aenv_release', 40),
  ));
  envRow.appendChild(panel);
}

// LFO
{
  const { panel } = makePanel('LFO');
  panel.style.minWidth = '100px';
  panel.appendChild(makeKnobsRow(
    buildKnob('lfo_rate', 30),
    buildKnob('lfo_depth', 30),
  
    buildDropdown('lfo_shape', 40),
    buildDropdown('lfo_dest', 50),
  ));
  envRow.appendChild(panel);
}

envRow.appendChild(makeAnalyzerPanel());

// FX rack (compact)
{
  const fxRowWrap = document.createElement('div');
  fxRowWrap.className = 'fx-row-wrap';

  const { panel } = makePanel('FX');
  panel.classList.add('fx-rack');

  const rackGrid = document.createElement('div');
  rackGrid.className = 'fx-rack-grid';

  const rackColA = document.createElement('div');
  rackColA.className = 'fx-rack-col';

  const rackColB = document.createElement('div');
  rackColB.className = 'fx-rack-col';

  panel.appendChild(rackGrid);
  rackGrid.appendChild(rackColA);
  rackGrid.appendChild(rackColB);

  for (let i = 0; i < 4; i++) {
    const slot = document.createElement('div');
    slot.className = 'fx-slot';

    const slotLabel = document.createElement('div');
    slotLabel.className = 'fx-slot-label';
    slotLabel.textContent = String(i + 1);

    const slotMain = document.createElement('div');
    slotMain.className = 'fx-slot-main';

    const typeDropdown = buildDropdown(`fx${i}_type`, 76);
    const mixKnob = buildKnob(`fx${i}_mix`, 32);
    mixKnob.style.display = 'none';

    const paramsWrap = document.createElement('div');
    paramsWrap.className = 'fx-slot-params';

    const delayGroup = document.createElement('div');
    delayGroup.className = 'fx-param-group';
    delayGroup.appendChild(buildKnob(`fx${i}_delay_time`, 30));
    delayGroup.appendChild(buildKnob(`fx${i}_delay_feedback`, 30));

    const chorusGroup = document.createElement('div');
    chorusGroup.className = 'fx-param-group';
    chorusGroup.appendChild(buildKnob(`fx${i}_chorus_rate`, 30));
    chorusGroup.appendChild(buildKnob(`fx${i}_chorus_depth`, 30));

    const reverbGroup = document.createElement('div');
    reverbGroup.className = 'fx-param-group';
    reverbGroup.appendChild(buildKnob(`fx${i}_reverb_t60`, 30));

    const distortionGroup = document.createElement('div');
    distortionGroup.className = 'fx-param-group';
    distortionGroup.appendChild(buildKnob(`fx${i}_distortion_drive`, 30));

    paramsWrap.appendChild(delayGroup);
    paramsWrap.appendChild(chorusGroup);
    paramsWrap.appendChild(reverbGroup);
    paramsWrap.appendChild(distortionGroup);

    function updateFxVisibility(typeIndex: number) {
      const isOff = typeIndex === 0;
      mixKnob.style.display = isOff ? 'none' : '';
      delayGroup.style.display = typeIndex === 1 ? 'flex' : 'none';
      chorusGroup.style.display = typeIndex === 2 ? 'flex' : 'none';
      reverbGroup.style.display = typeIndex === 3 ? 'flex' : 'none';
      distortionGroup.style.display = typeIndex === 4 ? 'flex' : 'none';
    }

    updateFxVisibility(0);

    onParam(`fx${i}_type`, (v) => {
      const idx = Math.round(v * (FX_TYPES.length - 1));
      updateFxVisibility(idx);
    });

    slotMain.appendChild(typeDropdown);
    slotMain.appendChild(mixKnob);

    slot.appendChild(slotLabel);
    slot.appendChild(slotMain);
    slot.appendChild(paramsWrap);

    (i < 2 ? rackColA : rackColB).appendChild(slot);
  }

  fxRowWrap.appendChild(panel);

  const fxSidePanel = document.createElement('div');
  fxSidePanel.className = 'panel fx-side-panel';
  fxSidePanel.appendChild(buildKnob('num_voices', 38));
  fxSidePanel.appendChild(buildKnob('pitch_bend_range', 38));
  const portamentoKnob = buildKnob('portamento_time', 38);
  portamentoKnob.style.gridColumn = '1 / -1';
  portamentoKnob.style.justifySelf = 'center';
  fxSidePanel.appendChild(portamentoKnob);
  fxRowWrap.appendChild(fxSidePanel);

  leftCol.appendChild(fxRowWrap);
}

// ---------------------------------------------------------------------------
// Right column: Master
// ---------------------------------------------------------------------------
const rightCol = document.createElement('div');
rightCol.className = 'right-col';
mainLayout.appendChild(rightCol);

// Master
{
  const masterPanel = document.createElement('div');
  masterPanel.className = 'panel master-panel';
  masterPanel.style.flexDirection = 'row';
  masterPanel.style.alignItems = 'center';
  masterPanel.style.justifyContent = 'flex-end';
  masterPanel.style.padding = '6px 16px';

  const masterWrap = document.createElement('div');
  masterWrap.style.display = 'flex';
  masterWrap.style.flexDirection = 'column';
  masterWrap.style.alignItems = 'center';
  masterWrap.style.gap = '6px';

  masterWrap.appendChild(buildKnob('master_volume', 52));

  masterPanel.appendChild(masterWrap);
  rightCol.appendChild(masterPanel);
}

notifyHostReady();
