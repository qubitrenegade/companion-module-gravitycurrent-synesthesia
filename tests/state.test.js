import assert from 'node:assert/strict'
import test from 'node:test'
import { InboundOscProcessor } from '../dist/osc.js'
import { SynesthesiaState } from '../dist/state.js'

class FakeScheduler {
	nowValue = 0
	nextId = 1
	timers = new Map()

	now = () => this.nowValue
	setTimeout = (callback, delay) => {
		const id = this.nextId++
		this.timers.set(id, { callback, due: this.nowValue + delay })
		return id
	}
	clearTimeout = (id) => this.timers.delete(id)

	advance(ms) {
		const target = this.nowValue + ms
		while (true) {
			const next = [...this.timers.entries()].sort((left, right) => left[1].due - right[1].due)[0]
			if (!next || next[1].due > target) break
			this.nowValue = next[1].due
			this.timers.delete(next[0])
			next[1].callback()
		}
		this.nowValue = target
	}
}

function setup(mode = 'normalized') {
	const scheduler = new FakeScheduler()
	const changes = []
	const debug = []
	const state = new SynesthesiaState((change) => changes.push(change), 500, scheduler, 40)
	const processor = new InboundOscProcessor(state, mode, (message) => debug.push(message), scheduler.now)
	return { scheduler, changes, debug, state, processor }
}

test('parses scene launch and global name messages, including empty-name clearing', () => {
	const { scheduler, changes, state, processor } = setup()
	assert.equal(processor.process({ address: '/scenes/hexarray', args: [] }), true)
	assert.equal(
		processor.process({ address: '/controls/global/slider/1/name', args: [{ type: 's', value: 'separation' }] }),
		true,
	)
	scheduler.advance(40)

	assert.equal(state.currentScene, 'hexarray')
	assert.equal(state.controls.get('slider:1').name, 'separation')
	assert.equal(changes.length, 1)
	assert.equal(changes[0].variables.current_scene, 'hexarray')
	assert.equal(changes[0].variables.osc_last_address, '/controls/global/slider/1/name')
	assert.equal(changes[0].variables.osc_messages_received, 2)
	assert.equal(changes[0].variables.global_slider_1_name, 'separation')
	assert.equal(changes[0].variables.global_slider_1_label, 'SEPARATION')

	processor.process({ address: '/controls/global/slider/1', args: [0.75] })
	processor.process({ address: '/controls/global/slider/1/name', args: [''] })
	scheduler.advance(40)
	assert.equal(changes[1].variables.global_slider_1_name, '')
	assert.equal(changes[1].variables.global_slider_1_value, '')
	assert.equal(state.getNumericValue('slider', 1), undefined)
})

test('parses normalized scalar, toggle, XY, and color values with stable component variables', () => {
	const { scheduler, changes, state, processor } = setup()
	processor.process({ address: '/controls/global/slider/1', args: [{ type: 'f', value: 0.25 }] })
	processor.process({ address: '/controls/global/toggle/2', args: [1] })
	processor.process({ address: '/controls/global/xy/3', args: [0.1, 0.9] })
	processor.process({ address: '/controls/global/color/4', args: [0.2, 0.4, 0.6] })
	scheduler.advance(40)

	assert.equal(changes.length, 1)
	assert.equal(changes[0].variables.global_slider_1_value, '0.25')
	assert.equal(changes[0].variables.global_toggle_2_value, 1)
	assert.equal(changes[0].variables.global_xy_3_value, '0.1, 0.9')
	assert.equal(changes[0].variables.global_xy_3_x, '0.1')
	assert.equal(changes[0].variables.global_color_4_value, '0.2, 0.4, 0.6')
	assert.equal(changes[0].variables.global_color_4_g, '0.4')
	assert.equal(state.getNumericValue('color', 4, 'b'), 0.6)
})

test('merges component-addressed XY and RGB output used by multidimensional controls', () => {
	const { scheduler, changes, state, processor } = setup()
	processor.process({ address: '/controls/global/xy/3/x', args: [0.1] })
	processor.process({ address: '/controls/global/xy/3/y', args: [0.9] })
	processor.process({ address: '/controls/global/color/4/r', args: [0.2] })
	processor.process({ address: '/controls/global/color/4/g', args: [0.4] })
	processor.process({ address: '/controls/global/color/4/b', args: [0.6] })
	processor.process({ address: '/controls/meta/high_color/r', args: [0.3] })
	processor.process({ address: '/controls/meta/high_color/g', args: [0.5] })
	processor.process({ address: '/controls/meta/high_color/b', args: [0.7] })
	scheduler.advance(40)

	assert.equal(state.getNumericValue('xy', 3, 'x'), 0.1)
	assert.equal(state.getNumericValue('xy', 3, 'y'), 0.9)
	assert.equal(state.getNumericValue('color', 4, 'r'), 0.2)
	assert.equal(state.getNumericValue('color', 4, 'g'), 0.4)
	assert.equal(state.getNumericValue('color', 4, 'b'), 0.6)
	assert.equal(state.getMetaNumericValue('high_color', 'r'), 0.3)
	assert.equal(state.getMetaNumericValue('high_color', 'g'), 0.5)
	assert.equal(state.getMetaNumericValue('high_color', 'b'), 0.7)
	assert.equal(changes.at(-1).variables.global_color_4_value, '0.2, 0.4, 0.6')
})

test('honors normalized versus raw expectations', () => {
	const normalized = setup('normalized')
	assert.equal(normalized.processor.process({ address: '/controls/global/slider/1/raw', args: [5] }), false)
	assert.equal(normalized.processor.process({ address: '/controls/global/slider/1', args: [0.5] }), true)

	const raw = setup('raw')
	assert.equal(raw.processor.process({ address: '/controls/global/slider/1', args: [0.5] }), false)
	assert.equal(raw.processor.process({ address: '/controls/global/slider/1/raw', args: [5] }), true)
})

test('accepts mismatched raw 0-to-1 toggle and color feedback but not unknown-range sliders', () => {
	const { state, processor } = setup('normalized')
	assert.equal(processor.process({ address: '/controls/global/toggle/1/raw', args: [1] }), true)
	assert.equal(processor.process({ address: '/controls/global/color/1/raw', args: [0.1, 0.2, 0.3] }), true)
	assert.equal(processor.process({ address: '/controls/global/color/2/raw', args: [255, 128, 0] }), false)
	assert.equal(processor.process({ address: '/controls/meta/lowcolor/raw', args: [0.2, 0.3, 0.4] }), true)
	assert.equal(processor.process({ address: '/controls/meta/brightness/raw', args: [0.4] }), false)
	assert.equal(state.getNumericValue('toggle', 1), 1)
	assert.equal(state.getNumericValue('color', 1, 'g'), 0.2)
	assert.equal(state.getMetaNumericValue('lowcolor', 'b'), 0.4)
	assert.equal(state.feedbackModeMismatch, true)
})

test('parses fixed normalized meta scalar output for rotary state', () => {
	const { scheduler, changes, state, processor } = setup()
	assert.equal(processor.process({ address: '/controls/meta/brightness', args: [0.65] }), true)
	scheduler.advance(40)
	assert.equal(state.getMetaScalarValue('brightness'), 0.65)
	assert.equal(changes[0].variables.meta_brightness_value, '0.65')
})

test('classifies the stable native meta toggle schema and reports feedback mode mismatches', () => {
	const { scheduler, changes, state, processor } = setup('normalized')
	assert.equal(processor.process({ address: '/controls/meta/vertmirror', args: [1] }), true)
	assert.equal(state.getMetaControlValue('vertmirror').kind, 'toggle')
	assert.equal(state.getMetaNumericValue('vertmirror'), 1)
	assert.equal(processor.process({ address: '/controls/meta/brightness/raw', args: [0.4] }), false)
	scheduler.advance(40)
	assert.equal(changes.at(-1).variables.feedback_detected_mode, 'raw')
	assert.equal(changes.at(-1).variables.feedback_mode_mismatch, 1)
})

test('discovers multidimensional meta output for dynamic component control', () => {
	const { scheduler, state, processor } = setup()
	assert.equal(processor.process({ address: '/controls/meta/high_color', args: [0.1, 0.2, 0.3] }), true)
	scheduler.advance(40)
	assert.equal(state.getMetaNumericValue('high_color', 'g'), 0.2)
	state.setMetaNumericComponent('high_color', 'b', 0.8)
	assert.equal(state.getMetaNumericValue('high_color', 'b'), 0.8)
})

test('coalesces state bursts and refreshes feedbacks only for affected state', () => {
	const { scheduler, changes, processor } = setup()
	for (let position = 1; position <= 16; position++) {
		processor.process({ address: `/controls/global/slider/${position}/name`, args: [`slider ${position}`] })
	}
	assert.equal(changes.length, 0)
	scheduler.advance(40)
	assert.equal(changes.length, 1)
	assert.equal(Object.keys(changes[0].variables).length, 38)
	assert.deepEqual(changes[0].feedbacks, ['feedback_fresh'])
})

test('freshness changes at the configured deadline without polling feedback callbacks', () => {
	const { scheduler, changes, state, processor } = setup()
	processor.process({ address: '/scenes/testscene', args: [] })
	scheduler.advance(40)
	assert.equal(state.isFeedbackFresh(), true)
	assert.equal(changes[0].variables.feedback_fresh, 1)

	scheduler.advance(460)
	assert.equal(state.isFeedbackFresh(), false)
	scheduler.advance(40)
	assert.equal(changes[1].variables.feedback_fresh, 0)
	assert.deepEqual(changes[1].feedbacks, ['feedback_fresh'])
})

test('malformed and unknown messages are ignored and repeated diagnostics are rate limited', () => {
	const { debug, processor } = setup()
	assert.equal(processor.process({ address: 'not-an-osc-path', args: [] }), false)
	assert.equal(processor.process({ address: '/controls/global/xy/1', args: [0.5] }), false)
	assert.equal(processor.process({ address: '/controls/global/slider/1', args: ['wrong', 0.5] }), false)
	assert.equal(processor.process({ address: '/audio/bass', args: [0.5] }), false)
	assert.equal(processor.process({ address: '/audio/bass', args: [0.6] }), false)
	assert.equal(debug.length, 4)
})
