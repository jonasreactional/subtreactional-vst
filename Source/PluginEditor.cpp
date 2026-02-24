#include "PluginEditor.h"

#include <cmath>

//==============================================================================
SubtreactionalAudioProcessorEditor::SubtreactionalAudioProcessorEditor (
    SubtreactionalAudioProcessor& p)
    : AudioProcessorEditor (&p), processor (p), bridge (p)
{
    addAndMakeVisible (bridge);

    // Dark overlay sits above the WebView and hides itself once the page loads.
    addAndMakeVisible (darkCover);
    bridge.onPageReady = [this]()
    {
        // Give JS ~500 ms to finish rendering before revealing the webview.
        // Timer runs at 30 Hz, so 15 ticks ≈ 500 ms.
        coverHideCountdown = 15;
    };

    // Subscribe to all parameter changes so preset loads push values to the UI
    for (int i = 0; i < SubtreactionalAudioProcessor::kNumParams; ++i)
        processor.apvts.addParameterListener (
            SubtreactionalAudioProcessor::kParams[i].apvtsId, this);

    startTimerHz (30);

    setSize (1000, 530);
}

SubtreactionalAudioProcessorEditor::~SubtreactionalAudioProcessorEditor()
{
    stopTimer();

    for (int i = 0; i < SubtreactionalAudioProcessor::kNumParams; ++i)
        processor.apvts.removeParameterListener (
            SubtreactionalAudioProcessor::kParams[i].apvtsId, this);
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::resized()
{
    bridge.setBounds (getLocalBounds());
    darkCover.setBounds (getLocalBounds());
}

//==============================================================================
bool SubtreactionalAudioProcessorEditor::isInterestedInFileDrag (const juce::StringArray& files)
{
    for (const auto& f : files)
        if (f.endsWithIgnoreCase (".json"))
            return true;
    return false;
}

void SubtreactionalAudioProcessorEditor::filesDropped (const juce::StringArray& files, int, int)
{
    for (const auto& path : files)
    {
        if (! path.endsWithIgnoreCase (".json"))
            continue;

        const juce::File file (path);
        const juce::String json = file.loadFileAsString();
        if (json.isEmpty())
            continue;

        const auto bytes = json.toUTF8();
        processor.setStateInformation (bytes.getAddress(), (int) std::strlen (bytes.getAddress()));
        break; // load the first valid JSON and stop
    }
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

void SubtreactionalAudioProcessorEditor::timerCallback()
{
    if (coverHideCountdown > 0)
    {
        if (--coverHideCountdown == 0)
            darkCover.setVisible (false);
    }

    const int numRead = processor.popAnalyzerSamples (analysisReadBuffer.data(),
                                                      static_cast<int> (analysisReadBuffer.size()));
    if (numRead <= 0)
        return;

    appendAnalysisSamples (analysisReadBuffer.data(), numRead);

    buildWaveformFrame();
    bridge.pushWaveform (waveformFrame.data(), static_cast<int> (waveformFrame.size()));

    if (buildSpectrogramFrame())
        bridge.pushSpectrogram (spectrogramFrame.data(), static_cast<int> (spectrogramFrame.size()));
}

void SubtreactionalAudioProcessorEditor::appendAnalysisSamples (const float* samples, int numSamples)
{
    if (samples == nullptr || numSamples <= 0)
        return;

    const int historySize = static_cast<int> (analysisHistory.size());
    for (int i = 0; i < numSamples; ++i)
    {
        analysisHistory[static_cast<size_t> (historyWritePos)] = samples[i];
        historyWritePos = (historyWritePos + 1) % historySize;
        historyCount = juce::jmin (historyCount + 1, historySize);
    }
}

void SubtreactionalAudioProcessorEditor::buildWaveformFrame()
{
    const int available = historyCount;
    if (available <= 0)
    {
        waveformFrame.fill (0.0f);
        return;
    }

    const int windowSamples = juce::jmin (available, kFftSize * 2);
    const int historySize = static_cast<int> (analysisHistory.size());
    const int start = (historyWritePos - windowSamples + historySize) % historySize;

    const int points = static_cast<int> (waveformFrame.size());
    for (int i = 0; i < points; ++i)
    {
        const int sourceOffset = (i * (windowSamples - 1)) / juce::jmax (1, points - 1);
        const int index = (start + sourceOffset) % historySize;
        waveformFrame[static_cast<size_t> (i)] = analysisHistory[static_cast<size_t> (index)];
    }
}

bool SubtreactionalAudioProcessorEditor::buildSpectrogramFrame()
{
    if (historyCount < kFftSize)
        return false;

    fftData.fill (0.0f);

    const int historySize = static_cast<int> (analysisHistory.size());
    const int start = (historyWritePos - kFftSize + historySize) % historySize;
    for (int i = 0; i < kFftSize; ++i)
        fftData[static_cast<size_t> (i)] = analysisHistory[static_cast<size_t> ((start + i) % historySize)];

    fftWindow.multiplyWithWindowingTable (fftData.data(), kFftSize);
    fft.performFrequencyOnlyForwardTransform (fftData.data());

    const int maxBin = kFftSize / 2;
    for (int i = 0; i < kSpectrogramBins; ++i)
    {
        const float norm = static_cast<float> (i) / static_cast<float> (juce::jmax (1, kSpectrogramBins - 1));
        const float skewed = std::pow (norm, 2.0f);
        const int bin = juce::jlimit (1, maxBin - 1,
                                      static_cast<int> (std::round (skewed * static_cast<float> (maxBin - 1))));

        const float magnitude = fftData[static_cast<size_t> (bin)] / static_cast<float> (kFftSize);
        const float db = juce::Decibels::gainToDecibels (magnitude, -100.0f);
        spectrogramFrame[static_cast<size_t> (i)] = juce::jlimit (0.0f, 1.0f, (db + 100.0f) / 100.0f);
    }

    return true;
}
