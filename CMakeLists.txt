cmake_minimum_required(VERSION 3.22)
project(SubtreactionalVST VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# JUCE submodule
add_subdirectory(external/JUCE)

# cJSON — subtreactional's patch system needs it.
# The subtreactional CMakeLists only fetches cJSON when tests/examples are ON,
# so we fetch it here and wire it up manually.
include(FetchContent)
FetchContent_Declare(
    cjson
    GIT_REPOSITORY https://github.com/DaveGamble/cJSON.git
    GIT_TAG v1.7.18
)
set(ENABLE_CJSON_TEST OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(cjson)

# Subtreactional DSP core submodule
# Build only the library, no examples or tests
set(ST_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(ST_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
add_subdirectory(external/subtreactional)

# Provide cJSON headers and library to subtreactional
target_include_directories(subtreactional PRIVATE ${cjson_SOURCE_DIR})
target_link_libraries(subtreactional PRIVATE cjson)

# BinaryData target for the web UI (Release builds).
# Run `npm run build` inside web/ before configuring CMake in Release mode.
# The file is optional at configure time so Debug builds (using the dev server)
# don't require a prior npm build.
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/web/dist/index.html")
    juce_add_binary_data(SubtreactionalWebUI
        SOURCES web/dist/index.html)
    set(HAVE_WEB_UI TRUE)
else()
    set(HAVE_WEB_UI FALSE)
endif()

# Factory presets baked into the binary
juce_add_binary_data(SubtreactionalPresets
    HEADER_NAME "PresetBinaryData.h"
    NAMESPACE   PresetData
    SOURCES
        "presets/Bass/Acid Bass.json"
        "presets/Bass/Reese Bass.json"
        "presets/Bass/Sub Bass.json"
        "presets/Bass/Wobble Bass.json"
        "presets/Lead/Dirty Lead.json"
        "presets/Lead/Mono Lead.json"
        "presets/Lead/PWM Lead.json"
        "presets/Lead/Supersaw Lead.json"
        "presets/Pad/Atmospheric Pad.json"
        "presets/Pad/Noise Pad.json"
        "presets/Pad/String Pad.json"
        "presets/Pad/Warm Pad.json"
        "presets/Pluck/Harp.json"
        "presets/Pluck/Metallic Pluck.json"
        "presets/Pluck/Pluck.json"
        "presets/Pluck/Rhodes Pluck.json"
)

juce_add_plugin(SubtreactionalVST
    PLUGIN_MANUFACTURER_CODE  RCTL
    PLUGIN_CODE               Stre
    FORMATS                   VST3
    PRODUCT_NAME              "Subtreactional"
    COMPANY_NAME              "Reactional"
    IS_SYNTH                  TRUE
    NEEDS_MIDI_INPUT          TRUE
    NEEDS_MIDI_OUTPUT         FALSE
    IS_MIDI_EFFECT            FALSE
    VST3_CATEGORIES           "Instrument|Synth"
)

target_sources(SubtreactionalVST
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
        Source/JuceBridge.cpp
)

target_compile_definitions(SubtreactionalVST
    PUBLIC
        JUCE_WEB_BROWSER=1
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(SubtreactionalVST
    PRIVATE
        subtreactional
        SubtreactionalPresets
        juce::juce_audio_utils
        juce::juce_audio_plugin_client
        juce::juce_dsp
        juce::juce_gui_extra
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

if(HAVE_WEB_UI)
    target_link_libraries(SubtreactionalVST PRIVATE SubtreactionalWebUI)
endif()
