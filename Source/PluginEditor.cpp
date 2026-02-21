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

    // Wire up FX type combo callbacks so knobs show/hide when type changes
    for (int i = 0; i < 4; ++i)
        fxTypeBox[i].onChange = [this, i]() { updateFxVisibility (i); };

    // setSize must come AFTER all components are created: it triggers resized()
    // immediately, which accesses the labels array and component bounds.
    setSize (860, 480);
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

    // OSC sub-labels — positions stored during layoutOsc()
    subLabel (oscPanel.withTop (oscPanel.getY() + kHeaderH + kPad).withHeight (kLabelH), " OSC 1");
    subLabel (oscPanel.withTop (osc2SectionY).withHeight (kLabelH), " OSC 2");

    // Env sub-labels — ampEnvSectionY stored during layoutEnv()
    subLabel (envPanel.withTop (envPanel.getY() + kHeaderH + kPad).withHeight (kLabelH), " Filter Env");
    subLabel (envPanel.withTop (ampEnvSectionY).withHeight (kLabelH), " Amp Env");
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
    // Reset label cursor so repeated resized() calls lay out correctly
    labelIdx = 0;

    const int W = getWidth();
    const int H = getHeight();
    const int top = kTitleH + kPad;
    const int bot = H - kPad;

    // Column widths: OSC and Env slightly narrower to give FX more room
    const int oscW    = (int)(W * 0.19f);
    const int filterW = (int)(W * 0.13f);
    const int envW    = (int)(W * 0.20f);
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

    // Apply type-based visibility after layout (layout sets bounds on all knobs)
    for (int i = 0; i < 4; ++i)
        updateFxVisibility (i);
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

void SubtreactionalAudioProcessorEditor::layoutOsc (int px, int py, int pw, int /*ph*/)
{
    const int comboW = pw - 2 * kPad;
    // Divide width into thirds for the three knobs
    const int cx0 = px + pw / 6;
    const int cx1 = px + pw / 2;
    const int cx2 = px + 5 * pw / 6;

    // --- OSC 1 ---
    int y = py + kHeaderH + kPad + kLabelH; // kLabelH reserved for "OSC 1" sub-label in paint()

    // Type combo (full width)
    labels[labelIdx++]->setBounds (px + kPad, y, comboW, kLabelH);
    osc1TypeBox.setBounds (px + kPad, y + kLabelH, comboW, kComboH);
    y += kLabelH + kComboH + kPad;

    // Level / Detune / Octave — all three on one row
    placeKnob (osc1Level,  labels[labelIdx++], cx0, y, kKnobSz);
    placeKnob (osc1Detune, labels[labelIdx++], cx1, y, kKnobSz);
    placeKnob (osc1Octave, labels[labelIdx++], cx2, y, kKnobSz);
    y += kLabelH + kKnobSz + 13 + kPad * 2;

    // --- OSC 2 --- (store y so paint() can draw the "OSC 2" sub-label)
    osc2SectionY = y;
    y += kLabelH;

    labels[labelIdx++]->setBounds (px + kPad, y, comboW, kLabelH);
    osc2TypeBox.setBounds (px + kPad, y + kLabelH, comboW, kComboH);
    y += kLabelH + kComboH + kPad;

    placeKnob (osc2Level,  labels[labelIdx++], cx0, y, kKnobSz);
    placeKnob (osc2Detune, labels[labelIdx++], cx1, y, kKnobSz);
    placeKnob (osc2Octave, labels[labelIdx++], cx2, y, kKnobSz);
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
    ampEnvSectionY = y2 - kPad; // stored for paint() "Amp Env" sub-label
    juce::Slider* aenv[] = { &aenvA, &aenvD, &aenvS, &aenvR };
    for (int i = 0; i < 4; ++i)
        placeKnob (*aenv[i], labels[labelIdx++], cx(i), y2, kKnobSz);
}

void SubtreactionalAudioProcessorEditor::layoutFx (int px, int py, int pw, int ph)
{
    // Each FX slot occupies one horizontal row:
    //   [type combo] [Mix] [Time] [Fb] [Rate] [Depth] [T60]
    // Knob size is computed to fit all 6 knobs + combo in the available width.
    const int usable  = pw - 2 * kPad;
    const int comboW  = 68;
    // 6 knobs with 5 gaps between them, plus one gap after combo
    const int ks      = (usable - comboW - kPad - 5 * kPad) / 6;
    const int rowH    = kLabelH + ks + 13 + kPad;

    // Master volume sits below the 4 FX rows
    {
        const int mvY = py + kHeaderH + kPad + 4 * rowH + kPad;
        const int mvX = px + pw - kKnobSz / 2 - kPad;
        labels[labelIdx + 4 * 7]->setBounds (mvX - kKnobSz / 2, mvY, kKnobSz, kLabelH);
        masterVolume.setBounds (mvX - kKnobSz / 2, mvY + kLabelH, kKnobSz, kKnobSz + 13);
    }

    for (int i = 0; i < 4; ++i)
    {
        int x = px + kPad;
        const int y = py + kHeaderH + kPad + i * rowH;

        // Type combo — record label start for this slot before incrementing
        fxLabelStart[i] = labelIdx;
        labels[labelIdx]->setBounds (x, y, comboW, kLabelH);
        fxTypeBox[i].setBounds (x, y + kLabelH, comboW, kComboH);
        labelIdx++;
        x += comboW + kPad;

        // Six knobs in a row — all on the same y baseline
        auto nextKnob = [&](juce::Slider& s, juce::Label* lbl) {
            placeKnob (s, lbl, x + ks / 2, y, ks);
            x += ks + kPad;
        };

        nextKnob (fxMix[i],          labels[labelIdx++]);
        nextKnob (fxDelayTime[i],    labels[labelIdx++]);
        nextKnob (fxDelayFb[i],      labels[labelIdx++]);
        nextKnob (fxChorusRate[i],   labels[labelIdx++]);
        nextKnob (fxChorusDepth[i],  labels[labelIdx++]);
        nextKnob (fxReverbT60[i],    labels[labelIdx++]);
    }
}

//==============================================================================
void SubtreactionalAudioProcessorEditor::updateFxVisibility (int i)
{
    // Read current type from APVTS (0=Off, 1=Delay, 2=Chorus, 3=Reverb)
    int type = (int) processor.apvts
                   .getRawParameterValue ("fx" + juce::String (i) + "_type")
                   ->load();

    // Labels relative to fxLabelStart[i]:
    //  +0 = Type  +1 = Mix  +2 = DelayTime  +3 = DelayFb
    //  +4 = ChorusRate  +5 = ChorusDepth  +6 = ReverbT60
    int li = fxLabelStart[i];

    auto setVis = [&](juce::Slider& s, int offset, bool visible)
    {
        s.setVisible (visible);
        if (li + offset < labels.size())
            labels[li + offset]->setVisible (visible);
    };

    bool isOn     = (type != 0);
    bool isDelay  = (type == 1);
    bool isChorus = (type == 2);
    bool isReverb = (type == 3);

    setVis (fxMix[i],          1, isOn);
    setVis (fxDelayTime[i],    2, isDelay);
    setVis (fxDelayFb[i],      3, isDelay);
    setVis (fxChorusRate[i],   4, isChorus);
    setVis (fxChorusDepth[i],  5, isChorus);
    setVis (fxReverbT60[i],    6, isReverb);
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter();
