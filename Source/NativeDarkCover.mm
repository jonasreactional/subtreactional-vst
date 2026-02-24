#include "NativeDarkCover.h"

#if JUCE_MAC || JUCE_IOS

#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>

NativeDarkCover::NativeDarkCover()
{
    NSView* view = [[NSView alloc] initWithFrame: NSMakeRect (0, 0, 1200, 700)];
    view.wantsLayer = YES;
    view.layer.backgroundColor = CGColorCreateSRGB (18.0 / 255.0, 18.0 / 255.0, 18.0 / 255.0, 1.0);
    nativeView = (__bridge_retained void*) view;
    setView (nativeView);
}

NativeDarkCover::~NativeDarkCover()
{
    setView (nullptr);
    if (nativeView != nullptr)
    {
        CFRelease (nativeView);
        nativeView = nullptr;
    }
}

#endif
