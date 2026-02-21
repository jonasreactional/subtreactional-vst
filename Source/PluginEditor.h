#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "PluginProcessor.h"
#include "JuceBridge.h"

//==============================================================================
class SubtreactionalAudioProcessorEditor
    : public juce::AudioProcessorEditor,
      private juce::AudioProcessorValueTreeState::Listener
{
public:
    explicit SubtreactionalAudioProcessorEditor (SubtreactionalAudioProcessor&);
    ~SubtreactionalAudioProcessorEditor() override;

    void paint   (juce::Graphics&) override {}
    void resized () override;

private:
    SubtreactionalAudioProcessor& processor;
    JuceBridge bridge;

    // juce::AudioProcessorValueTreeState::Listener
    void parameterChanged (const juce::String& parameterID, float newValue) override;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SubtreactionalAudioProcessorEditor)
};
