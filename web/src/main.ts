import { setParam, onParam } from './bridge';

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

const OSC_TYPES = ['Off', 'Saw', 'Square', 'Sine', 'Tri'];
const FILTER_TYPES = ['Off', 'LP', 'HP', 'BP'];
const FX_TYPES = ['Off', 'Delay', 'Chorus', 'Reverb'];
const VOICE_COUNTS = Array.from({ length: 16 }, (_, i) => String(i + 1)); // '1' to '16'

const PARAMS: ParamDef[] = [
  // OSC 1
  { id: 'osc1_type',   label: 'OSC1 Type',   min: 0, max: 4, defaultValue: 1, type: 'combo', options: OSC_TYPES },
  { id: 'osc1_level',  label: 'Level',       min: 0, max: 1, defaultValue: 0.7, type: 'slider' },
  { id: 'osc1_detune', label: 'Detune',      min: -50, max: 50, defaultValue: 0, type: 'slider' },
  { id: 'osc1_octave', label: 'Octave',      min: -2, max: 2, defaultValue: 0, step: 1, type: 'slider' },
  // OSC 2
  { id: 'osc2_type',   label: 'OSC2 Type',   min: 0, max: 4, defaultValue: 0, type: 'combo', options: OSC_TYPES },
  { id: 'osc2_level',  label: 'Level',       min: 0, max: 1, defaultValue: 0, type: 'slider' },
  { id: 'osc2_detune', label: 'Detune',      min: -50, max: 50, defaultValue: 0, type: 'slider' },
  { id: 'osc2_octave', label: 'Octave',      min: -2, max: 2, defaultValue: 0, step: 1, type: 'slider' },
  // Filter
  { id: 'filter_type',       label: 'Type',    min: 0, max: 3, defaultValue: 1, type: 'combo', options: FILTER_TYPES },
  { id: 'filter_cutoff',     label: 'Cutoff',  min: 20, max: 20000, defaultValue: 2000, type: 'slider' },
  { id: 'filter_resonance',  label: 'Res',     min: 0, max: 1, defaultValue: 0.3, type: 'slider' },
  { id: 'filter_env_amount', label: 'Env Amt', min: 0, max: 1, defaultValue: 0, type: 'slider' },
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
    { id: `fx${i}_type`,           label: `FX${i} Type`,  min: 0, max: 3,    defaultValue: 0,   type: 'combo' as const, options: FX_TYPES },
    { id: `fx${i}_mix`,            label: 'Mix',          min: 0, max: 1,    defaultValue: 0.3, type: 'slider' as const },
    { id: `fx${i}_delay_time`,     label: 'Dly Time',     min: 10, max: 1000, defaultValue: 250, type: 'slider' as const },
    { id: `fx${i}_delay_feedback`, label: 'Dly Fb',       min: 0, max: 0.99, defaultValue: 0.3, type: 'slider' as const },
    { id: `fx${i}_chorus_rate`,    label: 'Chr Rate',     min: 0.1, max: 10, defaultValue: 0.5, type: 'slider' as const },
    { id: `fx${i}_chorus_depth`,   label: 'Chr Depth',    min: 0, max: 1,    defaultValue: 0.4, type: 'slider' as const },
    { id: `fx${i}_reverb_t60`,     label: 'Rvb T60',      min: 0.1, max: 10, defaultValue: 2.0, type: 'slider' as const },
  ]),
  // Master
  { id: 'master_volume', label: 'Master', min: 0, max: 1, defaultValue: 0.8, type: 'slider' },
  // Voice count
  { id: 'num_voices', label: 'Voices', min: 0, max: 15, defaultValue: 7, type: 'combo', options: VOICE_COUNTS },
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
    max-height: 120px;
    overflow-y: auto;
    display: none;
  }

  .dropdown-panel.open {
    display: block;
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
  .fx-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
  }

  .fx-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .fx-type-wrap {
    flex: 0 0 70px;
  }

  .master-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 4px;
    padding: 6px 10px;
  }

  /* Divider between OSC/Filter and Envelopes */
  .divider {
    height: 1px;
    background: ${C.offDark3};
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
    panel.classList.add('open');
    chevron.classList.add('open');
  }

  function closePanel() {
    panel.classList.remove('open');
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
  panel.style.minWidth = '110px';
  panel.appendChild(buildDropdown('osc1_type', 92));
  panel.appendChild(makeKnobsRow(
    buildKnob('osc1_level', 44),
    buildKnob('osc1_detune', 44),
    buildKnob('osc1_octave', 44),
  ));
  topRow.appendChild(panel);
}

// OSC 2
{
  const { panel } = makePanel('OSC 2');
  panel.style.minWidth = '110px';
  panel.appendChild(buildDropdown('osc2_type', 92));
  panel.appendChild(makeKnobsRow(
    buildKnob('osc2_level', 44),
    buildKnob('osc2_detune', 44),
    buildKnob('osc2_octave', 44),
  ));
  topRow.appendChild(panel);
}

// Filter
{
  const { panel } = makePanel('Filter');
  panel.style.minWidth = '120px';
  panel.appendChild(buildDropdown('filter_type', 92));
  panel.appendChild(makeKnobsRow(
    buildKnob('filter_cutoff', 44),
    buildKnob('filter_resonance', 44),
    buildKnob('filter_env_amount', 44),
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
  panel.appendChild(makeKnobsRow(
    buildKnob('aenv_attack', 40),
    buildKnob('aenv_decay', 40),
    buildKnob('aenv_sustain', 40),
    buildKnob('aenv_release', 40),
  ));
  envRow.appendChild(panel);
}

// FX grid (below envelopes)
const fxGrid = document.createElement('div');
fxGrid.className = 'fx-grid';
leftCol.appendChild(fxGrid);

// ---------------------------------------------------------------------------
// Right column: Master
// ---------------------------------------------------------------------------
const rightCol = document.createElement('div');
rightCol.className = 'right-col';
mainLayout.appendChild(rightCol);

for (let i = 0; i < 4; i++) {
  const { panel } = makePanel(`FX ${i}`);
  panel.className = 'panel fx-panel';

  // FX type dropdown
  const typeRow = document.createElement('div');
  typeRow.className = 'fx-row';
  typeRow.appendChild(buildDropdown(`fx${i}_type`, 80));
  panel.appendChild(typeRow);

  // Mix knob (shown for all non-Off types)
  const mixRow = document.createElement('div');
  mixRow.className = 'knobs-row';
  mixRow.appendChild(buildKnob(`fx${i}_mix`, 36));
  panel.appendChild(mixRow);

  // Delay params
  const delayRow = document.createElement('div');
  delayRow.className = 'knobs-row';
  delayRow.appendChild(buildKnob(`fx${i}_delay_time`, 34));
  delayRow.appendChild(buildKnob(`fx${i}_delay_feedback`, 34));
  panel.appendChild(delayRow);

  // Chorus params
  const chorusRow = document.createElement('div');
  chorusRow.className = 'knobs-row';
  chorusRow.appendChild(buildKnob(`fx${i}_chorus_rate`, 34));
  chorusRow.appendChild(buildKnob(`fx${i}_chorus_depth`, 34));
  panel.appendChild(chorusRow);

  // Reverb params
  const reverbRow = document.createElement('div');
  reverbRow.className = 'knobs-row';
  reverbRow.appendChild(buildKnob(`fx${i}_reverb_t60`, 34));
  panel.appendChild(reverbRow);

  // Show/hide rows based on FX type: 0=Off, 1=Delay, 2=Chorus, 3=Reverb
  function updateFxVisibility(typeIndex: number) {
    mixRow.style.display    = typeIndex === 0 ? 'none' : 'flex';
    delayRow.style.display  = typeIndex === 1 ? 'flex' : 'none';
    chorusRow.style.display = typeIndex === 2 ? 'flex' : 'none';
    reverbRow.style.display = typeIndex === 3 ? 'flex' : 'none';
  }

  updateFxVisibility(0); // default: Off

  onParam(`fx${i}_type`, (v) => {
    const idx = Math.round(v * (FX_TYPES.length - 1));
    updateFxVisibility(idx);
  });

  fxGrid.appendChild(panel);
}

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

  // Voice count dropdown
  const voicesWrap = document.createElement('div');
  voicesWrap.style.display = 'flex';
  voicesWrap.style.flexDirection = 'column';
  voicesWrap.style.alignItems = 'center';
  voicesWrap.style.gap = '2px';
  const voicesLabel = document.createElement('div');
  voicesLabel.textContent = 'Voices';
  voicesLabel.style.fontSize = '9px';
  voicesLabel.style.color = C.white48;
  voicesLabel.style.textTransform = 'uppercase';
  voicesLabel.style.letterSpacing = '0.5px';
  voicesLabel.style.fontFamily = "'Inter', system-ui, sans-serif";
  voicesWrap.appendChild(voicesLabel);
  voicesWrap.appendChild(buildDropdown('num_voices', 60));
  masterWrap.appendChild(voicesWrap);

  masterPanel.appendChild(masterWrap);
  rightCol.appendChild(masterPanel);
}
