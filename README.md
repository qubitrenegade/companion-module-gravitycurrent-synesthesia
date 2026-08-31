# companion-module-gravitycurrent-synesthesia

Bitfocus Companion connection module for controlling Synesthesia Pro and receiving its documented OSC state output.

Synesthesia's OSC API is documented at <https://synesthesia.live/docs/manual/osc.html>. OSC requires a Synesthesia Pro license and the API is still evolving.

## Features

- Typed Companion actions for playlists, favslots, scenes, presets, media, controls, banks, groups, rendering, and locks.
- Optional OSC feedback for scene names, active global-control names, normalized values, toggles, XY controls, and RGB colors.
- A dynamic Stream Deck Plus performance surface with Scene, Meta, Media, and Favslots modes.
- Shared paging that keeps one-page button groups visible while additional rotary controls are paged.
- Favslot access for positions 1 through 10, with overlapping pages for fast navigation.
- RGB and XY component selection from the rotary LCD. Dial rotation adjusts the selected component and dial press restores the control default.
- Preset creation with generated `YY-MM-DD HH:MM:SS - Companion` names and per-scene memory for presets created through Companion.

## Requirements

- Bitfocus Companion with the Node 22 module runtime.
- Synesthesia Pro with OSC Input enabled.
- Synesthesia OSC Output enabled for state-aware controls.
- **Global Addresses** and **Output Normalized Values** selected in Synesthesia for the dynamic Scene surface.

See [the Companion help file](companion/HELP.md) for the same-computer port layout, LAN setup, available controls, and troubleshooting.

## Installation

Until this module is available through Companion's normal module distribution, build or download a Companion module package and upload it from Companion's Modules page. After uploading a new package, edit the connection and explicitly select the new module version. Importing a Companion configuration does not automatically switch an existing connection to the newly uploaded version.

## Known Synesthesia API limitations

- OSC is UDP and has no acknowledgement or persistent connection state.
- The documented OSC API does not enumerate scenes, existing presets, favslot names, playlists, or media/live sources.
- Native media Previous and Next follows Synesthesia's own source order. Automatic device exclusion is not possible without source enumeration from Synesthesia.
- Existing per-scene presets cannot be stepped generically through the documented API. Favslots and exact preset names remain the reliable external entry points.
- Synesthesia output is event-driven, so feedback can become stale while the most recently received values remain usable.
- Synesthesia does not expose a native atomic global undo or redo. The module's Global Undo sends one undo command to Scene and then one to Meta.

Release-specific changes and known issues are tracked in [CHANGELOG.md](CHANGELOG.md). Contribution setup and pull request expectations are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture

- `src/actions.ts` defines typed product actions and emits explicit OSC integer, float, and string arguments through Companion's OSC sender.
- `src/osc.ts` owns the inbound UDP listener boundary, safely normalizes messages and bundles, parses only documented MVP state routes, and rate-limits diagnostics for unsupported paths.
- `src/state.ts` stores typed scalar, toggle, bang, XY, RGB, and dropdown values. It coalesces packet bursts into bounded Companion variable and feedback updates and schedules the feedback freshness boundary.
- `src/variables.ts`, `src/feedbacks.ts`, and `src/presets.ts` expose the state to Companion controls.
- Preset template groups cover repeated global positions without generating hundreds of duplicate definition objects. Consequential project mutation, such as creating a preset from current state, uses a long-press control.
- `src/main.ts` owns configuration transitions and disposes the old listener before binding a replacement.

UDP does not provide a Synesthesia connection session or delivery acknowledgement. Module status describes local configuration and listener setup. The separate freshness feedback describes whether supported Synesthesia state arrived recently.

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

## Development

Use Node 22.20 or newer and Yarn 4:

```sh
corepack enable
yarn install
yarn build
yarn lint
yarn test
yarn package --prerelease
```

`yarn test` builds the TypeScript output and runs the Node test suite. Tests use in-memory action, state, timer, and UDP server boundaries, so they do not require Synesthesia or open network ports. They cover representative outgoing routes and OSC types, scene and global state parsing, multidimensional formatting, empty-name clearing, malformed input, burst coalescing, freshness deadlines, and listener replacement.

The GitHub Actions workflow runs build and typechecking, lint, tests, and the Companion package build on Node 22.

Before opening a pull request, run:

```sh
yarn build
yarn lint
yarn test
yarn companion-module-check
```

## Protocol scope

The module does not implement discovery or request-response behavior because Synesthesia documents OSC as one-way UDP input and output. It does not enumerate installed scenes or presets because the documented API does not expose enumeration. Audio-variable output is intentionally ignored: it is high-volume and is not needed for the control-surface state model.

User setup, the suggested port layout, rotary examples, and troubleshooting are in [companion/HELP.md](companion/HELP.md).
