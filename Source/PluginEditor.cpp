#include "PluginEditor.h"

//==============================================================================
SubtreactionalAudioProcessorEditor::SubtreactionalAudioProcessorEditor (
    SubtreactionalAudioProcessor& p)
    : AudioProcessorEditor (&p), processor (p), bridge (p)
{
    addAndMakeVisible (bridge);

    // Subscribe to all parameter changes so preset loads push values to the UI
    for (int i = 0; i < SubtreactionalAudioProcessor::kNumParams; ++i)
        processor.apvts.addParameterListener (
            SubtreactionalAudioProcessor::kParams[i].apvtsId, this);

    setSize (860, 480);
}

SubtreactionalAudioProcessorEditor::~SubtreactionalAudioProcessorEditor()
{
    for (int i = 0; i < SubtreactionalAudioProcessor::kNumParams; ++i)
        processor.apvts.removeParameterListener (
            SubtreactionalAudioProcessor::kParams[i].apvtsId, this);
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::resized()
{
    bridge.setBounds (getLocalBounds());
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::parameterChanged (
    const juce::String& parameterID, float /*newValue*/)
{
    // parameterChanged may be called from any thread; bridge must be on the
    // message thread, so we marshal through callAsync.
    // We re-read the normalised value (0..1) on the message thread to match
    // what the JS side expects.
    juce::MessageManager::callAsync ([this, parameterID]()
    {
        if (auto* param = processor.apvts.getParameter (parameterID))
            bridge.pushParam (parameterID, param->getValue());
    });
}
