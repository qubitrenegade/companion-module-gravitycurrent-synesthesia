# Releasing

Follow the official Bitfocus guides for [releasing a module](https://companion.free/for-developers/module-development/module-lifecycle/releasing-your-module#first-release) and [module versioning](https://companion.free/for-developers/git-workflows/versioning#version-of-modules). This checklist records how those steps apply to this repository.

## Version policy

- Local hardware builds use versions such as `0.1.0-dev.27`.
- The first public submission candidate is `1.0.0-beta.1`.
- Mark beta submissions as prereleases in the Bitfocus Developer Portal.
- Release `1.0.0` after the beta meets the hardware, documentation, and compatibility criteria.

`package.json` is the version source of truth. Companion's package builder copies that value into the built manifest. Prepare a release with:

```sh
RELEASE_VERSION=1.0.0-beta.1 yarn release:prepare
```

The command validates the semantic version, updates `package.json`, and stamps the prepared section in `CHANGELOG.md`. It is safe to rerun for the same already-prepared version. Review both files before committing. It does not create a tag, push a branch, or submit anything externally.

## First public release

The Bitfocus repository currently has no initial branch, so a pull request into an upstream `main` branch is not possible yet.

1. Complete and merge the development pull request into the accepted local `main` history.
2. Run `yarn build`, `yarn lint`, `yarn test`, and `yarn companion-module-check`.
3. Verify the dynamic surface and documented examples on hardware.
4. Run the release preparation command and commit the resulting version and changelog changes.
5. Push the accepted `main` history to the empty Bitfocus repository to establish its initial `main` branch.
6. Create and push tag `v1.0.0-beta.1` on that accepted commit. A GitHub Release is optional; its notes can be generated from the tag and then edited into a concise user-facing summary.
7. In the Bitfocus Developer Portal, open **My Connections**, select the module, choose **Submit Version**, select the tag, enable **Is Prerelease**, and submit it for review.

Only versions submitted through the Developer Portal enter Bitfocus review. Approval makes the version available through Companion's normal module distribution.

After the official repository has a `main` branch, use normal feature branches and pull requests there for later changes.
