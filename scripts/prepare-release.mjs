import { readFile, writeFile } from 'node:fs/promises'

const version = process.env.RELEASE_VERSION?.trim()
const semanticVersion =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

if (!version || !semanticVersion.test(version)) {
	throw new Error('Set RELEASE_VERSION to a valid semantic version, for example 1.0.0-beta.1')
}

const packagePath = new URL('../package.json', import.meta.url)
const changelogPath = new URL('../CHANGELOG.md', import.meta.url)
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
const changelog = await readFile(changelogPath, 'utf8')
const nextReleaseHeading = /^## Next release[^\n]*$/m
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const preparedHeading = new RegExp(`^## ${escapedVersion} - \\d{4}-\\d{2}-\\d{2}$`, 'm')

if (!nextReleaseHeading.test(changelog) && !preparedHeading.test(changelog)) {
	throw new Error(`CHANGELOG.md has neither a Next release heading nor a prepared ${version} heading`)
}

const date = new Date().toISOString().slice(0, 10)
packageJson.version = version
const preparedChangelog = nextReleaseHeading.test(changelog)
	? changelog.replace(nextReleaseHeading, `## ${version} - ${date}`)
	: changelog

await writeFile(packagePath, `${JSON.stringify(packageJson, null, '\t')}\n`)
await writeFile(changelogPath, preparedChangelog)

console.log(
	preparedChangelog === changelog
		? `${version} was already prepared. package.json and CHANGELOG.md are consistent.`
		: `Prepared ${version}. Review package.json and CHANGELOG.md before committing.`,
)
