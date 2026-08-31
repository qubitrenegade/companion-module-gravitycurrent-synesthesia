import assert from 'node:assert/strict'
import test from 'node:test'
import ModuleInstance from '../dist/main.js'
import { SynesthesiaState } from '../dist/state.js'

function makeSurface() {
	const instance = Object.create(ModuleInstance.prototype)
	const sent = []
	let variables = {}
	Object.assign(instance, {
		config: {
			feedbackValueMode: 'normalized',
			mediaSourceNames: 'Camera A\nNDI Feed',
			presetNames: '',
			presetCatalog: '{}',
		},
		state: new SynesthesiaState(() => {}, 5000),
		surfaceMode: 'scene',
		surfacePage: 0,
		mediaSourceView: false,
		surfaceComponents: new Map(),
		surfaceLocks: new Map(),
		playlistPlaying: false,
		renderEnabled: true,
		selectedMedia: '',
		presetCreated: false,
		sendOsc: (address, args = []) => sent.push({ address, args }),
		setVariableValues: (next) => (variables = { ...variables, ...next }),
		checkFeedbacks() {},
		saveConfig(next) {
			this.config = next
		},
	})
	return { instance, sent, variables: () => variables }
}

test('dynamic scene mode centers random and discrete controls while leaving empty slots blank', () => {
	const { instance, sent, variables } = makeSurface()
	instance.state.setControlName('toggle', 1, 'turbulence')
	instance.state.setControlValue('toggle', 1, { kind: 'toggle', value: false })
	instance.state.setControlName('bang', 1, 'new burst')
	instance.state.setControlName('slider', 1, 'fluid amount')
	instance.state.setControlValue('slider', 1, { kind: 'scalar', value: 0.25 })

	instance.setSurfaceMode('scene')
	assert.equal(variables().surface_button_1_label, 'RANDOM ALL')
	assert.equal(variables().surface_button_1_kind, 'bang')
	assert.equal(variables().surface_button_2_label, 'RANDOM SELECTED')
	assert.equal(variables().surface_button_11_label, 'TURBULENCE')
	assert.equal(variables().surface_button_11_kind, 'toggle')
	assert.equal(variables().surface_button_12_label, 'NEW BURST')
	assert.equal(variables().surface_button_12_kind, 'bang')
	assert.equal(variables().surface_button_10_label, '')
	assert.equal(variables().surface_button_13_label, '')
	assert.equal(variables().surface_rotary_1_label, 'FLUID AMOUNT')
	assert.equal(variables().surface_rotary_2_label, '')

	instance.triggerSurfaceButton(11, true)
	instance.triggerSurfaceButton(12, true)
	instance.triggerSurfaceButton(12, false)
	assert.deepEqual(sent, [
		{ address: '/controls/global/toggle/1', args: [{ type: 'f', value: 1 }] },
		{ address: '/controls/global/bang/1', args: [{ type: 'f', value: 1 }] },
		{ address: '/controls/global/bang/1', args: [{ type: 'f', value: 0 }] },
	])
	instance.state.destroy()
})

test('LCD touch cycles XY components while scalar touch toggles lock and dial press resets', () => {
	const { instance, sent, variables } = makeSurface()
	instance.state.setControlName('xy', 1, 'position')
	instance.state.setControlValue('xy', 1, { kind: 'xy', x: 0.2, y: 0.7 })
	instance.state.setControlName('slider', 1, 'amount')
	instance.state.setControlValue('slider', 1, { kind: 'scalar', value: 0.4 })
	instance.setSurfaceMode('scene')

	assert.equal(variables().surface_rotary_2_component, 'X')
	instance.touchSurfaceRotary(2)
	assert.equal(variables().surface_rotary_2_component, 'Y')
	instance.adjustSurfaceRotary(2, 0.05)
	instance.touchSurfaceRotary(1)
	instance.resetSurfaceRotary(1)

	assert.deepEqual(sent, [
		{ address: '/controls/global/xy/1/y', args: [{ type: 'f', value: 0.75 }] },
		{ address: '/controls/global/slider/1/lock', args: [{ type: 'f', value: 1 }] },
		{ address: '/controls/global/slider/1/default', args: [] },
	])
	instance.state.destroy()
})

test('LCD touch cycles a declared global color even before its first value packet arrives', () => {
	const { instance, sent, variables } = makeSurface()
	instance.state.setControlName('color', 1, 'glow color')
	instance.setSurfaceMode('scene')

	assert.equal(variables().surface_rotary_1_component, 'R')
	instance.touchSurfaceRotary(1)
	assert.equal(variables().surface_rotary_1_component, 'G')
	assert.equal(variables().surface_rotary_1_locked, 0)
	assert.deepEqual(sent, [])
	instance.state.destroy()
})

test('RGB feedback provides the starting component for relative adjustment', () => {
	const { instance, sent, variables } = makeSurface()
	instance.state.setControlName('color', 1, 'glow color')
	instance.state.setControlValue('color', 1, { kind: 'color', r: 0.2, g: 0.4, b: 0.6 })
	instance.setSurfaceMode('scene')
	instance.touchSurfaceRotary(1)
	assert.equal(variables().surface_rotary_1_component, 'G')
	instance.adjustSurfaceRotary(1, 0.05)
	assert.deepEqual(sent, [{ address: '/controls/global/color/1/g', args: [{ type: 'f', value: 0.45 }] }])
	instance.state.destroy()
})

test('random all targets both banks while random selected targets only the active bank', () => {
	const { instance, sent, variables } = makeSurface()
	instance.setSurfaceMode('scene')
	instance.triggerSurfaceButton(1, true)
	instance.triggerSurfaceButton(2, true)
	instance.setSurfaceMode('meta')
	assert.equal(variables().surface_button_1_label, 'RANDOM ALL')
	assert.equal(variables().surface_button_2_label, 'RANDOM SELECTED')
	assert.equal(variables().surface_button_3_label, 'COLOR\nUNLOCKED')
	instance.triggerSurfaceButton(2, true)
	assert.deepEqual(sent, [
		{ address: '/controls/banks/scene/random', args: [] },
		{ address: '/controls/banks/meta/random', args: [] },
		{ address: '/controls/banks/scene/random', args: [] },
		{ address: '/controls/banks/meta/random', args: [] },
	])
	instance.state.destroy()
})

test('pressing Media again switches between media controls and configured sources', () => {
	const { instance, sent, variables } = makeSurface()
	instance.setSurfaceMode('media')
	assert.equal(variables().surface_button_1_label, 'SOURCE\nPREVIOUS')
	assert.equal(variables().surface_button_2_label, 'SOURCE\nNEXT')
	assert.equal(variables().surface_button_1_kind, 'navigation')
	assert.equal(variables().surface_button_3_label, '')
	assert.equal(variables().surface_button_10_label, 'INVERT MEDIA')
	assert.equal(variables().surface_rotary_1_label, 'MEDIA CONTRAST')
	assert.equal(variables().surface_view, 'CONTROLS')

	instance.setSurfaceMode('media')
	assert.equal(variables().surface_view, 'SOURCES')
	assert.equal(variables().surface_media_sources, 1)
	assert.equal(variables().surface_button_1_label, 'SOURCE\nPREVIOUS')
	assert.equal(variables().surface_button_2_label, 'SOURCE\nNEXT')
	assert.ok(
		Array.from({ length: 16 }, (_, index) => variables()[`surface_button_${index + 1}_label`]).includes('CAMERA A'),
	)
	assert.equal(variables().surface_rotary_1_label, '')
	const cameraSlot = Array.from({ length: 16 }, (_, index) => index + 1).find(
		(slot) => variables()[`surface_button_${slot}_label`] === 'CAMERA A',
	)
	assert.ok(cameraSlot)
	instance.triggerSurfaceButton(cameraSlot, true)

	instance.setSurfaceMode('media')
	assert.equal(variables().surface_view, 'CONTROLS')
	assert.equal(variables().surface_media_sources, 0)
	assert.equal(variables().surface_button_10_label, 'INVERT MEDIA')
	assert.equal(variables().surface_rotary_1_label, 'MEDIA CONTRAST')

	instance.setSurfaceMode('favs')
	assert.equal(variables().surface_page_count, 2)
	assert.equal(variables().surface_button_8_label, 'FAV 1')
	assert.equal(variables().surface_button_16_label, 'FAV 9')
	instance.changeSurfacePage('next')
	assert.equal(variables().surface_button_8_label, 'FAV 2')
	assert.equal(variables().surface_button_16_label, 'FAV 10')
	instance.triggerSurfaceButton(16, true)

	assert.deepEqual(sent, [
		{ address: '/media/name', args: [{ type: 's', value: 'Camera A' }] },
		{ address: '/favslots/10', args: [] },
	])
	instance.state.destroy()
})

test('meta mode classifies native toggles and colors instead of assigning toggles to rotaries', () => {
	const { instance, variables } = makeSurface()
	instance.state.setMetaControlValue('vertmirror', { kind: 'scalar', value: 0 })
	instance.state.setMetaControlValue('lowcolor', { kind: 'color', r: 0.1, g: 0.2, b: 0.3 })
	instance.setSurfaceMode('meta')

	const buttonLabels = Array.from({ length: 16 }, (_, index) => variables()[`surface_button_${index + 1}_label`])
	assert.ok(buttonLabels.includes('VERT MIRROR'))
	assert.ok(buttonLabels.includes('COLOR\nUNLOCKED'))
	assert.ok(!buttonLabels.some((label) => label?.startsWith('TRANSFORM\n')))
	assert.ok(
		!Array.from({ length: 6 }, (_, index) => variables()[`surface_rotary_${index + 1}_label`]).includes('VERT MIRROR'),
	)

	while (
		!Array.from({ length: 6 }, (_, index) => variables()[`surface_rotary_${index + 1}_label`]).includes('LOW COLOR')
	) {
		instance.changeSurfacePage('next')
	}
	const lowColorSlot = Array.from({ length: 6 }, (_, index) => index + 1).find(
		(slot) => variables()[`surface_rotary_${slot}_label`] === 'LOW COLOR',
	)
	assert.ok(lowColorSlot)
	instance.touchSurfaceRotary(lowColorSlot)
	assert.equal(variables()[`surface_rotary_${lowColorSlot}_component`], 'G')
	instance.state.destroy()
})

test('rotary paging keeps a single page of scene toggles visible', () => {
	const { instance, variables } = makeSurface()
	instance.state.setControlName('toggle', 1, 'zero feedback')
	instance.state.setControlValue('toggle', 1, { kind: 'toggle', value: true })
	for (let position = 1; position <= 13; position++) {
		instance.state.setControlName('slider', position, `slider ${position}`)
		instance.state.setControlValue('slider', position, { kind: 'scalar', value: position / 20 })
	}
	instance.setSurfaceMode('scene')
	assert.equal(variables().surface_page_count, 3)
	assert.equal(variables().surface_button_1_label, 'RANDOM ALL')
	assert.equal(variables().surface_button_2_label, 'RANDOM SELECTED')
	assert.equal(variables().surface_button_12_label, 'ZERO FEEDBACK')
	instance.changeSurfacePage('next')
	assert.equal(variables().surface_rotary_1_label, 'SLIDER 7')
	assert.equal(variables().surface_button_1_label, 'RANDOM ALL')
	assert.equal(variables().surface_button_12_label, 'ZERO FEEDBACK')
	instance.changeSurfacePage('next')
	assert.equal(variables().surface_rotary_1_label, 'SLIDER 13')
	assert.equal(variables().surface_button_12_label, 'ZERO FEEDBACK')
	instance.state.destroy()
})

test('button paging changes only when discrete controls need another page', () => {
	const { instance, variables } = makeSurface()
	for (let position = 1; position <= 16; position++) {
		instance.state.setControlName('toggle', position, `toggle ${position}`)
		instance.state.setControlValue('toggle', position, { kind: 'toggle', value: false })
	}
	instance.setSurfaceMode('scene')
	assert.equal(variables().surface_page_count, 2)
	assert.equal(variables().surface_button_8_label, 'TOGGLE 1')
	assert.equal(variables().surface_button_16_label, 'TOGGLE 9')
	instance.changeSurfacePage('next')
	assert.equal(variables().surface_button_1_label, 'RANDOM ALL')
	assert.equal(variables().surface_button_9_label, 'TOGGLE 10')
	assert.equal(variables().surface_button_15_label, 'TOGGLE 16')
	instance.state.destroy()
})

test('five scene buttons occupy the centered row-three positions', () => {
	const { instance, variables } = makeSurface()
	for (let position = 1; position <= 5; position++) {
		instance.state.setControlName('toggle', position, `toggle ${position}`)
		instance.state.setControlValue('toggle', position, { kind: 'toggle', value: false })
	}
	instance.setSurfaceMode('scene')
	assert.deepEqual(
		Array.from({ length: 9 }, (_, index) => variables()[`surface_button_${index + 8}_label`]),
		['', '', 'TOGGLE 1', 'TOGGLE 2', 'TOGGLE 3', 'TOGGLE 4', 'TOGGLE 5', '', ''],
	)
	instance.state.destroy()
})

test('global default and undo operate on both scene and meta banks', () => {
	const { instance, sent } = makeSurface()
	instance.allBankOperation('default')
	instance.allBankOperation('undo')
	assert.deepEqual(sent, [
		{ address: '/controls/banks/scene/default', args: [] },
		{ address: '/controls/banks/meta/default', args: [] },
		{ address: '/controls/banks/scene/undo', args: [] },
		{ address: '/controls/banks/meta/undo', args: [] },
	])
	instance.state.destroy()
})

test('preset navigation persists Companion-created names per current scene', () => {
	const { instance } = makeSurface()
	instance.state.currentScene = 'fluidbody'
	instance.rememberPreset('26-08-30 01:02:03 - Companion')
	assert.deepEqual(JSON.parse(instance.config.presetCatalog), {
		fluidbody: ['26-08-30 01:02:03 - Companion'],
	})
	assert.equal(instance.cycleConfiguredPreset('next'), 'default')
	assert.equal(instance.cycleConfiguredPreset('next'), '26-08-30 01:02:03 - Companion')
	instance.state.currentScene = 'dispersion'
	assert.equal(instance.cycleConfiguredPreset('next'), 'default')
	instance.state.destroy()
})
