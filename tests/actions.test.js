import assert from 'node:assert/strict'
import test from 'node:test'
import { GetActionDefinitions } from '../dist/actions.js'

function makeInstance() {
	const sent = []
	const surfaceCalls = []
	const bankLocks = { scene: false, meta: false }
	return {
		sent,
		config: { feedbackValueMode: 'normalized', mediaSourceNames: '', presetNames: '' },
		state: {
			getNumericValue: () => 0.5,
			setControlValue() {},
			getMetaScalarValue: () => 0.5,
			setMetaScalarValue() {},
			isBankLocked: (bank) => bankLocks[bank],
			setBankLocked: (bank, locked) => (bankLocks[bank] = locked),
		},
		cycleConfiguredMedia: () => 'Camera A',
		cycleConfiguredPreset: () => 'Preset A',
		generatePresetName: () => 'Companion Test Preset',
		rememberPreset() {},
		markPresetCreated: () => surfaceCalls.push(['preset-created']),
		setSurfaceMode: (mode) => surfaceCalls.push(['mode', mode]),
		changeSurfacePage: (direction) => surfaceCalls.push(['page', direction]),
		triggerSurfaceButton: (slot, pressed) => surfaceCalls.push(['button', slot, pressed]),
		adjustSurfaceRotary: (slot, delta) => surfaceCalls.push(['adjust', slot, delta]),
		resetSurfaceRotary: (slot) => surfaceCalls.push(['reset', slot]),
		touchSurfaceRotary: (slot) => surfaceCalls.push(['touch', slot]),
		activeBankOperation: (operation) => surfaceCalls.push(['bank', operation]),
		togglePlaylistPlaying: () => surfaceCalls.push(['playlist-toggle']),
		toggleRendering: () => surfaceCalls.push(['render-toggle']),
		clearPresetCreated: () => surfaceCalls.push(['preset-clear']),
		surfaceCalls,
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
	await run(actions.render_enabled, { enabled: false })

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
		{ address: '/render/enabled', args: [{ type: 'i', value: 0 }] },
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

test('relative rotary action accepts cached values after traffic becomes quiet and rejects raw mode', async () => {
	const instance = makeInstance()
	const actions = GetActionDefinitions(instance)
	await run(actions.adjust_global_scalar, { type: 'slider', position: '1', delta: '0.05' })

	instance.config.feedbackValueMode = 'raw'
	await assert.rejects(
		() => run(actions.adjust_global_scalar, { type: 'slider', position: '1', delta: '0.05' }),
		/requires normalized/,
	)
	assert.equal(instance.sent.length, 1)
})

test('global toggle action inverts the last fresh normalized value', async () => {
	const instance = makeInstance()
	const actions = GetActionDefinitions(instance)
	instance.state.getNumericValue = () => 0

	await run(actions.toggle_global_toggle, { position: '4' })
	assert.deepEqual(instance.sent, [{ address: '/controls/global/toggle/4', args: [{ type: 'f', value: 1 }] }])
})

test('meta rotary, bank lock toggle, and configured media cycling use their dedicated state boundaries', async () => {
	const instance = makeInstance()
	const actions = GetActionDefinitions(instance)

	await run(actions.adjust_meta_scalar, { name: 'brightness', delta: '-0.1' })
	await run(actions.toggle_bank_lock, { bank: 'scene' })
	await run(actions.cycle_configured_media, { direction: 'next' })
	await run(actions.cycle_configured_preset, { direction: 'next', channel: 'all' })

	assert.deepEqual(instance.sent, [
		{ address: '/controls/meta/brightness', args: [{ type: 'f', value: 0.4 }] },
		{ address: '/controls/banks/scene/lock', args: [{ type: 'f', value: 1 }] },
		{ address: '/media/name', args: [{ type: 's', value: 'Camera A' }] },
		{ address: '/presets', args: [{ type: 's', value: 'Preset A' }] },
	])
})

test('toggles and rotaries use safe local starting values when OSC output has not supplied state', async () => {
	const instance = makeInstance()
	instance.state.getNumericValue = () => undefined
	instance.state.getMetaScalarValue = () => undefined
	const actions = GetActionDefinitions(instance)

	await run(actions.toggle_global_toggle, { position: '1' })
	await run(actions.adjust_global_scalar, { type: 'slider', position: '1', delta: '0.05' })
	await run(actions.adjust_meta_scalar, { name: 'brightness', delta: '-0.05' })

	assert.deepEqual(instance.sent, [
		{ address: '/controls/global/toggle/1', args: [{ type: 'f', value: 1 }] },
		{ address: '/controls/global/slider/1', args: [{ type: 'f', value: 0.55 }] },
		{ address: '/controls/meta/brightness', args: [{ type: 'f', value: 0.45 }] },
	])
})

test('dynamic surface actions delegate mode, paging, button, rotary, and transport interactions', async () => {
	const instance = makeInstance()
	const actions = GetActionDefinitions(instance)

	await run(actions.surface_set_mode, { mode: 'favs' })
	await run(actions.surface_change_page, { direction: 'next' })
	await run(actions.surface_button, { slot: '4', pressed: true })
	await run(actions.surface_adjust_rotary, { slot: '2', delta: '-0.05' })
	await run(actions.surface_reset_rotary, { slot: '2' })
	await run(actions.surface_touch_rotary, { slot: '2' })
	await run(actions.surface_active_bank_operation, { operation: 'default' })
	await run(actions.surface_toggle_playlist, {})
	await run(actions.surface_toggle_render, {})
	await run(actions.preset_clear_created, {})

	assert.deepEqual(instance.surfaceCalls, [
		['mode', 'favs'],
		['page', 'next'],
		['button', 4, true],
		['adjust', 2, -0.05],
		['reset', 2],
		['touch', 2],
		['bank', 'default'],
		['playlist-toggle'],
		['render-toggle'],
		['preset-clear'],
	])
})

test('configured preset cycling treats default as the scene default operation', async () => {
	const instance = makeInstance()
	instance.cycleConfiguredPreset = () => 'default'
	const actions = GetActionDefinitions(instance)

	await run(actions.cycle_configured_preset, { direction: 'next', channel: 'all' })
	assert.deepEqual(instance.sent, [{ address: '/controls/banks/scene/default', args: [] }])
})
