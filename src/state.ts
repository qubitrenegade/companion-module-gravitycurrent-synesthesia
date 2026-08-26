import type { CompanionVariableValue } from '@companion-module/base'
import type { FeedbackValueMode } from './config.js'

export const GLOBAL_CONTROL_TYPES = ['slider', 'knob', 'toggle', 'bang', 'xy', 'color', 'dropdown'] as const
export type GlobalControlType = (typeof GLOBAL_CONTROL_TYPES)[number]
export const GLOBAL_CONTROL_POSITIONS = 16

export type GlobalControlValue =
	| { kind: 'scalar'; value: number }
	| { kind: 'toggle'; value: boolean }
	| { kind: 'bang'; value: boolean }
	| { kind: 'xy'; x: number; y: number }
	| { kind: 'color'; r: number; g: number; b: number }
	| { kind: 'dropdown'; value: number }

export type GlobalControlState = {
	name: string
	value?: GlobalControlValue
}

export type FeedbackId = 'current_scene' | 'global_toggle' | 'global_value' | 'feedback_fresh' | 'listener_ready'

export type StateChange = {
	variables: Record<string, CompanionVariableValue>
	feedbacks: FeedbackId[]
}

export type Scheduler = {
	setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>
	clearTimeout(timer: ReturnType<typeof setTimeout>): void
	now(): number
}

const systemScheduler: Scheduler = {
	setTimeout,
	clearTimeout,
	now: Date.now,
}

export class SynesthesiaState {
	readonly controls = new Map<string, GlobalControlState>()
	currentScene = ''
	lastSceneReceivedAt = ''
	lastFeedbackAt?: number
	listenerReady = false

	private pendingVariables: Record<string, CompanionVariableValue> = {}
	private pendingFeedbacks = new Set<FeedbackId>()
	private flushTimer?: ReturnType<typeof setTimeout>
	private freshnessTimer?: ReturnType<typeof setTimeout>
	private fresh = false

	constructor(
		private readonly onChange: (change: StateChange) => void,
		private freshnessTimeoutMs: number,
		private readonly scheduler: Scheduler = systemScheduler,
		private readonly coalesceMs = 40,
	) {
		for (const type of GLOBAL_CONTROL_TYPES) {
			for (let position = 1; position <= GLOBAL_CONTROL_POSITIONS; position++) {
				this.controls.set(controlKey(type, position), { name: '' })
			}
		}
	}

	setFreshnessTimeout(timeoutMs: number): void {
		this.freshnessTimeoutMs = timeoutMs
		if (this.fresh) this.scheduleFreshnessExpiry()
	}

	setListenerReady(ready: boolean): void {
		if (this.listenerReady === ready) return
		this.listenerReady = ready
		this.queue({ socket_listening: ready ? 1 : 0 }, ['listener_ready'])
	}

	markSupportedFeedbackReceived(): void {
		const now = this.scheduler.now()
		this.lastFeedbackAt = now
		const becameFresh = !this.fresh
		this.fresh = true
		this.queue(
			{
				feedback_fresh: 1,
				feedback_last_received_at: new Date(now).toISOString(),
				feedback_age_ms: 0,
			},
			becameFresh ? ['feedback_fresh'] : [],
		)
		this.scheduleFreshnessExpiry()
	}

	isFeedbackFresh(): boolean {
		return this.fresh
	}

	setScene(name: string): void {
		if (name === this.currentScene) return
		this.currentScene = name
		this.lastSceneReceivedAt = new Date(this.scheduler.now()).toISOString()
		this.queue({ current_scene: name, last_scene_received_at: this.lastSceneReceivedAt }, ['current_scene'])
	}

	setControlName(type: GlobalControlType, position: number, name: string): void {
		const control = this.controls.get(controlKey(type, position))
		if (!control || (control.name === name && !(name === '' && control.value))) return
		control.name = name
		const variables: Record<string, CompanionVariableValue> = { [variableId(type, position, 'name')]: name }
		const feedbacks: FeedbackId[] = []
		if (name === '' && control.value) {
			control.value = undefined
			Object.assign(variables, clearControlValueVariables(type, position))
			feedbacks.push('global_value')
			if (type === 'toggle') feedbacks.push('global_toggle')
		}
		this.queue(variables, feedbacks)
	}

	setControlValue(type: GlobalControlType, position: number, value: GlobalControlValue): void {
		const control = this.controls.get(controlKey(type, position))
		if (!control || sameValue(control.value, value)) return
		control.value = value
		const feedbacks: FeedbackId[] = ['global_value']
		if (type === 'toggle') feedbacks.push('global_toggle')
		this.queue(formatControlVariables(type, position, value), feedbacks)
	}

	getNumericValue(type: GlobalControlType, position: number, component = 'value'): number | undefined {
		const value = this.controls.get(controlKey(type, position))?.value
		if (!value) return undefined
		switch (value.kind) {
			case 'scalar':
			case 'dropdown':
				return value.value
			case 'toggle':
			case 'bang':
				return value.value ? 1 : 0
			case 'xy':
				return component === 'y' ? value.y : value.x
			case 'color':
				return component === 'g' ? value.g : component === 'b' ? value.b : value.r
		}
	}

	getInitialVariableValues(): Record<string, CompanionVariableValue> {
		const values: Record<string, CompanionVariableValue> = {
			current_scene: this.currentScene,
			last_scene_received_at: this.lastSceneReceivedAt,
			feedback_last_received_at: '',
			feedback_age_ms: '',
			feedback_fresh: 0,
			socket_listening: this.listenerReady ? 1 : 0,
		}
		for (const type of GLOBAL_CONTROL_TYPES) {
			for (let position = 1; position <= GLOBAL_CONTROL_POSITIONS; position++) {
				values[variableId(type, position, 'name')] = ''
				values[variableId(type, position, 'value')] = ''
				if (type === 'xy') {
					values[variableId(type, position, 'x')] = ''
					values[variableId(type, position, 'y')] = ''
				} else if (type === 'color') {
					values[variableId(type, position, 'r')] = ''
					values[variableId(type, position, 'g')] = ''
					values[variableId(type, position, 'b')] = ''
				}
			}
		}
		return values
	}

	destroy(): void {
		if (this.flushTimer) this.scheduler.clearTimeout(this.flushTimer)
		if (this.freshnessTimer) this.scheduler.clearTimeout(this.freshnessTimer)
		this.flushTimer = undefined
		this.freshnessTimer = undefined
		this.pendingVariables = {}
		this.pendingFeedbacks.clear()
	}

	private queue(variables: Record<string, CompanionVariableValue>, feedbacks: FeedbackId[]): void {
		Object.assign(this.pendingVariables, variables)
		for (const feedback of feedbacks) this.pendingFeedbacks.add(feedback)
		if (this.flushTimer) return

		/*
		 * Synesthesia can emit every active control in one UDP burst after a scene
		 * launch. One short module-level window turns that burst into one Companion
		 * variable update and one feedback pass, preventing packet rate from becoming
		 * UI update rate. Individual feedback callbacks never poll or schedule work.
		 */
		this.flushTimer = this.scheduler.setTimeout(() => this.flush(), this.coalesceMs)
	}

	private flush(): void {
		this.flushTimer = undefined
		const change: StateChange = {
			variables: this.pendingVariables,
			feedbacks: [...this.pendingFeedbacks],
		}
		this.pendingVariables = {}
		this.pendingFeedbacks.clear()
		if (Object.keys(change.variables).length || change.feedbacks.length) this.onChange(change)
	}

	private scheduleFreshnessExpiry(): void {
		if (this.freshnessTimer) this.scheduler.clearTimeout(this.freshnessTimer)
		/*
		 * UDP has no session to disconnect. Freshness is therefore a deadline derived
		 * from the last supported packet, not a socket state. Resetting one timer per
		 * packet makes the transition exact without a polling loop or per-feedback timer.
		 */
		this.freshnessTimer = this.scheduler.setTimeout(() => {
			this.freshnessTimer = undefined
			if (!this.fresh || this.lastFeedbackAt === undefined) return
			const age = this.scheduler.now() - this.lastFeedbackAt
			if (age < this.freshnessTimeoutMs) {
				this.scheduleFreshnessExpiry()
				return
			}
			this.fresh = false
			this.queue({ feedback_fresh: 0, feedback_age_ms: age }, ['feedback_fresh'])
		}, this.freshnessTimeoutMs)
	}
}

export function parseGlobalValue(type: GlobalControlType, args: unknown[]): GlobalControlValue | undefined {
	const numbers: number[] = []
	for (const arg of args) {
		const value = unwrapOscValue(arg)
		if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
		numbers.push(value)
	}
	switch (type) {
		case 'slider':
		case 'knob':
			return numbers.length >= 1 ? { kind: 'scalar', value: numbers[0] } : undefined
		case 'toggle':
			return numbers.length >= 1 ? { kind: 'toggle', value: numbers[0] !== 0 } : undefined
		case 'bang':
			return numbers.length >= 1 ? { kind: 'bang', value: numbers[0] !== 0 } : undefined
		case 'xy':
			return numbers.length >= 2 ? { kind: 'xy', x: numbers[0], y: numbers[1] } : undefined
		case 'color':
			return numbers.length >= 3 ? { kind: 'color', r: numbers[0], g: numbers[1], b: numbers[2] } : undefined
		case 'dropdown':
			return numbers.length >= 1 ? { kind: 'dropdown', value: numbers[0] } : undefined
	}
}

export function matchesConfiguredValuePath(path: string, mode: FeedbackValueMode): boolean {
	return mode === 'raw' ? path.endsWith('/raw') : !path.endsWith('/raw')
}

export function unwrapOscValue(value: unknown): unknown {
	if (value && typeof value === 'object' && 'value' in value) return value.value
	return value
}

export function controlKey(type: GlobalControlType, position: number): string {
	return `${type}:${position}`
}

export function variableId(type: GlobalControlType, position: number, suffix: string): string {
	return `global_${type}_${position}_${suffix}`
}

export function formatNumber(value: number): string {
	if (!Number.isFinite(value)) return ''
	return Number(value.toFixed(4)).toString()
}

function formatControlVariables(
	type: GlobalControlType,
	position: number,
	value: GlobalControlValue,
): Record<string, CompanionVariableValue> {
	const prefix = `global_${type}_${position}`
	switch (value.kind) {
		case 'scalar':
		case 'dropdown':
			return { [`${prefix}_value`]: formatNumber(value.value) }
		case 'toggle':
		case 'bang':
			return { [`${prefix}_value`]: value.value ? 1 : 0 }
		case 'xy': {
			const x = formatNumber(value.x)
			const y = formatNumber(value.y)
			return { [`${prefix}_value`]: `${x}, ${y}`, [`${prefix}_x`]: x, [`${prefix}_y`]: y }
		}
		case 'color': {
			const r = formatNumber(value.r)
			const g = formatNumber(value.g)
			const b = formatNumber(value.b)
			return {
				[`${prefix}_value`]: `${r}, ${g}, ${b}`,
				[`${prefix}_r`]: r,
				[`${prefix}_g`]: g,
				[`${prefix}_b`]: b,
			}
		}
	}
}

function clearControlValueVariables(type: GlobalControlType, position: number): Record<string, CompanionVariableValue> {
	const variables: Record<string, CompanionVariableValue> = { [variableId(type, position, 'value')]: '' }
	if (type === 'xy') {
		variables[variableId(type, position, 'x')] = ''
		variables[variableId(type, position, 'y')] = ''
	} else if (type === 'color') {
		variables[variableId(type, position, 'r')] = ''
		variables[variableId(type, position, 'g')] = ''
		variables[variableId(type, position, 'b')] = ''
	}
	return variables
}

function sameValue(left: GlobalControlValue | undefined, right: GlobalControlValue): boolean {
	return left !== undefined && JSON.stringify(left) === JSON.stringify(right)
}
