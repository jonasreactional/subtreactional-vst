#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "PresetBinaryData.h"

#include <cstring>
#include <cstdlib>
#include <algorithm>

extern "C" {
#include "subtreactional/subtreactional.h"
}

//==============================================================================
// Full parameter mapping: APVTS ID (JUCE-safe) → st_synth name (dot notation).
// JUCE Identifier forbids dots; we use underscores in APVTS IDs.
//==============================================================================
const ParamMap SubtreactionalAudioProcessor::kParams[] = {
    // OSC 1
    { "osc1_type",           "osc1.type" },
    { "osc1_pitch",          "osc1.pitch" },
    { "osc1_level",          "osc1.level" },
    { "osc1_detune",         "osc1.detune" },
    { "osc1_octave",         "osc1.octave" },
    { "osc1_pulse_width",    "osc1.pulse_width" },
    { "osc1_pan",            "osc1.pan" },
    { "osc1_pan_spread",     "osc1.pan_spread" },
    // OSC 2
    { "osc2_type",           "osc2.type" },
    { "osc2_pitch",          "osc2.pitch" },
    { "osc2_level",          "osc2.level" },
    { "osc2_detune",         "osc2.detune" },
    { "osc2_octave",         "osc2.octave" },
    { "osc2_pulse_width",    "osc2.pulse_width" },
    { "osc2_pan",            "osc2.pan" },
    { "osc2_pan_spread",     "osc2.pan_spread" },
    // Sub Oscillator
    { "sub_level",           "sub.level" },
    // Filter
    { "filter_type",         "filter.type" },
    { "filter_cutoff",       "filter.cutoff" },
    { "filter_resonance",    "filter.resonance" },
    { "filter_env_amount",   "filter.env_amount" },
    { "filter_vel_amount",   "filter.vel_amount" },
    // Ring Modulation
    { "ring_mod",            "ring_mod" },
    // Filter envelope
    { "fenv_attack",         "filter_env.attack" },
    { "fenv_decay",          "filter_env.decay" },
    { "fenv_sustain",        "filter_env.sustain" },
    { "fenv_release",        "filter_env.release" },
    // Amp envelope
    { "aenv_attack",         "amp_env.attack" },
    { "aenv_decay",          "amp_env.decay" },
    { "aenv_sustain",        "amp_env.sustain" },
    { "aenv_release",        "amp_env.release" },
    // FX 0
    { "fx0_type",              "fx0.type" },
    { "fx0_mix",               "fx0.mix" },
    { "fx0_delay_time",        "fx0.delay_time" },
    { "fx0_delay_feedback",    "fx0.delay_feedback" },
    { "fx0_chorus_rate",       "fx0.chorus_rate" },
    { "fx0_chorus_depth",      "fx0.chorus_depth" },
    { "fx0_reverb_t60",        "fx0.reverb_t60" },
    { "fx0_reverb_damping",    "fx0.reverb_damping" },
    { "fx0_reverb_input_lpf",  "fx0.reverb_input_lpf" },
    { "fx0_distortion_drive",  "fx0.distortion_drive" },
    { "fx0_vhs_wow_rate",      "fx0.vhs_wow_rate" },
    { "fx0_vhs_wow_depth",     "fx0.vhs_wow_depth" },
    { "fx0_vhs_flutter_rate",  "fx0.vhs_flutter_rate" },
    { "fx0_vhs_flutter_depth", "fx0.vhs_flutter_depth" },
    { "fx0_vhs_drive",         "fx0.vhs_drive" },
    { "fx0_vhs_tone",          "fx0.vhs_tone" },
    { "fx0_vhs_noise",         "fx0.vhs_noise" },
    { "fx0_vhs_dropout",       "fx0.vhs_dropout" },
    { "fx0_eq_low_freq",       "fx0.eq_low_freq" },
    { "fx0_eq_low_gain",       "fx0.eq_low_gain" },
    { "fx0_eq_mid_gain",       "fx0.eq_mid_gain" },
    { "fx0_eq_high_freq",      "fx0.eq_high_freq" },
    { "fx0_eq_high_gain",      "fx0.eq_high_gain" },
    // FX 1
    { "fx1_type",              "fx1.type" },
    { "fx1_mix",               "fx1.mix" },
    { "fx1_delay_time",        "fx1.delay_time" },
    { "fx1_delay_feedback",    "fx1.delay_feedback" },
    { "fx1_chorus_rate",       "fx1.chorus_rate" },
    { "fx1_chorus_depth",      "fx1.chorus_depth" },
    { "fx1_reverb_t60",        "fx1.reverb_t60" },
    { "fx1_reverb_damping",    "fx1.reverb_damping" },
    { "fx1_reverb_input_lpf",  "fx1.reverb_input_lpf" },
    { "fx1_distortion_drive",  "fx1.distortion_drive" },
    { "fx1_vhs_wow_rate",      "fx1.vhs_wow_rate" },
    { "fx1_vhs_wow_depth",     "fx1.vhs_wow_depth" },
    { "fx1_vhs_flutter_rate",  "fx1.vhs_flutter_rate" },
    { "fx1_vhs_flutter_depth", "fx1.vhs_flutter_depth" },
    { "fx1_vhs_drive",         "fx1.vhs_drive" },
    { "fx1_vhs_tone",          "fx1.vhs_tone" },
    { "fx1_vhs_noise",         "fx1.vhs_noise" },
    { "fx1_vhs_dropout",       "fx1.vhs_dropout" },
    { "fx1_eq_low_freq",       "fx1.eq_low_freq" },
    { "fx1_eq_low_gain",       "fx1.eq_low_gain" },
    { "fx1_eq_mid_gain",       "fx1.eq_mid_gain" },
    { "fx1_eq_high_freq",      "fx1.eq_high_freq" },
    { "fx1_eq_high_gain",      "fx1.eq_high_gain" },
    // FX 2
    { "fx2_type",              "fx2.type" },
    { "fx2_mix",               "fx2.mix" },
    { "fx2_delay_time",        "fx2.delay_time" },
    { "fx2_delay_feedback",    "fx2.delay_feedback" },
    { "fx2_chorus_rate",       "fx2.chorus_rate" },
    { "fx2_chorus_depth",      "fx2.chorus_depth" },
    { "fx2_reverb_t60",        "fx2.reverb_t60" },
    { "fx2_reverb_damping",    "fx2.reverb_damping" },
    { "fx2_reverb_input_lpf",  "fx2.reverb_input_lpf" },
    { "fx2_distortion_drive",  "fx2.distortion_drive" },
    { "fx2_vhs_wow_rate",      "fx2.vhs_wow_rate" },
    { "fx2_vhs_wow_depth",     "fx2.vhs_wow_depth" },
    { "fx2_vhs_flutter_rate",  "fx2.vhs_flutter_rate" },
    { "fx2_vhs_flutter_depth", "fx2.vhs_flutter_depth" },
    { "fx2_vhs_drive",         "fx2.vhs_drive" },
    { "fx2_vhs_tone",          "fx2.vhs_tone" },
    { "fx2_vhs_noise",         "fx2.vhs_noise" },
    { "fx2_vhs_dropout",       "fx2.vhs_dropout" },
    { "fx2_eq_low_freq",       "fx2.eq_low_freq" },
    { "fx2_eq_low_gain",       "fx2.eq_low_gain" },
    { "fx2_eq_mid_gain",       "fx2.eq_mid_gain" },
    { "fx2_eq_high_freq",      "fx2.eq_high_freq" },
    { "fx2_eq_high_gain",      "fx2.eq_high_gain" },
    // FX 3
    { "fx3_type",              "fx3.type" },
    { "fx3_mix",               "fx3.mix" },
    { "fx3_delay_time",        "fx3.delay_time" },
    { "fx3_delay_feedback",    "fx3.delay_feedback" },
    { "fx3_chorus_rate",       "fx3.chorus_rate" },
    { "fx3_chorus_depth",      "fx3.chorus_depth" },
    { "fx3_reverb_t60",        "fx3.reverb_t60" },
    { "fx3_reverb_damping",    "fx3.reverb_damping" },
    { "fx3_reverb_input_lpf",  "fx3.reverb_input_lpf" },
    { "fx3_distortion_drive",  "fx3.distortion_drive" },
    { "fx3_vhs_wow_rate",      "fx3.vhs_wow_rate" },
    { "fx3_vhs_wow_depth",     "fx3.vhs_wow_depth" },
    { "fx3_vhs_flutter_rate",  "fx3.vhs_flutter_rate" },
    { "fx3_vhs_flutter_depth", "fx3.vhs_flutter_depth" },
    { "fx3_vhs_drive",         "fx3.vhs_drive" },
    { "fx3_vhs_tone",          "fx3.vhs_tone" },
    { "fx3_vhs_noise",         "fx3.vhs_noise" },
    { "fx3_vhs_dropout",       "fx3.vhs_dropout" },
    { "fx3_eq_low_freq",       "fx3.eq_low_freq" },
    { "fx3_eq_low_gain",       "fx3.eq_low_gain" },
    { "fx3_eq_mid_gain",       "fx3.eq_mid_gain" },
    { "fx3_eq_high_freq",      "fx3.eq_high_freq" },
    { "fx3_eq_high_gain",      "fx3.eq_high_gain" },
    // Master
    { "master_volume",       "master_volume" },
    { "pitch_bend_range",    "pitch_bend_range" },
    { "portamento_time",     "portamento_time" },
    { "pan_spread",          "pan_spread" },
    // Voice count
    { "num_voices",          "num_voices" },
    // LFO 0..3
    { "lfo0_rate",           "lfo0.rate" },
    { "lfo0_depth",          "lfo0.depth" },
    { "lfo0_shape",          "lfo0.shape" },
    { "lfo1_rate",           "lfo1.rate" },
    { "lfo1_depth",          "lfo1.depth" },
    { "lfo1_shape",          "lfo1.shape" },
    { "lfo2_rate",           "lfo2.rate" },
    { "lfo2_depth",          "lfo2.depth" },
    { "lfo2_shape",          "lfo2.shape" },
    { "lfo3_rate",           "lfo3.rate" },
    { "lfo3_depth",          "lfo3.depth" },
    { "lfo3_shape",          "lfo3.shape" },
    // Macros 0..3
    { "macro0_value",        "macro0.value" },
    { "macro0_cc",           "macro0.cc" },
    { "macro1_value",        "macro1.value" },
    { "macro1_cc",           "macro1.cc" },
    { "macro2_value",        "macro2.value" },
    { "macro2_cc",           "macro2.cc" },
    { "macro3_value",        "macro3.value" },
    { "macro3_cc",           "macro3.cc" },
};

const int SubtreactionalAudioProcessor::kNumParams =
    (int)(sizeof (kParams) / sizeof (kParams[0]));

//==============================================================================
juce::AudioProcessorValueTreeState::ParameterLayout
SubtreactionalAudioProcessor::createParameterLayout()
{
    using NR  = juce::NormalisableRange<float>;
    using RAP = juce::RangedAudioParameter;

    std::vector<std::unique_ptr<RAP>> params;

    auto addSlider = [&](const char* id, float lo, float hi, float def,
                         float step = 0.0f, float skew = 1.0f)
    {
        NR range(lo, hi, step, skew);
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            juce::ParameterID{id, 1}, id, range, def));
    };

    auto addCombo = [&](const char* id, juce::StringArray choices, int def)
    {
        params.push_back(std::make_unique<juce::AudioParameterChoice>(
            juce::ParameterID{id, 1}, id, choices, def));
    };

    // OSC 1  (default: saw, full level)
    addCombo ("osc1_type",       {"Off","Saw","Square","Sine","Tri","Noise"}, 1);
    addSlider("osc1_pitch",     -24.0f, 24.0f,  0.0f, 0.01f);
    addSlider("osc1_level",      0.0f, 1.0f,   0.7f, 0.001f);
    addSlider("osc1_detune",   -50.0f, 50.0f,  0.0f, 0.1f);
    addSlider("osc1_octave",    -2.0f, 2.0f,   0.0f, 1.0f);
    addSlider("osc1_pulse_width", 0.0f, 1.0f,  0.5f, 0.001f);
    addSlider("osc1_pan",       -1.0f, 1.0f,   0.0f, 0.001f);
    addSlider("osc1_pan_spread", 0.0f, 1.0f,   1.0f, 0.001f);

    // OSC 2  (default: off)
    addCombo ("osc2_type",       {"Off","Saw","Square","Sine","Tri","Noise"}, 0);
    addSlider("osc2_pitch",     -24.0f, 24.0f,  0.0f, 0.01f);
    addSlider("osc2_level",      0.0f, 1.0f,   0.0f, 0.001f);
    addSlider("osc2_detune",   -50.0f, 50.0f,  0.0f, 0.1f);
    addSlider("osc2_octave",    -2.0f, 2.0f,   0.0f, 1.0f);
    addSlider("osc2_pulse_width", 0.0f, 1.0f,  0.5f, 0.001f);
    addSlider("osc2_pan",       -1.0f, 1.0f,   0.0f, 0.001f);
    addSlider("osc2_pan_spread", 0.0f, 1.0f,   1.0f, 0.001f);

    // Sub Oscillator
    addSlider("sub_level", 0.0f, 1.0f, 0.0f, 0.001f);

    // Filter
    addCombo ("filter_type",       {"Off","LP","HP","BP"}, 1);
    addSlider("filter_cutoff",     20.0f, 20000.0f, 2000.0f, 0.0f, 0.25f);
    addSlider("filter_resonance",  0.0f, 1.0f, 0.3f, 0.001f);
    addSlider("filter_env_amount", 0.0f, 1.0f, 0.0f, 0.001f);
    addSlider("filter_vel_amount", 0.0f, 1.0f, 0.0f, 0.001f);

    // Ring Modulation
    addSlider("ring_mod", 0.0f, 1.0f, 0.0f, 0.001f);

    // Filter envelope
    addSlider("fenv_attack",  1.0f, 5000.0f, 10.0f,  0.0f, 0.25f);
    addSlider("fenv_decay",   1.0f, 5000.0f, 300.0f, 0.0f, 0.25f);
    addSlider("fenv_sustain", 0.0f, 1.0f,    0.0f,   0.001f);
    addSlider("fenv_release", 1.0f, 5000.0f, 200.0f, 0.0f, 0.25f);

    // Amp envelope
    addSlider("aenv_attack",  1.0f, 5000.0f, 10.0f,  0.0f, 0.25f);
    addSlider("aenv_decay",   1.0f, 5000.0f, 200.0f, 0.0f, 0.25f);
    addSlider("aenv_sustain", 0.0f, 1.0f,    0.7f,   0.001f);
    addSlider("aenv_release", 1.0f, 5000.0f, 500.0f, 0.0f, 0.25f);

    // FX slots 0..3
    // Types: 0=Off,1=Delay,2=Chorus,3=Flanger,4=Phaser,5=VHS,6=Reverb,7=Distortion,8=EQ
    const juce::StringArray fxTypes { "Off","Delay","Chorus","Flanger","Phaser","VHS","Reverb","Distortion","EQ" };
    for (int i = 0; i < 4; ++i)
    {
        juce::String fx = "fx" + juce::String(i) + "_";
        addCombo ((fx + "type").toRawUTF8(),              fxTypes, 0);
        addSlider((fx + "mix").toRawUTF8(),               0.0f,   1.0f,    0.3f,  0.001f);
        addSlider((fx + "delay_time").toRawUTF8(),       10.0f, 1000.0f,  250.0f, 0.1f);
        addSlider((fx + "delay_feedback").toRawUTF8(),    0.0f,   0.99f,   0.3f,  0.001f);
        addSlider((fx + "chorus_rate").toRawUTF8(),       0.1f,  10.0f,   0.5f,  0.01f);
        addSlider((fx + "chorus_depth").toRawUTF8(),      0.0f,   1.0f,   0.4f,  0.001f);
        addSlider((fx + "reverb_t60").toRawUTF8(),        0.1f,  10.0f,   2.0f,  0.01f);
        addSlider((fx + "reverb_damping").toRawUTF8(),  500.0f, 20000.0f, 6000.0f, 1.0f);
        addSlider((fx + "reverb_input_lpf").toRawUTF8(), 100.0f, 20000.0f, 500.0f, 1.0f);
        addSlider((fx + "distortion_drive").toRawUTF8(),  0.0f,  10.0f,   1.0f,  0.01f);
        addSlider((fx + "vhs_wow_rate").toRawUTF8(),      0.1f,   5.0f,   0.35f, 0.01f);
        addSlider((fx + "vhs_wow_depth").toRawUTF8(),     0.0f,   1.0f,   0.25f, 0.001f);
        addSlider((fx + "vhs_flutter_rate").toRawUTF8(),  1.0f,  20.0f,   6.0f,  0.1f);
        addSlider((fx + "vhs_flutter_depth").toRawUTF8(), 0.0f,   1.0f,   0.15f, 0.001f);
        addSlider((fx + "vhs_drive").toRawUTF8(),         0.0f,   1.0f,   0.25f, 0.001f);
        addSlider((fx + "vhs_tone").toRawUTF8(),          0.0f,   1.0f,   0.35f, 0.001f);
        addSlider((fx + "vhs_noise").toRawUTF8(),         0.0f,   1.0f,   0.1f,  0.001f);
        addSlider((fx + "vhs_dropout").toRawUTF8(),       0.0f,   1.0f,   0.05f, 0.001f);
        addSlider((fx + "eq_low_freq").toRawUTF8(),      20.0f,  1000.0f, 300.0f, 1.0f);
        addSlider((fx + "eq_low_gain").toRawUTF8(),     -48.0f,   12.0f,   0.0f,  0.1f);
        addSlider((fx + "eq_mid_gain").toRawUTF8(),     -48.0f,   12.0f,   0.0f,  0.1f);
        addSlider((fx + "eq_high_freq").toRawUTF8(),   1000.0f, 20000.0f, 5000.0f, 1.0f);
        addSlider((fx + "eq_high_gain").toRawUTF8(),   -48.0f,   12.0f,   0.0f,  0.1f);
    }

    // Master volume
    addSlider("master_volume", 0.0f, 1.0f, 0.8f, 0.001f);

    // Pitch bend range (semitones: 0-24, default 2)
    addSlider("pitch_bend_range", 0.0f, 24.0f, 2.0f, 1.0f);

    // Portamento time (ms: 0-1000, default 0)
    addSlider("portamento_time", 0.0f, 1000.0f, 0.0f, 1.0f);

    // Global pan spread (0=mono, 1=full stereo, default 1.0 for audible stereo)
    addSlider("pan_spread", 0.0f, 1.0f, 1.0f, 0.001f);

    // Play mode (Poly=0, Mono=1, Legato=2)
    addCombo("play_mode", {"Poly","Mono","Legato"}, 0);

    // Voice count (1-16, default 8)
    juce::StringArray voiceChoices;
    for (int i = 1; i <= 16; ++i)
        voiceChoices.add(juce::String(i));
    addCombo("num_voices", voiceChoices, 7); // index 7 = 8 voices

    // LFOs 0..3 (sine, tri, saw, square)
    juce::StringArray lfoShapes { "Sine", "Tri", "Saw", "Square" };
    for (int l = 0; l < 4; ++l)
    {
        juce::String lp = "lfo" + juce::String(l) + "_";
        addSlider((lp + "rate").toRawUTF8(),  0.1f, 20.0f, 1.0f, 0.01f);
        addSlider((lp + "depth").toRawUTF8(), 0.0f, 1.0f,  0.0f, 0.001f);
        addCombo((lp  + "shape").toRawUTF8(), lfoShapes, 0);
    }

    // Macros 0..3
    for (int m = 0; m < 4; ++m)
    {
        juce::String mp = "macro" + juce::String(m) + "_";
        addSlider((mp + "value").toRawUTF8(), 0.0f, 1.0f,   0.0f, 0.001f);
        addSlider((mp + "cc").toRawUTF8(),   -1.0f, 127.0f, -1.0f, 1.0f);
    }

    return { params.begin(), params.end() };
}

//==============================================================================
SubtreactionalAudioProcessor::SubtreactionalAudioProcessor()
    : AudioProcessor (BusesProperties()
                      .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "Parameters", createParameterLayout())
{
    std::memset (mempool, 0, sizeof (mempool));
    std::memset (&synth,  0, sizeof (synth));

    for (auto& a : pendingMacroCC_)
        a.store (-1.0f);

    for (auto& d : pendingLFODepth_)
        d.store (kNoLFOOverride);
}

SubtreactionalAudioProcessor::~SubtreactionalAudioProcessor()
{
    if (synthInitialised)
        st_synth_deinit (&synth);
}

//==============================================================================
void SubtreactionalAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    // Preserve current patch state (including mod assignments) across re-initialization.
    // This handles both cases:
    //  (a) setStateInformation called before first prepareToPlay → pendingState_ already set
    //  (b) prepareToPlay called again (sample-rate change, DAW transport) → save now
    if (synthInitialised && pendingState_.isEmpty())
        getStateInformation (pendingState_);

    if (synthInitialised)
        st_synth_deinit (&synth);

    std::memset (mempool, 0, sizeof (mempool));
    std::memset (&synth,  0, sizeof (synth));

    st_config cfg;
    cfg.sample_rate    = static_cast<float> (sampleRate);
    cfg.max_block_size = samplesPerBlock;
    cfg.memory         = mempool;
    cfg.memory_size    = kMempoolSize;

    // Read num_voices from APVTS (choice param: 0=1 voice, 1=2 voices, ..., 15=16 voices)
    if (auto* numVoicesParam = dynamic_cast<juce::AudioParameterChoice*>(
            apvts.getParameter("num_voices")))
    {
        cfg.num_voices = numVoicesParam->getIndex() + 1;
    }
    else
    {
        cfg.num_voices = 8; // fallback
    }

    if (st_synth_init (&synth, &cfg) != 0)
    {
        juce::Logger::writeToLog ("st_synth_init failed");
        return;
    }

    synthInitialised = true;

    // If setStateInformation was called before prepareToPlay (common DAW pattern),
    // apply the deferred patch JSON now — it overrides the APVTS defaults below.
    if (! pendingState_.isEmpty())
    {
        applyStateData (pendingState_.getData(), (int) pendingState_.getSize());
        pendingState_.reset();
    }
    else
    {
        syncAllParamsToSynth();

        // Mod assignments (LFO/macro targets) are not APVTS params — they only
        // live in modAssignments_.  After a synth re-init they must be replayed
        // so that LFO targets survive a second prepareToPlay call from the host.
        for (const auto& a : modAssignments_)
            st_synth_mod_add (&synth, a.sourceType, a.sourceIdx,
                              a.paramName.toRawUTF8(), a.depth);

        if (! modAssignments_.empty())
            patchJustLoaded_.store (true);
    }

    // Apply play_mode once (has side-effect: st_synth_panic — don't run every block)
    lastPlayMode_ = apvts.getRawParameterValue ("play_mode")->load();
    st_synth_set_param_float (&synth, "play_mode", lastPlayMode_);
}

void SubtreactionalAudioProcessor::releaseResources()
{
    if (synthInitialised)
    {
        st_synth_deinit (&synth);
        synthInitialised = false;
    }
}

bool SubtreactionalAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

//==============================================================================
void SubtreactionalAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                                  juce::MidiBuffer& midiMessages)
{
    if (! synthInitialised)
    {
        buffer.clear();
        return;
    }

    juce::ScopedNoDenormals noDenormals;
    buffer.clear();

    // Apply any macro values driven by MIDI CC since the last block.
    // This must happen before the APVTS sync so the CC value is not overwritten.
    for (int m = 0; m < ST_MAX_MACROS; ++m)
    {
        const float ccVal = pendingMacroCC_[m].exchange (-1.0f);
        if (ccVal >= 0.0f)
        {
            // Write into the APVTS raw atomic so the sync below picks it up.
            // getRawParameterValue returns the denormalized value; for macro_value
            // (range 0..1) the denormalized value equals the normalised value.
            if (auto* raw = apvts.getRawParameterValue ("macro" + juce::String (m) + "_value"))
                raw->store (ccVal);
        }
    }

    // Sync all APVTS parameters to the synth before rendering.
    // Skipped during applyStateData to prevent overwriting freshly loaded values
    // with stale APVTS defaults before syncApvtsFromSynth has updated APVTS.
    if (! apvtsSyncDisabled_.load())
    {
        for (int i = 0; i < kNumParams; ++i)
        {
            float val = apvts.getRawParameterValue (kParams[i].apvtsId)->load();
            st_synth_set_param_float (&synth, kParams[i].synthName, val);
        }
    }

    // Re-apply LFO depths from the most recent patch load.  This overrides any
    // stale APVTS values the host may have restored after prepareToPlay returned.
    // The override stays active on every block until resyncLFOParamsToAPVTS() clears
    // it from the editor timer (~33 ms after patch load).
    {
        static const char* kLFODepthSynthNames[ST_MAX_LFOS] = {
            "lfo0.depth", "lfo1.depth", "lfo2.depth", "lfo3.depth"
        };
        for (int l = 0; l < ST_MAX_LFOS; ++l)
        {
            const float d = pendingLFODepth_[l].load();
            if (d != kNoLFOOverride)
                st_synth_set_param_float (&synth, kLFODepthSynthNames[l], d);
        }
    }

    // play_mode calls st_synth_panic() on every set — only apply on change.
    {
        float pm = apvts.getRawParameterValue ("play_mode")->load();
        if (pm != lastPlayMode_)
        {
            lastPlayMode_ = pm;
            st_synth_set_param_float (&synth, "play_mode", pm);
        }
    }

    // Handle MIDI events
    for (const auto metadata : midiMessages)
    {
        const auto msg = metadata.getMessage();
        if (msg.isNoteOn())
            st_synth_note_on  (&synth, msg.getNoteNumber(), msg.getVelocity());
        else if (msg.isNoteOff())
            st_synth_note_off (&synth, msg.getNoteNumber(), 0);
        else if (msg.isController())
        {
            const int cc  = msg.getControllerNumber();
            const int val = msg.getControllerValue();
            st_synth_midi_cc (&synth, cc, val);

            // Store CC-driven macro values so the top of the next block
            // writes them into APVTS before the APVTS→synth sync runs.
            for (int m = 0; m < ST_MAX_MACROS; ++m)
            {
                if (synth.patch.macros[m].cc == cc)
                    pendingMacroCC_[m].store (val / 127.0f);
            }
        }
    }

    // Render audio — st_synth_render add-mixes into (already-cleared) buffers
    float* channelPtrs[2] = {
        buffer.getWritePointer (0),
        buffer.getWritePointer (1)
    };
    st_synth_render (&synth, channelPtrs, buffer.getNumSamples());

    pushAnalyzerSamples (buffer);
}

//==============================================================================
juce::AudioProcessorEditor* SubtreactionalAudioProcessor::createEditor()
{
    return new SubtreactionalAudioProcessorEditor (*this);
}

//==============================================================================
void SubtreactionalAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (! synthInitialised)
        return;

    char* json = st_patch_save_string (&synth);
    if (json)
    {
        destData.append (json, std::strlen (json));
        std::free (json);
    }
}

void SubtreactionalAudioProcessor::applyStateData (const void* data, int sizeInBytes)
{
    juce::MemoryBlock mb (data, static_cast<size_t> (sizeInBytes));
    mb.append ("\0", 1);

    const char* json = static_cast<const char*> (mb.getData());

    // Guard: prevent processBlock from overwriting freshly loaded synth values
    // with stale APVTS values in the window between st_patch_load_string and
    // syncApvtsFromSynth.  Without this, the audio thread can clobber e.g.
    // lfo0.depth back to 0 before syncApvtsFromSynth reads it, permanently
    // locking the LFO off.
    apvtsSyncDisabled_.store (true);

    if (st_patch_load_string (&synth, json) == 0)
    {
        syncApvtsFromSynth();           // synth → APVTS so knobs reflect the loaded patch
        rebuildModAssignmentsFromPatch();

        // Cache each LFO's depth so processBlock can re-apply it after the host
        // restores stale APVTS values.  The override stays active until the editor
        // timer calls resyncLFOParamsToAPVTS() (~33 ms later).
        for (int l = 0; l < ST_MAX_LFOS; ++l)
            pendingLFODepth_[l].store (synth.patch.lfos[l].depth);

        patchJustLoaded_.store (true);  // signal editor timer to re-push mod assignments
        // Leave apvtsSyncDisabled_ = true here.  The editor timer will call
        // resyncLFOParamsToAPVTS() on the next tick (~33 ms), which clears the flag.
    }
    else
    {
        apvtsSyncDisabled_.store (false);
    }
}

void SubtreactionalAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (sizeInBytes <= 0)
        return;

    if (! synthInitialised)
    {
        pendingState_.replaceAll (data, static_cast<size_t> (sizeInBytes));
        return;
    }

    applyStateData (data, sizeInBytes);
}

//==============================================================================
void SubtreactionalAudioProcessor::rebuildModAssignmentsFromPatch()
{
    modAssignments_.clear();
    if (! synthInitialised) return;

    // Reverse map: st_mod_param enum value → dot-notation name.
    // Order MUST match the st_mod_param enum in st_types.h exactly.
    static const char* kModParamNames[ST_MOD_PARAM_COUNT] = {
        "pitch",                                          // ST_MOD_PITCH
        "osc1.pitch",                                     // ST_MOD_OSC1_PITCH
        "osc1.level",   "osc1.detune",                    // ST_MOD_OSC1_LEVEL/DETUNE
        "osc1.pulse_width", "osc1.pan",                   // ST_MOD_OSC1_PULSE_WIDTH/PAN
        "osc2.pitch",                                     // ST_MOD_OSC2_PITCH
        "osc2.level",   "osc2.detune",                    // ST_MOD_OSC2_LEVEL/DETUNE
        "osc2.pulse_width", "osc2.pan",                   // ST_MOD_OSC2_PULSE_WIDTH/PAN
        "sub.level",    "ring_mod",                       // ST_MOD_SUB_LEVEL/RING_MOD
        "filter.cutoff", "filter.resonance",              // ST_MOD_FILTER_CUTOFF/RESONANCE
        "fenv.attack",  "fenv.decay",                     // ST_MOD_FENV_ATTACK/DECAY
        "fenv.sustain", "fenv.release",                   // ST_MOD_FENV_SUSTAIN/RELEASE
        "amp",                                            // ST_MOD_AMP
        "aenv.attack",  "aenv.decay",                     // ST_MOD_AENV_ATTACK/DECAY
        "aenv.sustain", "aenv.release",                   // ST_MOD_AENV_SUSTAIN/RELEASE
        "pan_spread",   "master_volume",                  // ST_MOD_PAN_SPREAD/MASTER_VOLUME
        "fx0.mix", "fx1.mix", "fx2.mix", "fx3.mix",      // ST_MOD_FX0-3_MIX
    };

    // Rebuild from LFOs
    for (int l = 0; l < ST_MAX_LFOS; ++l)
    {
        const st_lfo_data& lfo = synth.patch.lfos[l];
        for (int t = 0; t < lfo.num_targets; ++t)
        {
            int paramIdx = static_cast<int> (lfo.targets[t].param);
            if (paramIdx < 0 || paramIdx >= ST_MOD_PARAM_COUNT) continue;
            modAssignments_.push_back ({ 0, l,
                                         juce::String (kModParamNames[paramIdx]),
                                         lfo.targets[t].depth });
        }
    }

    // Rebuild from Macros
    for (int m = 0; m < ST_MAX_MACROS; ++m)
    {
        const st_macro_data& mac = synth.patch.macros[m];
        for (int t = 0; t < mac.num_targets; ++t)
        {
            int paramIdx = static_cast<int> (mac.targets[t].param);
            if (paramIdx < 0 || paramIdx >= ST_MOD_PARAM_COUNT) continue;
            modAssignments_.push_back ({ 1, m,
                                         juce::String (kModParamNames[paramIdx]),
                                         mac.targets[t].depth });
        }
    }
}

//==============================================================================
void SubtreactionalAudioProcessor::modAdd (int sourceType, int sourceIdx,
                                            const juce::String& paramName, float depth)
{
    if (! synthInitialised) return;

    st_synth_mod_add (&synth, sourceType, sourceIdx,
                      paramName.toRawUTF8(), depth);

    // Update local mirror
    auto it = std::find_if (modAssignments_.begin(), modAssignments_.end(),
        [&](const ModAssignment& a) {
            return a.sourceType == sourceType && a.sourceIdx == sourceIdx
                   && a.paramName == paramName;
        });
    if (it != modAssignments_.end())
        it->depth = depth;
    else
        modAssignments_.push_back ({ sourceType, sourceIdx, paramName, depth });

    // Mod assignments bypass APVTS — notify the host that state changed so
    // the DAW marks the project dirty and includes the changes when saving.
    updateHostDisplay (juce::AudioProcessorListener::ChangeDetails().withNonParameterStateChanged (true));
}

void SubtreactionalAudioProcessor::modRemove (int sourceType, int sourceIdx,
                                               const juce::String& paramName)
{
    if (! synthInitialised) return;

    st_synth_mod_remove (&synth, sourceType, sourceIdx, paramName.toRawUTF8());

    modAssignments_.erase (
        std::remove_if (modAssignments_.begin(), modAssignments_.end(),
            [&](const ModAssignment& a) {
                return a.sourceType == sourceType && a.sourceIdx == sourceIdx
                       && a.paramName == paramName;
            }),
        modAssignments_.end());

    updateHostDisplay (juce::AudioProcessorListener::ChangeDetails().withNonParameterStateChanged (true));
}

void SubtreactionalAudioProcessor::modSetDepth (int sourceType, int sourceIdx,
                                                 const juce::String& paramName, float depth)
{
    if (! synthInitialised) return;

    st_synth_mod_set_depth (&synth, sourceType, sourceIdx,
                            paramName.toRawUTF8(), depth);

    auto it = std::find_if (modAssignments_.begin(), modAssignments_.end(),
        [&](const ModAssignment& a) {
            return a.sourceType == sourceType && a.sourceIdx == sourceIdx
                   && a.paramName == paramName;
        });
    if (it != modAssignments_.end())
        it->depth = depth;

    updateHostDisplay (juce::AudioProcessorListener::ChangeDetails().withNonParameterStateChanged (true));
}

//==============================================================================
void SubtreactionalAudioProcessor::syncAllParamsToSynth()
{
    if (! synthInitialised)
        return;

    for (int i = 0; i < kNumParams; ++i)
    {
        float val = apvts.getRawParameterValue (kParams[i].apvtsId)->load();
        st_synth_set_param_float (&synth, kParams[i].synthName, val);
    }
}

void SubtreactionalAudioProcessor::syncApvtsFromSynth()
{
    if (! synthInitialised)
        return;

    for (int i = 0; i < kNumParams; ++i)
    {
        float val = 0.0f;
        if (st_synth_get_param_float (&synth, kParams[i].synthName, &val) != 0)
            continue;

        if (auto* p = dynamic_cast<juce::RangedAudioParameter*> (
                apvts.getParameter (kParams[i].apvtsId)))
        {
            p->setValueNotifyingHost (p->getNormalisableRange().convertTo0to1 (val));
        }
    }

    // play_mode is excluded from kParams[] to avoid voice panic on every block,
    // so we sync it explicitly here.  prepareToPlay reads the APVTS value, so
    // without this the synth reverts to Poly on every DAW reload.
    {
        float pm = 0.0f;
        if (st_synth_get_param_float (&synth, "play_mode", &pm) == 0)
            if (auto* p = apvts.getParameter ("play_mode"))
                p->setValueNotifyingHost (p->getNormalisableRange().convertTo0to1 (pm));
    }
}

void SubtreactionalAudioProcessor::resyncLFOParamsToAPVTS()
{
    if (! synthInitialised)
        return;

    // Re-sync LFO depth, rate, shape from synth to APVTS.
    // This counteracts the host's parameter restore (which happens after prepareToPlay
    // and can clobber APVTS values with stale saved values).
    for (int l = 0; l < ST_MAX_LFOS; ++l)
    {
        const char* fields[] = { "rate", "depth", "shape" };
        for (const char* field : fields)
        {
            juce::String synthName = "lfo" + juce::String (l) + "." + field;
            juce::String apvtsId = "lfo" + juce::String (l) + "_" + field;

            float val = 0.0f;
            if (st_synth_get_param_float (&synth, synthName.toRawUTF8(), &val) == 0)
            {
                if (auto* p = dynamic_cast<juce::RangedAudioParameter*> (
                        apvts.getParameter (apvtsId)))
                {
                    p->setValueNotifyingHost (p->getNormalisableRange().convertTo0to1 (val));
                }
            }
        }
    }

    // Clear the LFO depth override — APVTS now holds the correct values so
    // processBlock's normal APVTS→synth sync will keep the depth correct.
    for (auto& d : pendingLFODepth_)
        d.store (kNoLFOOverride);

    // Allow processBlock to resume its APVTS→synth sync now that APVTS is correct.
    apvtsSyncDisabled_.store (false);
}

int SubtreactionalAudioProcessor::popAnalyzerSamples (float* dest, int maxSamples)
{
    if (dest == nullptr || maxSamples <= 0)
        return 0;

    int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
    analyzerFifo.prepareToRead (maxSamples, start1, size1, start2, size2);

    if (size1 > 0)
        std::memcpy (dest,
                     analyzerSampleBuffer.data() + start1,
                     static_cast<size_t> (size1) * sizeof (float));

    if (size2 > 0)
        std::memcpy (dest + size1,
                     analyzerSampleBuffer.data() + start2,
                     static_cast<size_t> (size2) * sizeof (float));

    analyzerFifo.finishedRead (size1 + size2);
    return size1 + size2;
}

void SubtreactionalAudioProcessor::pushAnalyzerSamples (const juce::AudioBuffer<float>& buffer)
{
    const int numSamples = buffer.getNumSamples();
    if (numSamples <= 0 || buffer.getNumChannels() <= 0)
        return;

    int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
    analyzerFifo.prepareToWrite (numSamples, start1, size1, start2, size2);

    const float* left = buffer.getReadPointer (0);
    const float* right = buffer.getNumChannels() > 1 ? buffer.getReadPointer (1) : nullptr;

    auto writeRange = [&](int start, int size, int sourceOffset)
    {
        for (int i = 0; i < size; ++i)
        {
            const int srcIndex = sourceOffset + i;
            const float mono = right != nullptr
                ? 0.5f * (left[srcIndex] + right[srcIndex])
                : left[srcIndex];
            analyzerSampleBuffer[static_cast<size_t> (start + i)] = mono;
        }
    };

    writeRange (start1, size1, 0);
    writeRange (start2, size2, size1);

    analyzerFifo.finishedWrite (size1 + size2);
}

//==============================================================================
// Factory preset manifest
//==============================================================================
namespace {
struct FactoryEntry { const char* data; int size; const char* category; const char* name; };
static const FactoryEntry kFactory[] = {
    { PresetData::Acid_Bass_json,       PresetData::Acid_Bass_jsonSize,       "Bass",  "Acid Bass"       },
    { PresetData::Reese_Bass_json,      PresetData::Reese_Bass_jsonSize,      "Bass",  "Reese Bass"      },
    { PresetData::Sub_Bass_json,        PresetData::Sub_Bass_jsonSize,        "Bass",  "Sub Bass"        },
    { PresetData::Wobble_Bass_json,     PresetData::Wobble_Bass_jsonSize,     "Bass",  "Wobble Bass"     },
    { PresetData::Dirty_Lead_json,      PresetData::Dirty_Lead_jsonSize,      "Lead",  "Dirty Lead"      },
    { PresetData::Mono_Lead_json,       PresetData::Mono_Lead_jsonSize,       "Lead",  "Mono Lead"       },
    { PresetData::PWM_Lead_json,        PresetData::PWM_Lead_jsonSize,        "Lead",  "PWM Lead"        },
    { PresetData::Supersaw_Lead_json,   PresetData::Supersaw_Lead_jsonSize,   "Lead",  "Supersaw Lead"   },
    { PresetData::Atmospheric_Pad_json, PresetData::Atmospheric_Pad_jsonSize, "Pad",   "Atmospheric Pad" },
    { PresetData::Noise_Pad_json,       PresetData::Noise_Pad_jsonSize,       "Pad",   "Noise Pad"       },
    { PresetData::String_Pad_json,      PresetData::String_Pad_jsonSize,      "Pad",   "String Pad"      },
    { PresetData::Warm_Pad_json,        PresetData::Warm_Pad_jsonSize,        "Pad",   "Warm Pad"        },
    { PresetData::Harp_json,            PresetData::Harp_jsonSize,            "Pluck", "Harp"            },
    { PresetData::Metallic_Pluck_json,  PresetData::Metallic_Pluck_jsonSize,  "Pluck", "Metallic Pluck"  },
    { PresetData::Pluck_json,           PresetData::Pluck_jsonSize,           "Pluck", "Pluck"           },
    { PresetData::Rhodes_Pluck_json,    PresetData::Rhodes_Pluck_jsonSize,    "Pluck", "Rhodes Pluck"    },
};
static constexpr int kNumFactory = (int)(sizeof(kFactory) / sizeof(kFactory[0]));
} // namespace

juce::File SubtreactionalAudioProcessor::getUserPresetsDir() const
{
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
               .getChildFile ("Reactional Music")
               .getChildFile ("Subtreactional")
               .getChildFile ("Presets");
}

juce::Array<SubtreactionalAudioProcessor::PresetInfo>
SubtreactionalAudioProcessor::getPresetList() const
{
    juce::Array<PresetInfo> list;

    for (int i = 0; i < kNumFactory; ++i)
    {
        juce::String json (juce::CharPointer_UTF8 (kFactory[i].data),
                           (size_t) kFactory[i].size);
        auto j = juce::JSON::fromString (json);
        PresetInfo p;
        p.isFactory   = true;
        p.factoryIdx  = i;
        p.category    = kFactory[i].category;
        p.name        = j.getProperty ("name",        kFactory[i].name).toString();
        p.author      = j.getProperty ("author",      "").toString();
        p.description = j.getProperty ("description", "").toString();
        list.add (p);
    }

    const juce::File dir = getUserPresetsDir();
    if (dir.isDirectory())
    {
        for (auto& f : dir.findChildFiles (juce::File::findFiles, false, "*.json"))
        {
            auto j = juce::JSON::fromString (f.loadFileAsString());
            PresetInfo p;
            p.isFactory   = false;
            p.filePath    = f.getFullPathName();
            p.category    = "User";
            p.name        = j.getProperty ("name",        f.getFileNameWithoutExtension()).toString();
            p.author      = j.getProperty ("author",      "").toString();
            p.description = j.getProperty ("description", "").toString();
            list.add (p);
        }
    }
    return list;
}

void SubtreactionalAudioProcessor::loadFactoryPreset (int idx)
{
    if (idx < 0 || idx >= kNumFactory) return;
    const juce::String json (juce::CharPointer_UTF8 (kFactory[idx].data),
                             (size_t) kFactory[idx].size);
    const auto utf8 = json.toUTF8();
    setStateInformation (utf8.getAddress(), (int) std::strlen (utf8.getAddress()));
}

void SubtreactionalAudioProcessor::loadUserPreset (const juce::String& filePath)
{
    const juce::File f (filePath);
    if (! f.existsAsFile()) return;
    const juce::String json = f.loadFileAsString();
    const auto utf8 = json.toUTF8();
    setStateInformation (utf8.getAddress(), (int) std::strlen (utf8.getAddress()));
}

void SubtreactionalAudioProcessor::setPatchMeta (const juce::String& name,
                                                  const juce::String& author,
                                                  const juce::String& description)
{
    if (! synthInitialised) return;
    name.copyToUTF8        (synth.patch.name,        sizeof (synth.patch.name));
    author.copyToUTF8      (synth.patch.author,      sizeof (synth.patch.author));
    description.copyToUTF8 (synth.patch.description, sizeof (synth.patch.description));
}

void SubtreactionalAudioProcessor::saveUserPreset (const juce::String& name,
                                                    const juce::String& author,
                                                    const juce::String& description)
{
    if (! synthInitialised) return;
    setPatchMeta (name, author, description);

    juce::MemoryBlock mb;
    getStateInformation (mb);
    if (mb.isEmpty()) return;

    const juce::File dir = getUserPresetsDir();
    dir.createDirectory();

    juce::String safeName = name;
    for (juce::juce_wchar ch : { (juce::juce_wchar)'/', (juce::juce_wchar)'\\',
                                  (juce::juce_wchar)':', (juce::juce_wchar)'*',
                                  (juce::juce_wchar)'?', (juce::juce_wchar)'"',
                                  (juce::juce_wchar)'<', (juce::juce_wchar)'>',
                                  (juce::juce_wchar)'|' })
        safeName = safeName.replaceCharacter (ch, '_');
    if (safeName.isEmpty()) safeName = "Untitled";

    juce::File out = dir.getChildFile (safeName + ".json");
    out.replaceWithData (mb.getData(), mb.getSize());
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new SubtreactionalAudioProcessor();
}
