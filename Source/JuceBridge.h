#pragma once

#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"

//==============================================================================
/**
 * WebBrowserComponent subclass that bridges JUCE APVTS parameters to/from
 * a TypeScript/JavaScript web UI.
 *
 * JS → C++:  intercepts  juce://param?id=<id>&v=<value>  navigations
 * C++ → JS:  calls       window.__juce.onParam(id, value)  via goToURL("javascript:...")
 */
class JuceBridge : public juce::WebBrowserComponent
{
public:
    explicit JuceBridge (SubtreactionalAudioProcessor& processor);
    ~JuceBridge() override = default;

    /** Push a single parameter value to the web UI (must be called on the message thread). */
    void pushParam (const juce::String& id, float value);

    /** Push waveform points to the web UI (must be called on the message thread). */
    void pushWaveform (const float* points, int numPoints);

    /** Push spectrogram magnitudes (0..1) to the web UI (must be called on the message thread). */
    void pushSpectrogram (const float* bins, int numBins);

    /** Push all current APVTS values to the web UI. */
    void pushAllParams();

    /** Push all current modulation assignments to the web UI. */
    void pushModAssignments();

    /** Push the full preset list (factory + user) to the web UI. */
    void pushPresetList();

    /** Called once on the message thread when the page has finished loading. */
    std::function<void()> onPageReady;

    //==========================================================================
    // WebBrowserComponent overrides
    bool pageAboutToLoad  (const juce::String& newURL) override;
    void pageFinishedLoading (const juce::String& url) override;

private:
    SubtreactionalAudioProcessor& processor;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (JuceBridge)
};
