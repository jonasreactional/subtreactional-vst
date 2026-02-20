#include "PluginEditor.h"

namespace {
    // Colours
    const juce::Colour kBg      { 0xff1a1a2e };
    const juce::Colour kPanel   { 0xff16213e };
    const juce::Colour kAccent  { 0xff0f3460 };
    const juce::Colour kKnob    { 0xffe94560 };
    const juce::Colour kText    { 0xffe0e0e0 };

    // Sizes
    constexpr int kKnobSize   = 60;
    constexpr int kComboH     = 22;
    constexpr int kLabelH     = 16;
    constexpr int kPad        = 8;
    constexpr int kHeaderH    = 24;
}

//==============================================================================
static juce::LookAndFeel_V4 sLookAndFeel;

//==============================================================================
SubtreactionalAudioProcessorEditor::SubtreactionalAudioProcessorEditor (
    SubtreactionalAudioProcessor& p)
    : AudioProcessorEditor (&p), processor (p)
{
    setSize (860, 520);
    setResizable (false, false);

    auto& apvts = processor.apvts;

    // Helper lambdas for concise setup
    auto makeKnob = [&](juce::Slider& s, const juce::String& id,
                        std::unique_ptr<SliderAttachment>& att)
    {
        configureRotary (s);
        addAndMakeVisible (s);
        att = std::make_unique<SliderAttachment> (apvts, id, s);
    };

    auto makeCombo = [&](juce::ComboBox& b, const juce::String& id,
                         std::unique_ptr<ComboAttachment>& att)
    {
        configureCombo (b);
        addAndMakeVisible (b);
        att = std::make_unique<ComboAttachment> (apvts, id, b);
    };

    // OSC 1
    makeCombo (osc1TypeBox,  "osc1.type",   osc1TypeAtt);
    makeKnob  (osc1Level,    "osc1.level",  osc1LevelAtt);
    makeKnob  (osc1Detune,   "osc1.detune", osc1DetuneAtt);
    makeKnob  (osc1Octave,   "osc1.octave", osc1OctaveAtt);

    // OSC 2
    makeCombo (osc2TypeBox,  "osc2.type",   osc2TypeAtt);
    makeKnob  (osc2Level,    "osc2.level",  osc2LevelAtt);
    makeKnob  (osc2Detune,   "osc2.detune", osc2DetuneAtt);
    makeKnob  (osc2Octave,   "osc2.octave", osc2OctaveAtt);

    // Filter
    makeCombo (filterTypeBox,    "filter.type",       filterTypeAtt);
    makeKnob  (filterCutoff,     "filter.cutoff",     filterCutoffAtt);
    makeKnob  (filterResonance,  "filter.resonance",  filterResonanceAtt);
    makeKnob  (filterEnvAmount,  "filter.env_amount", filterEnvAmountAtt);

    // Filter envelope
    makeKnob (fenvAttack,  "filter_env.attack",  fenvAttackAtt);
    makeKnob (fenvDecay,   "filter_env.decay",   fenvDecayAtt);
    makeKnob (fenvSustain, "filter_env.sustain", fenvSustainAtt);
    makeKnob (fenvRelease, "filter_env.release", fenvReleaseAtt);

    // Amp envelope
    makeKnob (aenvAttack,  "amp_env.attack",  aenvAttackAtt);
    makeKnob (aenvDecay,   "amp_env.decay",   aenvDecayAtt);
    makeKnob (aenvSustain, "amp_env.sustain", aenvSustainAtt);
    makeKnob (aenvRelease, "amp_env.release", aenvReleaseAtt);

    // FX slots
    for (int i = 0; i < 4; ++i)
    {
        juce::String fx = "fx" + juce::String (i);
        makeCombo (fxTypeBox[i],  fx + ".type",     fxTypeAtt[i]);
        makeKnob  (fxMix[i],      fx + ".mix",       fxMixAtt[i]);
        makeKnob  (fxTime[i],     fx + ".time",      fxTimeAtt[i]);
        makeKnob  (fxFeedback[i], fx + ".feedback",  fxFeedbackAtt[i]);
        makeKnob  (fxRate[i],     fx + ".rate",      fxRateAtt[i]);
        makeKnob  (fxDepth[i],    fx + ".depth",     fxDepthAtt[i]);
        makeKnob  (fxT60[i],      fx + ".t60",       fxT60Att[i]);
    }

    // Master volume
    makeKnob (masterVolume, "master_volume", masterVolumeAtt);
}

SubtreactionalAudioProcessorEditor::~SubtreactionalAudioProcessorEditor() = default;

//==============================================================================
void SubtreactionalAudioProcessorEditor::configureRotary (juce::Slider& s)
{
    s.setSliderStyle (juce::Slider::RotaryVerticalDrag);
    s.setTextBoxStyle (juce::Slider::TextBoxBelow, false, kKnobSize, 14);
    s.setColour (juce::Slider::rotarySliderFillColourId, kKnob);
    s.setColour (juce::Slider::textBoxTextColourId,      kText);
    s.setColour (juce::Slider::textBoxBackgroundColourId, kAccent);
    s.setColour (juce::Slider::textBoxOutlineColourId,    juce::Colours::transparentBlack);
}

void SubtreactionalAudioProcessorEditor::configureCombo (juce::ComboBox& b)
{
    b.setColour (juce::ComboBox::backgroundColourId, kAccent);
    b.setColour (juce::ComboBox::textColourId,       kText);
    b.setColour (juce::ComboBox::outlineColourId,    juce::Colours::transparentBlack);
    b.setColour (juce::ComboBox::arrowColourId,      kKnob);
    b.setJustificationType (juce::Justification::centred);
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::paintSectionBg (
    juce::Graphics& g, juce::Rectangle<int> bounds, const juce::String& title) const
{
    g.setColour (kPanel);
    g.fillRoundedRectangle (bounds.toFloat(), 6.0f);

    g.setColour (kAccent);
    g.drawRoundedRectangle (bounds.toFloat().reduced (0.5f), 6.0f, 1.0f);

    g.setColour (kText);
    g.setFont (juce::Font (13.0f, juce::Font::bold));
    g.drawText (title, bounds.withHeight (kHeaderH), juce::Justification::centred);
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (kBg);

    // Title bar
    g.setColour (kAccent);
    g.fillRect (0, 0, getWidth(), 30);
    g.setColour (kText);
    g.setFont (juce::Font (15.0f, juce::Font::bold));
    g.drawText ("SUBTREACTIONAL", 0, 0, getWidth(), 30, juce::Justification::centred);

    paintSectionBg (g, oscPanel,    "OSCILLATORS");
    paintSectionBg (g, filterPanel, "FILTER");
    paintSectionBg (g, envPanel,    "ENVELOPES");
    paintSectionBg (g, fxPanel,     "EFFECTS");
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::resized()
{
    const int W = getWidth();
    const int H = getHeight();
    const int top = 34;
    const int bot = H - kPad;
    const int panelH = bot - top;

    // Divide width: OSC=22%, Filter=16%, Env=22%, FX=40%
    const int oscW    = (int)(W * 0.22f);
    const int filterW = (int)(W * 0.16f);
    const int envW    = (int)(W * 0.22f);
    const int fxW     = W - oscW - filterW - envW;

    oscPanel    = { kPad,                             top, oscW    - kPad, panelH };
    filterPanel = { oscPanel.getRight()    + kPad,    top, filterW - kPad, panelH };
    envPanel    = { filterPanel.getRight() + kPad,    top, envW    - kPad, panelH };
    fxPanel     = { envPanel.getRight()   + kPad,    top, fxW     - 2*kPad, panelH };

    layoutOscSection();
    layoutFilterSection();
    layoutEnvSection();
    layoutFxSection();
}

//==============================================================================
static void placeKnobColumn (juce::Component& widget, int cx, int& y,
                              int knobSize, const juce::String& /*label*/)
{
    widget.setBounds (cx - knobSize / 2, y, knobSize, knobSize + 14);
    y += knobSize + 14 + 4;
}

static void placeCombo (juce::Component& widget, int x, int w, int& y)
{
    widget.setBounds (x, y, w, kComboH);
    y += kComboH + kPad;
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::layoutOscSection()
{
    const int x0 = oscPanel.getX() + kPad;
    const int w  = oscPanel.getWidth() - 2 * kPad;
    const int cx1 = x0 + w / 4;
    const int cx2 = x0 + 3 * w / 4;

    // Row labels via paint — just layout widgets here
    int y = oscPanel.getY() + kHeaderH + kPad;

    // OSC 1 combo
    osc1TypeBox.setBounds (x0, y, w / 2 - kPad / 2, kComboH);
    // OSC 2 combo
    osc2TypeBox.setBounds (x0 + w / 2 + kPad / 2, y, w / 2 - kPad / 2, kComboH);
    y += kComboH + kPad;

    // Level
    placeKnobColumn (osc1Level,  cx1, y, kKnobSize, "Level");
    int y2 = oscPanel.getY() + kHeaderH + kPad + kComboH + kPad;
    placeKnobColumn (osc2Level,  cx2, y2, kKnobSize, "Level");

    // Detune
    placeKnobColumn (osc1Detune, cx1, y, kKnobSize, "Detune");
    placeKnobColumn (osc2Detune, cx2, y2, kKnobSize, "Detune");

    // Octave
    placeKnobColumn (osc1Octave, cx1, y, kKnobSize, "Octave");
    placeKnobColumn (osc2Octave, cx2, y2, kKnobSize, "Octave");
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::layoutFilterSection()
{
    const int x0 = filterPanel.getX() + kPad;
    const int w  = filterPanel.getWidth() - 2 * kPad;
    const int cx = filterPanel.getCentreX();
    int y        = filterPanel.getY() + kHeaderH + kPad;

    placeCombo  (filterTypeBox,   x0, w, y);
    placeKnobColumn (filterCutoff,    cx, y, kKnobSize, "Cutoff");
    placeKnobColumn (filterResonance, cx, y, kKnobSize, "Reso");
    placeKnobColumn (filterEnvAmount, cx, y, kKnobSize, "Env");
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::layoutEnvSection()
{
    const int x0 = envPanel.getX() + kPad;
    const int w  = envPanel.getWidth() - 2 * kPad;
    const int knobW = (w - 3 * kPad / 2) / 4;
    const int ks    = juce::jmin (knobW, kKnobSize);

    // Filter envelope row
    int y = envPanel.getY() + kHeaderH + kPad;
    // sub-label "Filter Env"
    juce::Slider* fenv[] = { &fenvAttack, &fenvDecay, &fenvSustain, &fenvRelease };
    for (int i = 0; i < 4; ++i)
    {
        int cx = x0 + (int)((i + 0.5f) * (float)w / 4.0f);
        fenv[i]->setBounds (cx - ks / 2, y, ks, ks + 14);
    }
    y += ks + 14 + kPad * 2;

    // Amp envelope row
    juce::Slider* aenv[] = { &aenvAttack, &aenvDecay, &aenvSustain, &aenvRelease };
    for (int i = 0; i < 4; ++i)
    {
        int cx = x0 + (int)((i + 0.5f) * (float)w / 4.0f);
        aenv[i]->setBounds (cx - ks / 2, y, ks, ks + 14);
    }
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::layoutFxSection()
{
    const int x0  = fxPanel.getX() + kPad;
    const int panW = fxPanel.getWidth() - 2 * kPad;
    const int slotW = panW / 4;
    const int ks   = juce::jmin (kKnobSize, (slotW - 5 * kPad) / 3);

    // Master volume at bottom
    {
        const int mvSize = kKnobSize;
        masterVolume.setBounds (fxPanel.getRight() - mvSize - kPad * 2,
                                fxPanel.getBottom() - mvSize - 14 - kPad,
                                mvSize, mvSize + 14);
    }

    for (int i = 0; i < 4; ++i)
    {
        int sx = x0 + i * slotW;
        int y  = fxPanel.getY() + kHeaderH + kPad;

        // Type combo
        fxTypeBox[i].setBounds (sx, y, slotW - kPad, kComboH);
        y += kComboH + kPad;

        // Mix knob (always visible)
        fxMix[i].setBounds (sx, y, ks, ks + 14);

        // Delay: time + feedback
        fxTime[i].setBounds    (sx + ks + kPad,       y, ks, ks + 14);
        fxFeedback[i].setBounds(sx + 2 * (ks + kPad), y, ks, ks + 14);

        // Chorus: rate + depth
        fxRate[i].setBounds  (sx + ks + kPad,       y, ks, ks + 14);
        fxDepth[i].setBounds (sx + 2 * (ks + kPad), y, ks, ks + 14);

        // Reverb: t60
        fxT60[i].setBounds   (sx + ks + kPad,       y, ks, ks + 14);
    }
}

//==============================================================================
// Forwarded helpers (defined here to keep header clean)
void SubtreactionalAudioProcessorEditor::makeRotary (
    juce::Slider& s, const juce::String& paramId,
    std::unique_ptr<SliderAttachment>& att, APVTS& apvts)
{
    configureRotary (s);
    addAndMakeVisible (s);
    att = std::make_unique<SliderAttachment> (apvts, paramId, s);
}

void SubtreactionalAudioProcessorEditor::makeComboBox (
    juce::ComboBox& b, const juce::String& paramId,
    std::unique_ptr<ComboAttachment>& att, APVTS& apvts)
{
    configureCombo (b);
    addAndMakeVisible (b);
    att = std::make_unique<ComboAttachment> (apvts, paramId, b);
}
