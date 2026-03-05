#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>
#include <array>
#include "PluginProcessor.h"
#include "JuceBridge.h"
#include "NativeDarkCover.h"

//==============================================================================
class SubtreactionalAudioProcessorEditor
    : public juce::AudioProcessorEditor,
    public juce::FileDragAndDropTarget,
    private juce::AudioProcessorValueTreeState::Listener,
    private juce::Timer
{
public:
    explicit SubtreactionalAudioProcessorEditor (SubtreactionalAudioProcessor&);
    ~SubtreactionalAudioProcessorEditor() override;

    void paint             (juce::Graphics& g) override { g.fillAll (juce::Colour (0xff121212)); }
    void resized           () override;
    void visibilityChanged () override;

    // Consume all key events so the host never intercepts typing in the WebView
    bool keyPressed      (const juce::KeyPress&) override { return true; }
    bool keyStateChanged (bool)                  override { return true; }

    // FileDragAndDropTarget
    bool isInterestedInFileDrag (const juce::StringArray& files) override;
    void filesDropped (const juce::StringArray& files, int x, int y) override;

private:
    SubtreactionalAudioProcessor& processor;
    JuceBridge bridge;

    // Native dark cover that composites on top of WKWebView, hiding the white
    // flash while the page loads.  Hidden via a short countdown after the page
    // finishes loading to allow JS to fully render before revealing the view.
    NativeDarkCover darkCover;
    int coverHideCountdown = -1;  // -1 = inactive; counts down in timerCallback

    // juce::AudioProcessorValueTreeState::Listener
    void parameterChanged (const juce::String& parameterID, float newValue) override;

    // juce::Timer
    void timerCallback() override;

    void appendAnalysisSamples (const float* samples, int numSamples);
    void buildWaveformFrame();
    bool buildSpectrogramFrame();

    static constexpr int kAnalysisReadSize = 2048;
    static constexpr int kWaveformPoints = 256;
    static constexpr int kSpectrogramBins = 96;
    static constexpr int kFftOrder = 10;
    static constexpr int kFftSize = 1 << kFftOrder;

    juce::dsp::FFT fft { kFftOrder };
    juce::dsp::WindowingFunction<float> fftWindow {
        kFftSize,
        juce::dsp::WindowingFunction<float>::hann,
        true
    };

    std::array<float, kAnalysisReadSize> analysisReadBuffer {};
    std::array<float, kFftSize * 8> analysisHistory {};
    int historyWritePos = 0;
    int historyCount = 0;

    std::array<float, kFftSize * 2> fftData {};
    std::array<float, kWaveformPoints> waveformFrame {};
    std::array<float, kSpectrogramBins> spectrogramFrame {};

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SubtreactionalAudioProcessorEditor)
};
