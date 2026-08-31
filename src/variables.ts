import type { CompanionVariableDefinition, CompanionVariableValue } from '@companion-module/base'
import type ModuleInstance from './main.js'
import {
	GLOBAL_CONTROL_POSITIONS,
	GLOBAL_CONTROL_TYPES,
	META_CONTROL_NAMES,
	metaVariableId,
	variableId,
} from './state.js'

export type VariablesSchema = Record<string, CompanionVariableValue>

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const definitions: Record<string, CompanionVariableDefinition> = {
		current_scene: { name: 'Current scene name' },
		last_scene_received_at: { name: 'Time the current scene was received' },
		feedback_last_received_at: { name: 'Time the last supported OSC feedback was received' },
		feedback_age_ms: { name: 'Feedback age recorded at the last freshness transition in milliseconds' },
		feedback_fresh: { name: 'Whether supported OSC feedback is fresh (1 or 0)' },
		socket_listening: { name: 'Whether the feedback UDP socket is listening (1 or 0)' },
		osc_last_address: { name: 'Last OSC address received, including unsupported routes' },
		osc_last_received_at: { name: 'Time any OSC message was last received' },
		osc_messages_received: { name: 'Number of OSC messages received since the connection started' },
		scene_bank_locked: { name: 'Locally tracked scene-control bank lock state (1 or 0)' },
		meta_bank_locked: { name: 'Locally tracked meta-control bank lock state (1 or 0)' },
		meta_controls_revision: { name: 'Internal revision counter for dynamically discovered meta controls' },
		feedback_detected_mode: { name: 'Control feedback mode most recently observed from Synesthesia' },
		feedback_mode_mismatch: { name: 'Whether observed and configured feedback modes differ (1 or 0)' },
		surface_mode: { name: 'Active dynamic control mode' },
		surface_view: { name: 'Active dynamic control view' },
		surface_media_sources: { name: 'Whether the Media source selector is visible (1 or 0)' },
		surface_page: { name: 'Active dynamic control page' },
		surface_page_count: { name: 'Number of dynamic control pages' },
		playlist_playing: { name: 'Locally tracked playlist playing state (1 or 0)' },
		render_enabled: { name: 'Locally tracked rendering enabled state (1 or 0)' },
		preset_created: { name: 'Whether a preset creation command was sent during the current hold' },
	}

	for (let slot = 1; slot <= 18; slot++) {
		definitions[`surface_button_${slot}_label`] = { name: `Dynamic button ${slot} label` }
		definitions[`surface_button_${slot}_kind`] = { name: `Dynamic button ${slot} behavior kind` }
		definitions[`surface_button_${slot}_active`] = { name: `Whether dynamic button ${slot} is assigned` }
		definitions[`surface_button_${slot}_on`] = { name: `Dynamic button ${slot} active/on state` }
		definitions[`surface_button_${slot}_locked`] = { name: `Whether dynamic button ${slot} is a locked group` }
	}

	for (let slot = 1; slot <= 6; slot++) {
		definitions[`surface_rotary_${slot}_label`] = { name: `Dynamic rotary ${slot} label` }
		definitions[`surface_rotary_${slot}_value`] = { name: `Dynamic rotary ${slot} value` }
		definitions[`surface_rotary_${slot}_component`] = { name: `Dynamic rotary ${slot} selected component` }
		definitions[`surface_rotary_${slot}_active`] = { name: `Whether dynamic rotary ${slot} is assigned` }
		definitions[`surface_rotary_${slot}_locked`] = { name: `Dynamic rotary ${slot} lock state` }
	}

	for (const name of META_CONTROL_NAMES) {
		definitions[metaVariableId(name)] = { name: `Meta ${name.replaceAll('_', ' ')} normalized value` }
	}

	for (const type of GLOBAL_CONTROL_TYPES) {
		for (let position = 1; position <= GLOBAL_CONTROL_POSITIONS; position++) {
			const label = `Global ${type} ${position}`
			definitions[variableId(type, position, 'name')] = { name: `${label} name` }
			definitions[variableId(type, position, 'label')] = { name: `${label} uppercase display label` }
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
