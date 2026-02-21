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

const PARAMS: ParamDef[] = [
  // OSC 1
  { id: 'osc1_type',   label: 'OSC1 Type',   min: 0, max: 4, defaultValue: 1, type: 'combo', options: OSC_TYPES },
  { id: 'osc1_level',  label: 'OSC1 Level',  min: 0, max: 1, defaultValue: 0.7, type: 'slider' },
  { id: 'osc1_detune', label: 'OSC1 Detune', min: -50, max: 50, defaultValue: 0, type: 'slider' },
  { id: 'osc1_octave', label: 'OSC1 Octave', min: -2, max: 2, defaultValue: 0, step: 1, type: 'slider' },
  // OSC 2
  { id: 'osc2_type',   label: 'OSC2 Type',   min: 0, max: 4, defaultValue: 0, type: 'combo', options: OSC_TYPES },
  { id: 'osc2_level',  label: 'OSC2 Level',  min: 0, max: 1, defaultValue: 0, type: 'slider' },
  { id: 'osc2_detune', label: 'OSC2 Detune', min: -50, max: 50, defaultValue: 0, type: 'slider' },
  { id: 'osc2_octave', label: 'OSC2 Octave', min: -2, max: 2, defaultValue: 0, step: 1, type: 'slider' },
  // Filter
  { id: 'filter_type',       label: 'Filter Type', min: 0, max: 3, defaultValue: 1, type: 'combo', options: FILTER_TYPES },
  { id: 'filter_cutoff',     label: 'Cutoff',      min: 20, max: 20000, defaultValue: 2000, type: 'slider' },
  { id: 'filter_resonance',  label: 'Resonance',   min: 0, max: 1, defaultValue: 0.3, type: 'slider' },
  { id: 'filter_env_amount', label: 'Env Amt',     min: 0, max: 1, defaultValue: 0, type: 'slider' },
  // Filter envelope
  { id: 'fenv_attack',  label: 'F Atk', min: 1, max: 5000, defaultValue: 10,  type: 'slider' },
  { id: 'fenv_decay',   label: 'F Dec', min: 1, max: 5000, defaultValue: 300, type: 'slider' },
  { id: 'fenv_sustain', label: 'F Sus', min: 0, max: 1,    defaultValue: 0,   type: 'slider' },
  { id: 'fenv_release', label: 'F Rel', min: 1, max: 5000, defaultValue: 200, type: 'slider' },
  // Amp envelope
  { id: 'aenv_attack',  label: 'A Atk', min: 1, max: 5000, defaultValue: 10,  type: 'slider' },
  { id: 'aenv_decay',   label: 'A Dec', min: 1, max: 5000, defaultValue: 200, type: 'slider' },
  { id: 'aenv_sustain', label: 'A Sus', min: 0, max: 1,    defaultValue: 0.7, type: 'slider' },
  { id: 'aenv_release', label: 'A Rel', min: 1, max: 5000, defaultValue: 500, type: 'slider' },
  // FX slots
  ...([0, 1, 2, 3] as const).flatMap((i) => [
    { id: `fx${i}_type`,           label: `FX${i} Type`,  min: 0, max: 3,    defaultValue: 0,   type: 'combo' as const, options: FX_TYPES },
    { id: `fx${i}_mix`,            label: `FX${i} Mix`,   min: 0, max: 1,    defaultValue: 0.3, type: 'slider' as const },
    { id: `fx${i}_delay_time`,     label: 'Dly Time',     min: 10, max: 1000, defaultValue: 250, type: 'slider' as const },
    { id: `fx${i}_delay_feedback`, label: 'Dly Fb',       min: 0, max: 0.99, defaultValue: 0.3, type: 'slider' as const },
    { id: `fx${i}_chorus_rate`,    label: 'Chr Rate',     min: 0.1, max: 10, defaultValue: 0.5, type: 'slider' as const },
    { id: `fx${i}_chorus_depth`,   label: 'Chr Depth',    min: 0, max: 1,    defaultValue: 0.4, type: 'slider' as const },
    { id: `fx${i}_reverb_t60`,     label: 'Rvb T60',      min: 0.1, max: 10, defaultValue: 2.0, type: 'slider' as const },
  ]),
  // Master
  { id: 'master_volume', label: 'Master', min: 0, max: 1, defaultValue: 0.8, type: 'slider' },
];

// ---------------------------------------------------------------------------
// Minimal UI — renders all parameters as native HTML controls.
// Replace this section with your own styled TS/JS components.
// ---------------------------------------------------------------------------

const app = document.getElementById('app')!;

// Inject baseline styles
const style = document.createElement('style');
style.textContent = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #2e231a;
    color: #e0e0e0;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    overflow-x: hidden;
  }
  h1 {
    background: #0f3460;
    text-align: center;
    padding: 6px;
    font-size: 14px;
    letter-spacing: 2px;
    color: #e94560;
  }
  .sections {
    display: flex;
    gap: 8px;
    padding: 8px;
    flex-wrap: wrap;
  }
  .section {
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 6px;
    padding: 8px;
    flex: 1 1 160px;
  }
  .section h2 {
    font-size: 10px;
    color: #888899;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
    border-bottom: 1px solid #0f3460;
    padding-bottom: 4px;
  }
  .param-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .param-row label {
    width: 70px;
    color: #888899;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  input[type=range] {
    flex: 1;
    accent-color: #e94560;
    min-width: 0;
  }
  select {
    flex: 1;
    background: #0f3460;
    color: #e0e0e0;
    border: none;
    border-radius: 3px;
    padding: 2px 4px;
  }
  .param-row span {
    width: 42px;
    text-align: right;
    color: #888899;
    flex-shrink: 0;
  }
`;
document.head.appendChild(style);

const title = document.createElement('h1');
title.textContent = 'SUBTREACTIONAL';
app.appendChild(title);

const sections = document.createElement('div');
sections.className = 'sections';
app.appendChild(sections);

// Group params into named sections
const SECTION_ORDER: { title: string; ids: string[] }[] = [
  { title: 'OSC 1',         ids: ['osc1_type','osc1_level','osc1_detune','osc1_octave'] },
  { title: 'OSC 2',         ids: ['osc2_type','osc2_level','osc2_detune','osc2_octave'] },
  { title: 'Filter',        ids: ['filter_type','filter_cutoff','filter_resonance','filter_env_amount'] },
  { title: 'Filter Env',    ids: ['fenv_attack','fenv_decay','fenv_sustain','fenv_release'] },
  { title: 'Amp Env',       ids: ['aenv_attack','aenv_decay','aenv_sustain','aenv_release'] },
  ...[0,1,2,3].map((i) => ({
    title: `FX ${i}`,
    ids: [`fx${i}_type`,`fx${i}_mix`,`fx${i}_delay_time`,`fx${i}_delay_feedback`,
          `fx${i}_chorus_rate`,`fx${i}_chorus_depth`,`fx${i}_reverb_t60`],
  })),
  { title: 'Master',        ids: ['master_volume'] },
];

const paramMap = new Map(PARAMS.map((p) => [p.id, p]));

for (const sec of SECTION_ORDER) {
  const div = document.createElement('div');
  div.className = 'section';
  const h2 = document.createElement('h2');
  h2.textContent = sec.title;
  div.appendChild(h2);

  for (const id of sec.ids) {
    const def = paramMap.get(id);
    if (!def) continue;

    const row = document.createElement('div');
    row.className = 'param-row';

    const lbl = document.createElement('label');
    lbl.textContent = def.label;
    row.appendChild(lbl);

    if (def.type === 'combo' && def.options) {
      const sel = document.createElement('select');
      def.options.forEach((opt, idx) => {
        const o = document.createElement('option');
        o.value = String(idx);
        o.textContent = opt;
        sel.appendChild(o);
      });
      sel.value = String(def.defaultValue);

      sel.addEventListener('change', () => {
        // APVTS combo params take a normalised value: (index) / (numChoices - 1)
        const idx = Number(sel.value);
        const norm = def.options!.length > 1 ? idx / (def.options!.length - 1) : 0;
        setParam(id, norm);
      });

      onParam(id, (v) => {
        // C++ pushes the normalised value; convert back to index
        const idx = Math.round(v * (def.options!.length - 1));
        sel.value = String(idx);
      });

      row.appendChild(sel);
    } else {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step ?? (def.max - def.min) / 1000);
      input.value = String(def.defaultValue);

      const display = document.createElement('span');
      display.textContent = def.defaultValue.toFixed(2);

      input.addEventListener('input', () => {
        display.textContent = Number(input.value).toFixed(2);
        // APVTS sliders take normalised 0..1
        const norm = (Number(input.value) - def.min) / (def.max - def.min);
        setParam(id, norm);
      });

      onParam(id, (v) => {
        // C++ pushes normalised value; convert to display range
        const raw = def.min + v * (def.max - def.min);
        input.value = String(raw);
        display.textContent = raw.toFixed(2);
      });

      row.appendChild(input);
      row.appendChild(display);
    }

    div.appendChild(row);
  }

  sections.appendChild(div);
}
