import type { CompanionVariableValue } from '@companion-module/base'
import type { FeedbackValueMode } from './config.js'

export const GLOBAL_CONTROL_TYPES = ['slider', 'knob', 'toggle', 'bang', 'xy', 'color', 'dropdown'] as const
export type GlobalControlType = (typeof GLOBAL_CONTROL_TYPES)[number]
export const GLOBAL_CONTROL_POSITIONS = 16
export type MetaControlKind = 'scalar' | 'toggle' | 'bang' | 'color' | 'dropdown'
export type MetaControlDefinition = {
	name: string
	label: string
	kind: MetaControlKind
	group: 'master' | 'color' | 'transform' | 'audio' | 'media-color' | 'media-transform' | 'video'
}

/*
 * Meta controls are part of Synesthesia itself rather than an individual scene.
 * Unlike global scene controls, OSC output does not send type/name metadata for
 * them, so their stable schema has to be classified here. These identifiers and
 * types were observed in Synesthesia 1.25.4 and verified through OSC behavior;
 * unknown future identifiers still fall back to dimensional discovery.
 */
export const META_CONTROL_DEFINITIONS: readonly MetaControlDefinition[] = [
	{ name: 'master', label: 'MASTER', kind: 'scalar', group: 'master' },
	{ name: 'brightness', label: 'BRIGHTNESS', kind: 'scalar', group: 'color' },
	{ name: 'gamma', label: 'GAMMA', kind: 'scalar', group: 'color' },
	{ name: 'contrast', label: 'CONTRAST', kind: 'scalar', group: 'color' },
	{ name: 'hue', label: 'HUE', kind: 'scalar', group: 'color' },
	{ name: 'saturation', label: 'SATURATION', kind: 'scalar', group: 'color' },
	{ name: 'invert', label: 'INVERT', kind: 'toggle', group: 'color' },
	{ name: 'vertmirror', label: 'VERT MIRROR', kind: 'toggle', group: 'transform' },
	{ name: 'hormirror', label: 'HORIZ MIRROR', kind: 'toggle', group: 'transform' },
	{ name: 'limitcolors', label: 'LIMIT COLORS', kind: 'toggle', group: 'color' },
	{ name: 'lowcolor', label: 'LOW COLOR', kind: 'color', group: 'color' },
	{ name: 'highcolor', label: 'HIGH COLOR', kind: 'color', group: 'color' },
	{ name: 'transition', label: 'TRANSITION', kind: 'bang', group: 'master' },
	{ name: 'alphachannel', label: 'ALPHA CHANNEL', kind: 'toggle', group: 'master' },
	{ name: 'mediacontrast', label: 'MEDIA CONTRAST', kind: 'scalar', group: 'media-color' },
	{ name: 'mediagamma', label: 'MEDIA GAMMA', kind: 'scalar', group: 'media-color' },
	{ name: 'mediahue', label: 'MEDIA HUE', kind: 'scalar', group: 'media-color' },
	{ name: 'mediasaturation', label: 'MEDIA SATURATION', kind: 'scalar', group: 'media-color' },
	{ name: 'invertmedia', label: 'INVERT MEDIA', kind: 'toggle', group: 'media-color' },
	{ name: 'vertflip', label: 'VERT FLIP', kind: 'toggle', group: 'media-transform' },
	{ name: 'fitorfill', label: 'FIT OR FILL', kind: 'toggle', group: 'media-transform' },
	{ name: 'horflip', label: 'HORIZ FLIP', kind: 'toggle', group: 'media-transform' },
	{ name: 'mediascale', label: 'MEDIA SCALE', kind: 'scalar', group: 'media-transform' },
	{ name: 'paused', label: 'PAUSED', kind: 'toggle', group: 'video' },
	{ name: 'playbackspeed', label: 'PLAYBACK SPEED', kind: 'scalar', group: 'video' },
	{ name: 'playbackmode', label: 'PLAYBACK MODE', kind: 'dropdown', group: 'video' },
	{ name: 'mediaoverlaymode', label: 'MEDIA OVERLAY MODE', kind: 'dropdown', group: 'video' },
	{ name: 'mediaoverlay', label: 'MEDIA OVERLAY', kind: 'scalar', group: 'video' },
	{ name: 'reactivity', label: 'REACTIVITY', kind: 'scalar', group: 'audio' },
	{ name: 'audiospeed', label: 'AUDIO SPEED', kind: 'scalar', group: 'audio' },
] as const
export const META_CONTROL_NAMES = META_CONTROL_DEFINITIONS.map((control) => control.name)
const META_CONTROLS_BY_NAME = new Map(META_CONTROL_DEFINITIONS.map((control) => [control.name, control]))
export type ControlBank = 'scene' | 'meta'

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

export type ActiveGlobalControl = GlobalControlState & {
	type: GlobalControlType
	position: number
}

export type FeedbackId =
	'current_scene' | 'global_toggle' | 'global_value' | 'bank_locked' | 'feedback_fresh' | 'listener_ready'

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
	oscMessagesReceived = 0
	readonly bankLocks: Record<ControlBank, boolean> = { scene: false, meta: false }
	readonly metaValues = new Map<string, GlobalControlValue>()
	detectedFeedbackMode = ''
	feedbackModeMismatch = false
	private metaControlsRevision = 0

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

	markOscReceived(address: string): void {
		this.oscMessagesReceived++
		this.queue(
			{
				osc_last_address: address,
				osc_last_received_at: new Date(this.scheduler.now()).toISOString(),
				osc_messages_received: this.oscMessagesReceived,
			},
			[],
		)
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

	observeFeedbackMode(mode: FeedbackValueMode, expected: FeedbackValueMode): void {
		const mismatch = mode !== expected
		if (this.detectedFeedbackMode === mode && this.feedbackModeMismatch === mismatch) return
		this.detectedFeedbackMode = mode
		this.feedbackModeMismatch = mismatch
		this.queue(
			{
				feedback_detected_mode: mode,
				feedback_mode_mismatch: mismatch ? 1 : 0,
			},
			[],
		)
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
		const variables: Record<string, CompanionVariableValue> = {
			[variableId(type, position, 'name')]: name,
			[variableId(type, position, 'label')]: displayControlName(name),
		}
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

	getActiveControls(types: readonly GlobalControlType[] = GLOBAL_CONTROL_TYPES): ActiveGlobalControl[] {
		const controls: ActiveGlobalControl[] = []
		for (const type of types) {
			for (let position = 1; position <= GLOBAL_CONTROL_POSITIONS; position++) {
				const control = this.controls.get(controlKey(type, position))
				if (control?.name) controls.push({ type, position, name: control.name, value: control.value })
			}
		}
		return controls
	}

	setNumericComponent(type: GlobalControlType, position: number, component: string, next: number): void {
		const current = this.controls.get(controlKey(type, position))?.value
		switch (type) {
			case 'slider':
			case 'knob':
				this.setControlValue(type, position, { kind: 'scalar', value: next })
				break
			case 'dropdown':
				this.setControlValue(type, position, { kind: 'dropdown', value: next })
				break
			case 'xy':
				this.setControlValue(type, position, {
					kind: 'xy',
					x: component === 'x' ? next : current?.kind === 'xy' ? current.x : 0.5,
					y: component === 'y' ? next : current?.kind === 'xy' ? current.y : 0.5,
				})
				break
			case 'color':
				this.setControlValue(type, position, {
					kind: 'color',
					r: component === 'r' ? next : current?.kind === 'color' ? current.r : 0.5,
					g: component === 'g' ? next : current?.kind === 'color' ? current.g : 0.5,
					b: component === 'b' ? next : current?.kind === 'color' ? current.b : 0.5,
				})
				break
			case 'toggle':
			case 'bang':
				break
		}
	}

	setMetaScalarValue(name: string, value: number): void {
		this.setMetaControlValue(name, { kind: 'scalar', value })
	}

	getMetaScalarValue(name: string): number | undefined {
		return this.getMetaNumericValue(name)
	}

	setMetaControlValue(name: string, value: GlobalControlValue): void {
		value = coerceMetaControlValue(name, value)
		if (sameValue(this.metaValues.get(name), value)) return
		this.metaValues.set(name, value)
		const variables: Record<string, CompanionVariableValue> = {
			meta_controls_revision: ++this.metaControlsRevision,
		}
		if ((META_CONTROL_NAMES as readonly string[]).includes(name))
			variables[metaVariableId(name)] = formatMetaValue(value)
		this.queue(variables, ['global_value'])
	}

	getMetaControlValue(name: string): GlobalControlValue | undefined {
		return this.metaValues.get(name)
	}

	getMetaNumericValue(name: string, component = 'value'): number | undefined {
		const value = this.metaValues.get(name)
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

	setMetaNumericComponent(name: string, component: string, next: number): void {
		const current = this.metaValues.get(name)
		if (current?.kind === 'xy') {
			this.setMetaControlValue(name, {
				kind: 'xy',
				x: component === 'x' ? next : current.x,
				y: component === 'y' ? next : current.y,
			})
		} else if (current?.kind === 'color') {
			this.setMetaControlValue(name, {
				kind: 'color',
				r: component === 'r' ? next : current.r,
				g: component === 'g' ? next : current.g,
				b: component === 'b' ? next : current.b,
			})
		} else if (component === 'x' || component === 'y') {
			this.setMetaControlValue(name, {
				kind: 'xy',
				x: component === 'x' ? next : 0.5,
				y: component === 'y' ? next : 0.5,
			})
		} else if (component === 'r' || component === 'g' || component === 'b') {
			this.setMetaControlValue(name, {
				kind: 'color',
				r: component === 'r' ? next : 0.5,
				g: component === 'g' ? next : 0.5,
				b: component === 'b' ? next : 0.5,
			})
		} else {
			this.setMetaScalarValue(name, next)
		}
	}

	setBankLocked(bank: ControlBank, locked: boolean): void {
		if (this.bankLocks[bank] === locked) return
		this.bankLocks[bank] = locked
		this.queue({ [`${bank}_bank_locked`]: locked ? 1 : 0 }, ['bank_locked'])
	}

	isBankLocked(bank: ControlBank): boolean {
		return this.bankLocks[bank]
	}

	getInitialVariableValues(): Record<string, CompanionVariableValue> {
		const values: Record<string, CompanionVariableValue> = {
			current_scene: this.currentScene,
			last_scene_received_at: this.lastSceneReceivedAt,
			feedback_last_received_at: '',
			feedback_age_ms: '',
			feedback_fresh: 0,
			socket_listening: this.listenerReady ? 1 : 0,
			osc_last_address: '',
			osc_last_received_at: '',
			osc_messages_received: this.oscMessagesReceived,
			scene_bank_locked: this.bankLocks.scene ? 1 : 0,
			meta_bank_locked: this.bankLocks.meta ? 1 : 0,
			meta_controls_revision: this.metaControlsRevision,
			feedback_detected_mode: this.detectedFeedbackMode,
			feedback_mode_mismatch: this.feedbackModeMismatch ? 1 : 0,
		}
		for (const name of META_CONTROL_NAMES) values[metaVariableId(name)] = ''
		for (const type of GLOBAL_CONTROL_TYPES) {
			for (let position = 1; position <= GLOBAL_CONTROL_POSITIONS; position++) {
				values[variableId(type, position, 'name')] = ''
				values[variableId(type, position, 'label')] = ''
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

export function metaVariableId(name: string): string {
	return `meta_${name}_value`
}

export function metaControlDefinition(name: string): MetaControlDefinition | undefined {
	return META_CONTROLS_BY_NAME.get(name)
}

export function metaControlLabel(name: string): string {
	return metaControlDefinition(name)?.label ?? displayControlName(name)
}

function coerceMetaControlValue(name: string, value: GlobalControlValue): GlobalControlValue {
	const definition = metaControlDefinition(name)
	if (!definition || value.kind !== 'scalar') return value
	if (definition.kind === 'toggle') return { kind: 'toggle', value: value.value >= 0.5 }
	if (definition.kind === 'bang') return { kind: 'bang', value: value.value >= 0.5 }
	if (definition.kind === 'dropdown') return { kind: 'dropdown', value: value.value }
	return value
}

export function formatNumber(value: number): string {
	if (!Number.isFinite(value)) return ''
	return Number(value.toFixed(4)).toString()
}

export function displayControlName(value: string): string {
	return value.trim().replaceAll(/[_-]+/g, ' ').replaceAll(/\s+/g, ' ').toUpperCase()
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

function formatMetaValue(value: GlobalControlValue): string | number {
	switch (value.kind) {
		case 'scalar':
		case 'dropdown':
			return formatNumber(value.value)
		case 'toggle':
		case 'bang':
			return value.value ? 1 : 0
		case 'xy':
			return `${formatNumber(value.x)}, ${formatNumber(value.y)}`
		case 'color':
			return `${formatNumber(value.r)}, ${formatNumber(value.g)}, ${formatNumber(value.b)}`
	}
}
