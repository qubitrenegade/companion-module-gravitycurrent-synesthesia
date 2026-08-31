# Changelog

This project follows Semantic Versioning. Release-specific behavior and known issues are recorded here. Enduring setup constraints are documented in the README and Companion help file.

## Next release (planned `1.0.0-beta.1`)

This will be the module's first public beta. Development packages such as `0.1.0-dev.27` are local test builds, not earlier public releases.

### Added

- Typed OSC control for playlists, favs, scenes, presets, media, controls, banks, groups, rendering, and locks.
- Dynamic Scene, Meta, Media, and Favs performance modes.
- Shared button and rotary paging with centered discrete controls.
- Fav access for positions 1 through 10.
- Component cycling and relative adjustment for XY and RGB controls.
- Random All and Random Selected controls for Scene and Meta modes.
- A configured media-source allowlist, native source Previous and Next, and a second-press Media source view.
- Per-scene memory for presets created through Companion.
- Automated OSC parsing, action, preset, configuration, and surface tests.

### Changed

- Dynamic bangs send press and release values so they can be triggered repeatedly.
- Toggle and rotary state follows normalized OSC feedback and then tracks local changes.
- Listener readiness and feedback freshness are reported separately.
- Button labels and placement are optimized for compact control surfaces.

### Known limitations

- Catalog discovery for scenes, existing presets, fav names, playlists, and media/live sources is not currently available through the documented Synesthesia OSC routes.
- Native media navigation cannot automatically omit capture devices.
- Existing presets cannot be generically stepped without known names or Fav assignments.
- Global Undo is a sequential Scene undo followed by Meta undo; a combined undo and redo operation is not currently available.
- Feedback is event-driven and can become stale while cached values remain valid.
