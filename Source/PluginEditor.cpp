#include "PluginEditor.h"

namespace {
    // Colours
    const juce::Colour kBg     { 0xff1a1a2e };
    const juce::Colour kPanel  { 0xff16213e };
    const juce::Colour kAccent { 0xff0f3460 };
    const juce::Colour kKnob   { 0xffe94560 };
    const juce::Colour kText   { 0xffe0e0e0 };
    const juce::Colour kDim    { 0xff888899 };

    // Sizes
    constexpr int kTitleH  = 30;
    constexpr int kHeaderH = 22;
    constexpr int kPad     = 8;
    constexpr int kLabelH  = 14;
    constexpr int kKnobSz  = 52;
    constexpr int kComboH  = 20;

    const juce::StringArray kOscTypes    { "Off","Saw","Square","Sine","Tri" };
    const juce::StringArray kFilterTypes { "Off","LP","HP","BP" };
    const juce::StringArray kFxTypes     { "Off","Delay","Chorus","Reverb" };
}

//==============================================================================
SubtreactionalAudioProcessorEditor::SubtreactionalAudioProcessorEditor (
    SubtreactionalAudioProcessor& p)
    : AudioProcessorEditor (&p), processor (p)
{
    setSize (860, 480);
    setResizable (false, false);

    auto& apvts = processor.apvts;

    // -- Helpers -------------------------------------------------------
    auto knob = [&](juce::Slider& s, const char* id,
                    std::unique_ptr<SliderAttachment>& att,
                    const juce::String& labelText)
    {
        styleRotary (s);
        addAndMakeVisible (s);
        att = std::make_unique<SliderAttachment> (apvts, id, s);
        addLabel (labelText, s);
    };

    auto combo = [&](juce::ComboBox& b, const char* id,
                     std::unique_ptr<ComboAttachment>& att,
                     const juce::StringArray& items,
                     const juce::String& labelText)
    {
        styleCombo (b, items);
        addAndMakeVisible (b);
        att = std::make_unique<ComboAttachment> (apvts, id, b);
        addLabel (labelText, b);
    };

    // -- OSC 1 ----------------------------------------------------------
    combo (osc1TypeBox, "osc1_type",   osc1TypeAtt,  kOscTypes, "Type");
    knob  (osc1Level,   "osc1_level",  osc1LevelAtt, "Level");
    knob  (osc1Detune,  "osc1_detune", osc1DetuneAtt,"Detune");
    knob  (osc1Octave,  "osc1_octave", osc1OctaveAtt,"Octave");

    // -- OSC 2 ----------------------------------------------------------
    combo (osc2TypeBox, "osc2_type",   osc2TypeAtt,  kOscTypes, "Type");
    knob  (osc2Level,   "osc2_level",  osc2LevelAtt, "Level");
    knob  (osc2Detune,  "osc2_detune", osc2DetuneAtt,"Detune");
    knob  (osc2Octave,  "osc2_octave", osc2OctaveAtt,"Octave");

    // -- Filter ---------------------------------------------------------
    combo (filterTypeBox, "filter_type",       filterTypeAtt,       kFilterTypes, "Type");
    knob  (filterCutoff,  "filter_cutoff",     filterCutoffAtt,     "Cutoff");
    knob  (filterResonance,"filter_resonance", filterResonanceAtt,  "Reso");
    knob  (filterEnvAmt,  "filter_env_amount", filterEnvAmtAtt,     "Env");

    // -- Filter envelope ------------------------------------------------
    knob (fenvA, "fenv_attack",  fenvAAtt, "Attack");
    knob (fenvD, "fenv_decay",   fenvDAtt, "Decay");
    knob (fenvS, "fenv_sustain", fenvSAtt, "Sustain");
    knob (fenvR, "fenv_release", fenvRAtt, "Release");

    // -- Amp envelope ---------------------------------------------------
    knob (aenvA, "aenv_attack",  aenvAAtt, "Attack");
    knob (aenvD, "aenv_decay",   aenvDAtt, "Decay");
    knob (aenvS, "aenv_sustain", aenvSAtt, "Sustain");
    knob (aenvR, "aenv_release", aenvRAtt, "Release");

    // -- FX slots -------------------------------------------------------
    for (int i = 0; i < 4; ++i)
    {
        juce::String fx = "fx" + juce::String(i) + "_";
        combo (fxTypeBox[i],    (fx + "type").toRawUTF8(),           fxTypeAtt[i],         kFxTypes, "Type");
        knob  (fxMix[i],        (fx + "mix").toRawUTF8(),            fxMixAtt[i],          "Mix");
        knob  (fxDelayTime[i],  (fx + "delay_time").toRawUTF8(),     fxDelayTimeAtt[i],    "Time");
        knob  (fxDelayFb[i],    (fx + "delay_feedback").toRawUTF8(), fxDelayFbAtt[i],      "Feedback");
        knob  (fxChorusRate[i], (fx + "chorus_rate").toRawUTF8(),    fxChorusRateAtt[i],   "Rate");
        knob  (fxChorusDepth[i],(fx + "chorus_depth").toRawUTF8(),   fxChorusDepthAtt[i],  "Depth");
        knob  (fxReverbT60[i],  (fx + "reverb_t60").toRawUTF8(),     fxReverbT60Att[i],    "T60");
    }

    // -- Master volume --------------------------------------------------
    knob (masterVolume, "master_volume", masterVolumeAtt, "Master");
}

SubtreactionalAudioProcessorEditor::~SubtreactionalAudioProcessorEditor() = default;

//==============================================================================
void SubtreactionalAudioProcessorEditor::styleRotary (juce::Slider& s)
{
    s.setSliderStyle (juce::Slider::RotaryVerticalDrag);
    s.setTextBoxStyle (juce::Slider::TextBoxBelow, false, kKnobSz, 13);
    s.setColour (juce::Slider::rotarySliderFillColourId,   kKnob);
    s.setColour (juce::Slider::rotarySliderOutlineColourId, kAccent);
    s.setColour (juce::Slider::textBoxTextColourId,         kText);
    s.setColour (juce::Slider::textBoxBackgroundColourId,   kAccent);
    s.setColour (juce::Slider::textBoxOutlineColourId,      juce::Colours::transparentBlack);
}

void SubtreactionalAudioProcessorEditor::styleCombo (juce::ComboBox& b,
                                                       const juce::StringArray& items)
{
    b.addItemList (items, 1);
    b.setColour (juce::ComboBox::backgroundColourId, kAccent);
    b.setColour (juce::ComboBox::textColourId,       kText);
    b.setColour (juce::ComboBox::outlineColourId,    juce::Colours::transparentBlack);
    b.setColour (juce::ComboBox::arrowColourId,      kKnob);
    b.setJustificationType (juce::Justification::centred);
}

juce::Label* SubtreactionalAudioProcessorEditor::addLabel (const juce::String& text,
                                                             juce::Component& /*attachTo*/)
{
    auto* lbl = labels.add (new juce::Label());
    lbl->setText (text, juce::dontSendNotification);
    lbl->setFont (juce::Font (11.0f));
    lbl->setColour (juce::Label::textColourId, kDim);
    lbl->setJustificationType (juce::Justification::centred);
    addAndMakeVisible (lbl);
    return lbl;
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::paintPanel (
    juce::Graphics& g, juce::Rectangle<int> r, const juce::String& title) const
{
    g.setColour (kPanel);
    g.fillRoundedRectangle (r.toFloat(), 6.0f);
    g.setColour (kAccent);
    g.drawRoundedRectangle (r.toFloat().reduced (0.5f), 6.0f, 1.0f);
    g.setColour (kText);
    g.setFont (juce::Font (11.5f, juce::Font::bold));
    g.drawText (title, r.withHeight (kHeaderH), juce::Justification::centred);
}

void SubtreactionalAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (kBg);

    g.setColour (kAccent);
    g.fillRect (0, 0, getWidth(), kTitleH);
    g.setColour (kText);
    g.setFont (juce::Font (14.0f, juce::Font::bold));
    g.drawText ("SUBTREACTIONAL", 0, 0, getWidth(), kTitleH,
                juce::Justification::centred);

    paintPanel (g, oscPanel,    "OSCILLATORS");
    paintPanel (g, filterPanel, "FILTER");
    paintPanel (g, envPanel,    "ENVELOPES");
    paintPanel (g, fxPanel,     "EFFECTS");

    // Sub-section labels inside panels
    auto subLabel = [&](juce::Rectangle<int> r, const juce::String& t) {
        g.setColour (kDim);
        g.setFont (juce::Font (10.0f, juce::Font::bold));
        g.drawText (t, r, juce::Justification::centredLeft);
    };

    // OSC divider
    subLabel (oscPanel.withTop (oscPanel.getY() + kHeaderH + kPad).withHeight (kLabelH), " OSC 1");
    int oscMidY = oscPanel.getY() + kHeaderH + kPad + kLabelH + kComboH + kPad + kKnobSz + 13 + kPad + kPad;
    subLabel (oscPanel.withTop (oscMidY).withHeight (kLabelH), " OSC 2");

    // Env divider
    int envMidY = envPanel.getY() + kHeaderH + kPad + kLabelH + kKnobSz + 13 + kPad * 2;
    subLabel (envPanel.withTop (envPanel.getY() + kHeaderH + kPad).withHeight (kLabelH), " Filter Env");
    subLabel (envPanel.withTop (envMidY).withHeight (kLabelH), " Amp Env");
}

//==============================================================================
int SubtreactionalAudioProcessorEditor::placeKnob (
    juce::Slider& s, juce::Label* lbl, int cx, int y, int size)
{
    if (lbl)
        lbl->setBounds (cx - size / 2, y, size, kLabelH);

    int ky = y + kLabelH;
    s.setBounds (cx - size / 2, ky, size, size + 13);
    return ky + size + 13 + kPad;
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::resized()
{
    const int W = getWidth();
    const int H = getHeight();
    const int top = kTitleH + kPad;
    const int bot = H - kPad;

    // Column widths (proportional)
    const int oscW    = (int)(W * 0.21f);
    const int filterW = (int)(W * 0.15f);
    const int envW    = (int)(W * 0.22f);
    const int fxW     = W - oscW - filterW - envW - 5 * kPad;

    int x = kPad;
    oscPanel    = { x, top, oscW,    bot - top }; x += oscW + kPad;
    filterPanel = { x, top, filterW, bot - top }; x += filterW + kPad;
    envPanel    = { x, top, envW,    bot - top }; x += envW + kPad;
    fxPanel     = { x, top, fxW,    bot - top };

    layoutOsc    (oscPanel.getX(),    oscPanel.getY(),    oscPanel.getWidth(),    oscPanel.getHeight());
    layoutFilter (filterPanel.getX(), filterPanel.getY(), filterPanel.getWidth(), filterPanel.getHeight());
    layoutEnv    (envPanel.getX(),    envPanel.getY(),    envPanel.getWidth(),    envPanel.getHeight());
    layoutFx     (fxPanel.getX(),     fxPanel.getY(),     fxPanel.getWidth(),     fxPanel.getHeight());
}

//==============================================================================
// Label index helpers — labels are added in constructor order, so we track
// which label index corresponds to which control.
// Label order: osc1Type, osc1Level, osc1Detune, osc1Octave,
//              osc2Type, osc2Level, osc2Detune, osc2Octave,
//              filterType, filterCutoff, filterReso, filterEnv,
//              fenvA, fenvD, fenvS, fenvR,
//              aenvA, aenvD, aenvS, aenvR,
//              (fx0: type mix delayTime delayFb chorusRate chorusDepth reverbT60)  × 4
//              masterVol
// We just use labels[i] in the same construction order.

static int labelIdx = 0; // reset in layoutOsc

void SubtreactionalAudioProcessorEditor::layoutOsc (int px, int py, int pw, int /*ph*/)
{
    labelIdx = 0;
    const int cx = px + pw / 2;
    const int comboW = pw - 2 * kPad;
    const int cx1 = px + pw / 4;
    const int cx2 = px + 3 * pw / 4;

    // --- OSC 1 ---
    int y = py + kHeaderH + kPad + kLabelH; // skip sub-section label

    // Type combo
    labels[labelIdx++]->setBounds (px + kPad, y, comboW / 2 - kPad/2, kLabelH);
    osc1TypeBox.setBounds (px + kPad, y + kLabelH, comboW / 2 - kPad/2, kComboH);
    y += kLabelH + kComboH + kPad;

    // Level / Detune / Octave — side by side
    int y1 = y;
    placeKnob (osc1Level,  labels[labelIdx++], cx1, y1, kKnobSz);
    placeKnob (osc1Detune, labels[labelIdx++], cx2, y1, kKnobSz);
    y = y1 + kLabelH + kKnobSz + 13 + kPad;
    placeKnob (osc1Octave, labels[labelIdx++], cx, y, kKnobSz);
    y += kLabelH + kKnobSz + 13 + kPad * 2;

    // --- OSC 2 ---
    labels[labelIdx++]->setBounds (px + kPad, y, comboW / 2 - kPad/2, kLabelH); // type label
    osc2TypeBox.setBounds (px + kPad, y + kLabelH, comboW / 2 - kPad/2, kComboH);
    y += kLabelH + kComboH + kPad;

    int y2 = y;
    placeKnob (osc2Level,  labels[labelIdx++], cx1, y2, kKnobSz);
    placeKnob (osc2Detune, labels[labelIdx++], cx2, y2, kKnobSz);
    y = y2 + kLabelH + kKnobSz + 13 + kPad;
    placeKnob (osc2Octave, labels[labelIdx++], cx, y, kKnobSz);
}

void SubtreactionalAudioProcessorEditor::layoutFilter (int px, int py, int pw, int /*ph*/)
{
    const int cx    = px + pw / 2;
    const int comboW = pw - 2 * kPad;
    int y = py + kHeaderH + kPad;

    // Type combo
    labels[labelIdx++]->setBounds (px + kPad, y, comboW, kLabelH);
    filterTypeBox.setBounds (px + kPad, y + kLabelH, comboW, kComboH);
    y += kLabelH + kComboH + kPad;

    y = placeKnob (filterCutoff,    labels[labelIdx++], cx, y, kKnobSz);
    y = placeKnob (filterResonance, labels[labelIdx++], cx, y, kKnobSz);
    placeKnob     (filterEnvAmt,    labels[labelIdx++], cx, y, kKnobSz);
}

void SubtreactionalAudioProcessorEditor::layoutEnv (int px, int py, int pw, int /*ph*/)
{
    const int slotW = (pw - 2 * kPad) / 4;
    auto cx = [&](int i) { return px + kPad + (int)((i + 0.5f) * slotW); };

    // Filter env row
    int y = py + kHeaderH + kPad + kLabelH;
    juce::Slider* fenv[] = { &fenvA, &fenvD, &fenvS, &fenvR };
    for (int i = 0; i < 4; ++i)
        placeKnob (*fenv[i], labels[labelIdx++], cx(i), y, kKnobSz);

    // Amp env row
    int y2 = y + kLabelH + kKnobSz + 13 + kPad * 3;
    juce::Slider* aenv[] = { &aenvA, &aenvD, &aenvS, &aenvR };
    for (int i = 0; i < 4; ++i)
        placeKnob (*aenv[i], labels[labelIdx++], cx(i), y2, kKnobSz);
}

void SubtreactionalAudioProcessorEditor::layoutFx (int px, int py, int pw, int ph)
{
    const int slotW = pw / 4;

    // Master volume at bottom-right
    const int mvSz = kKnobSz;
    int mvX = px + pw - mvSz / 2 - kPad;
    int mvY = py + ph - kLabelH - mvSz - 13 - kPad;
    labels[labelIdx + 4*7]->setBounds (mvX - mvSz / 2, mvY, mvSz, kLabelH);
    masterVolume.setBounds (mvX - mvSz / 2, mvY + kLabelH, mvSz, mvSz + 13);

    for (int i = 0; i < 4; ++i)
    {
        int sx  = px + i * slotW;
        int sw  = slotW - kPad;
        int y   = py + kHeaderH + kPad;
        int ks  = juce::jmin (kKnobSz, (sw - 2 * kPad) / 3);

        // Type combo
        labels[labelIdx]->setBounds (sx + kPad, y, sw, kLabelH);
        fxTypeBox[i].setBounds (sx + kPad, y + kLabelH, sw, kComboH);
        labelIdx++;
        y += kLabelH + kComboH + kPad;

        // Row 1: Mix | Time/Rate/T60 | Feedback/Depth
        int cx0 = sx + kPad + ks / 2;
        int cx1 = cx0 + ks + kPad;
        int cx2 = cx1 + ks + kPad;

        placeKnob (fxMix[i],         labels[labelIdx++], cx0, y, ks);
        placeKnob (fxDelayTime[i],   labels[labelIdx++], cx1, y, ks);
        placeKnob (fxDelayFb[i],     labels[labelIdx++], cx2, y, ks);
        placeKnob (fxChorusRate[i],  labels[labelIdx++], cx1, y, ks);
        placeKnob (fxChorusDepth[i], labels[labelIdx++], cx2, y, ks);
        placeKnob (fxReverbT60[i],   labels[labelIdx++], cx1, y, ks);
    }
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter();
