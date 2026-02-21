#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "PluginProcessor.h"

//==============================================================================
class SubtreactionalAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit SubtreactionalAudioProcessorEditor (SubtreactionalAudioProcessor&);
    ~SubtreactionalAudioProcessorEditor() override;

    void paint  (juce::Graphics&) override;
    void resized() override;

private:
    SubtreactionalAudioProcessor& processor;

    using APVTS            = juce::AudioProcessorValueTreeState;
    using SliderAttachment = APVTS::SliderAttachment;
    using ComboAttachment  = APVTS::ComboBoxAttachment;

    //==========================================================================
    // Oscillator section
    juce::ComboBox osc1TypeBox,  osc2TypeBox;
    juce::Slider   osc1Level,   osc1Detune,   osc1Octave;
    juce::Slider   osc2Level,   osc2Detune,   osc2Octave;

    std::unique_ptr<ComboAttachment>  osc1TypeAtt,  osc2TypeAtt;
    std::unique_ptr<SliderAttachment> osc1LevelAtt, osc1DetuneAtt, osc1OctaveAtt;
    std::unique_ptr<SliderAttachment> osc2LevelAtt, osc2DetuneAtt, osc2OctaveAtt;

    //==========================================================================
    // Filter section
    juce::ComboBox filterTypeBox;
    juce::Slider   filterCutoff, filterResonance, filterEnvAmt;

    std::unique_ptr<ComboAttachment>  filterTypeAtt;
    std::unique_ptr<SliderAttachment> filterCutoffAtt, filterResonanceAtt, filterEnvAmtAtt;

    //==========================================================================
    // Envelope section
    juce::Slider fenvA, fenvD, fenvS, fenvR;
    juce::Slider aenvA, aenvD, aenvS, aenvR;

    std::unique_ptr<SliderAttachment> fenvAAtt, fenvDAtt, fenvSAtt, fenvRAtt;
    std::unique_ptr<SliderAttachment> aenvAAtt, aenvDAtt, aenvSAtt, aenvRAtt;

    //==========================================================================
    // FX section (4 slots)
    juce::ComboBox fxTypeBox[4];
    juce::Slider   fxMix[4], fxDelayTime[4], fxDelayFb[4];
    juce::Slider   fxChorusRate[4], fxChorusDepth[4], fxReverbT60[4];

    std::unique_ptr<ComboAttachment>  fxTypeAtt[4];
    std::unique_ptr<SliderAttachment> fxMixAtt[4], fxDelayTimeAtt[4], fxDelayFbAtt[4];
    std::unique_ptr<SliderAttachment> fxChorusRateAtt[4], fxChorusDepthAtt[4], fxReverbT60Att[4];

    //==========================================================================
    // Master volume
    juce::Slider masterVolume;
    std::unique_ptr<SliderAttachment> masterVolumeAtt;

    //==========================================================================
    // All labels are owned here; labelIdx is the layout cursor reset each resized()
    juce::OwnedArray<juce::Label> labels;
    int labelIdx = 0;

    // Stored during layout, read in paint() for sub-section labels
    int osc2SectionY  = 0;
    int ampEnvSectionY = 0;

    //==========================================================================
    // Helpers
    static void styleRotary (juce::Slider& s);
    static void styleCombo  (juce::ComboBox& b, const juce::StringArray& items);

    juce::Label* addLabel (const juce::String& text, juce::Component& attachTo);

    // Section panel rectangles (set in resized)
    juce::Rectangle<int> oscPanel, filterPanel, envPanel, fxPanel;

    void paintPanel (juce::Graphics& g, juce::Rectangle<int> r, const juce::String& title) const;

    void layoutOsc    (int x, int y, int w, int h);
    void layoutFilter (int x, int y, int w, int h);
    void layoutEnv    (int x, int y, int w, int h);
    void layoutFx     (int x, int y, int w, int h);

    // Place a rotary knob with a label above it; returns the knob bottom y
    int placeKnob (juce::Slider& s, juce::Label* lbl,
                   int cx, int y, int size);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SubtreactionalAudioProcessorEditor)
};
