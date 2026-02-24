#pragma once

#include <juce_gui_extra/juce_gui_extra.h>

/**
 * A solid dark cover that must sit on top of the WebBrowserComponent
 * (WKWebView) to hide the white flash during page load.
 *
 * Regular JUCE Components are software-rendered and always appear *behind*
 * native NSViews, so they cannot cover WKWebView.  This class wraps a native
 * NSView (macOS) / UIView (iOS) that composites correctly above WKWebView.
 * On other platforms a plain JUCE Component is used as a fallback.
 */

#if JUCE_MAC || JUCE_IOS

class NativeDarkCover : public juce::NSViewComponent
{
public:
    NativeDarkCover();
    ~NativeDarkCover() override;

private:
    void* nativeView = nullptr;  // retained NSView* / UIView*
};

#else

class NativeDarkCover : public juce::Component
{
public:
    void paint (juce::Graphics& g) override
    {
        g.fillAll (juce::Colour (0xff121212));
    }
};

#endif
