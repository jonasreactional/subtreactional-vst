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

    using APVTS           = juce::AudioProcessorValueTreeState;
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
    juce::Slider   filterCutoff, filterResonance, filterEnvAmount;

    std::unique_ptr<ComboAttachment>  filterTypeAtt;
    std::unique_ptr<SliderAttachment> filterCutoffAtt, filterResonanceAtt, filterEnvAmountAtt;

    //==========================================================================
    // Envelope section (filter env + amp env)
    juce::Slider fenvAttack, fenvDecay, fenvSustain, fenvRelease;
    juce::Slider aenvAttack, aenvDecay, aenvSustain, aenvRelease;

    std::unique_ptr<SliderAttachment> fenvAttackAtt, fenvDecayAtt, fenvSustainAtt, fenvReleaseAtt;
    std::unique_ptr<SliderAttachment> aenvAttackAtt, aenvDecayAtt, aenvSustainAtt, aenvReleaseAtt;

    //==========================================================================
    // Effects section (4 slots)
    juce::ComboBox fxTypeBox[4];
    juce::Slider   fxMix[4], fxTime[4], fxFeedback[4];
    juce::Slider   fxRate[4], fxDepth[4], fxT60[4];

    std::unique_ptr<ComboAttachment>  fxTypeAtt[4];
    std::unique_ptr<SliderAttachment> fxMixAtt[4], fxTimeAtt[4], fxFeedbackAtt[4];
    std::unique_ptr<SliderAttachment> fxRateAtt[4], fxDepthAtt[4], fxT60Att[4];

    //==========================================================================
    // Master volume
    juce::Slider   masterVolume;
    std::unique_ptr<SliderAttachment> masterVolumeAtt;

    //==========================================================================
    // Helpers
    static void configureRotary (juce::Slider& s);
    static void configureCombo  (juce::ComboBox& b);

    void makeRotary    (juce::Slider& s,    const juce::String& paramId,
                        std::unique_ptr<SliderAttachment>& att,
                        APVTS& apvts);
    void makeComboBox  (juce::ComboBox& b,  const juce::String& paramId,
                        std::unique_ptr<ComboAttachment>& att,
                        APVTS& apvts);

    // Section panel rectangles (computed in resized())
    juce::Rectangle<int> oscPanel, filterPanel, envPanel, fxPanel;

    void paintSectionBg (juce::Graphics& g, juce::Rectangle<int> bounds,
                         const juce::String& title) const;
    void layoutOscSection();
    void layoutFilterSection();
    void layoutEnvSection();
    void layoutFxSection();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SubtreactionalAudioProcessorEditor)
};
