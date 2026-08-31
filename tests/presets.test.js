import assert from 'node:assert/strict'
import test from 'node:test'
import { UpdatePresets } from '../dist/presets.js'

test('preset templates cover all documented global positions without duplicate definitions', () => {
	let captured
	UpdatePresets({
		setPresetDefinitions(structure, presets) {
			captured = { structure, presets }
		},
	})

	const globalSection = captured.structure.find((section) => section.id === 'global-controls')
	const sliderGroup = globalSection.definitions.find((group) => group.id === 'global-sliders')
	assert.equal(sliderGroup.type, 'template')
	assert.equal(sliderGroup.presetId, 'global_slider_rotary')
	assert.equal(sliderGroup.templateValues.length, 16)
	assert.deepEqual(sliderGroup.templateValues.at(-1), { name: 'Position 16', value: '16' })
	assert.equal(captured.presets.global_slider_rotary.localVariables[0].variableName, 'position')
})

test('preset catalog includes transport, bank safety, rendering, and state controls', () => {
	let captured
	UpdatePresets({
		setPresetDefinitions(structure, presets) {
			captured = { structure, presets }
		},
	})

	for (const id of [
		'playlist_play',
		'playlist_stop',
		'render_on',
		'render_off',
		'scene_undo',
		'scene_unlock',
		'meta_undo',
		'meta_unlock',
		'scene_lock_toggle',
		'meta_lock_toggle',
		'meta_brightness_rotary',
		'preset_previous_configured',
		'preset_next_configured',
		'osc_last_address',
		'listener_status',
		'feedback_status',
	]) {
		assert.ok(captured.presets[id], `missing preset ${id}`)
	}
	assert.deepEqual(captured.presets.create_preset.steps[0][1000].options, { runWhileHeld: true })
	assert.equal(captured.presets.global_bang.steps[0].down[0].options.values, '1')
	assert.equal(captured.presets.global_bang.steps[0].up[0].options.values, '0')
	for (let position = 1; position <= 10; position++) {
		assert.ok(captured.presets[`favslot_${position}`], `missing favslot ${position}`)
	}
})
