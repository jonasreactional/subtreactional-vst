cmake_minimum_required(VERSION 3.22)
project(SubtreactionalVST VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Apply local JUCE patches before including the submodule.
# Each patch is applied idempotently: skip if already applied (reverse-check passes).
set(JUCE_DIR "${CMAKE_SOURCE_DIR}/external/JUCE")
file(GLOB JUCE_PATCHES "${CMAKE_SOURCE_DIR}/patches/juce_*.patch")
foreach(PATCH_FILE ${JUCE_PATCHES})
    execute_process(
        COMMAND git apply --check --reverse "${PATCH_FILE}"
        WORKING_DIRECTORY "${JUCE_DIR}"
        RESULT_VARIABLE _already_applied
        OUTPUT_QUIET ERROR_QUIET
    )
    if(NOT _already_applied EQUAL 0)
        message(STATUS "Applying JUCE patch: ${PATCH_FILE}")
        execute_process(
            COMMAND git apply "${PATCH_FILE}"
            WORKING_DIRECTORY "${JUCE_DIR}"
            RESULT_VARIABLE _apply_result
        )
        if(NOT _apply_result EQUAL 0)
            message(FATAL_ERROR "Failed to apply JUCE patch: ${PATCH_FILE}")
        endif()
    endif()
endforeach()

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
# cJSON v1.7.18 uses cmake_minimum_required(VERSION 3.0) which CMake 4.x rejects.
set(CMAKE_POLICY_VERSION_MINIMUM 3.5 CACHE STRING "" FORCE)
FetchContent_MakeAvailable(cjson)
unset(CMAKE_POLICY_VERSION_MINIMUM CACHE)

# Subtreactional DSP core submodule
# Build only the library, no examples or tests
set(ST_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(ST_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
add_subdirectory(external/subtreactional)

# Provide cJSON headers and library to subtreactional
target_include_directories(subtreactional PRIVATE ${cjson_SOURCE_DIR})
target_link_libraries(subtreactional PRIVATE cjson)

# Linux: subtreactional is a static lib linked into a shared object (.so),
# so it must be compiled with -fPIC.
set_target_properties(subtreactional PROPERTIES POSITION_INDEPENDENT_CODE ON)
set_target_properties(cjson PROPERTIES POSITION_INDEPENDENT_CODE ON)

# LEAF's CMakeLists uses GCC/Clang flags unconditionally; replace with
# generator expressions so MSVC doesn't choke on -Wno-narrowing etc.
if(TARGET LEAF)
    get_target_property(_leaf_opts LEAF COMPILE_OPTIONS)
    if(_leaf_opts)
        set_target_properties(LEAF PROPERTIES COMPILE_OPTIONS "")
    endif()
    target_compile_options(LEAF PRIVATE
        $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wno-narrowing -w>
    )
endif()

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
    COMPANY_NAME              "Reactional Music"
    IS_SYNTH                  TRUE
    NEEDS_MIDI_INPUT          TRUE
    NEEDS_MIDI_OUTPUT         FALSE
    IS_MIDI_EFFECT            FALSE
    NEEDS_WEB_BROWSER         TRUE
    VST3_CATEGORIES           "Instrument|Synth"
)

target_sources(SubtreactionalVST
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
        Source/JuceBridge.cpp
)

# NativeDarkCover uses Obj-C++ on Apple; the header provides a pure-JUCE
# fallback on other platforms, so we compile the .mm as C++ there.
if(APPLE)
    target_sources(SubtreactionalVST PRIVATE Source/NativeDarkCover.mm)
else()
    set_source_files_properties(Source/NativeDarkCover.mm PROPERTIES LANGUAGE CXX)
    target_sources(SubtreactionalVST PRIVATE Source/NativeDarkCover.mm)
endif()

# Windows: fetch WebView2 SDK and enable the Chromium-based WebView2 backend.
# The JUCE patch (juce_webview2_static_link.patch) removes the dynamic
# WebView2Loader.dll dependency so no extra DLL needs to ship with the VST3.
if(WIN32)
    FetchContent_Declare(
        webview2
        URL "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.902.49"
        DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    )
    FetchContent_MakeAvailable(webview2)
    set(WEBVIEW2_INCLUDE "${webview2_SOURCE_DIR}/build/native/include")

    # Determine the correct architecture subdirectory
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        set(WEBVIEW2_ARCH "x64")
    else()
        set(WEBVIEW2_ARCH "x86")
    endif()
    set(WEBVIEW2_STATIC_LIB "${webview2_SOURCE_DIR}/build/native/${WEBVIEW2_ARCH}/WebView2LoaderStatic.lib")
endif()

target_compile_definitions(SubtreactionalVST
    PUBLIC
        JUCE_WEB_BROWSER=1
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
        JUCE_DISPLAY_SPLASH_SCREEN=0
        JUCE_REPORT_APP_USAGE=0
        $<$<PLATFORM_ID:Windows>:JUCE_USE_WIN_WEBVIEW2=1>
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

if(WIN32)
    target_include_directories(SubtreactionalVST PRIVATE "${WEBVIEW2_INCLUDE}")
    target_link_libraries(SubtreactionalVST PRIVATE "${WEBVIEW2_STATIC_LIB}")
endif()

if(HAVE_WEB_UI)
    target_link_libraries(SubtreactionalVST PRIVATE SubtreactionalWebUI)
endif()
