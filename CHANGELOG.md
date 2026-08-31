# Changelog

This project follows Semantic Versioning. Release-specific behavior and known issues are recorded here. Enduring setup constraints are documented in the README and Companion help file.

## Unreleased

### Added

- Dynamic Scene, Meta, Media, and Favslots performance modes for Stream Deck Plus.
- Shared button and rotary paging with centered discrete controls.
- Favslot access for positions 1 through 10.
- Component cycling and relative adjustment for XY and RGB controls.
- Random All and Random Selected controls for Scene and Meta modes.
- Configured media-source allowlist controls and native source Previous and Next.
- Per-scene memory for presets created through Companion.
- Automated OSC parsing, action, preset, configuration, and surface tests.

### Changed

- Dynamic bangs send press and release values so they can be triggered repeatedly.
- Toggle and rotary state follows normalized OSC feedback and then tracks local changes.
- Listener readiness and feedback freshness are reported separately.
- Button labels and placement are optimized for the Stream Deck Plus layout.

### Known limitations

- Synesthesia does not enumerate scenes, existing presets, favslot names, playlists, or media/live sources through its documented OSC API.
- Native media navigation cannot automatically omit capture devices.
- Existing presets cannot be generically stepped without known names or favslot assignments.
- Global Undo is a sequential Scene undo followed by Meta undo. There is no documented atomic global undo or redo.
- Feedback is event-driven and can become stale while cached values remain valid.

## 0.1.0

- Initial module scaffold and documented OSC action coverage.
