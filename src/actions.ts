import type {
	CompanionActionDefinition,
	CompanionActionDefinitions,
	CompanionInputFieldTextInput,
	OSCMetaArgument,
} from '@companion-module/base'
import type ModuleInstance from './main.js'
import { GLOBAL_CONTROL_TYPES, type GlobalControlType } from './state.js'

type EmptyOptions = Record<string, never>
type PlayOptions = { shouldPlay: boolean }
type RenderOptions = { enabled: boolean }
type PositionOptions = { position: string }
type NameOptions = { name: string }
type SceneOptions = { scene: string; preset: string }
type PresetOptions = { name: string; channel: 'all' | 'scene' | 'meta' | 'media' }
type MediaOptions = { mode: 'name' | 'position'; name: string; position: string }
type ControlOptions = { name: string; values: string; raw: boolean }
type GlobalControlOptions = { type: GlobalControlType; position: string; values: string; raw: boolean }
type AdjustGlobalOptions = { type: 'slider' | 'knob'; position: string; delta: string }
type ControlOperationOptions = {
	scope: 'scene' | 'meta' | 'global'
	name: string
	type: GlobalControlType
	position: string
	operation: 'default' | 'random' | 'preset' | 'lock'
	locked: boolean
}
type BankOperationOptions = {
	bank: 'scene' | 'meta'
	operation: 'default' | 'random' | 'undo' | 'lock'
	locked: boolean
}
type GroupOperationOptions = {
	bank: 'scene' | 'meta' | 'specific'
	scene: string
	group: string
	operation: 'default' | 'random' | 'lock'
	locked: boolean
}

export type ActionsSchema = {
	playlist_previous: { options: EmptyOptions }
	playlist_next: { options: EmptyOptions }
	playlist_play: { options: PlayOptions }
	playlist_toggle_play: { options: EmptyOptions }
	playlist_position: { options: PositionOptions }
	playlist_select: { options: NameOptions }
	render_enabled: { options: RenderOptions }
	favslot_trigger: { options: PositionOptions }
	launch_scene: { options: SceneOptions }
	launch_preset: { options: PresetOptions }
	create_preset: { options: NameOptions }
	select_media: { options: MediaOptions }
	set_meta_control: { options: ControlOptions }
	set_scene_control: { options: ControlOptions }
	set_global_control: { options: GlobalControlOptions }
	adjust_global_scalar: { options: AdjustGlobalOptions }
	toggle_global_toggle: { options: PositionOptions }
	control_operation: { options: ControlOperationOptions }
	bank_operation: { options: BankOperationOptions }
	group_operation: { options: GroupOperationOptions }
}

const globalTypeChoices = GLOBAL_CONTROL_TYPES.map((type) => ({ id: type, label: capitalize(type) }))

export function GetActionDefinitions(self: ModuleInstance): CompanionActionDefinitions<ActionsSchema> {
	return {
		playlist_previous: simpleAction('Playlist: Previous', () => send(self, '/playlist/previous')),
		playlist_next: simpleAction('Playlist: Next', () => send(self, '/playlist/next')),
		playlist_play: {
			name: 'Playlist: Set Play State',
			options: [{ id: 'shouldPlay', type: 'checkbox', label: 'Playing', default: true }],
			callback: (event) => send(self, '/playlist/play', [integer(event.options.shouldPlay ? 1 : 0)]),
		},
		playlist_toggle_play: simpleAction('Playlist: Toggle Play', () => send(self, '/playlist/toggleplay')),
		playlist_position: {
			name: 'Playlist: Go to Position',
			options: [positionField('position', 'Playlist position', '1', -9999)],
			callback: (event) =>
				send(self, '/playlist/position', [integer(parseInteger(event.options.position, 'position'))]),
		},
		playlist_select: {
			name: 'Playlist: Select by Name',
			options: [textField('name', 'Playlist name')],
			callback: (event) =>
				send(self, '/playlist/select', [stringArg(requireText(event.options.name, 'playlist name'))]),
		},
		render_enabled: {
			name: 'Rendering: Set Enabled',
			description: 'Control the pause button below the Synesthesia preview.',
			options: [{ id: 'enabled', type: 'checkbox', label: 'Rendering enabled', default: true }],
			callback: (event) => send(self, '/render/enabled', [integer(event.options.enabled ? 1 : 0)]),
		},
		favslot_trigger: {
			name: 'Favslot: Trigger by Position',
			options: [positionField('position', 'Favslot position')],
			callback: (event) => send(self, `/favslots/${parseInteger(event.options.position, 'position', 1)}`),
		},
		launch_scene: {
			name: 'Scene: Launch by Name',
			options: [textField('scene', 'Scene name'), textField('preset', 'Preset name (optional)', '')],
			callback: (event) => {
				const path = `/scenes/${normalizeSceneName(event.options.scene)}`
				const preset = String(event.options.preset).trim()
				return send(self, path, preset ? [stringArg(preset)] : [])
			},
		},
		launch_preset: {
			name: 'Preset: Launch by Name',
			options: [
				textField('name', 'Preset name'),
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Preset channel',
					default: 'all',
					choices: [
						{ id: 'all', label: 'All channels' },
						{ id: 'scene', label: 'Scene controls only' },
						{ id: 'meta', label: 'Meta controls only' },
						{ id: 'media', label: 'Media only' },
					],
				},
			],
			callback: (event) => {
				const suffix = event.options.channel === 'all' ? '' : `/${event.options.channel}`
				return send(self, `/presets${suffix}`, [stringArg(requireText(event.options.name, 'preset name'))])
			},
		},
		create_preset: {
			name: 'Preset: Create from Current State',
			options: [textField('name', 'Preset name (optional)', '')],
			callback: (event) => {
				const name = String(event.options.name).trim()
				return send(self, '/presets/new', name ? [stringArg(name)] : [])
			},
		},
		select_media: {
			name: 'Media: Select',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Select by',
					default: 'name',
					choices: [
						{ id: 'name', label: 'Name or path' },
						{ id: 'position', label: 'Loaded media position' },
					],
				},
				{ ...textField('name', 'Media name or path'), isVisibleExpression: '$(options:mode) == "name"' },
				{
					...positionField('position', 'Media position'),
					isVisibleExpression: '$(options:mode) == "position"',
				},
			],
			callback: (event) =>
				event.options.mode === 'position'
					? send(self, '/media/position', [integer(parseInteger(event.options.position, 'position', 1))])
					: send(self, '/media/name', [stringArg(requireText(event.options.name, 'media name'))]),
		},
		set_meta_control: controlAction(self, 'Meta Control: Set Value', 'meta'),
		set_scene_control: controlAction(self, 'Scene Control: Set Value', 'scene'),
		set_global_control: {
			name: 'Global Control: Set Value',
			description: 'Set a scene control by stable type and position across scene changes.',
			options: [
				{ id: 'type', type: 'dropdown', label: 'Control type', default: 'slider', choices: globalTypeChoices },
				positionField('position', 'Position'),
				textField('values', 'Value(s)', '0.5'),
				{ id: 'raw', type: 'checkbox', label: 'Send raw values', default: false },
			],
			callback: (event) => {
				const position = parseInteger(event.options.position, 'position', 1, 16)
				const suffix = event.options.raw ? '/raw' : ''
				const values = parseControlValues(event.options.values, event.options.raw)
				return send(self, `/controls/global/${event.options.type}/${position}${suffix}`, values.map(floatArg))
			},
		},
		adjust_global_scalar: {
			name: 'Global Scalar: Adjust Relative',
			description: 'Adjust a global slider or knob from the last normalized value received from Synesthesia.',
			options: [
				{
					id: 'type',
					type: 'dropdown',
					label: 'Control type',
					default: 'slider',
					choices: [
						{ id: 'slider', label: 'Slider' },
						{ id: 'knob', label: 'Knob' },
					],
				},
				positionField('position', 'Position'),
				textField('delta', 'Normalized adjustment', '0.05'),
			],
			callback: (event) => {
				const position = parseInteger(event.options.position, 'position', 1, 16)
				if (self.config.feedbackValueMode !== 'normalized' || !self.state.isFeedbackFresh()) {
					throw new Error('Relative adjustment requires fresh normalized OSC feedback')
				}
				const current = self.state.getNumericValue(event.options.type, position)
				if (current === undefined) throw new Error('No feedback value has been received for this global control')
				const delta = parseNumber(event.options.delta, 'adjustment')
				const next = Math.min(1, Math.max(0, current + delta))
				return send(self, `/controls/global/${event.options.type}/${position}`, [floatArg(next)])
			},
		},
		toggle_global_toggle: {
			name: 'Global Toggle: Toggle from Feedback',
			description: 'Invert a global toggle using the most recent normalized value received from Synesthesia.',
			options: [positionField('position', 'Position')],
			callback: (event) => {
				const position = parseInteger(event.options.position, 'position', 1, 16)
				if (self.config.feedbackValueMode !== 'normalized' || !self.state.isFeedbackFresh()) {
					throw new Error('Toggle requires fresh normalized OSC feedback')
				}
				const current = self.state.getNumericValue('toggle', position)
				if (current === undefined) throw new Error('No feedback value has been received for this global toggle')
				return send(self, `/controls/global/toggle/${position}`, [floatArg(current === 0 ? 1 : 0)])
			},
		},
		control_operation: {
			name: 'Control: Default, Random, Preset, or Lock',
			options: [
				{
					id: 'scope',
					type: 'dropdown',
					label: 'Address type',
					default: 'scene',
					choices: [
						{ id: 'scene', label: 'Scene control by name' },
						{ id: 'meta', label: 'Meta control by name' },
						{ id: 'global', label: 'Global type and position' },
					],
				},
				{ ...textField('name', 'Control name'), isVisibleExpression: '$(options:scope) != "global"' },
				{
					id: 'type',
					type: 'dropdown',
					label: 'Global control type',
					default: 'slider',
					choices: globalTypeChoices,
					isVisibleExpression: '$(options:scope) == "global"',
				},
				{
					...positionField('position', 'Global position'),
					isVisibleExpression: '$(options:scope) == "global"',
				},
				{
					id: 'operation',
					type: 'dropdown',
					label: 'Operation',
					default: 'default',
					choices: [
						{ id: 'default', label: 'Default' },
						{ id: 'random', label: 'Random' },
						{ id: 'preset', label: 'Current preset value' },
						{ id: 'lock', label: 'Set lock state' },
					],
				},
				{
					id: 'locked',
					type: 'checkbox',
					label: 'Locked',
					default: true,
					isVisibleExpression: '$(options:operation) == "lock"',
				},
			],
			callback: (event) => {
				const base =
					event.options.scope === 'global'
						? `/controls/global/${event.options.type}/${parseInteger(event.options.position, 'position', 1, 16)}`
						: `/controls/${event.options.scope}/${normalizeControlName(event.options.name)}`
				const args = event.options.operation === 'lock' ? [floatArg(event.options.locked ? 1 : 0)] : []
				return send(self, `${base}/${event.options.operation}`, args)
			},
		},
		bank_operation: {
			name: 'Control Bank: Default, Random, Undo, or Lock',
			options: [
				{
					id: 'bank',
					type: 'dropdown',
					label: 'Bank',
					default: 'scene',
					choices: [
						{ id: 'scene', label: 'Scene controls' },
						{ id: 'meta', label: 'Meta controls' },
					],
				},
				{
					id: 'operation',
					type: 'dropdown',
					label: 'Operation',
					default: 'default',
					choices: [
						{ id: 'default', label: 'Default' },
						{ id: 'random', label: 'Random' },
						{ id: 'undo', label: 'Undo' },
						{ id: 'lock', label: 'Set lock state' },
					],
				},
				{
					id: 'locked',
					type: 'checkbox',
					label: 'Locked',
					default: true,
					isVisibleExpression: '$(options:operation) == "lock"',
				},
			],
			callback: (event) =>
				send(
					self,
					`/controls/banks/${event.options.bank}/${event.options.operation}`,
					event.options.operation === 'lock' ? [floatArg(event.options.locked ? 1 : 0)] : [],
				),
		},
		group_operation: {
			name: 'Control Group: Default, Random, or Lock',
			options: [
				{
					id: 'bank',
					type: 'dropdown',
					label: 'Bank',
					default: 'scene',
					choices: [
						{ id: 'scene', label: 'Current scene' },
						{ id: 'meta', label: 'Meta controls' },
						{ id: 'specific', label: 'Specific scene' },
					],
				},
				{
					...textField('scene', 'Specific scene bank'),
					isVisibleExpression: '$(options:bank) == "specific"',
				},
				textField('group', 'Group name'),
				{
					id: 'operation',
					type: 'dropdown',
					label: 'Operation',
					default: 'default',
					choices: [
						{ id: 'default', label: 'Default' },
						{ id: 'random', label: 'Random' },
						{ id: 'lock', label: 'Set lock state' },
					],
				},
				{
					id: 'locked',
					type: 'checkbox',
					label: 'Locked',
					default: true,
					isVisibleExpression: '$(options:operation) == "lock"',
				},
			],
			callback: (event) => {
				const bank = event.options.bank === 'specific' ? normalizeSceneName(event.options.scene) : event.options.bank
				const group = normalizeControlName(event.options.group)
				const args = event.options.operation === 'lock' ? [floatArg(event.options.locked ? 1 : 0)] : []
				return send(self, `/controls/groups/${bank}/${group}/${event.options.operation}`, args)
			},
		},
	}
}

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions(GetActionDefinitions(self))
}

function simpleAction(name: string, callback: () => void): CompanionActionDefinition<EmptyOptions> {
	return { name, options: [], callback }
}

function controlAction(
	self: ModuleInstance,
	name: string,
	bank: 'scene' | 'meta',
): CompanionActionDefinitions<ActionsSchema>['set_scene_control'] {
	return {
		name,
		options: [
			textField('name', 'Control name', bank === 'meta' ? 'brightness' : ''),
			textField('values', 'Value(s)', '0.5'),
			{ id: 'raw', type: 'checkbox', label: 'Send raw values', default: false },
		],
		callback: (event) => {
			const suffix = event.options.raw ? '/raw' : ''
			const values = parseControlValues(event.options.values, event.options.raw)
			return send(self, `/controls/${bank}/${normalizeControlName(event.options.name)}${suffix}`, values.map(floatArg))
		},
	}
}

function send(self: ModuleInstance, address: string, args: OSCMetaArgument[] = []): void {
	/*
	 * Companion's OSC sender owns datagram encoding and lifecycle. Explicit OSC
	 * tags preserve Synesthesia's documented integer, float, and string contracts;
	 * plain JavaScript numbers could otherwise change type when a value happens
	 * to be integral. A successful local send is not a delivery acknowledgement.
	 */
	self.sendOsc(address, args)
}

function textField<TKey extends string>(
	id: TKey,
	label: string,
	defaultValue = '',
): CompanionInputFieldTextInput<TKey> {
	return { id, type: 'textinput' as const, label, default: defaultValue, useVariables: true }
}

function positionField<TKey extends string>(
	id: TKey,
	label: string,
	defaultValue = '1',
	minimum = 1,
): CompanionInputFieldTextInput<TKey> {
	return {
		...textField(id, label, defaultValue),
		regex: minimum < 0 ? '/^-?\\d+$/' : '/^\\d+$/',
	}
}

function parseInteger(value: unknown, label: string, min?: number, max?: number): number {
	const number = parseNumber(value, label)
	if (!Number.isInteger(number)) throw new Error(`${label} must be an integer`)
	if (min !== undefined && number < min) throw new Error(`${label} must be at least ${min}`)
	if (max !== undefined && number > max) throw new Error(`${label} must be at most ${max}`)
	return number
}

function parseNumber(value: unknown, label: string): number {
	const number = Number(String(value).trim())
	if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number`)
	return number
}

function parseControlValues(value: unknown, raw: boolean): number[] {
	const parts = String(value)
		.trim()
		.split(/[\s,]+/)
		.filter(Boolean)
	if (parts.length < 1 || parts.length > 3) throw new Error('Control value must contain one to three numbers')
	const numbers = parts.map((part) => parseNumber(part, 'control value'))
	if (!raw && numbers.some((number) => number < 0 || number > 1)) {
		throw new Error('Normalized control values must be between 0 and 1')
	}
	return numbers
}

function requireText(value: unknown, label: string): string {
	const text = String(value).trim()
	if (!text) throw new Error(`${label} is required`)
	return text
}

function normalizeSceneName(value: unknown): string {
	const result = requireText(value, 'scene name')
		.toLowerCase()
		.replace(/[\s_-]+/g, '')
	if (!/^[a-z0-9]+$/.test(result)) throw new Error('Scene name contains unsupported OSC path characters')
	return result
}

function normalizeControlName(value: unknown): string {
	const result = requireText(value, 'control name')
		.toLowerCase()
		.replace(/[\s-]+/g, '')
	if (!/^[a-z0-9_]+$/.test(result)) throw new Error('Control name contains unsupported OSC path characters')
	return result
}

function integer(value: number): OSCMetaArgument {
	return { type: 'i', value }
}

function floatArg(value: number): OSCMetaArgument {
	return { type: 'f', value }
}

function stringArg(value: string): OSCMetaArgument {
	return { type: 's', value }
}

function capitalize(value: string): string {
	return `${value[0].toUpperCase()}${value.slice(1)}`
}
