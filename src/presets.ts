import type { CompanionPresetAction, CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type ModuleInstance from './main.js'
import type { ActionsSchema } from './actions.js'
import type { ModuleSchema } from './main.js'

const white = 0xffffff
const blue = 0x154c79
const purple = 0x5b2380

export function UpdatePresets(self: ModuleInstance): void {
	const structure: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'playback',
			name: 'Playlist and Favslots',
			definitions: [
				{
					id: 'playlist',
					name: 'Playlist',
					type: 'simple',
					presets: ['playlist_previous', 'playlist_next'],
				},
				{
					id: 'favslots',
					name: 'Favslots',
					type: 'simple',
					presets: ['favslot_1', 'favslot_2', 'favslot_3', 'favslot_4'],
				},
			],
		},
		{
			id: 'controls',
			name: 'Controls',
			definitions: [
				{
					id: 'banks',
					name: 'Scene Controls',
					type: 'simple',
					presets: ['scene_default', 'scene_random'],
				},
				{
					id: 'examples',
					name: 'Ready-to-edit Examples',
					type: 'simple',
					presets: ['meta_brightness', 'global_slider_1_rotary'],
				},
			],
		},
	]

	const presets: CompanionPresetDefinitions<ModuleSchema> = {
		playlist_previous: button('Playlist Previous', 'PREV', blue, action('playlist_previous', {})),
		playlist_next: button('Playlist Next', 'NEXT', blue, action('playlist_next', {})),
		scene_default: button(
			'Scene Controls Default',
			'SCENE\nDEFAULT',
			purple,
			action('bank_operation', { bank: 'scene', operation: 'default', locked: true }),
		),
		scene_random: button(
			'Scene Controls Random',
			'SCENE\nRANDOM',
			purple,
			action('bank_operation', { bank: 'scene', operation: 'random', locked: true }),
		),
		meta_brightness: button(
			'Meta Brightness 50%',
			'BRIGHTNESS\n50%',
			purple,
			action('set_meta_control', { name: 'brightness', values: '0.5', raw: false }),
		),
		global_slider_1_rotary: {
			type: 'simple',
			name: 'Global Slider 1 Rotary',
			keywords: ['rotary', 'dial', 'dynamic'],
			style: {
				text: '$(Synesthesia:global_slider_1_name)\n$(Synesthesia:global_slider_1_value)',
				size: 'auto',
				color: white,
				bgcolor: blue,
				show_topbar: false,
			},
			steps: [
				{
					down: [],
					up: [],
					rotate_left: [action('adjust_global_scalar', { type: 'slider', position: '1', delta: '-0.05' })],
					rotate_right: [action('adjust_global_scalar', { type: 'slider', position: '1', delta: '0.05' })],
				},
			],
			feedbacks: [],
		},
	}

	for (let position = 1; position <= 4; position++) {
		presets[`favslot_${position}`] = button(
			`Favslot ${position}`,
			`FAV\n${position}`,
			purple,
			action('favslot_trigger', { position: String(position) }),
		)
	}

	self.setPresetDefinitions(structure, presets)
}

function button(
	name: string,
	text: string,
	bgcolor: number,
	presetAction: CompanionPresetAction<ActionsSchema>,
): CompanionPresetDefinitions<ModuleSchema>[string] {
	return {
		type: 'simple',
		name,
		style: { text, size: 'auto', color: white, bgcolor, show_topbar: false },
		steps: [{ down: [presetAction], up: [] }],
		feedbacks: [],
	}
}

function action<TKey extends keyof ActionsSchema>(
	actionId: TKey,
	options: ActionsSchema[TKey]['options'],
): CompanionPresetAction<ActionsSchema> {
	return { actionId, options } as CompanionPresetAction<ActionsSchema>
}
