# companion-module-gravitycurrent-synesthesia

Bitfocus Companion connection module for controlling Synesthesia Pro and receiving OSC state output.

Synesthesia's OSC API is documented at <https://synesthesia.live/docs/manual/osc.html>. OSC requires a Synesthesia Pro license and the API continues to evolve.

## Features

- Typed Companion actions for playlists, favs, scenes, presets, media, controls, banks, groups, rendering, and locks.
- Optional OSC feedback for scene names, active global-control names, normalized values, toggles, XY controls, and RGB colors.
- A dynamic performance surface with Scene, Meta, Media, and Favs modes.
- Shared paging that keeps one-page button groups visible while additional rotary controls are paged.
- Fav access for positions 1 through 10, with overlapping pages for fast navigation.
- RGB and XY component selection from the rotary LCD. Dial rotation adjusts the selected component and dial press restores the control default.
- Preset creation with generated `YY-MM-DD HH:MM:SS - Companion` names and per-scene memory for presets created through Companion.

## Requirements

- Bitfocus Companion with the Node 22 module runtime.
- Synesthesia Pro with OSC Input enabled.
- Synesthesia OSC Output enabled for state-aware controls.
- **Global Addresses** and **Output Normalized Values** selected in Synesthesia for the dynamic Scene surface.

## Installation

In Companion, add a connection and search for **Gravity Current: Synesthesia Pro**. Enter the Synesthesia host and OSC input port. Enable feedback listening if you want state-aware toggles, rotary values, and dynamic labels.

See [the Companion help file](companion/HELP.md) for the same-computer port layout, LAN setup, available controls, examples, and troubleshooting.

## Current OSC interface considerations

- The OSC transport and recent feedback are reported separately so local listener readiness is not confused with recent state activity.
- Catalog discovery for scenes, existing presets, fav names, playlists, and media/live sources is not currently available through the documented routes.
- Native media Previous and Next follows Synesthesia's source order. The configured exact-name source list provides fast selection and optional exclusion until catalog discovery becomes available.
- Existing per-scene presets can be reached by exact name or Fav position. Presets created through Companion are also remembered per scene for Previous and Next navigation.
- Synesthesia state output is event-driven, so feedback can become stale while the most recently received values remain useful.
- Global Undo is implemented as Scene undo followed by Meta undo because the current interface provides those operations separately.

Release-specific changes and known issues are tracked in [CHANGELOG.md](CHANGELOG.md). Contribution setup is in [CONTRIBUTING.md](CONTRIBUTING.md). Maintainer details are in [Architecture](docs/ARCHITECTURE.md) and [Releasing](docs/RELEASING.md).

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

`yarn test` builds the TypeScript output and runs the Node test suite. The tests use in-memory action, state, timer, and UDP server boundaries, so they do not require Synesthesia or open network ports.

The GitHub Actions workflow runs build and typechecking, lint, tests, and the Companion package build on Node 22.

Before opening a pull request, run:

```sh
yarn build
yarn lint
yarn test
yarn companion-module-check
```
