import assert from 'node:assert/strict'
import test from 'node:test'
import { GetActionDefinitions } from '../dist/actions.js'

function makeInstance() {
	const sent = []
	return {
		sent,
		state: { getNumericValue: () => 0.5 },
		sendOsc(address, args) {
			sent.push({ address, args })
		},
	}
}

async function run(definition, options) {
	await definition.callback({ options }, { type: 'action' })
}

test('representative actions send documented routes with explicit OSC argument types', async () => {
	const instance = makeInstance()
	const actions = GetActionDefinitions(instance)

	await run(actions.playlist_play, { shouldPlay: true })
	await run(actions.playlist_position, { position: '-2' })
	await run(actions.launch_scene, { scene: 'Hex Array', preset: 'hectic' })
	await run(actions.set_global_control, { type: 'xy', position: '1', values: '0.25, 0.75', raw: false })
	await run(actions.bank_operation, { bank: 'meta', operation: 'lock', locked: true })
	await run(actions.select_media, { mode: 'position', name: '', position: '3' })

	assert.deepEqual(instance.sent, [
		{ address: '/playlist/play', args: [{ type: 'i', value: 1 }] },
		{ address: '/playlist/position', args: [{ type: 'i', value: -2 }] },
		{ address: '/scenes/hexarray', args: [{ type: 's', value: 'hectic' }] },
		{
			address: '/controls/global/xy/1',
			args: [
				{ type: 'f', value: 0.25 },
				{ type: 'f', value: 0.75 },
			],
		},
		{ address: '/controls/banks/meta/lock', args: [{ type: 'f', value: 1 }] },
		{ address: '/media/position', args: [{ type: 'i', value: 3 }] },
	])
})

test('control action validates normalized values and multidimensional arity', async () => {
	const instance = makeInstance()
	const actions = GetActionDefinitions(instance)

	await assert.rejects(
		() => run(actions.set_scene_control, { name: 'xy1', values: '0.1 0.2 0.3 0.4', raw: false }),
		/one to three numbers/,
	)
	await assert.rejects(
		() => run(actions.set_meta_control, { name: 'brightness', values: '1.5', raw: false }),
		/between 0 and 1/,
	)
	assert.equal(instance.sent.length, 0)
})

test('relative rotary action uses the last inbound state and clamps normalized output', async () => {
	const instance = makeInstance()
	instance.state.getNumericValue = () => 0.98
	const actions = GetActionDefinitions(instance)

	await run(actions.adjust_global_scalar, { type: 'slider', position: '1', delta: '0.05' })
	assert.deepEqual(instance.sent, [{ address: '/controls/global/slider/1', args: [{ type: 'f', value: 1 }] }])
})
