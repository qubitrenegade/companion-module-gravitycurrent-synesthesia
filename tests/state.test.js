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
	assert.equal(changes[0].variables.global_slider_1_name, 'separation')

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

test('honors normalized versus raw expectations', () => {
	const normalized = setup('normalized')
	assert.equal(normalized.processor.process({ address: '/controls/global/slider/1/raw', args: [5] }), false)
	assert.equal(normalized.processor.process({ address: '/controls/global/slider/1', args: [0.5] }), true)

	const raw = setup('raw')
	assert.equal(raw.processor.process({ address: '/controls/global/slider/1', args: [0.5] }), false)
	assert.equal(raw.processor.process({ address: '/controls/global/slider/1/raw', args: [5] }), true)
})

test('coalesces state bursts and refreshes feedbacks only for affected state', () => {
	const { scheduler, changes, processor } = setup()
	for (let position = 1; position <= 16; position++) {
		processor.process({ address: `/controls/global/slider/${position}/name`, args: [`slider ${position}`] })
	}
	assert.equal(changes.length, 0)
	scheduler.advance(40)
	assert.equal(changes.length, 1)
	assert.equal(Object.keys(changes[0].variables).length, 19)
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
