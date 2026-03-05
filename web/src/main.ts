import { setParam, onParam, onWaveform, onSpectrogram, onLFO, notifyHostReady, sendModAdd, sendModRemove, sendModSetDepth, onModAssignments, onPresets, onVersion, sendLoadFactoryPreset, sendLoadUserPreset, sendSavePreset, type PresetInfo } from './bridge';

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
  skew?: number;  // JUCE NormalisableRange skewFactor; value = min + (max-min) * norm^(1/skew)
  type: 'slider' | 'combo';
  options?: string[];
}

/** Convert normalised 0..1 knob position → actual parameter value (accounts for skew). */
function normToRaw(norm: number, def: ParamDef): number {
  if (def.skew && def.skew !== 1) {
    return def.min + (def.max - def.min) * Math.pow(norm, 1 / def.skew);
  }
  return def.min + norm * (def.max - def.min);
}

/** Convert actual parameter value → normalised 0..1 (accounts for skew). */
function rawToNorm(raw: number, def: ParamDef): number {
  if (def.skew && def.skew !== 1) {
    const t = (raw - def.min) / (def.max - def.min);
    return Math.pow(Math.max(0, t), def.skew);
  }
  return (raw - def.min) / (def.max - def.min);
}

const OSC_TYPES = ['Off', 'Saw', 'Square', 'Sine', 'Tri', 'Noise'];
const FILTER_TYPES = ['Off', 'LP', 'HP', 'BP'];
const FX_TYPES = ['Off', 'Delay', 'Chorus', 'Flanger', 'Phaser', 'VHS', 'Reverb', 'Distortion', 'EQ'];
const PLAY_MODES = ['Poly', 'Mono', 'Legato'];
const LFO_SHAPES = ['Sine', 'Tri', 'Saw', 'Square'];
const VOICE_COUNTS = Array.from({ length: 16 }, (_, i) => String(i + 1)); // '1' to '16'

const PARAMS: ParamDef[] = [
  // OSC 1
  { id: 'osc1_type',         label: 'OSC1 Type',  min: 0, max: 5,   defaultValue: 1,   type: 'combo', options: OSC_TYPES },
  { id: 'osc1_pitch',        label: 'Pitch',      min: -24, max: 24, defaultValue: 0,  step: 0.01, type: 'slider' },
  { id: 'osc1_level',        label: 'Level',      min: 0, max: 1,   defaultValue: 0.7, type: 'slider' },
  { id: 'osc1_detune',       label: 'Detune',     min: -50, max: 50, defaultValue: 0,  type: 'slider' },
  { id: 'osc1_octave',       label: 'Octave',     min: -2, max: 2,  defaultValue: 0,   step: 1, type: 'slider' },
  { id: 'osc1_pulse_width',  label: 'Pulse',      min: 0, max: 1,   defaultValue: 0.5, type: 'slider' },
  { id: 'osc1_pan',          label: 'Pan',        min: -1, max: 1,  defaultValue: 0,   type: 'slider' },
  { id: 'osc1_pan_spread',   label: 'Spread',     min: 0, max: 1,   defaultValue: 1,   type: 'slider' },
  // OSC 2
  { id: 'osc2_type',         label: 'OSC2 Type',  min: 0, max: 5,   defaultValue: 0,   type: 'combo', options: OSC_TYPES },
  { id: 'osc2_pitch',        label: 'Pitch',      min: -24, max: 24, defaultValue: 0,  step: 0.01, type: 'slider' },
  { id: 'osc2_level',        label: 'Level',      min: 0, max: 1,   defaultValue: 0,   type: 'slider' },
  { id: 'osc2_detune',       label: 'Detune',     min: -50, max: 50, defaultValue: 0,  type: 'slider' },
  { id: 'osc2_octave',       label: 'Octave',     min: -2, max: 2,  defaultValue: 0,   step: 1, type: 'slider' },
  { id: 'osc2_pulse_width',  label: 'Pulse',      min: 0, max: 1,   defaultValue: 0.5, type: 'slider' },
  { id: 'osc2_pan',          label: 'Pan',        min: -1, max: 1,  defaultValue: 0,   type: 'slider' },
  { id: 'osc2_pan_spread',   label: 'Spread',     min: 0, max: 1,   defaultValue: 1,   type: 'slider' },
  // Sub Oscillator
  { id: 'sub_level',         label: 'Sub',        min: 0, max: 1, defaultValue: 0, type: 'slider' },
  // Filter
  { id: 'filter_type',       label: 'Type',       min: 0, max: 3, defaultValue: 1, type: 'combo', options: FILTER_TYPES },
  { id: 'filter_cutoff',     label: 'Cutoff',     min: 20, max: 20000, defaultValue: 2000, skew: 0.25, type: 'slider' },
  { id: 'filter_resonance',  label: 'Res',        min: 0, max: 1, defaultValue: 0.3, type: 'slider' },
  { id: 'filter_env_amount', label: 'Env Amt',    min: 0, max: 1, defaultValue: 0, type: 'slider' },
  { id: 'filter_vel_amount', label: 'Vel Amt',    min: 0, max: 1, defaultValue: 0, type: 'slider' },
  // Ring Modulation
  { id: 'ring_mod',          label: 'Ring Mod',   min: 0, max: 1, defaultValue: 0, type: 'slider' },
  // Filter envelope
  { id: 'fenv_attack',  label: 'Atk', min: 1, max: 5000, defaultValue: 10,  skew: 0.25, type: 'slider' },
  { id: 'fenv_decay',   label: 'Dec', min: 1, max: 5000, defaultValue: 300, skew: 0.25, type: 'slider' },
  { id: 'fenv_sustain', label: 'Sus', min: 0, max: 1,    defaultValue: 0,   type: 'slider' },
  { id: 'fenv_release', label: 'Rel', min: 1, max: 5000, defaultValue: 200, skew: 0.25, type: 'slider' },
  // Amp envelope
  { id: 'aenv_attack',  label: 'Atk', min: 1, max: 5000, defaultValue: 10,  skew: 0.25, type: 'slider' },
  { id: 'aenv_decay',   label: 'Dec', min: 1, max: 5000, defaultValue: 200, skew: 0.25, type: 'slider' },
  { id: 'aenv_sustain', label: 'Sus', min: 0, max: 1,    defaultValue: 0.7, type: 'slider' },
  { id: 'aenv_release', label: 'Rel', min: 1, max: 5000, defaultValue: 500, skew: 0.25, type: 'slider' },
  // FX slots — types: 0=Off,1=Delay,2=Chorus,3=Flanger,4=Phaser,5=VHS,6=Reverb,7=Distortion,8=EQ
  ...([0, 1, 2, 3] as const).flatMap((i) => [
    { id: `fx${i}_type`,             label: `FX${i} Type`,    min: 0, max: 8,    defaultValue: 0,    type: 'combo' as const, options: FX_TYPES },
    { id: `fx${i}_mix`,              label: 'Mix',             min: 0, max: 1,    defaultValue: 0.3,  type: 'slider' as const },
    { id: `fx${i}_delay_time`,       label: 'Time',        min: 10, max: 1000, defaultValue: 250, type: 'slider' as const },
    { id: `fx${i}_delay_feedback`,   label: 'Fb',          min: 0, max: 0.99, defaultValue: 0.3,  type: 'slider' as const },
    { id: `fx${i}_chorus_rate`,      label: 'Rate',            min: 0.1, max: 10, defaultValue: 0.5,  type: 'slider' as const },
    { id: `fx${i}_chorus_depth`,     label: 'Dpth',           min: 0, max: 1,    defaultValue: 0.4,  type: 'slider' as const },
    { id: `fx${i}_reverb_t60`,        label: 'T60',       min: 0.1, max: 10,    defaultValue: 2.0,    type: 'slider' as const },
    { id: `fx${i}_reverb_damping`,    label: 'Damp',      min: 500, max: 20000, defaultValue: 6000.0, type: 'slider' as const },
    { id: `fx${i}_reverb_input_lpf`,  label: 'In LPF',    min: 100, max: 20000, defaultValue: 500, type: 'slider' as const },
    { id: `fx${i}_distortion_drive`, label: 'Drive',           min: 0, max: 10,   defaultValue: 1.0,  type: 'slider' as const },
    { id: `fx${i}_vhs_wow_rate`,     label: 'Wow',             min: 0.1, max: 5,  defaultValue: 0.35, type: 'slider' as const },
    { id: `fx${i}_vhs_wow_depth`,    label: 'Wow%',           min: 0, max: 1,    defaultValue: 0.25, type: 'slider' as const },
    { id: `fx${i}_vhs_flutter_rate`, label: 'Fltr',            min: 1, max: 20,   defaultValue: 6.0,  type: 'slider' as const },
    { id: `fx${i}_vhs_flutter_depth`,label: 'Fltr%',          min: 0, max: 1,    defaultValue: 0.15, type: 'slider' as const },
    { id: `fx${i}_vhs_drive`,        label: 'Drive',           min: 0, max: 1,    defaultValue: 0.25, type: 'slider' as const },
    { id: `fx${i}_vhs_tone`,         label: 'Tone',            min: 0, max: 1,    defaultValue: 0.35, type: 'slider' as const },
    { id: `fx${i}_vhs_noise`,        label: 'Noise',           min: 0, max: 1,    defaultValue: 0.1,  type: 'slider' as const },
    { id: `fx${i}_vhs_dropout`,      label: 'Drop',            min: 0, max: 1,    defaultValue: 0.05, type: 'slider' as const },
    { id: `fx${i}_eq_low_freq`,      label: 'Lo Hz',       min: 20,   max: 1000,  defaultValue: 300,  type: 'slider' as const },
    { id: `fx${i}_eq_low_gain`,      label: 'Lo dB',       min: -48,  max: 12,    defaultValue: 0,    type: 'slider' as const },
    { id: `fx${i}_eq_mid_gain`,      label: 'Mid dB',      min: -48,  max: 12,    defaultValue: 0,    type: 'slider' as const },
    { id: `fx${i}_eq_high_freq`,     label: 'Hi Hz',       min: 1000, max: 20000, defaultValue: 5000, type: 'slider' as const },
    { id: `fx${i}_eq_high_gain`,     label: 'Hi dB',       min: -48,  max: 12,    defaultValue: 0,    type: 'slider' as const },
  ]),
  // Master
  { id: 'master_volume',    label: 'Master',     min: 0, max: 1,    defaultValue: 0.8, type: 'slider' },
  { id: 'pitch_bend_range', label: 'Pitch Bend', min: 0, max: 24,   defaultValue: 2,   step: 1, type: 'slider' },
  { id: 'portamento_time',  label: 'Portamento', min: 0, max: 1000, defaultValue: 0,   type: 'slider' },
  { id: 'pan_spread',       label: 'Pan Spread', min: 0, max: 1,    defaultValue: 1,   type: 'slider' },
  { id: 'play_mode',        label: 'Mode',       min: 0, max: 2,    defaultValue: 0,   type: 'combo', options: PLAY_MODES },
  // Voice count
  { id: 'num_voices', label: 'Voices', min: 0, max: 15, defaultValue: 7, type: 'combo', options: VOICE_COUNTS },
  // LFO 1-4
  ...([0, 1, 2, 3] as const).flatMap((i) => [
    { id: `lfo${i}_rate`,  label: `LFO${i+1} Rate`, min: 0.1, max: 20, defaultValue: 1, step: 0.01, type: 'slider' as const },
    { id: `lfo${i}_depth`, label: 'Depth', min: 0, max: 1, defaultValue: 0, type: 'slider' as const },
    { id: `lfo${i}_shape`, label: 'Shape', min: 0, max: 3, defaultValue: 0, type: 'combo' as const, options: LFO_SHAPES },
  ]),
  // Macros 1-4 (with CC assignments)
  ...([0, 1, 2, 3] as const).flatMap((i) => {
    const ccDefaults = [70, 71, 74, 75]; // Sound controller CCs
    return [
      { id: `macro${i}_value`, label: `Macro ${i+1}`, min: 0, max: 1, defaultValue: 0, type: 'slider' as const },
      { id: `macro${i}_cc`, label: `Macro ${i+1} CC`, min: -1, max: 127, defaultValue: -1, type: 'slider' as const },
    ];
  }),
];

// Modulation source colors (LFO 1-4 and Macro 1-4)
const LFO_COLORS = ['#825CED', '#F38E30', '#2DD4BF', '#86EFAC'];
const MACRO_COLORS = ['#F04E4E', '#4EF0A3', '#F0C24E', '#4E90F0'];

// Maps UI param IDs to C modulation param names (dot notation for st_synth_mod_add)
const MOD_PARAM_NAMES: Record<string, string> = {
  'osc1_pitch':       'osc1.pitch',
  'osc1_level':       'osc1.level',
  'osc1_detune':      'osc1.detune',
  'osc1_pulse_width': 'osc1.pulse_width',
  'osc1_pan':         'osc1.pan',
  'osc2_pitch':       'osc2.pitch',
  'osc2_level':       'osc2.level',
  'osc2_detune':      'osc2.detune',
  'osc2_pulse_width': 'osc2.pulse_width',
  'osc2_pan':         'osc2.pan',
  'sub_level':        'sub.level',
  'ring_mod':         'ring_mod',
  'filter_cutoff':    'filter.cutoff',
  'filter_resonance': 'filter.resonance',
  'fenv_attack':      'fenv.attack',
  'fenv_decay':       'fenv.decay',
  'fenv_sustain':     'fenv.sustain',
  'fenv_release':     'fenv.release',
  'aenv_attack':      'aenv.attack',
  'aenv_decay':       'aenv.decay',
  'aenv_sustain':     'aenv.sustain',
  'aenv_release':     'aenv.release',
  'pan_spread':       'pan_spread',
  'master_volume':    'master_volume',
  'fx0_mix':          'fx0.mix',
  'fx1_mix':          'fx1.mix',
  'fx2_mix':          'fx2.mix',
  'fx3_mix':          'fx3.mix',
};

// Reverse lookup: C mod param name → UI param ID
const MOD_PARAM_ID_FROM_NAME: Record<string, string> =
  Object.fromEntries(Object.entries(MOD_PARAM_NAMES).map(([id, name]) => [name, id]));

// ---------------------------------------------------------------------------
// Design tokens — ported from ge_core-webapp/src/styling.js
// ---------------------------------------------------------------------------

const C = {
  offWhite:        '#dddddd',
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
    width: 1000px;
    height: 530px;
    user-select: none;
    -webkit-user-select: none;
    cursor: default;
  }

  #app {
    display: flex;
    flex-direction: column;
    width: 1000px;
    height: 530px;
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

  .header-right {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .header-accent {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${C.purple};
    box-shadow: 0 0 8px ${C.purpleGlow};
    flex-shrink: 0;
  }

  .header-version {
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 1px;
    color: ${C.offDark5};
    user-select: none;
  }

  /* ─── Preset selector (header center) ───────────────────── */
  .preset-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .preset-name-btn {
    background: ${C.offDark3};
    border: 1px solid ${C.offDark5};
    border-radius: 4px;
    color: ${C.offWhite};
    font-size: 11px;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 3px 10px;
    cursor: pointer;
    min-width: 140px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: border-color 0.15s, background 0.15s;
  }
  .preset-name-btn:hover {
    border-color: ${C.purple};
    background: ${C.offDark4};
  }

  .preset-save-btn {
    background: transparent;
    border: 1px solid ${C.offDark5};
    border-radius: 4px;
    color: ${C.white48};
    font-size: 10px;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 3px 8px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .preset-save-btn:hover {
    border-color: ${C.purple};
    color: ${C.offWhite};
  }

  .preset-arrow-btn {
    background: transparent;
    border: none;
    color: ${C.white48};
    font-size: 13px;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
    transition: color 0.1s;
    user-select: none;
  }
  .preset-arrow-btn:hover { color: ${C.offWhite}; }

  /* ─── Preset modal ────────────────────────────────────────── */
  .preset-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .preset-modal {
    background: ${C.offDark2};
    border: 1px solid ${C.offDark4};
    border-radius: 8px;
    width: 520px;
    height: 380px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
  }

  .preset-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid ${C.offDark4};
    flex-shrink: 0;
  }
  .preset-modal-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: ${C.offWhite};
  }
  .preset-modal-close {
    background: none;
    border: none;
    color: ${C.white48};
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .preset-modal-close:hover { color: ${C.offWhite}; }

  .preset-modal-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .preset-categories {
    width: 90px;
    border-right: 1px solid ${C.offDark4};
    padding: 6px 0;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .preset-cat-btn {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 6px 12px;
    font-size: 11px;
    font-family: 'Inter', system-ui, sans-serif;
    color: ${C.white48};
    cursor: pointer;
    transition: color 0.1s, background 0.1s;
  }
  .preset-cat-btn:hover { color: ${C.offWhite}; background: ${C.offDark3}; }
  .preset-cat-btn.active { color: ${C.purple}; background: ${C.offDark3}; }

  .preset-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
  }
  .preset-list::-webkit-scrollbar { width: 4px; }
  .preset-list::-webkit-scrollbar-track { background: transparent; }
  .preset-list::-webkit-scrollbar-thumb { background: ${C.offDark5}; border-radius: 2px; }
  .preset-list::-webkit-scrollbar-thumb:hover { background: ${C.offDark5}; }

  .dropdown-panel::-webkit-scrollbar { width: 4px; }
  .dropdown-panel::-webkit-scrollbar-track { background: transparent; }
  .dropdown-panel::-webkit-scrollbar-thumb { background: ${C.offDark5}; border-radius: 2px; }
  .dropdown-panel::-webkit-scrollbar-thumb:hover { background: ${C.offDark5}; }

  .preset-item {
    padding: 8px 14px;
    cursor: pointer;
    border-left: 2px solid transparent;
    transition: background 0.1s, border-color 0.1s;
  }
  .preset-item:hover { background: ${C.offDark3}; }
  .preset-item.active { border-left-color: ${C.purple}; background: ${C.offDark3}; }
  .preset-item-name {
    font-size: 12px;
    color: ${C.offWhite};
    font-weight: 500;
    margin-bottom: 2px;
  }
  .preset-item-meta {
    font-size: 10px;
    color: ${C.white48};
  }
  .preset-item-desc {
    font-size: 10px;
    color: ${C.white48};
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .preset-item-user-badge {
    display: inline-block;
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 3px;
    background: ${C.offDark5};
    color: ${C.orange};
    margin-left: 5px;
  }

  /* ─── Save preset dialog ──────────────────────────────────── */
  .save-dialog {
    background: ${C.offDark2};
    border: 1px solid ${C.offDark4};
    border-radius: 8px;
    width: 320px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
  }
  .save-dialog-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: ${C.offWhite};
    margin-bottom: 2px;
  }
  .save-dialog input, .save-dialog textarea {
    background: ${C.offDark3};
    border: 1px solid ${C.offDark5};
    border-radius: 4px;
    color: ${C.offWhite};
    font-size: 11px;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 5px 8px;
    width: 100%;
    box-sizing: border-box;
    resize: none;
    outline: none;
    transition: border-color 0.15s;
  }
  .save-dialog input:focus, .save-dialog textarea:focus {
    border-color: ${C.purple};
  }
  .save-dialog label {
    font-size: 10px;
    color: ${C.white48};
    display: block;
    margin-bottom: 3px;
  }
  .save-dialog-row {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .save-dialog-cancel {
    background: none;
    border: 1px solid ${C.offDark5};
    border-radius: 4px;
    color: ${C.white48};
    font-size: 10px;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 4px 12px;
    cursor: pointer;
  }
  .save-dialog-confirm {
    background: ${C.purple};
    border: 1px solid ${C.purple};
    border-radius: 4px;
    color: white;
    font-size: 10px;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 4px 12px;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .save-dialog-confirm:hover { opacity: 0.85; }

  .main-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    padding: 4px;
    gap: 4px;
  }

  /* Left column: OSC + Filter + Envelopes + FX */
  .left-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-height: 0;
  }

  /* Top row of left col: OSC1 + OSC2 + Filter */
  .top-row {
    display: flex;
    gap: 4px;
  }

  /* Bottom row of left col: FilterEnv + AmpEnv */
  .env-row {
    display: flex;
    gap: 4px;
  }

  /* Middle column: LFOs + Macros */
  .mid-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 0 0 auto;
    width: 244px;
    overflow-y: auto;
  }

  /* Right column: Master */
  .right-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 0 0 auto;
  }

  .fx-grid {
    display: flex;
    gap: 4px;
    flex: 1;
    min-height: 0;
  }

  .panel {
    background: ${C.offDark2};
    border: 1px solid ${C.offDark3};
    border-radius: 4px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .panel-content-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;
    flex: 1;
  }

  .panel-title {
    font-size: 8px;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${C.white48};
    padding-bottom: 3px;
    border-bottom: 1px solid ${C.offDark3};
    flex-shrink: 0;
  }

  .knobs-row {
    display: flex;
    gap: 4px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .knob-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .knob-label {
    font-size: 9px;
    color: ${C.white24};
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
    position: relative;
    z-index: 1;
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
    z-index: 2000;
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

  /* Hide number input spinners */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type="number"] {
    -moz-appearance: textfield;
  }

  /* FX panel layout */
  .fx-rack {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px 6px;
    flex: 1;
    min-width: 0;
  }

  .fx-row-wrap {
    display: flex;
    gap: 4px;
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
    gap: 4px;
  }

  .fx-rack-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .fx-slot {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 60px;
    border: 1px solid ${C.offDark3};
    background: linear-gradient(-10deg, ${C.offDark3}, ${C.offDark2});
    border-radius: 10px;
  }

  .fx-slot-bg-label {
    position: absolute;
    right: 0px;
    bottom: -6px;
    font-size: 52px;
    font-weight: 1000;
    letter-spacing: -1px;
    text-transform: uppercase;
    color: ${C.offWhite};
    opacity: 0.025;
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    line-height: 1;
  }

  .fx-slot-label {
    flex: 0 0 16px;
    font-size: 9px;
    letter-spacing: 0.5px;
    color: ${C.white48};
    text-transform: uppercase;
    text-align: center;
    opacity: 0.25;
  }

  .fx-type-wrapper {
    margin-top: 25px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .fx-type-label {
    font-size: 12px;
    opacity: 0.2;
    color: ${C.offWhite};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 700;
    left: 25px;
    top: 25px;
    position: absolute;
  }

  .fx-slot-main {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .fx-slot-params {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .fx-params-scroll {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 3px;
    flex-wrap: wrap;
    min-height: 85px;
    max-height: 85px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .fx-param-placeholder {
    opacity: 0.3;
    pointer-events: none;
  }

  .fx-param-group {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 3px;
    flex-wrap: wrap;
    width: 100%;
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
    width: 100%;
    
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
    width: 100px;
    height: 90px;
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

  /* ─── Waveform selector ─────────────────────────────────────────── */
  .waveform-selector {
    display: flex;
    gap: 3px;
    align-items: center;
  }

  .wave-btn {
    width: 24px;
    height: 24px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    opacity: 0.4;
    transition: opacity 0.1s, border-color 0.1s;
  }

  .wave-btn:hover {
    opacity: 0.7;
  }

  .wave-btn.active {
    opacity: 1;
    border-color: var(--lfo-color, #825CED);
  }

  /* ─── LFO drag handle ───────────────────────────────────────────── */
  .lfo-drag-handle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    cursor: grab;
    flex-shrink: 0;
    transition: transform 0.1s;
    box-shadow: 0 0 6px var(--lfo-color, #825CED);
  }

  .lfo-drag-handle:hover {
    transform: scale(1.2);
  }

  .lfo-drag-handle:active {
    cursor: grabbing;
  }

  /* ─── Macro drag handle ─────────────────────────────────────────── */
  .macro-drag-handle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    cursor: grab;
    flex-shrink: 0;
    transition: transform 0.1s;
    box-shadow: 0 0 6px var(--lfo-color, #F04E4E);
  }

  .macro-drag-handle:hover {
    transform: scale(1.2);
  }

  .macro-drag-handle:active {
    cursor: grabbing;
  }

  /* ─── Modulation depth mini-knob ────────────────────────────────── */
  .mod-depth-knob {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    cursor: ns-resize;
    z-index: 10;
    transition: transform 0.1s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.6);
  }

  .mod-depth-knob:hover {
    transform: scale(1.2);
  }

  /* ─── Knob container drop zone ──────────────────────────────────── */
  .knob-container.drop-zone-ready {
    outline: 2px solid color-mix(in srgb, var(--drop-color, #825CED) 45%, transparent);
    outline-offset: 2px;
    border-radius: 50%;
    transition: outline-color 0.15s;
  }
  .knob-container.drop-target-active {
    outline: 2px solid var(--drop-color, #825CED);
    outline-offset: 2px;
    border-radius: 50%;
  }

  /* ─── Custom tooltips (fixed positioning) ────────────────────────────────────────── */
  [data-tooltip] {

  }

  .tooltip-portal {
    position: fixed;
    background: ${C.offDark3};
    color: ${C.offWhite};
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 10px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10001;
    border: 1px solid ${C.offDark4};
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
  }

  .tooltip-portal.visible {
    opacity: 1;
    visibility: visible;
  }
`;
document.head.appendChild(style);

// ---------------------------------------------------------------------------
// Tooltip system (fixed positioning portal)
// ---------------------------------------------------------------------------

const tooltipPortal = document.createElement('div');
tooltipPortal.className = 'tooltip-portal';
document.body.appendChild(tooltipPortal);

let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
let activeTooltipElement: HTMLElement | null = null;

function positionTooltip(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const text = el.getAttribute('data-tooltip') || '';

  tooltipPortal.textContent = text;

  // Position above the element, centered
  const tooltipRect = tooltipPortal.getBoundingClientRect();
  const left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  const top = rect.top - tooltipRect.height - 4;

  tooltipPortal.style.left = `${Math.max(0, left)}px`;
  tooltipPortal.style.top = `${Math.max(0, top)}px`;
}

function showTooltip(el: HTMLElement) {
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
  activeTooltipElement = el;

  tooltipTimeout = setTimeout(() => {
    if (activeTooltipElement === el) {
      positionTooltip(el);
      tooltipPortal.classList.add('visible');
    }
  }, 300); // 300ms delay before showing
}

function hideTooltip() {
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
  tooltipPortal.classList.remove('visible');
  activeTooltipElement = null;
}

// Attach listeners to all [data-tooltip] elements
document.addEventListener('mouseover', (e) => {
  const el = (e.target as HTMLElement).closest('[data-tooltip]');
  if (el && el.getAttribute('data-tooltip')) {
    showTooltip(el as HTMLElement);
  }
});

document.addEventListener('mouseout', (e) => {
  const el = (e.target as HTMLElement).closest('[data-tooltip]');
  if (el) {
    hideTooltip();
  }
});

document.addEventListener('mousemove', (e) => {
  if (activeTooltipElement && tooltipPortal.classList.contains('visible')) {
    positionTooltip(activeTooltipElement);
  }
  // Update value display position if active
  if (valueDisplayActive) {
    valueDisplayPortal.style.left = `${e.clientX + 8}px`;
    valueDisplayPortal.style.top = `${e.clientY - 16}px`;
  }
});

// ---------------------------------------------------------------------------
// Value display during knob drag
// ---------------------------------------------------------------------------

let valueDisplayActive = false;
const valueDisplayPortal = document.createElement('div');
valueDisplayPortal.className = 'tooltip-portal'; // reuse tooltip styling
valueDisplayPortal.style.zIndex = '10002'; // slightly higher than tooltip
document.body.appendChild(valueDisplayPortal);

function showValueDisplay(value: string) {
  valueDisplayActive = true;
  valueDisplayPortal.textContent = value;
  valueDisplayPortal.classList.add('visible');
}

function hideValueDisplay() {
  valueDisplayActive = false;
  valueDisplayPortal.classList.remove('visible');
}

function updateValueDisplay(value: string) {
  valueDisplayPortal.textContent = value;
}

// ---------------------------------------------------------------------------
// SVG Knob component
// ---------------------------------------------------------------------------

interface KnobOptions {
  size: number;
  min: number;
  max: number;
  defaultValue: number; // display-range default
  label: string;
  skew?: number;  // JUCE skewFactor: value = min + (max-min) * norm^(1/skew)
}

interface KnobControl {
  el: HTMLElement;
  setValue: (normValue: number) => void;
  setModIndicator: (normModulated: number | null) => void;
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
  // Arc uses polarToCartesian where deg=0 → 6-o'clock, so CSS equiv = (deg+180)%360.
  // Arc min at deg=45 → 225° CSS; arc max at deg=315 → 135° CSS (225+270=495=135°).
  // Starting at 225° (≈7:30) means norm=0.5 lands exactly at 0°/360° (12 o'clock, straight up).
  return 225 + normValue * 270;
}

function createKnob(opts: KnobOptions & { showLabel?: boolean }): KnobControl {
  const { size, min, max, defaultValue, label, skew, showLabel = true } = opts;
  const normDefault = skew && skew !== 1
    ? Math.pow(Math.max(0, (defaultValue - min) / (max - min)), skew)
    : (defaultValue - min) / (max - min);

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

  // Modulated value indicator — a small white dot on the arc rim
  const modDot = document.createElementNS(svgNS, 'circle');
  modDot.setAttribute('r', String(Math.max(1.2, size * 0.055)));
  modDot.setAttribute('fill', 'white');
  modDot.setAttribute('opacity', '0');
  modDot.style.filter = `drop-shadow(0 0 ${Math.max(1.5, size * 0.065)}px rgba(255,255,255,0.9))`;
  modDot.style.pointerEvents = 'none';
  svg.appendChild(modDot);

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
  if (showLabel)
    wrap.appendChild(lbl);

  // Animation state
  let currentNorm = normDefault;
  let targetNorm = normDefault;
  let rafId = 0;

  function formatVal(norm: number): string {
    const raw = skew && skew !== 1
      ? min + (max - min) * Math.pow(norm, 1 / skew)
      : min + norm * (max - min);
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
    setModIndicator(normMod: number | null) {
      if (normMod === null) {
        modDot.setAttribute('opacity', '0');
        // Revert arc to actual knob value
        if (currentNorm < 0.01) {
          arcPath.setAttribute('d', '');
        } else {
          arcPath.setAttribute('d', makeArcPath(cx, cy, arcR * 0.88, 45, 45 + currentNorm * 270));
        }
        return;
      }
      const norm = Math.max(0, Math.min(1, normMod));
      const arcAngle = 45 + norm * 270; // arc space: 45=7-o'clock, +270
      // Update arc to show modulated value (gradient fill follows modulation)
      if (norm < 0.01) {
        arcPath.setAttribute('d', '');
      } else {
        arcPath.setAttribute('d', makeArcPath(cx, cy, arcR * 0.88, 45, arcAngle));
      }
      // Update dot position
      const [dotX, dotY] = polarToCartesian(cx, cy, arcR * 0.88, arcAngle);
      modDot.setAttribute('cx', String(dotX.toFixed(2)));
      modDot.setAttribute('cy', String(dotY.toFixed(2)));
      modDot.setAttribute('opacity', '0.9');
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
    const rect = btn.getBoundingClientRect();
    const panelMaxHeight = 100;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenUpward = spaceBelow < panelMaxHeight && spaceAbove > spaceBelow;

    // Portal: move to document.body so it escapes all stacking contexts.
    // Use 'auto' not '' for top/bottom/right to override CSS class values
    // (.dropdown-panel has top:calc(100%+2px) and right:0 which would
    //  misbehave when position:fixed if left as inherited class values).
    document.body.appendChild(panel);
    panel.style.position = 'fixed';
    panel.style.width = rect.width + 'px';
    panel.style.left = rect.left + 'px';
    panel.style.right = 'auto';
    panel.style.zIndex = '9999';
    if (shouldOpenUpward) {
      panel.style.top = 'auto';
      panel.style.bottom = (window.innerHeight - rect.top + 2) + 'px';
    } else {
      panel.style.top = (rect.bottom + 2) + 'px';
      panel.style.bottom = 'auto';
    }
    panel.classList.add('open');
    chevron.classList.add('open');
  }

  function closePanel() {
    panel.classList.remove('open', 'open-upward');
    panel.style.position = '';
    panel.style.width = '';
    panel.style.left = '';
    panel.style.right = '';
    panel.style.top = '';
    panel.style.bottom = '';
    panel.style.zIndex = '';
    chevron.classList.remove('open');
    // Move panel back into its container
    if (panel.parentNode !== container) container.appendChild(panel);
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
header.style.position = 'relative';

const headerTitle = document.createElement('div');
headerTitle.className = 'header-title';
headerTitle.textContent = 'Subtreactional';

// Center: preset selector
const presetSelector = document.createElement('div');
presetSelector.className = 'preset-selector';

const presetPrevBtn = document.createElement('button');
presetPrevBtn.className = 'preset-arrow-btn';
presetPrevBtn.textContent = '‹';
presetPrevBtn.setAttribute('data-tooltip', 'Previous preset');
presetSelector.appendChild(presetPrevBtn);

const presetNameBtn = document.createElement('button');
presetNameBtn.className = 'preset-name-btn';
presetNameBtn.textContent = 'Init';
presetSelector.appendChild(presetNameBtn);

const presetNextBtn = document.createElement('button');
presetNextBtn.className = 'preset-arrow-btn';
presetNextBtn.textContent = '›';
presetNextBtn.setAttribute('data-tooltip', 'Next preset');
presetSelector.appendChild(presetNextBtn);

const presetSaveBtn = document.createElement('button');
presetSaveBtn.className = 'preset-save-btn';
presetSaveBtn.textContent = 'Save';
presetSelector.appendChild(presetSaveBtn);

const headerRight = document.createElement('div');
headerRight.className = 'header-right';

const headerAccent = document.createElement('div');
headerAccent.className = 'header-accent';

const headerVersion = document.createElement('span');
headerVersion.className = 'header-version';

headerRight.appendChild(headerAccent);
headerRight.appendChild(headerVersion);

header.appendChild(headerTitle);
header.appendChild(presetSelector);
header.appendChild(headerRight);

onVersion((v) => { headerVersion.textContent = `v${v}`; });
app.appendChild(header);

// Main layout
const mainLayout = document.createElement('div');
mainLayout.className = 'main-layout';
app.appendChild(mainLayout);

const paramMap = new Map(PARAMS.map((p) => [p.id, p]));

// Track macro state for the mod indicator RAF loop.
for (let i = 0; i < 4; i++) {
  onParam(`macro${i}_value`, (v) => { macroV[i] = v; });
}

// ---------------------------------------------------------------------------
// Modulation drag-and-drop infrastructure
// ---------------------------------------------------------------------------

interface ActiveDrag {
  type: 'lfo' | 'macro';
  idx: number;
  color: string;
}

interface ModDepthEntry {
  type: 'lfo' | 'macro';
  idx: number;
  color: string;
  depth: number;
  el: HTMLElement;
  updateArc: (depth: number) => void;
}

// ---------------------------------------------------------------------------
// Real-time modulation value visualisation
// ---------------------------------------------------------------------------

// Actual LFO output values pushed from C++ at ~30 Hz (raw * depth, -1..+1)
const lfoCurrentOutput = [0, 0, 0, 0];
onLFO((vals) => { for (let i = 0; i < 4; i++) lfoCurrentOutput[i] = vals[i] ?? 0; });

// LED elements for the 4 LFO panels — populated when the panels are built below.
const lfoLeds: HTMLElement[] = [];

const macroV = [0, 0, 0, 0]; // 0..1 raw knob value

// Scales: how much one unit of mod_offset shifts the display-range value
// Must match st_voice.c multipliers (e.g. filter cutoff * 8000).
// Raw-unit scale per mod target: how many raw units does depth=1 produce?
// Used to convert modulation offset → fraction of param range for the indicator.
const MOD_DISPLAY_SCALE: Record<string, number> = {
  pitch:            12,    // ±12 semitones at depth=1 (global pitch)
  osc1_pitch:       24,    // ±24 semitones
  osc2_pitch:       24,
  osc1_level:       1,
  osc1_detune:      100,   // ±100 cents
  osc1_pulse_width: 1,
  osc1_pan:         1,
  osc2_level:       1,
  osc2_detune:      100,
  osc2_pulse_width: 1,
  osc2_pan:         1,
  sub_level:        1,
  ring_mod:         1,
  filter_cutoff:    1,     // unused — see MOD_LOG_SCALE below
  filter_resonance: 1,
  fenv_attack:      4000,  // ±4000 ms
  fenv_decay:       4000,
  fenv_release:     4000,
  aenv_attack:      4000,
  aenv_decay:       4000,
  aenv_release:     4000,
  pan_spread:       1,
  master_volume:    1,
  fx0_mix:          1,
  fx1_mix:          1,
  fx2_mix:          1,
  fx3_mix:          1,
};

// Parameters modulated multiplicatively in log2 space (musical symmetry).
// Value = max octaves at |mod|=1.  Must match st_voice.c constants.
const MOD_LOG_SCALE: Record<string, number> = {
  filter_cutoff: 3,  // ±3 octaves at mod=1 → matches `* 3.0f` in st_voice.c
};

// Per-knob current normalised base value (written by onParam in buildKnob)
const knobBaseValues       = new Map<string, number>();
// Per-knob mod indicator setter (written by buildKnob, used by RAF)
const modIndicatorSetters  = new Map<string, (norm: number | null) => void>();
// Active updater functions for the RAF loop (no tSec needed — uses pushed values)
const modIndicatorUpdaters = new Map<string, () => void>();

function registerModIndicatorUpdater(paramId: string): void {
  if (modIndicatorUpdaters.has(paramId)) return;
  const def = paramMap.get(paramId);
  const setter = modIndicatorSetters.get(paramId);
  if (!def || !setter) return;

  // Compute modulation in raw-unit space then convert back to norm with skew.
  const logScale  = MOD_LOG_SCALE[paramId];          // defined → multiplicative
  const linScale  = MOD_DISPLAY_SCALE[paramId] ?? 1; // fallback → additive Hz/ms

  modIndicatorUpdaters.set(paramId, () => {
    const assignments = modDepthMap.get(paramId) ?? [];
    if (assignments.length === 0) {
      setter(null);
      modIndicatorUpdaters.delete(paramId);
      return;
    }
    const normBase = knobBaseValues.get(paramId) ?? 0;
    const rawBase  = normToRaw(normBase, def);

    // lfoCurrentOutput[idx] is raw * lfoDepth, pushed from synth at 30 Hz
    const signal = (a: { type: string; idx: number; depth: number }) =>
      a.type === 'lfo' ? lfoCurrentOutput[a.idx] : macroV[a.idx] * 2 - 1;

    let rawMod: number;
    if (logScale !== undefined) {
      // Multiplicative (log2 octave space) — matches st_voice.c behaviour.
      // totalMod=1 → rawBase * 2^logScale octaves up; -1 → same octaves down.
      let totalMod = 0;
      for (const a of assignments) totalMod += signal(a) * a.depth;
      rawMod = rawBase * Math.pow(2, totalMod * logScale);
    } else {
      // Additive (linear Hz / ms space).
      let rawOffset = 0;
      for (const a of assignments) rawOffset += signal(a) * a.depth * linScale;
      rawMod = rawBase + rawOffset;
    }

    setter(rawToNorm(Math.max(def.min, Math.min(def.max, rawMod)), def));
  });
}

function modRafLoop(): void {
  modIndicatorUpdaters.forEach((update) => update());

  // Animate LFO LEDs: positive half of each cycle → dim at 0, bright at peak depth.
  for (let i = 0; i < 4; i++) {
    const led = lfoLeds[i];
    if (!led) continue;
    const level = Math.max(0, lfoCurrentOutput[i]); // 0..lfoDepth
    const opacity = 0.08 + level * 0.92;
    led.style.opacity = opacity.toFixed(3);
    led.style.boxShadow = level > 0.02
      ? `0 0 ${(level * 10).toFixed(1)}px ${LFO_COLORS[i]}`
      : 'none';
  }

  requestAnimationFrame(modRafLoop);
}
requestAnimationFrame(modRafLoop);

let activeDrag: ActiveDrag | null = null;

function setAllDropZonesHighlighted(color: string | null) {
  document.querySelectorAll<HTMLElement>('.knob-container[data-param-id]').forEach((el) => {
    if (color) {
      el.style.setProperty('--drop-color', color);
      el.classList.add('drop-zone-ready');
    } else {
      el.classList.remove('drop-zone-ready');
    }
  });
}

// paramId -> list of active mod depth mini-knobs
const modDepthMap = new Map<string, ModDepthEntry[]>();

function addModDepthKnob(containerEl: HTMLElement, paramId: string, entry: ModDepthEntry) {
  // Ensure container is relative
  if (getComputedStyle(containerEl).position === 'static') {
    containerEl.style.position = 'relative';
  }

  const existing = modDepthMap.get(paramId) ?? [];

  // Check if same source already assigned — update depth instead
  const prev = existing.find(e => e.type === entry.type && e.idx === entry.idx);
  if (prev) {
    prev.depth = entry.depth;
    updateDepthKnobVisual(prev);
    return;
  }

  existing.push(entry);
  modDepthMap.set(paramId, existing);

  const mini = document.createElement('div');
  mini.className = 'mod-depth-knob';
  // Offset each mini-knob horizontally so they don't stack
  const offset = (existing.length - 1) * 16;
  mini.style.right = `${-4 + offset}px`;

  // SVG pie-slice arc
  const svgNS = 'http://www.w3.org/2000/svg';
  const miniSvg = document.createElementNS(svgNS, 'svg');
  miniSvg.setAttribute('width', '14');
  miniSvg.setAttribute('height', '14');
  miniSvg.setAttribute('viewBox', '0 0 14 14');
  miniSvg.style.display = 'block';

  const bgCircle = document.createElementNS(svgNS, 'circle');
  bgCircle.setAttribute('cx', '7');
  bgCircle.setAttribute('cy', '7');
  bgCircle.setAttribute('r', '6');
  bgCircle.setAttribute('fill', '#1A1D22');
  bgCircle.setAttribute('stroke', 'rgba(0,0,0,0.5)');
  bgCircle.setAttribute('stroke-width', '0.5');
  miniSvg.appendChild(bgCircle);

  const arcSlice = document.createElementNS(svgNS, 'path');
  arcSlice.setAttribute('fill', entry.color);
  miniSvg.appendChild(arcSlice);

  // Thin ring border
  const ringCircle = document.createElementNS(svgNS, 'circle');
  ringCircle.setAttribute('cx', '7');
  ringCircle.setAttribute('cy', '7');
  ringCircle.setAttribute('r', '6');
  ringCircle.setAttribute('fill', 'none');
  ringCircle.setAttribute('stroke', entry.color);
  ringCircle.setAttribute('stroke-width', '0.75');
  ringCircle.setAttribute('opacity', '0.5');
  miniSvg.appendChild(ringCircle);

  mini.appendChild(miniSvg);

  function updateArc(depth: number) {
    const absD = Math.abs(depth);
    mini.setAttribute('data-tooltip', `${entry.type.toUpperCase()} ${entry.idx + 1} depth: ${depth >= 0 ? '+' : ''}${depth.toFixed(2)} · Drag to adjust · Right-click to remove`);
    if (absD < 0.01) {
      arcSlice.setAttribute('d', '');
      arcSlice.setAttribute('opacity', '1');
      return;
    }
    const cx = 7, cy = 7, r = 5.5;
    // Start at 12 o'clock (−π/2). Positive fills clockwise, negative counter-clockwise.
    const startAngle = -Math.PI / 2;
    const sweep = absD * Math.PI; // max ±180°
    const endAngle = depth > 0 ? startAngle + sweep : startAngle - sweep;
    const sx = cx + r * Math.cos(startAngle);
    const sy = cy + r * Math.sin(startAngle);
    const ex = cx + r * Math.cos(endAngle);
    const ey = cy + r * Math.sin(endAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const sweepFlag = depth > 0 ? 1 : 0;
    arcSlice.setAttribute('d',
      `M ${cx} ${cy} L ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${ex.toFixed(2)} ${ey.toFixed(2)} Z`
    );
    // Negative depth: slightly desaturated via opacity
    arcSlice.setAttribute('opacity', depth >= 0 ? '1' : '0.65');
  }

  entry.el = mini;
  entry.updateArc = updateArc;
  updateDepthKnobVisual(entry);

  // Depth drag (vertical)
  let dragY = 0;
  let dragDepth = entry.depth;

  function onDepthMove(e: MouseEvent) {
    const dy = dragY - e.clientY;
    const newDepth = Math.max(-1, Math.min(1, dragDepth + dy / 100));
    entry.depth = newDepth;
    updateDepthKnobVisual(entry);
    sendModSetDepth(entry.type, entry.idx, MOD_PARAM_NAMES[paramId] ?? paramId, newDepth);
  }

  function onDepthUp() {
    window.removeEventListener('mousemove', onDepthMove);
    window.removeEventListener('mouseup', onDepthUp);
  }

  mini.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragY = e.clientY;
    dragDepth = entry.depth;
    window.addEventListener('mousemove', onDepthMove);
    window.addEventListener('mouseup', onDepthUp);
  });

  mini.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideTooltip();
    removeModDepthKnob(containerEl, paramId, entry);
  });

  containerEl.appendChild(mini);
}

function updateDepthKnobVisual(entry: ModDepthEntry) {
  if (!entry.el || !entry.updateArc) return;
  entry.updateArc(entry.depth);
}

function removeModDepthKnob(containerEl: HTMLElement, paramId: string, entry: ModDepthEntry) {
  const arr = modDepthMap.get(paramId);
  if (!arr) return;
  const idx = arr.indexOf(entry);
  if (idx !== -1) arr.splice(idx, 1);
  if (entry.el) containerEl.removeChild(entry.el);
  sendModRemove(entry.type, entry.idx, MOD_PARAM_NAMES[paramId] ?? paramId);
}

// Restore mod assignment visuals pushed from C++ on page load
onModAssignments((assignments) => {
  // Clear any visuals that were previously rendered (e.g. double-push)
  modDepthMap.forEach((entries, paramId) => {
    const containerEl = document.querySelector(`[data-param-id="${paramId}"]`) as HTMLElement | null;
    if (containerEl) entries.forEach((e) => { if (e.el) e.el.remove(); });
  });
  modDepthMap.clear();

  for (const a of assignments) {
    const paramId = MOD_PARAM_ID_FROM_NAME[a.param];
    if (!paramId) continue;
    const containerEl = document.querySelector(`[data-param-id="${paramId}"]`) as HTMLElement | null;
    if (!containerEl) continue;
    const color = a.type === 'lfo' ? LFO_COLORS[a.idx] : MACRO_COLORS[a.idx];
    const entry: ModDepthEntry = {
      type: a.type,
      idx: a.idx,
      color,
      depth: a.depth,
      el: null as unknown as HTMLElement,
      updateArc: () => {},
    };
    addModDepthKnob(containerEl, paramId, entry);
    registerModIndicatorUpdater(paramId);
  }
});

function setupKnobDropZone(containerEl: HTMLElement, paramId: string) {
  // Only modulatable params
  if (!MOD_PARAM_NAMES[paramId]) return;

  containerEl.setAttribute('data-param-id', paramId);

  containerEl.addEventListener('dragover', (e) => {
    if (!activeDrag) return;
    e.preventDefault();
    containerEl.style.setProperty('--drop-color', activeDrag.color);
    containerEl.classList.add('drop-target-active');
  });

  containerEl.addEventListener('dragleave', () => {
    containerEl.classList.remove('drop-target-active');
  });

  containerEl.addEventListener('drop', (e) => {
    e.preventDefault();
    containerEl.classList.remove('drop-target-active');
    if (!activeDrag) return;
    const modParamName = MOD_PARAM_NAMES[paramId];
    if (!modParamName) return;
    const entry: ModDepthEntry = {
      type: activeDrag.type,
      idx: activeDrag.idx,
      color: activeDrag.color,
      depth: 1.0,
      el: null as unknown as HTMLElement,
      updateArc: () => {},
    };
    addModDepthKnob(containerEl, paramId, entry);
    registerModIndicatorUpdater(paramId);
    sendModAdd(entry.type, entry.idx, modParamName, entry.depth);
  });
}

// Helper: create a knob for a slider param + wire it
function buildKnob(id: string, size: number, showLabel?: boolean): HTMLElement {
  const def = paramMap.get(id)!;
  const normDefault = rawToNorm(def.defaultValue, def);
  const knob = createKnob({ size, min: def.min, max: def.max, defaultValue: def.defaultValue, label: def.label, skew: def.skew, showLabel });

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
    const divisor = e.shiftKey ? 2000 : 500;
    const delta = dy / divisor;
    let newNorm = Math.max(0, Math.min(1, dragStartNorm + delta));

    // Quantize to step if defined
    if (def.step) {
      const rawValue = normToRaw(newNorm, def);
      const quantized = Math.round(rawValue / def.step) * def.step;
      newNorm = rawToNorm(quantized, def);
    }

    currentNormRef = newNorm;
    knob.setValue(newNorm);
    setParam(id, newNorm);

    // Update value display with 2 decimal places
    const rawValue = normToRaw(newNorm, def);
    const displayValue = rawValue.toFixed(2);
    updateValueDisplay(displayValue);
  }

  function onDragUp() {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragUp);
    hideValueDisplay();
  }

  container.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragStartY = e.clientY;
    dragStartNorm = currentNormRef;

    // Show value display on drag start with immediate positioning
    const rawValue = normToRaw(currentNormRef, def);
    showValueDisplay(rawValue.toFixed(2));
    valueDisplayPortal.style.left = `${e.clientX + 8}px`;
    valueDisplayPortal.style.top = `${e.clientY - 16}px`;

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragUp);
  });

  container.addEventListener('dblclick', () => {
    const normDefault2 = rawToNorm(def.defaultValue, def);
    currentNormRef = normDefault2;
    knob.setValue(normDefault2);
    setParam(id, normDefault2);
  });

  onParam(id, (v) => {
    currentNormRef = v;
    knob.setValue(v);
  });

  // Set up modulation drop zone and real-time indicator for modulatable params
  const dropContainer = knob.el.querySelector('.knob-container') as HTMLElement;
  if (dropContainer && MOD_PARAM_NAMES[id]) {
    setupKnobDropZone(dropContainer, id);
    modIndicatorSetters.set(id, (norm) => knob.setModIndicator(norm));
    // Seed the base value tracker so the RAF loop has data immediately
    knobBaseValues.set(id, normDefault);
    onParam(id, (v) => { knobBaseValues.set(id, v); });
  }

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

/// Helper: create a CC number input for a macro
function buildCCInput(id: string): HTMLElement {
  const def = paramMap.get(id)!;
  const range = def.max - def.min; // -1..127 → 128

  // Convert a CC integer (-1..127) to the normalised 0..1 value JUCE expects
  function ccToNorm(cc: number): number {
    return (cc - def.min) / range;
  }
  // Convert normalised 0..1 pushed from JUCE back to a CC integer
  function normToCC(v: number): number {
    return Math.round(def.min + v * range);
  }

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '2px';
  wrap.style.alignItems = 'center';

  const label = document.createElement('div');
  label.style.fontSize = '8px';
  label.style.color = `${C.white48}`;
  label.style.textTransform = 'uppercase';
  label.style.letterSpacing = '0.5px';
  label.textContent = 'CC';

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '127';
  input.placeholder = '–';
  input.value = def.defaultValue >= 0 ? String(def.defaultValue) : '';
  input.style.width = '40px';
  input.style.height = '24px';
  input.style.background = `${C.offDark}`;
  input.style.border = `1px solid ${C.offDark3}`;
  input.style.borderRadius = '4px';
  input.style.color = `${C.offWhite}`;
  input.style.fontSize = '11px';
  input.style.padding = '0 6px';
  input.style.fontFamily = "'Inter', system-ui, sans-serif";
  input.style.textAlign = 'center';
  input.style.cursor = 'pointer';

  function applyCC(cc: number) {
    cc = Math.max(-1, Math.min(127, cc));
    input.value = cc >= 0 ? String(cc) : '';
    setParam(id, ccToNorm(cc));
  }

  input.addEventListener('change', () => {
    const raw = input.value.trim();
    const cc = raw === '' ? -1 : Math.max(0, Math.min(127, parseInt(raw, 10) || 0));
    applyCC(cc);
  });

  input.addEventListener('wheel', (e) => {
    e.preventDefault();
    const cur = input.value.trim() === '' ? -1 : parseInt(input.value, 10);
    applyCC(cur + ((e as WheelEvent).deltaY < 0 ? 1 : -1));
  });

  onParam(id, (v) => {
    const cc = normToCC(v);
    input.value = cc >= 0 ? String(cc) : '';
  });

  wrap.appendChild(label);
  wrap.appendChild(input);
  return wrap;
}

// Helper: build an animated waveform shape selector for an LFO
function buildWaveformSelector(lfoIdx: number): HTMLElement {
  const color = LFO_COLORS[lfoIdx];
  const shapes = ['Sine', 'Tri', 'Saw', 'Square'];

  // SVG icon paths for each waveform shape (viewBox 0 0 20 12)
  const wavePaths: Record<string, string> = {
    Sine:   'M1 6 C4 1, 6 1, 10 6 C14 11, 16 11, 19 6',
    Tri:    'M1 6 L5.5 1 L10 11 L14.5 1 L19 6',
    Saw:    'M1 11 L10 1 L10 11 L19 1',
    Square: 'M1 11 L1 1 L10 1 L10 11 L19 11 L19 1',
  };

  const wrap = document.createElement('div');
  wrap.className = 'waveform-selector';
  wrap.style.setProperty('--lfo-color', color);

  let currentShapeIdx = 0;
  const buttons: HTMLButtonElement[] = [];

  shapes.forEach((shape, idx) => {
    const btn = document.createElement('button');
    btn.className = 'wave-btn' + (idx === 0 ? ' active' : '');
    btn.style.setProperty('--lfo-color', color);
    btn.setAttribute('data-tooltip', shape);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '12');
    svg.setAttribute('viewBox', '0 0 20 12');
    svg.style.display = 'block';

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', wavePaths[shape]);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    btn.appendChild(svg);

    btn.addEventListener('click', () => {
      currentShapeIdx = idx;
      buttons.forEach((b, i) => b.classList.toggle('active', i === idx));
      const norm = shapes.length > 1 ? idx / (shapes.length - 1) : 0;
      setParam(`lfo${lfoIdx}_shape`, norm);
    });

    buttons.push(btn);
    wrap.appendChild(btn);
  });

  onParam(`lfo${lfoIdx}_shape`, (v) => {
    const idx = Math.round(v * (shapes.length - 1));
    currentShapeIdx = idx;
    buttons.forEach((b, i) => b.classList.toggle('active', i === idx));
  });

  return wrap;
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
    buildKnob('osc1_pitch', 40),
    buildKnob('osc1_level', 40),
    buildKnob('osc1_detune', 40),
    buildKnob('osc1_octave', 40),
  ));
  panel.appendChild(makeKnobsRow(
    buildKnob('osc1_pulse_width', 40),
    buildKnob('osc1_pan', 40),
    buildKnob('osc1_pan_spread', 40),
  ));
  topRow.appendChild(panel);
}

// OSC 2
{
  const { panel } = makePanel('OSC 2');
  panel.style.minWidth = '210px';
  panel.appendChild(buildDropdown('osc2_type', 92));
  panel.appendChild(makeKnobsRow(
    buildKnob('osc2_pitch', 40),
    buildKnob('osc2_level', 40),
    buildKnob('osc2_detune', 40),
    buildKnob('osc2_octave', 40),
  ));
  panel.appendChild(makeKnobsRow(
    buildKnob('osc2_pulse_width', 40),
    buildKnob('osc2_pan', 40),
    buildKnob('osc2_pan_spread', 40),
  ));
  topRow.appendChild(panel);
}

// Sub + Ring Mod
{
  const { panel } = makePanel('Mod');
  panel.style.minWidth = '90px';

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'panel-content-wrapper';
  contentWrapper.appendChild(makeKnobsRow(
    buildKnob('sub_level', 40),
  ));
  contentWrapper.appendChild(makeKnobsRow(
    buildKnob('ring_mod', 40),
  ));
  panel.appendChild(contentWrapper);

  topRow.appendChild(panel);
}

// Filter
{
  const { panel } = makePanel('Filter');
  
  panel.style.maxWidth = '160px';
  panel.appendChild(buildDropdown('filter_type', 92));
  panel.appendChild(makeKnobsRow(
    buildKnob('filter_cutoff', 40),
    buildKnob('filter_resonance', 40),
    buildKnob('filter_env_amount', 40),
    buildKnob('filter_vel_amount', 40),
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

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'panel-content-wrapper';
  contentWrapper.appendChild(makeKnobsRow(
    buildKnob('fenv_attack', 40),
    buildKnob('fenv_decay', 40),
    buildKnob('fenv_sustain', 40),
    buildKnob('fenv_release', 40),
  ));
  panel.appendChild(contentWrapper);

  envRow.appendChild(panel);
}

// Amp Env
{
  const { panel } = makePanel('Amp Env');
  panel.style.minWidth = '210px';

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'panel-content-wrapper';
  contentWrapper.appendChild(makeKnobsRow(
    buildKnob('aenv_attack', 40),
    buildKnob('aenv_decay', 40),
    buildKnob('aenv_sustain', 40),
    buildKnob('aenv_release', 40),
  ));
  panel.appendChild(contentWrapper);

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
    delayGroup.appendChild(buildKnob(`fx${i}_delay_time`, 26));
    delayGroup.appendChild(buildKnob(`fx${i}_delay_feedback`, 26));

    const chorusGroup = document.createElement('div');
    chorusGroup.className = 'fx-param-group';
    chorusGroup.appendChild(buildKnob(`fx${i}_chorus_rate`, 26));
    chorusGroup.appendChild(buildKnob(`fx${i}_chorus_depth`, 26));

    // Flanger and Phaser share chorus_rate/depth + delay_feedback for feedback
    const flangerGroup = document.createElement('div');
    flangerGroup.className = 'fx-param-group';
    flangerGroup.appendChild(buildKnob(`fx${i}_chorus_rate`, 26));
    flangerGroup.appendChild(buildKnob(`fx${i}_chorus_depth`, 26));
    flangerGroup.appendChild(buildKnob(`fx${i}_delay_feedback`, 26));

    const phaserGroup = document.createElement('div');
    phaserGroup.className = 'fx-param-group';
    phaserGroup.appendChild(buildKnob(`fx${i}_chorus_rate`, 26));
    phaserGroup.appendChild(buildKnob(`fx${i}_chorus_depth`, 26));
    phaserGroup.appendChild(buildKnob(`fx${i}_delay_feedback`, 26));

    const vhsGroup = document.createElement('div');
    vhsGroup.className = 'fx-param-group';
    vhsGroup.appendChild(buildKnob(`fx${i}_vhs_wow_rate`, 26));
    vhsGroup.appendChild(buildKnob(`fx${i}_vhs_wow_depth`, 26));
    vhsGroup.appendChild(buildKnob(`fx${i}_vhs_flutter_rate`, 26));
    vhsGroup.appendChild(buildKnob(`fx${i}_vhs_flutter_depth`, 26));
    vhsGroup.appendChild(buildKnob(`fx${i}_vhs_drive`, 26));
    vhsGroup.appendChild(buildKnob(`fx${i}_vhs_tone`, 26));
    vhsGroup.appendChild(buildKnob(`fx${i}_vhs_noise`, 26));
    vhsGroup.appendChild(buildKnob(`fx${i}_vhs_dropout`, 26));

    const reverbGroup = document.createElement('div');
    reverbGroup.className = 'fx-param-group';
    reverbGroup.appendChild(buildKnob(`fx${i}_reverb_t60`, 26));
    reverbGroup.appendChild(buildKnob(`fx${i}_reverb_damping`, 26));
    reverbGroup.appendChild(buildKnob(`fx${i}_reverb_input_lpf`, 26));

    const distortionGroup = document.createElement('div');
    distortionGroup.className = 'fx-param-group';
    distortionGroup.appendChild(buildKnob(`fx${i}_distortion_drive`, 26));

    const eqGroup = document.createElement('div');
    eqGroup.className = 'fx-param-group';
    eqGroup.appendChild(buildKnob(`fx${i}_eq_low_freq`, 26));
    eqGroup.appendChild(buildKnob(`fx${i}_eq_low_gain`, 26));
    eqGroup.appendChild(buildKnob(`fx${i}_eq_mid_gain`, 26));
    eqGroup.appendChild(buildKnob(`fx${i}_eq_high_freq`, 26));
    eqGroup.appendChild(buildKnob(`fx${i}_eq_high_gain`, 26));

    // Create scrollable container for all param groups
    const paramsScroll = document.createElement('div');
    paramsScroll.className = 'fx-params-scroll';

    paramsScroll.appendChild(delayGroup);
    paramsScroll.appendChild(chorusGroup);
    paramsScroll.appendChild(flangerGroup);
    paramsScroll.appendChild(phaserGroup);
    paramsScroll.appendChild(vhsGroup);
    paramsScroll.appendChild(reverbGroup);
    paramsScroll.appendChild(distortionGroup);
    paramsScroll.appendChild(eqGroup);

    // Create placeholder knobs for OFF state (4 per row)
    const offPlaceholdersRow1 = document.createElement('div');
    offPlaceholdersRow1.className = 'fx-param-group';
    for (let p = 0; p < 4; p++) {
      const knobWrap = document.createElement('div');
      knobWrap.className = 'knob-wrap fx-param-placeholder';
      knobWrap.style.pointerEvents = 'none';
      knobWrap.innerHTML = '<canvas style="width: 26px; height: 26px; background: rgba(58, 64, 73, 0.5); border-radius: 4px;"></canvas><div class="knob-label">–</div>';
      offPlaceholdersRow1.appendChild(knobWrap);
    }

    const offPlaceholdersRow2 = document.createElement('div');
    offPlaceholdersRow2.className = 'fx-param-group';
    for (let p = 0; p < 4; p++) {
      const knobWrap = document.createElement('div');
      knobWrap.className = 'knob-wrap fx-param-placeholder';
      knobWrap.style.pointerEvents = 'none';
      knobWrap.innerHTML = '<canvas style="width: 26px; height: 26px; background: rgba(58, 64, 73, 0.5); border-radius: 4px;"></canvas><div class="knob-label">–</div>';
      offPlaceholdersRow2.appendChild(knobWrap);
    }

    paramsScroll.appendChild(offPlaceholdersRow1);
    paramsScroll.appendChild(offPlaceholdersRow2);

    paramsWrap.appendChild(paramsScroll);

    // Big transparent type name in the background
    const bgLabel = document.createElement('div');
    bgLabel.className = 'fx-slot-bg-label';
    slot.appendChild(bgLabel);

    // Types: 0=Off,1=Delay,2=Chorus,3=Flanger,4=Phaser,5=VHS,6=Reverb,7=Distortion,8=EQ
    function updateFxVisibility(typeIndex: number) {
      const isOff = typeIndex === 0;
      mixKnob.style.display = isOff ? 'none' : '';
      delayGroup.style.display      = typeIndex === 1 ? 'flex' : 'none';
      chorusGroup.style.display     = typeIndex === 2 ? 'flex' : 'none';
      flangerGroup.style.display    = typeIndex === 3 ? 'flex' : 'none';
      phaserGroup.style.display     = typeIndex === 4 ? 'flex' : 'none';
      vhsGroup.style.display        = typeIndex === 5 ? 'flex' : 'none';
      reverbGroup.style.display     = typeIndex === 6 ? 'flex' : 'none';
      distortionGroup.style.display = typeIndex === 7 ? 'flex' : 'none';
      eqGroup.style.display         = typeIndex === 8 ? 'flex' : 'none';
      offPlaceholdersRow1.style.display = isOff ? 'flex' : 'none';
      offPlaceholdersRow2.style.display = isOff ? 'flex' : 'none';
      bgLabel.textContent = isOff ? '' : FX_TYPES[typeIndex];
    }

    updateFxVisibility(0);

    onParam(`fx${i}_type`, (v) => {
      const idx = Math.round(v * (FX_TYPES.length - 1));
      updateFxVisibility(idx);
    });

    // Wrapper: label + dropdown
    const fxTypeWrapper = document.createElement('div');
    fxTypeWrapper.className = 'fx-type-wrapper';
    const fxTypeLabel = document.createElement('div');
    fxTypeLabel.className = 'fx-type-label';
    fxTypeLabel.textContent = `FX${i + 1}`;
    fxTypeWrapper.appendChild(fxTypeLabel);
    fxTypeWrapper.appendChild(typeDropdown);

    slotMain.appendChild(fxTypeWrapper);
    slotMain.appendChild(mixKnob);

    slot.appendChild(slotLabel);
    slot.appendChild(slotMain);
    slot.appendChild(paramsWrap);

    (i < 2 ? rackColA : rackColB).appendChild(slot);
  }

  fxRowWrap.appendChild(panel);


  leftCol.appendChild(fxRowWrap);
}

// ---------------------------------------------------------------------------
// Middle column: LFOs + Macros
// ---------------------------------------------------------------------------
const midCol = document.createElement('div');
midCol.className = 'mid-col';
mainLayout.appendChild(midCol);

// LFOs grid: 2 per row
const lfosGrid = document.createElement('div');
lfosGrid.style.display = 'grid';
lfosGrid.style.minHeight = '294px';
lfosGrid.style.gridTemplateColumns = '1fr 1fr';
lfosGrid.style.gap = '4px';
midCol.appendChild(lfosGrid);

for (let i = 0; i < 4; i++) {
  const lfoColor = LFO_COLORS[i];
  const { panel } = makePanel(`LFO ${i + 1}`);
  panel.style.minWidth = '0';

  // Top row: drag handle + waveform selector
  const topLfoRow = document.createElement('div');
  topLfoRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 0;';
  const dragHandle = document.createElement('div');
  dragHandle.className = 'lfo-drag-handle';
  dragHandle.style.background = lfoColor;
  dragHandle.style.setProperty('--lfo-color', lfoColor);
  dragHandle.draggable = true;
  dragHandle.setAttribute('data-tooltip', `Drag LFO ${i + 1} onto a knob to modulate it`);

  dragHandle.addEventListener('dragstart', (e) => {
    activeDrag = { type: 'lfo', idx: i, color: lfoColor };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', `lfo:${i}`);
    }
    setAllDropZonesHighlighted(lfoColor);
  });

  dragHandle.addEventListener('dragend', () => {
    activeDrag = null;
    setAllDropZonesHighlighted(null);
  });

  topLfoRow.appendChild(dragHandle);

  // LED pulse indicator — right-aligned in the same row as the drag handle.
  // Brightness pulses with lfoCurrentOutput[i] (positive half only) so it
  // blinks once per LFO cycle at an intensity that reflects the current depth.
  const led = document.createElement('div');
  led.style.cssText = `
    width: 7px; height: 7px;
    border-radius: 50%;
    background: ${lfoColor};
    margin-left: auto;
    flex-shrink: 0;
    opacity: 0.08;
    transition: opacity 40ms linear, box-shadow 40ms linear;
    pointer-events: none;
  `;
  topLfoRow.appendChild(led);
  lfoLeds[i] = led;

  panel.appendChild(topLfoRow);
  panel.appendChild(buildWaveformSelector(i));
  panel.appendChild(makeKnobsRow(
    buildKnob(`lfo${i}_rate`, 40),
    buildKnob(`lfo${i}_depth`, 40),
  ));
  lfosGrid.appendChild(panel);
}

// Macros 1-4 grid: 2 per row (with CC inputs)
{
  const { panel } = makePanel('Macros');
  panel.style.minWidth = '0';
  panel.style.minHeight = '192px';

  const macrosGrid = document.createElement('div');
  macrosGrid.style.display = 'grid';
  macrosGrid.style.gridTemplateColumns = '1fr 1fr';
  macrosGrid.style.gap = '6px';

  for (let i = 0; i < 4; i++) {
    const macroCell = document.createElement('div');
    macroCell.style.display = 'flex';
    macroCell.style.flexDirection = 'column';
    macroCell.style.gap = '14px';
    macroCell.style.alignItems = 'flex-start';

    const macroColor = MACRO_COLORS[i];

    // Header row: drag handle + label
    const macroHeader = document.createElement('div');
    macroHeader.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0;';

    const macroDragHandle = document.createElement('div');
    macroDragHandle.className = 'macro-drag-handle';
    macroDragHandle.style.background = macroColor;
    macroDragHandle.style.setProperty('--lfo-color', macroColor);
    macroDragHandle.draggable = true;
    macroDragHandle.setAttribute('data-tooltip', `Drag Macro ${i + 1} onto a knob to modulate it`);

    macroDragHandle.addEventListener('dragstart', (e) => {
      activeDrag = { type: 'macro', idx: i, color: macroColor };
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', `macro:${i}`);
      }
      setAllDropZonesHighlighted(macroColor);
    });
    macroDragHandle.addEventListener('dragend', () => {
      activeDrag = null;
      setAllDropZonesHighlighted(null);
    });

    const knobLabel = document.createElement('div');
    knobLabel.style.fontSize = '9px';
    knobLabel.style.color = `${C.white48}`;
    knobLabel.textContent = `M${i + 1}`;

    macroHeader.appendChild(macroDragHandle);
    macroHeader.appendChild(knobLabel);

    const knobRow = document.createElement('div');
    knobRow.style.display = 'flex';
    knobRow.style.gap = '4px';
    knobRow.style.alignItems = 'center';

    knobRow.appendChild(buildKnob(`macro${i}_value`, 45, false));
    knobRow.appendChild(buildCCInput(`macro${i}_cc`));

    macroCell.appendChild(macroHeader);
    macroCell.appendChild(knobRow);
    macrosGrid.appendChild(macroCell);
  }

  panel.appendChild(macrosGrid);
  midCol.appendChild(panel);
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
  masterWrap.appendChild(buildDropdown('num_voices', 64));
  masterWrap.appendChild(buildDropdown('play_mode', 64));
  masterWrap.appendChild(buildKnob('pitch_bend_range', 40));
  masterWrap.appendChild(buildKnob('portamento_time', 40));
  masterWrap.appendChild(buildKnob('pan_spread', 40));

  masterPanel.appendChild(masterWrap);
  rightCol.appendChild(masterPanel);
}

notifyHostReady();

// ---------------------------------------------------------------------------
// Preset modal
// ---------------------------------------------------------------------------

let allPresets: PresetInfo[] = [];
let currentPresetName = 'Init';

function updatePresetNameBtn() {
  presetNameBtn.textContent = currentPresetName;
}

// Track current patch name when params are updated (preset loads push "name" via onPresets)
onPresets((presets) => {
  allPresets = presets;
});

function openPresetModal() {
  const overlay = document.createElement('div');
  overlay.className = 'preset-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'preset-modal';

  // Header
  const mHeader = document.createElement('div');
  mHeader.className = 'preset-modal-header';
  const mTitle = document.createElement('div');
  mTitle.className = 'preset-modal-title';
  mTitle.textContent = 'Presets';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'preset-modal-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => overlay.remove());
  mHeader.appendChild(mTitle);
  mHeader.appendChild(closeBtn);
  modal.appendChild(mHeader);

  // Body
  const body = document.createElement('div');
  body.className = 'preset-modal-body';

  // Category sidebar
  const catSidebar = document.createElement('div');
  catSidebar.className = 'preset-categories';

  const listPane = document.createElement('div');
  listPane.className = 'preset-list';

  const categories = ['All', ...Array.from(new Set(allPresets.map((p) => p.category))).sort()];
  let activeCategory = 'All';

  function renderList() {
    listPane.innerHTML = '';
    const filtered = activeCategory === 'All'
      ? allPresets
      : allPresets.filter((p) => p.category === activeCategory);

    filtered.forEach((preset) => {
      const item = document.createElement('div');
      item.className = 'preset-item';
      if (preset.name === currentPresetName) item.classList.add('active');

      const nameLine = document.createElement('div');
      nameLine.className = 'preset-item-name';
      nameLine.textContent = preset.name;
      if (preset.source === 'user') {
        const badge = document.createElement('span');
        badge.className = 'preset-item-user-badge';
        badge.textContent = 'user';
        nameLine.appendChild(badge);
      }

      const metaLine = document.createElement('div');
      metaLine.className = 'preset-item-meta';
      metaLine.textContent = [preset.author, preset.category].filter(Boolean).join(' · ');

      item.appendChild(nameLine);
      item.appendChild(metaLine);

      if (preset.description) {
        const descLine = document.createElement('div');
        descLine.className = 'preset-item-desc';
        descLine.textContent = preset.description;
        item.appendChild(descLine);
      }

      item.addEventListener('click', () => {
        if (preset.source === 'factory' && preset.idx !== undefined) {
          sendLoadFactoryPreset(preset.idx);
        } else if (preset.source === 'user' && preset.path) {
          sendLoadUserPreset(preset.path);
        }
        currentPresetName = preset.name;
        updatePresetNameBtn();
        overlay.remove();
      });

      listPane.appendChild(item);
    });
  }

  categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'preset-cat-btn' + (cat === activeCategory ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      catSidebar.querySelectorAll('.preset-cat-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderList();
    });
    catSidebar.appendChild(btn);
  });

  renderList();

  body.appendChild(catSidebar);
  body.appendChild(listPane);
  modal.appendChild(body);

  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function openSaveDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'preset-modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'save-dialog';

  const title = document.createElement('div');
  title.className = 'save-dialog-title';
  title.textContent = 'Save Preset';
  dialog.appendChild(title);

  function field(labelText: string, placeholder: string, multiline = false): HTMLInputElement | HTMLTextAreaElement {
    const wrap = document.createElement('div');
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    wrap.appendChild(lbl);
    const el = multiline
      ? Object.assign(document.createElement('textarea'), { rows: 2, placeholder })
      : Object.assign(document.createElement('input'), { type: 'text', placeholder });
    wrap.appendChild(el);
    dialog.appendChild(wrap);
    return el as HTMLInputElement | HTMLTextAreaElement;
  }

  const nameInput   = field('Name',        currentPresetName) as HTMLInputElement;
  nameInput.value   = currentPresetName;
  const authorInput = field('Author',      'Your name') as HTMLInputElement;
  const descInput   = field('Description', 'Describe the sound…', true);

  const row = document.createElement('div');
  row.className = 'save-dialog-row';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'save-dialog-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'save-dialog-confirm';
  confirmBtn.textContent = 'Save';
  confirmBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Untitled';
    sendSavePreset(name, authorInput.value.trim(), descInput.value.trim());
    currentPresetName = name;
    updatePresetNameBtn();
    overlay.remove();
  });

  row.appendChild(cancelBtn);
  row.appendChild(confirmBtn);
  dialog.appendChild(row);

  overlay.appendChild(dialog);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  nameInput.select();
}

presetNameBtn.addEventListener('click', openPresetModal);
presetSaveBtn.addEventListener('click', openSaveDialog);

function loadPresetByIndex(idx: number) {
  const preset = allPresets[idx];
  if (!preset) return;
  if (preset.source === 'factory' && preset.idx !== undefined) {
    sendLoadFactoryPreset(preset.idx);
  } else if (preset.source === 'user' && preset.path) {
    sendLoadUserPreset(preset.path);
  }
  currentPresetName = preset.name;
  updatePresetNameBtn();
}

presetPrevBtn.addEventListener('click', () => {
  if (allPresets.length === 0) return;
  const cur = allPresets.findIndex((p) => p.name === currentPresetName);
  const next = cur <= 0 ? allPresets.length - 1 : cur - 1;
  loadPresetByIndex(next);
});

presetNextBtn.addEventListener('click', () => {
  if (allPresets.length === 0) return;
  const cur = allPresets.findIndex((p) => p.name === currentPresetName);
  const next = cur < 0 || cur === allPresets.length - 1 ? 0 : cur + 1;
  loadPresetByIndex(next);
});

// Update preset name display when a patch is loaded externally (drag-drop, DAW recall)
onPresets((presets) => {
  // C++ sends updated list after load — the first user preset added or factory preset
  // name comes through here; we don't track which was loaded, so just leave it as-is.
  // The name gets updated when the user explicitly clicks a preset.
});
