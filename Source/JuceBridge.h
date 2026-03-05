#pragma once

#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"

/** Dark LookAndFeel for native dialogs (AlertWindow etc.) matching the plugin theme. */
class DarkAlertLookAndFeel : public juce::LookAndFeel_V4
{
public:
    DarkAlertLookAndFeel()
    {
        setColour (juce::ResizableWindow::backgroundColourId,  juce::Colour (0xff1A1D22));
        setColour (juce::AlertWindow::backgroundColourId,      juce::Colour (0xff1A1D22));
        setColour (juce::AlertWindow::textColourId,            juce::Colour (0xffDDDDDD));
        setColour (juce::AlertWindow::outlineColourId,         juce::Colour (0xff2D3239));
        setColour (juce::TextEditor::backgroundColourId,       juce::Colour (0xff22252A));
        setColour (juce::TextEditor::textColourId,             juce::Colour (0xffDDDDDD));
        setColour (juce::TextEditor::highlightColourId,        juce::Colour (0x44825CED));
        setColour (juce::TextEditor::highlightedTextColourId,  juce::Colour (0xffDDDDDD));
        setColour (juce::TextEditor::outlineColourId,          juce::Colour (0xff2D3239));
        setColour (juce::TextEditor::focusedOutlineColourId,   juce::Colour (0xff825CED));
        setColour (juce::CaretComponent::caretColourId,        juce::Colour (0xff825CED));
        setColour (juce::TextButton::buttonColourId,           juce::Colour (0xff2D3239));
        setColour (juce::TextButton::buttonOnColourId,         juce::Colour (0xff825CED));
        setColour (juce::TextButton::textColourOffId,          juce::Colour (0xffDDDDDD));
        setColour (juce::TextButton::textColourOnId,           juce::Colour (0xffDDDDDD));
        setColour (juce::Label::textColourId,                  juce::Colour (0xffDDDDDD));
        setColour (juce::Label::backgroundColourId,            juce::Colour (0x00000000));
    }

    // Draw the AlertWindow box with our dark background and subtle border
    void drawAlertBox (juce::Graphics& g, juce::AlertWindow& alert,
                       const juce::Rectangle<int>& textArea, juce::TextLayout& tl) override
    {
        const auto bounds = alert.getLocalBounds();
        g.setColour (juce::Colour (0xff1A1D22));
        g.fillRoundedRectangle (bounds.toFloat(), 6.0f);
        g.setColour (juce::Colour (0xff2D3239));
        g.drawRoundedRectangle (bounds.toFloat().reduced (0.5f), 6.0f, 1.0f);
        g.setColour (juce::Colour (0xffDDDDDD));
        tl.draw (g, textArea.toFloat());
    }

    // Explicit outline so focused fields show the purple border
    void drawTextEditorOutline (juce::Graphics& g, int width, int height,
                                juce::TextEditor& te) override
    {
        const bool focused = te.hasKeyboardFocus (false);
        g.setColour (focused ? juce::Colour (0xff825CED) : juce::Colour (0xff3A4049));
        g.drawRect (0, 0, width, height, 1);
    }

    // Match the plugin's sans-serif font
    juce::Font getAlertWindowTitleFont()   override { return juce::Font (13.0f, juce::Font::bold); }
    juce::Font getAlertWindowMessageFont() override { return juce::Font (12.0f); }
    juce::Font getAlertWindowFont()        override { return juce::Font (12.0f); }
};

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

    /** Push current LFO output values (raw * depth, -1..+1) to the web UI. */
    void pushLFOValues (const float* vals, int n);

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
    DarkAlertLookAndFeel darkLAF;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (JuceBridge)
};
