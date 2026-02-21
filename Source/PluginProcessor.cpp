#include "PluginProcessor.h"
#include "PluginEditor.h"

#include <cstring>
#include <cstdlib>

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
    { "osc1_level",          "osc1.level" },
    { "osc1_detune",         "osc1.detune" },
    { "osc1_octave",         "osc1.octave" },
    // OSC 2
    { "osc2_type",           "osc2.type" },
    { "osc2_level",          "osc2.level" },
    { "osc2_detune",         "osc2.detune" },
    { "osc2_octave",         "osc2.octave" },
    // Filter
    { "filter_type",         "filter.type" },
    { "filter_cutoff",       "filter.cutoff" },
    { "filter_resonance",    "filter.resonance" },
    { "filter_env_amount",   "filter.env_amount" },
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
    { "fx0_type",            "fx0.type" },
    { "fx0_mix",             "fx0.mix" },
    { "fx0_delay_time",      "fx0.delay_time" },
    { "fx0_delay_feedback",  "fx0.delay_feedback" },
    { "fx0_chorus_rate",     "fx0.chorus_rate" },
    { "fx0_chorus_depth",    "fx0.chorus_depth" },
    { "fx0_reverb_t60",      "fx0.reverb_t60" },
    // FX 1
    { "fx1_type",            "fx1.type" },
    { "fx1_mix",             "fx1.mix" },
    { "fx1_delay_time",      "fx1.delay_time" },
    { "fx1_delay_feedback",  "fx1.delay_feedback" },
    { "fx1_chorus_rate",     "fx1.chorus_rate" },
    { "fx1_chorus_depth",    "fx1.chorus_depth" },
    { "fx1_reverb_t60",      "fx1.reverb_t60" },
    // FX 2
    { "fx2_type",            "fx2.type" },
    { "fx2_mix",             "fx2.mix" },
    { "fx2_delay_time",      "fx2.delay_time" },
    { "fx2_delay_feedback",  "fx2.delay_feedback" },
    { "fx2_chorus_rate",     "fx2.chorus_rate" },
    { "fx2_chorus_depth",    "fx2.chorus_depth" },
    { "fx2_reverb_t60",      "fx2.reverb_t60" },
    // FX 3
    { "fx3_type",            "fx3.type" },
    { "fx3_mix",             "fx3.mix" },
    { "fx3_delay_time",      "fx3.delay_time" },
    { "fx3_delay_feedback",  "fx3.delay_feedback" },
    { "fx3_chorus_rate",     "fx3.chorus_rate" },
    { "fx3_chorus_depth",    "fx3.chorus_depth" },
    { "fx3_reverb_t60",      "fx3.reverb_t60" },
    // Master
    { "master_volume",       "master_volume" },
    // Voice count
    { "num_voices",          "num_voices" },
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
    addCombo ("osc1_type",   {"Off","Saw","Square","Sine","Tri"}, 1);
    addSlider("osc1_level",  0.0f, 1.0f, 0.7f, 0.001f);
    addSlider("osc1_detune", -50.0f, 50.0f, 0.0f, 0.1f);
    addSlider("osc1_octave", -2.0f, 2.0f, 0.0f, 1.0f);

    // OSC 2  (default: off)
    addCombo ("osc2_type",   {"Off","Saw","Square","Sine","Tri"}, 0);
    addSlider("osc2_level",  0.0f, 1.0f, 0.0f, 0.001f);
    addSlider("osc2_detune", -50.0f, 50.0f, 0.0f, 0.1f);
    addSlider("osc2_octave", -2.0f, 2.0f, 0.0f, 1.0f);

    // Filter
    addCombo ("filter_type",       {"Off","LP","HP","BP"}, 1);
    addSlider("filter_cutoff",     20.0f, 20000.0f, 2000.0f, 0.0f, 0.25f);
    addSlider("filter_resonance",  0.0f, 1.0f, 0.3f, 0.001f);
    addSlider("filter_env_amount", 0.0f, 1.0f, 0.0f, 0.001f);

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
    const juce::StringArray fxTypes { "Off","Delay","Chorus","Reverb" };
    for (int i = 0; i < 4; ++i)
    {
        juce::String fx = "fx" + juce::String(i) + "_";
        addCombo ((fx + "type").toRawUTF8(),           fxTypes, 0);
        addSlider((fx + "mix").toRawUTF8(),            0.0f,  1.0f,    0.3f, 0.001f);
        addSlider((fx + "delay_time").toRawUTF8(),    10.0f, 1000.0f, 250.0f, 0.1f);
        addSlider((fx + "delay_feedback").toRawUTF8(), 0.0f,  0.99f,  0.3f, 0.001f);
        addSlider((fx + "chorus_rate").toRawUTF8(),    0.1f, 10.0f,   0.5f, 0.01f);
        addSlider((fx + "chorus_depth").toRawUTF8(),   0.0f,  1.0f,   0.4f, 0.001f);
        addSlider((fx + "reverb_t60").toRawUTF8(),     0.1f, 10.0f,   2.0f, 0.01f);
    }

    // Master volume
    addSlider("master_volume", 0.0f, 1.0f, 0.8f, 0.001f);

    // Voice count (1-16, default 8)
    juce::StringArray voiceChoices;
    for (int i = 1; i <= 16; ++i)
        voiceChoices.add(juce::String(i));
    addCombo("num_voices", voiceChoices, 7); // index 7 = 8 voices

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
}

SubtreactionalAudioProcessor::~SubtreactionalAudioProcessor()
{
    if (synthInitialised)
        st_synth_deinit (&synth);
}

//==============================================================================
void SubtreactionalAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
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
    syncAllParamsToSynth();
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

    // Sync all APVTS parameters to the synth before rendering.
    // getRawParameterValue returns std::atomic<float>*, safe from audio thread.
    for (int i = 0; i < kNumParams; ++i)
    {
        float val = apvts.getRawParameterValue (kParams[i].apvtsId)->load();
        st_synth_set_param_float (&synth, kParams[i].synthName, val);
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
            st_synth_midi_cc  (&synth, msg.getControllerNumber(), msg.getControllerValue());
    }

    // Render audio — st_synth_render add-mixes into (already-cleared) buffers
    float* channelPtrs[2] = {
        buffer.getWritePointer (0),
        buffer.getWritePointer (1)
    };
    st_synth_render (&synth, channelPtrs, buffer.getNumSamples());
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

void SubtreactionalAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (! synthInitialised || sizeInBytes <= 0)
        return;

    juce::MemoryBlock mb (data, static_cast<size_t> (sizeInBytes));
    mb.append ("\0", 1);

    const char* json = static_cast<const char*> (mb.getData());
    if (st_patch_load_string (&synth, json) == 0)
        syncApvtsFromSynth();  // synth → APVTS so knobs reflect the loaded patch
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
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new SubtreactionalAudioProcessor();
}
