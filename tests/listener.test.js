import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { FeedbackListener, flattenBundle, normalizeIncomingMessage } from '../dist/osc.js'

class FakeServer extends EventEmitter {
	closeCount = 0
	async close() {
		this.closeCount++
	}
}

test('config-style listener restarts close the previous socket and teardown closes the current socket', async () => {
	const servers = []
	const listener = new FeedbackListener(() => {
		const server = new FakeServer()
		servers.push(server)
		return server
	})
	const callbacks = { onListening() {}, onMessage() {}, onError() {}, onClose() {} }

	await listener.start(9001, '127.0.0.1', callbacks)
	await listener.start(9011, '0.0.0.0', callbacks)
	assert.equal(servers[0].closeCount, 1)
	assert.equal(servers[1].closeCount, 0)

	await listener.stop()
	assert.equal(servers[1].closeCount, 1)
})

test('normalizes messages and recursively flattens bundles without trusting malformed shapes', () => {
	assert.deepEqual(normalizeIncomingMessage(['/scenes/test', 1]), { address: '/scenes/test', args: [1] })
	assert.equal(normalizeIncomingMessage([42, 'bad']), undefined)
	assert.deepEqual(flattenBundle({ elements: [['/one', 1], { elements: [['/two', 2]] }, { invalid: true }] }), [
		{ address: '/one', args: [1] },
		{ address: '/two', args: [2] },
	])
})
