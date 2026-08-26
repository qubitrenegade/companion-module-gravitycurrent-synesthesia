import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { GLOBAL_CONTROL_TYPES, type GlobalControlType } from './state.js'

type SceneOptions = { scene: string; caseSensitive: boolean }
type ToggleOptions = { position: string; state: boolean }
type ValueOptions = {
	type: GlobalControlType
	position: string
	component: 'value' | 'x' | 'y' | 'r' | 'g' | 'b'
	operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
	value: string
}

export type FeedbacksSchema = {
	current_scene: { type: 'boolean'; options: SceneOptions }
	global_toggle: { type: 'boolean'; options: ToggleOptions }
	global_value: { type: 'boolean'; options: ValueOptions }
	feedback_fresh: { type: 'boolean'; options: Record<string, never> }
	listener_ready: { type: 'boolean'; options: Record<string, never> }
}

const activeStyle = { bgcolor: 0x00cc44, color: 0x000000 }

export function GetFeedbackDefinitions(self: ModuleInstance): CompanionFeedbackDefinitions<FeedbacksSchema> {
	return {
		current_scene: {
			name: 'Scene: Current Scene Matches',
			type: 'boolean',
			defaultStyle: activeStyle,
			options: [
				{ id: 'scene', type: 'textinput', label: 'Scene name', default: '', useVariables: true },
				{ id: 'caseSensitive', type: 'checkbox', label: 'Case sensitive', default: false },
			],
			callback: (feedback) => {
				const expected = String(feedback.options.scene)
				return feedback.options.caseSensitive
					? self.state.currentScene === expected
					: self.state.currentScene.toLowerCase() === expected.toLowerCase()
			},
		},
		global_toggle: {
			name: 'Global Toggle: State',
			type: 'boolean',
			defaultStyle: activeStyle,
			options: [
				{ id: 'position', type: 'textinput', label: 'Position', default: '1', useVariables: true, regex: '/^\\d+$/' },
				{ id: 'state', type: 'checkbox', label: 'Expected on state', default: true },
			],
			callback: (feedback) => {
				const position = validPosition(feedback.options.position)
				if (!position) return false
				const value = self.state.getNumericValue('toggle', position)
				return value !== undefined && (value !== 0) === feedback.options.state
			},
		},
		global_value: {
			name: 'Global Control: Compare Value',
			type: 'boolean',
			defaultStyle: activeStyle,
			options: [
				{
					id: 'type',
					type: 'dropdown',
					label: 'Control type',
					default: 'slider',
					choices: GLOBAL_CONTROL_TYPES.map((type) => ({ id: type, label: type })),
				},
				{ id: 'position', type: 'textinput', label: 'Position', default: '1', useVariables: true, regex: '/^\\d+$/' },
				{
					id: 'component',
					type: 'dropdown',
					label: 'Component',
					default: 'value',
					choices: [
						{ id: 'value', label: 'Primary value' },
						{ id: 'x', label: 'X' },
						{ id: 'y', label: 'Y' },
						{ id: 'r', label: 'Red' },
						{ id: 'g', label: 'Green' },
						{ id: 'b', label: 'Blue' },
					],
				},
				{
					id: 'operator',
					type: 'dropdown',
					label: 'Comparison',
					default: 'gte',
					choices: [
						{ id: 'eq', label: '=' },
						{ id: 'ne', label: '!=' },
						{ id: 'gt', label: '>' },
						{ id: 'gte', label: '>=' },
						{ id: 'lt', label: '<' },
						{ id: 'lte', label: '<=' },
					],
				},
				{ id: 'value', type: 'textinput', label: 'Comparison value', default: '0.5', useVariables: true },
			],
			callback: (feedback) => {
				const position = validPosition(feedback.options.position)
				const target = Number(feedback.options.value)
				if (!position || !Number.isFinite(target)) return false
				const actual = self.state.getNumericValue(feedback.options.type, position, feedback.options.component)
				return actual === undefined ? false : compare(actual, feedback.options.operator, target)
			},
		},
		feedback_fresh: {
			name: 'OSC Feedback: Recently Received',
			description: 'True only after a supported Synesthesia state message arrived within the configured timeout.',
			type: 'boolean',
			defaultStyle: activeStyle,
			options: [],
			callback: () => self.state.isFeedbackFresh(),
		},
		listener_ready: {
			name: 'OSC Feedback: Listener Ready',
			description: 'True when the local UDP feedback socket is listening. This does not prove Synesthesia is sending.',
			type: 'boolean',
			defaultStyle: activeStyle,
			options: [],
			callback: () => self.state.listenerReady,
		},
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions(GetFeedbackDefinitions(self))
}

function validPosition(value: unknown): number | undefined {
	const position = Number(value)
	return Number.isInteger(position) && position >= 1 && position <= 16 ? position : undefined
}

function compare(actual: number, operator: ValueOptions['operator'], target: number): boolean {
	switch (operator) {
		case 'eq':
			return actual === target
		case 'ne':
			return actual !== target
		case 'gt':
			return actual > target
		case 'gte':
			return actual >= target
		case 'lt':
			return actual < target
		case 'lte':
			return actual <= target
	}
}
