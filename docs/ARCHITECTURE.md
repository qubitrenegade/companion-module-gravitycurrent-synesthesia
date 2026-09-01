# Architecture

This document records implementation decisions that are useful to maintainers but are not needed for day-to-day module use.

## Module boundaries

- `src/actions.ts` defines typed product actions and emits explicit OSC integer, float, and string arguments through Companion's OSC sender.
- `src/osc.ts` owns the inbound UDP listener boundary. It normalizes messages and bundles, parses supported state routes, and rate-limits diagnostics for unsupported paths.
- `src/state.ts` stores typed scalar, toggle, bang, XY, RGB, and dropdown values. It coalesces packet bursts into bounded Companion variable and feedback updates and schedules the feedback freshness boundary.
- `src/variables.ts`, `src/feedbacks.ts`, and `src/presets.ts` expose the state to Companion controls.
- `src/main.ts` owns configuration transitions, dynamic surface composition, and listener replacement.

Repeated global positions use compact preset templates instead of hundreds of duplicate definitions. Actions that change the Synesthesia project, such as creating a preset from the current state, use a deliberate long-press interaction.

## Dynamic discovery and fixed protocol concepts

User scene names and preset names are not compiled into the module. Scene controls are populated from the Global Addresses name messages sent by Synesthesia. Presets created through Companion are remembered per scene in connection configuration.

Some fixed lists are part of the control protocol rather than user content:

- Fav positions 1 through 10
- Global control positions 1 through 16
- Known built-in Meta and Media control addresses

Unknown future Meta values received through supported dimensional routes remain available through fallback discovery.

## OSC state model

OSC uses UDP, so the module reports two separate facts:

- Listener readiness means Companion successfully opened its local UDP socket.
- Feedback freshness means a supported Synesthesia state message arrived within the configured timeout.

Synesthesia state output is event-driven. The module retains the most recently received value when freshness expires so a quiet control surface does not discard useful state.

The current Synesthesia OSC interface focuses on control and state messages. Catalog discovery for scenes, presets, fav names, playlists, and media sources is not currently available through those routes. The configured media-source allowlist provides exact-name selection until discovery becomes available.

## OSC dependency decision

The module uses [`node-osc`](https://github.com/MylesBorins/node-osc) for the inbound UDP server and OSC message and bundle decoder. Outbound messages use `InstanceBase.oscSend` from [`@companion-module/base`](https://github.com/bitfocus/companion-module-base), which keeps encoding within Companion and lets actions set exact OSC type tags.

The libraries reviewed before this choice were:

| Library                                                 | License        | TypeScript and OSC coverage                                           | UDP and packaging tradeoff                                                                                                             |
| ------------------------------------------------------- | -------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `node-osc`                                              | Apache-2.0     | Bundled declarations, messages and bundles, common OSC argument types | Current ESM support, direct closeable UDP server, zero runtime dependencies. Chosen for the smallest maintained Node-only integration. |
| [`osc`](https://github.com/colinbdclark/osc.js)         | MIT OR GPL-2.0 | Broad OSC 1.0 and 1.1 coverage                                        | Mature UDP transports, but a larger dependency graph and dual-license surface than this module needs.                                  |
| [`osc-js`](https://github.com/adzialocha/osc-js)        | MIT            | Bundled declarations and OSC 1.0 coverage                             | UDP works through a general plugin system that also carries WebSocket concerns outside this module's scope.                            |
| [`osc-min`](https://github.com/russellmcc/node-osc-min) | Zlib           | Bundled declarations and OSC 1.1 codec coverage                       | Compact and transport-independent, but would require the module to recreate socket lifecycle and has less recent maintenance activity. |

Apache-2.0 is compatible with distributing this MIT-licensed module. The dependency and its license are retained by the Companion package build.

The generic OSC Companion module was reviewed as a route and argument behavior reference. Its legacy JavaScript architecture is not used as this module's scaffold.

## Surface color language

Example surfaces reserve visual channels for distinct meanings:

- Blue backgrounds indicate navigation.
- Purple backgrounds indicate inactive latching toggles; green indicates on.
- Amber backgrounds indicate momentary bangs.
- Red indicates locked or error state.
- A green background with a bright outline identifies the selected Scene, Meta, Media, or Favs mode.
- Rotary borders are blue while adjustable and red while locked. The visible R/G/B or X/Y component label carries component information, so a second unlocked border color is unnecessary.

This keeps button behavior, selected context, and lock state visually separate.
