import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const examples = [
	'streamdeck-plus-synesthesia-surface.companionconfig',
	'streamdeck-plus-xl-synesthesia-surface.companionconfig',
]

for (const filename of examples) {
	test(`${filename} is a sanitized page-only example`, async () => {
		const content = await readFile(new URL(`../companion/assets/${filename}`, import.meta.url), 'utf8')
		const example = JSON.parse(content)

		assert.equal(example.type, 'page')
		assert.equal(example.instances['synesthesia-example-connection'].label, 'Synesthesia')
		assert.equal(example.instances['synesthesia-example-connection'].moduleId, 'gravitycurrent-synesthesia')
		assert.ok(example.page.controls)
		assert.doesNotMatch(content, /QAQP7haScNcALBdQe-O98|\$\(arena:|\$\(custom:|127\.0\.0\.1/)
		assert.doesNotMatch(content, /"(?:host|listenPort|targetPort|secrets)"/)

		const referencedConnections = new Set([...content.matchAll(/"connectionId": "([^"]+)"/g)].map((match) => match[1]))
		assert.deepEqual([...referencedConnections], ['synesthesia-example-connection'])

		const controls = Object.values(example.page.controls).flatMap((row) => Object.values(row))
		const modeFeedbacks = controls
			.flatMap((control) => control.feedbacks ?? [])
			.filter((feedback) => feedback.definitionId === 'surface_mode')
		assert.deepEqual(modeFeedbacks.map((feedback) => feedback.options.mode.value).sort(), [
			'favs',
			'media',
			'meta',
			'scene',
		])

		for (const feedback of modeFeedbacks) {
			const styles = new Map(
				feedback.styleOverrides.map((style) => [`${style.elementId}:${style.elementProperty}`, style.override.value]),
			)
			assert.equal(styles.get('box0:color'), 0x00cc44)
			assert.equal(styles.get('text0:color'), 0x000000)
			assert.equal(styles.get('box0:borderColor'), 0xffffff)
			assert.equal(styles.get('box0:borderWidth'), 4)
		}
	})
}
