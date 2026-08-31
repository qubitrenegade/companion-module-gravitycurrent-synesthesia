# Contributing

Thanks for helping improve the Synesthesia Pro module for Bitfocus Companion.

## Development setup

Use Node 22.20 or newer and Yarn 4:

```sh
corepack enable
yarn install
```

Build and test the module with:

```sh
yarn build
yarn lint
yarn test
yarn companion-module-check
```

Create an installable Companion package with:

```sh
yarn package --prerelease
```

Use the prerelease flag for development and beta builds. Stable packages should omit it.

## Testing with Synesthesia

The automated tests do not require Synesthesia or open network ports. For hardware testing, use Synesthesia Pro with OSC Input and Output enabled. The dynamic Scene surface expects Global Addresses and normalized control output.

Please test changes against representative scenes with:

- sliders and knobs
- toggles and repeatable bangs
- multiple pages of controls
- XY and RGB controls
- default, random, undo, and lock operations
- Fav positions and media navigation

When reporting an OSC issue, include the Synesthesia version, Companion version, module version, control address format, value output mode, the exact OSC address and arguments when available, and a short reproduction sequence.

## Code and protocol guidelines

- Prefer documented Synesthesia OSC routes.
- Keep OSC argument types explicit.
- Treat UDP listener readiness and recent feedback as separate states.
- Do not invent values for unknown-range controls.
- Add or update tests for protocol parsing, generated routes, and dynamic surface placement.
- Keep user-facing setup and troubleshooting in `companion/HELP.md`.
- Put lasting project information in `README.md` and release-specific changes in `CHANGELOG.md`.
- Record protocol boundaries and dependency decisions in `docs/ARCHITECTURE.md`.

## Pull requests

Keep a pull request focused on one coherent change. Explain the user-visible result, the OSC routes affected, the tests run, and any hardware validation performed. Update the help file and changelog when behavior changes.

Do not include Companion configuration exports, logs, tokens, or other local secrets in a pull request.

## Versioning and releases

Development builds use prerelease versions such as `0.1.0-dev.27`. The first public beta candidate is `1.0.0-beta.1`. Additional beta fixes increment the beta number. Once the documented release criteria are met, the accepted beta line can be released as `1.0.0`.

Before a release:

1. Run the full local checks.
2. Verify the dynamic surface on hardware.
3. Prepare and review the package version and `CHANGELOG.md` with `RELEASE_VERSION=<version> yarn release:prepare`.
4. Build the package with the correct prerelease setting.
5. Confirm the packaged manifest version and runtime.
6. Tag the accepted commit and submit that tag through the Bitfocus Developer Portal.

See [docs/RELEASING.md](docs/RELEASING.md) for the complete first-release flow.
