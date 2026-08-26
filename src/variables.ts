import type { CompanionVariableDefinition, CompanionVariableValue } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { GLOBAL_CONTROL_POSITIONS, GLOBAL_CONTROL_TYPES, variableId } from './state.js'

export type VariablesSchema = Record<string, CompanionVariableValue>

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const definitions: Record<string, CompanionVariableDefinition> = {
		current_scene: { name: 'Current scene name' },
		last_scene_received_at: { name: 'Time the current scene was received' },
		feedback_last_received_at: { name: 'Time the last supported OSC feedback was received' },
		feedback_age_ms: { name: 'Feedback age recorded at the last freshness transition in milliseconds' },
		feedback_fresh: { name: 'Whether supported OSC feedback is fresh (1 or 0)' },
		socket_listening: { name: 'Whether the feedback UDP socket is listening (1 or 0)' },
	}

	for (const type of GLOBAL_CONTROL_TYPES) {
		for (let position = 1; position <= GLOBAL_CONTROL_POSITIONS; position++) {
			const label = `Global ${type} ${position}`
			definitions[variableId(type, position, 'name')] = { name: `${label} name` }
			definitions[variableId(type, position, 'value')] = { name: `${label} formatted value` }
			if (type === 'xy') {
				definitions[variableId(type, position, 'x')] = { name: `${label} X value` }
				definitions[variableId(type, position, 'y')] = { name: `${label} Y value` }
			} else if (type === 'color') {
				definitions[variableId(type, position, 'r')] = { name: `${label} red value` }
				definitions[variableId(type, position, 'g')] = { name: `${label} green value` }
				definitions[variableId(type, position, 'b')] = { name: `${label} blue value` }
			}
		}
	}

	self.setVariableDefinitions(definitions)
}
