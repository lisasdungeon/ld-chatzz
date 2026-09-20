# Changelog

## 1.5.0

### Added

- Runtime theme picker (Crimson, Void, Neon) in the hub Settings tab as a swatch grid and in the settings window as a dropdown; switching re-colors every open window instantly and persists per client. Theme choice is reapplied on startup.
- Personal background image feature, completed end to end: pick a file from the hub Settings tab (with Clear button and instant preview on the hub and every open chat window) or the settings window.
- Startup asset check: warns in the console, grouped by icons/sounds, when any asset referenced by the module is missing from disk, instead of failing silently as dead buttons or silent audio.
- The close-window sound, previously registered but never wired, now plays when chat windows close.
- Notification sound is now selectable from a dropdown of the four built-in sounds, persisted as a client setting, with a working Preview button.
- Release pipeline: on every version tag, GitHub Actions runs manifest validation and the full test suite, builds the release zip with the project packager, verifies the tag matches module.json, and attaches the zip to the GitHub release with notes extracted from the changelog.

### Changed

- Replaced the placeholder grey/blue icon set with the crimson blood-themed icon pack; filled the two missing states (`Notification.png`, `Yes_on.png`) from their variants.
- All accent tints, window borders, and background scrims now derive from theme variables (`--chatzz-accent-rgb`, `--chatzz-bg-scrim`), so custom palettes recolor the entire UI without CSS changes. Removed roughly 26 hardcoded crimson values across six stylesheets.
- Background image overlays use a per-theme scrim so message text stays readable on any theme.

### Fixed

- Notification and UI sounds did not play at all: the shipped WAV files used WAVE_FORMAT_EXTENSIBLE headers that Chromium cannot decode. All four were replaced with standard PCM copies; the settings window's sound dropdown was also empty and now populates correctly.
- Background images never appeared: the CSS overlay read a variable the code never set, and a leftover dark gradient obscured any image that did load. Both appliers now set the variable and a theme-aware scrim.
- Icon assets shrank from 28.6 MB to 0.43 MB (256px palette PNGs) with pixel-verified quality and alpha preservation, cutting the module download by ~28 MB.

## 1.4.4

- Responsive mobile layout: chat hub, chat windows, and GM tools now go full-screen with enlarged touch targets on phone-sized viewports (768px and below) and touch devices
- Added safe-area insets for notched phones and 16px input font sizing to prevent iOS auto-zoom
- Stacked the New Chat columns into a single scrollable column on small screens
- Shared images now never exceed the viewport width on mobile
- On mobile, Foundry's scene controls, hotbar, navigation bar, and sidebar auto-hide while a chat window is open for a dedicated-app feel
- Restored the LD Chatzz scene-control button by registering its hook during init and explicitly rebuilding Foundry v14's cached controls at ready

## 1.4.3

- Notification volume default used a missing `soundVolume` key, so new worlds stored an empty volume setting
- Message edit dialog now HTML-escapes existing content before putting it in the textarea
- Remote edit and delete socket events are ignored when the payload user is not the message author and the receiver is not the GM
- User-facing settings, scene controls, friend-request dialogs, and hub notices now go through localization keys

## 1.4.2

- README version and support contacts (Discord MystryssLysa, email Lisasdungeon@gmail.com, Patreon LisasDungeon)
- Removed leftover dash characters from comments and CSS

## 1.4.1

- Sole author Lisa's Dungeon with Discord MystryssLysa, email Lisasdungeon@gmail.com, and Patreon LisasDungeon
- Thin entry: `main.js` only registers hooks; Settings/Ready/UI modules load via dynamic import on init/ready
- Split SettingsHook/ReadyHook into testable `onInit`/`onReady` methods so lazy hook registration does not nest unused `Hooks.once` handlers
- Expanded core-layer tests (ConversationUtils, ActorContacts, Utils helpers, hooks wiring, DataMessaging keys)
- Line coverage for `main.js` and all `src/**/*.js` via expanded unit tests (data, sockets, UIManager, LDChatzz, hooks, all windows)
- `Utils.sanitizeHTML` now uses explicit entity escaping so quotes are consistent in browsers and headless tests
- `DataManager.interceptedMessages` setter so GM monitor clear-log can reset the intercept buffer
- Extracted `resolve*AppClass` helpers on Settings/Group/GMMod windows for v11 fallback testability

## 1.4.0 - 2026-07-30

- Rebranded the module as LD Chatzz under Lisa's Dungeon.
- Fixed group chat creation, deletion, and editing throwing an error and failing outright, caused by several socket broadcast methods being called but never defined.
- Fixed every chat message rendering with visibly broken markup (literal `&lt;br&gt;` text, dead links) due to message content being HTML-enriched twice.
- Fixed sound and GM audio override settings silently breaking on this rename, caused by a hardcoded module identifier instead of the shared constant.
- Fixed 32 UI strings (group manager, moderation, and conversation dialogs) rendering as raw translation keys instead of real text; removed roughly 350 unused, long-abandoned translation keys left over from an earlier UI structure.
- Fixed the GM stealth monitor never live-updating while open, due to a hook that was listened for but never fired.
- Fixed an unescaped username in the "New Private Chat" and "Edit Group" dialogs.
- Removed a broken header logo (referencing an image that doesn't exist in the repository) and a leftover, disabled cross-module registry hook.
- Split a single 3,900-line stylesheet into focused files, none over 500 lines.
- Added a real test suite for the data and socket layers.

## 1.3.0 - 2026-04-12

### Added
- Actor and NPC conversation support alongside player-to-player chats.
- A lightweight friend-request flow for actor messaging.
- Separate actor chat storage and GM moderation views.
- Ready-to-use macros for actor friendship and direct actor chat access.

### Changed
- Split actor conversations out of private user chats for cleaner persistence and moderation.
- Added a shared conversation lookup helper to reduce branching across the data layer.
- Persisted conversation `lastActivity` so hub ordering stays stable after reloads.

### Fixed
- Actor recipients now resolve correctly so accepted characters can actually receive messages.
- GM moderation clear/delete actions now target the correct conversation type.
- Circular imports in the data layer were removed.

### Notes
- Verified against Foundry VTT v11 through v13 compatibility paths.
