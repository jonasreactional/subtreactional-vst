#include "PluginProcessor.h"
#include "PluginEditor.h"

#include <cstring>
#include <cstdlib>

extern "C" {
#include "subtreactional/subtreactional.h"
}

//==============================================================================
// APVTS parameter IDs — match st_synth dot-notation names exactly.
// The osc type enum: 0=off 1=saw 2=square 3=sine 4=tri
// The filter type enum: 0=off 1=lp 2=hp 3=bp
// The fx type enum: 0=off 1=delay 2=chorus 3=reverb
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

    // OSC 1
    addCombo ("osc1.type",   {"off","saw","square","sine","tri"}, 1);
    addSlider("osc1.level",  0.0f, 1.0f, 0.7f, 0.001f);
    addSlider("osc1.detune", -50.0f, 50.0f, 0.0f, 0.1f);
    addSlider("osc1.octave", -2.0f, 2.0f, 0.0f, 1.0f);

    // OSC 2
    addCombo ("osc2.type",   {"off","saw","square","sine","tri"}, 0);
    addSlider("osc2.level",  0.0f, 1.0f, 0.0f, 0.001f);
    addSlider("osc2.detune", -50.0f, 50.0f, 0.0f, 0.1f);
    addSlider("osc2.octave", -2.0f, 2.0f, 0.0f, 1.0f);

    // Filter
    addCombo ("filter.type",       {"off","lp","hp","bp"}, 1);
    addSlider("filter.cutoff",     20.0f, 20000.0f, 2000.0f, 0.0f, 0.25f); // skewed
    addSlider("filter.resonance",  0.0f, 1.0f, 0.3f, 0.001f);
    addSlider("filter.env_amount", 0.0f, 1.0f, 0.0f, 0.001f);

    // Filter envelope
    addSlider("filter_env.attack",  1.0f, 5000.0f, 10.0f,  0.0f, 0.25f);
    addSlider("filter_env.decay",   1.0f, 5000.0f, 300.0f, 0.0f, 0.25f);
    addSlider("filter_env.sustain", 0.0f, 1.0f,    0.0f,   0.001f);
    addSlider("filter_env.release", 1.0f, 5000.0f, 200.0f, 0.0f, 0.25f);

    // Amp envelope
    addSlider("amp_env.attack",  1.0f, 5000.0f, 10.0f,  0.0f, 0.25f);
    addSlider("amp_env.decay",   1.0f, 5000.0f, 200.0f, 0.0f, 0.25f);
    addSlider("amp_env.sustain", 0.0f, 1.0f,    0.7f,   0.001f);
    addSlider("amp_env.release", 1.0f, 5000.0f, 500.0f, 0.0f, 0.25f);

    // FX slots 0..3
    for (int i = 0; i < 4; ++i)
    {
        juce::String fx = "fx" + juce::String(i);
        addCombo ((fx + ".type").toRawUTF8(), {"off","delay","chorus","reverb"}, 0);
        addSlider((fx + ".mix").toRawUTF8(),      0.0f,  1.0f,    0.3f,  0.001f);
        addSlider((fx + ".time").toRawUTF8(),    10.0f, 500.0f, 250.0f,  0.1f);
        addSlider((fx + ".feedback").toRawUTF8(), 0.0f,  0.99f,  0.3f,  0.001f);
        addSlider((fx + ".rate").toRawUTF8(),     0.1f, 10.0f,   0.5f,  0.01f);
        addSlider((fx + ".depth").toRawUTF8(),    0.0f,  1.0f,   0.4f,  0.001f);
        addSlider((fx + ".t60").toRawUTF8(),      0.1f, 10.0f,   2.0f,  0.01f);
    }

    // Master volume
    addSlider("master_volume", 0.0f, 1.0f, 0.8f, 0.001f);

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
    cfg.num_voices     = 8;
    cfg.memory         = mempool;
    cfg.memory_size    = kMempoolSize;

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
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    return true;
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

    // Handle MIDI events
    for (const auto metadata : midiMessages)
    {
        const auto msg = metadata.getMessage();
        if (msg.isNoteOn())
            st_synth_note_on (&synth, msg.getNoteNumber(), msg.getVelocity());
        else if (msg.isNoteOff())
            st_synth_note_off (&synth, msg.getNoteNumber(), 0);
        else if (msg.isController())
            st_synth_midi_cc (&synth, msg.getControllerNumber(), msg.getControllerValue());
    }

    // Render audio — st_synth_render add-mixes into buffers (they are already cleared)
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

    // Null-terminate
    juce::MemoryBlock mb (data, static_cast<size_t> (sizeInBytes));
    mb.append ("\0", 1);

    const char* json = static_cast<const char*> (mb.getData());
    if (st_patch_load_string (&synth, json) == 0)
        syncAllParamsToSynth();
}

//==============================================================================
void SubtreactionalAudioProcessor::applyParam (const char* name, float value)
{
    st_synth_set_param_float (&synth, name, value);
}

void SubtreactionalAudioProcessor::syncAllParamsToSynth()
{
    if (! synthInitialised)
        return;

    // Collect all parameter IDs and push their current values to synth.
    // Osc types: APVTS combo index matches st_osc_type enum values.
    // Filter/FX types same.
    for (auto* param : apvts.processor.getParameters())
    {
        if (auto* ranged = dynamic_cast<juce::RangedAudioParameter*> (param))
        {
            juce::String id = ranged->getParameterID();
            float value     = ranged->convertFrom0to1 (ranged->getValue());
            st_synth_set_param_float (&synth, id.toRawUTF8(), value);
        }
    }
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new SubtreactionalAudioProcessor();
}
