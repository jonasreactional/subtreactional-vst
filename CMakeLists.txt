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
)

target_compile_definitions(SubtreactionalVST
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(SubtreactionalVST
    PRIVATE
        subtreactional
        juce::juce_audio_utils
        juce::juce_audio_plugin_client
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
