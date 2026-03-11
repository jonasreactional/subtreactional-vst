#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <array>
#include <vector>

extern "C" {
#include "subtreactional/subtreactional.h"
}

//==============================================================================
// Maps JUCE-safe APVTS IDs (underscores) to st_synth dot-notation param names.
// Dots are not valid JUCE Identifier characters; using this table keeps the
// APVTS IDs legal while the synth's st_param_set keeps its own naming.
struct ParamMap
{
    const char* apvtsId;   // used in APVTS, attachments, and DAW automation
    const char* synthName; // passed to st_synth_set_param_float
};

//==============================================================================
class SubtreactionalAudioProcessor : public juce::AudioProcessor
{
public:
    SubtreactionalAudioProcessor();
    ~SubtreactionalAudioProcessor() override;

    //==========================================================================
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;

    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    //==========================================================================
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    //==========================================================================
    const juce::String getName() const override { return JucePlugin_Name; }

    bool   acceptsMidi()  const override { return true; }
    bool   producesMidi() const override { return false; }
    bool   isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 2.0; }

    //==========================================================================
    int  getNumPrograms()    override { return 1; }
    int  getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    //==========================================================================
    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    //==========================================================================
    juce::AudioProcessorValueTreeState apvts;

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    // Full param mapping table — also used by the editor for attachments
    static const ParamMap kParams[];
    static const int      kNumParams;

    // Pops mono analyzer samples from the lock-free FIFO.
    // Returns number of samples written to dest.
    int popAnalyzerSamples (float* dest, int maxSamples);

    // Modulation assignment management (not APVTS params — stored in patch JSON)
    struct ModAssignment {
        int          sourceType;   // 0=LFO, 1=Macro, 2=Key, 3=Vel
        int          sourceIdx;    // 0-3 (Key/Vel always 0)
        juce::String paramName;    // dot notation (e.g. "filter.cutoff")
        float        depth;        // -1..+1
    };

    // Add/update a modulation assignment and push to synth
    void modAdd    (int sourceType, int sourceIdx, const juce::String& paramName, float depth);
    // Remove a modulation assignment from synth
    void modRemove (int sourceType, int sourceIdx, const juce::String& paramName);
    // Update depth of an existing assignment
    void modSetDepth(int sourceType, int sourceIdx, const juce::String& paramName, float depth);

    // Get current assignments (for UI query)
    const std::vector<ModAssignment>& getModAssignments() const { return modAssignments_; }

    //==========================================================================
    // Preset management
    struct PresetInfo {
        juce::String name;
        juce::String author;
        juce::String description;
        juce::String pack;      // top-level grouping (parent folder)
        juce::String category;  // sub-grouping within pack
        bool         isFactory  = false;
        int          factoryIdx = -1;
        juce::String filePath;
    };

    juce::Array<PresetInfo> getPresetList() const;
    void loadFactoryPreset (int idx);
    void loadUserPreset    (const juce::String& filePath);
    void saveUserPreset    (const juce::String& pack,
                            const juce::String& category,
                            const juce::String& name,
                            const juce::String& author,
                            const juce::String& description);
    void setPatchMeta      (const juce::String& name,
                            const juce::String& author,
                            const juce::String& description);
    juce::File getUserPresetsDir() const;

    /** Returns the last per-LFO output values (raw * depth, -1..+1). For display only. */
    const float* getLFOOutput() const { return synth.lfo_output; }

    /** Returns audio processing load as a proportion (0..1). Thread-safe. */
    float getCpuLoad() const { return (float) loadMeasurer_.getLoadAsProportion(); }

    /** Returns true (and clears the flag) if applyStateData ran since last check.
     *  Called from the editor timer to know when to re-push mod assignments. */
    bool checkAndClearPatchLoaded() { return patchJustLoaded_.exchange (false); }

    /** Re-sync LFO depth/rate/shape from synth to APVTS.
     *  Called from editor timer to counteract host parameter restores that may
     *  clobber APVTS values after a state load. */
    void resyncLFOParamsToAPVTS();

private:
    static constexpr size_t kMempoolSize = 4 * 1024 * 1024; // 4 MB
    char     mempool[kMempoolSize];
    st_synth synth;
    bool     synthInitialised = false;

    // Push all current APVTS values to the synth (safe from any thread)
    void syncAllParamsToSynth();

    // Read all values from synth back into APVTS (used after loading a patch)
    void syncApvtsFromSynth();

    // Rebuild modAssignments_ from synth.patch after loading a preset
    void rebuildModAssignmentsFromPatch();

    void pushAnalyzerSamples (const juce::AudioBuffer<float>& buffer);

    // Apply raw patch JSON to the synth + APVTS + modAssignments_.
    // Shared by setStateInformation (when synthInitialised) and prepareToPlay
    // (to flush pendingState_ deferred from an early setStateInformation call).
    void applyStateData (const void* data, int sizeInBytes);

    // Patch JSON cached when setStateInformation fires before prepareToPlay.
    juce::MemoryBlock pendingState_;

    static constexpr int kAnalyzerFifoSize = 1 << 16;
    juce::AbstractFifo analyzerFifo { kAnalyzerFifoSize };
    std::array<float, kAnalyzerFifoSize> analyzerSampleBuffer {};

    // Params with side-effects (panic, realloc) — only applied on change
    float lastPlayMode_ = -1.0f;

    // Set to true by applyStateData after rebuildModAssignmentsFromPatch.
    // Read + cleared by the editor timer to re-push mod assignments to JS.
    std::atomic<bool> patchJustLoaded_ { false };

    // Set to true around applyStateData to prevent processBlock from overwriting
    // freshly loaded synth values with stale APVTS values before syncApvtsFromSynth runs.
    std::atomic<bool> apvtsSyncDisabled_ { false };

    // MIDI CC → macro: written from the audio thread when a CC matches a macro.
    // A value of -1 means no pending update. Read and cleared at the top of
    // each processBlock before the APVTS sync so the CC value wins.
    std::array<std::atomic<float>, ST_MAX_MACROS> pendingMacroCC_;

    // LFO depth values loaded from the most recent patch load.
    // Written by applyStateData (message/audio thread), read by processBlock.
    // The sentinel -2.0f means "no override active".  The override is applied
    // on every block until resyncLFOParamsToAPVTS() clears it (~33 ms after
    // patch load), ensuring the host's APVTS restore cannot zero out the depth.
    static constexpr float kNoLFOOverride = -2.0f;
    std::array<std::atomic<float>, ST_MAX_LFOS> pendingLFODepth_;

    // Guards synth.patch.macros/lfos targets[] against concurrent access between
    // the audio thread (st_synth_render) and message thread (modAdd/modRemove/modSetDepth).
    juce::CriticalSection modLock_;

    // Modulation assignments (persisted alongside patch JSON)
    std::vector<ModAssignment> modAssignments_;

    juce::AudioProcessLoadMeasurer loadMeasurer_;

    // Cached raw APVTS pointers — populated once in prepareToPlay to avoid
    // per-block string map lookups in getRawParameterValue().
    std::vector<std::atomic<float>*> rawParamPtrs_;

    // Last values pushed to the synth — skip st_synth_set_param_float when unchanged.
    std::vector<float> lastSyncedValues_;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SubtreactionalAudioProcessor)
};
