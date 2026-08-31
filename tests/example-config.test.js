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
	})
}
