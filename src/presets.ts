import type {
	CompanionPresetAction,
	CompanionPresetDefinitions,
	CompanionPresetFeedback,
	CompanionPresetSection,
} from '@companion-module/base'
import type ModuleInstance from './main.js'
import type { ActionsSchema } from './actions.js'
import type { FeedbacksSchema } from './feedbacks.js'
import type { ModuleSchema } from './main.js'

const white = 0xffffff
const blue = 0x154c79
const purple = 0x5b2380
const green = 0x006600
const red = 0x660000
const positions = Array.from({ length: 16 }, (_, index) => ({
	name: `Position ${index + 1}`,
	value: String(index + 1),
}))
type PresetDefinition = NonNullable<CompanionPresetDefinitions<ModuleSchema>[string]>
type SimplePresetDefinition = Extract<PresetDefinition, { type: 'simple' }>

export function UpdatePresets(self: ModuleInstance): void {
	const structure: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'playback',
			name: 'Playback and Rendering',
			definitions: [
				{
					id: 'transport',
					name: 'Playlist Transport',
					type: 'simple',
					presets: [
						'playlist_previous',
						'playlist_next',
						'playlist_play',
						'playlist_stop',
						'playlist_toggle',
						'playlist_select',
					],
				},
				{
					id: 'playlist-positions',
					name: 'Playlist Positions',
					type: 'template',
					presetId: 'playlist_position',
					templateVariableName: 'position',
					templateValues: positions,
				},
				{
					id: 'favslots',
					name: 'Favslots',
					type: 'simple',
					presets: [
						'favslot_1',
						'favslot_2',
						'favslot_3',
						'favslot_4',
						'favslot_5',
						'favslot_6',
						'favslot_7',
						'favslot_8',
						'favslot_9',
						'favslot_10',
					],
				},
				{
					id: 'rendering',
					name: 'Rendering',
					type: 'simple',
					presets: ['render_on', 'render_off'],
				},
			],
		},
		{
			id: 'scenes',
			name: 'Scenes, Presets, and Media',
			definitions: [
				{
					id: 'ready-to-edit',
					name: 'Ready-to-edit Controls',
					description:
						'Open each action and replace the placeholder with a name or position from your Synesthesia project.',
					type: 'simple',
					presets: [
						'launch_scene',
						'launch_preset_all',
						'launch_preset_scene',
						'launch_preset_meta',
						'launch_preset_media',
						'preset_previous_configured',
						'preset_next_configured',
						'select_media_name',
						'select_media_position',
						'media_previous_configured',
						'media_next_configured',
						'create_preset',
					],
				},
			],
		},
		{
			id: 'banks',
			name: 'Control Banks',
			definitions: [
				{
					id: 'scene-bank',
					name: 'Scene Controls',
					type: 'simple',
					presets: ['scene_default', 'scene_random', 'scene_undo', 'scene_lock_toggle'],
				},
				{
					id: 'meta-bank',
					name: 'Meta Controls',
					type: 'simple',
					presets: ['meta_default', 'meta_random', 'meta_undo', 'meta_lock_toggle'],
				},
				{
					id: 'brightness',
					name: 'Meta Brightness',
					type: 'template',
					presetId: 'meta_brightness',
					templateVariableName: 'value',
					templateValues: [
						{ name: 'Brightness 0%', value: '0' },
						{ name: 'Brightness 25%', value: '0.25' },
						{ name: 'Brightness 50%', value: '0.5' },
						{ name: 'Brightness 75%', value: '0.75' },
						{ name: 'Brightness 100%', value: '1' },
					],
				},
				{
					id: 'brightness-rotary',
					name: 'Meta Brightness Rotary',
					type: 'simple',
					presets: ['meta_brightness_rotary'],
				},
			],
		},
		{
			id: 'global-controls',
			name: 'Global Controls',
			description: 'Position templates address the same physical control slot across scene changes.',
			definitions: [
				{
					id: 'rich-rotary',
					name: 'Dynamic LCD Example',
					type: 'simple',
					presets: ['global_slider_1_rotary'],
				},
				positionTemplate('global-sliders', 'Slider Rotaries', 'global_slider_rotary'),
				positionTemplate('global-knobs', 'Knob Rotaries', 'global_knob_rotary'),
				positionTemplate('global-toggles', 'Toggle Buttons', 'global_toggle'),
				positionTemplate('global-bangs', 'Bang Buttons', 'global_bang'),
			],
		},
		{
			id: 'state',
			name: 'State and Diagnostics',
			definitions: [
				{
					id: 'state-status',
					name: 'OSC State',
					type: 'simple',
					presets: ['current_scene', 'listener_status', 'feedback_status', 'osc_last_address', 'current_scene_match'],
				},
			],
		},
	]

	const presets: CompanionPresetDefinitions<ModuleSchema> = {
		playlist_previous: button('Playlist Previous', 'PREV', blue, action('playlist_previous', {})),
		playlist_next: button('Playlist Next', 'NEXT', blue, action('playlist_next', {})),
		playlist_play: button('Playlist Play', 'PLAY', blue, action('playlist_play', { shouldPlay: true })),
		playlist_stop: button('Playlist Stop', 'STOP', blue, action('playlist_play', { shouldPlay: false })),
		playlist_toggle: button('Playlist Toggle Play', 'PLAY\nTOGGLE', blue, action('playlist_toggle_play', {})),
		playlist_select: button(
			'Select Playlist by Name',
			'SELECT\nPLAYLIST',
			blue,
			action('playlist_select', { name: '' }),
		),
		playlist_position: templatedButton(
			'Playlist Position',
			'PLAYLIST\n$(local:position)',
			blue,
			'position',
			action('playlist_position', { position: expression('$(local:position)') }),
		),
		render_on: button('Enable Rendering', 'RENDER\nON', green, action('render_enabled', { enabled: true })),
		render_off: button('Disable Rendering', 'RENDER\nOFF', red, action('render_enabled', { enabled: false })),
		launch_scene: button(
			'Launch Scene by Name',
			'LAUNCH\nSCENE',
			purple,
			action('launch_scene', { scene: '', preset: '' }),
		),
		launch_preset_all: presetLaunchButton('Launch Preset: All Channels', 'all'),
		launch_preset_scene: presetLaunchButton('Launch Preset: Scene Controls', 'scene'),
		launch_preset_meta: presetLaunchButton('Launch Preset: Meta Controls', 'meta'),
		launch_preset_media: presetLaunchButton('Launch Preset: Media', 'media'),
		preset_previous_configured: button(
			'Previous Configured/Remembered Preset',
			'PRESET\nPREVIOUS',
			purple,
			action('cycle_configured_preset', { direction: 'previous', channel: 'all' }),
		),
		preset_next_configured: button(
			'Next Configured/Remembered Preset',
			'PRESET\nNEXT',
			purple,
			action('cycle_configured_preset', { direction: 'next', channel: 'all' }),
		),
		select_media_name: button(
			'Select Media by Name',
			'MEDIA\nNAME',
			purple,
			action('select_media', { mode: 'name', name: '', position: '1' }),
		),
		select_media_position: button(
			'Select Media by Position',
			'MEDIA\nPOSITION',
			purple,
			action('select_media', { mode: 'position', name: '', position: '1' }),
		),
		media_previous_configured: button(
			'Previous Configured Media/Live Source',
			'MEDIA\nPREVIOUS',
			purple,
			action('cycle_configured_media', { direction: 'previous' }),
		),
		media_next_configured: button(
			'Next Configured Media/Live Source',
			'MEDIA\nNEXT',
			purple,
			action('cycle_configured_media', { direction: 'next' }),
		),
		create_preset: longPressButton(
			'Create Preset from Current State',
			'HOLD TO\nCREATE PRESET',
			purple,
			action('create_preset', { name: '' }),
		),
		scene_default: bankButton('Scene Controls Default', 'SCENE\nDEFAULT', 'scene', 'default'),
		scene_random: bankButton('Scene Controls Random', 'SCENE\nRANDOM', 'scene', 'random'),
		scene_undo: bankButton('Scene Controls Undo', 'SCENE\nUNDO', 'scene', 'undo'),
		scene_lock: bankButton('Lock Scene Controls', 'SCENE\nLOCK', 'scene', 'lock', true),
		scene_unlock: bankButton('Unlock Scene Controls', 'SCENE\nUNLOCK', 'scene', 'lock', false),
		scene_lock_toggle: bankLockButton('scene'),
		meta_default: bankButton('Meta Controls Default', 'META\nDEFAULT', 'meta', 'default'),
		meta_random: bankButton('Meta Controls Random', 'META\nRANDOM', 'meta', 'random'),
		meta_undo: bankButton('Meta Controls Undo', 'META\nUNDO', 'meta', 'undo'),
		meta_lock: bankButton('Lock Meta Controls', 'META\nLOCK', 'meta', 'lock', true),
		meta_unlock: bankButton('Unlock Meta Controls', 'META\nUNLOCK', 'meta', 'lock', false),
		meta_lock_toggle: bankLockButton('meta'),
		meta_brightness: templatedButton(
			'Meta Brightness',
			'BRIGHTNESS\n$(local:value)',
			purple,
			'value',
			action('set_meta_control', { name: 'brightness', values: expression('$(local:value)'), raw: false }),
		),
		meta_brightness_rotary: metaRotary(
			'Meta Brightness Rotary',
			'BRIGHTNESS\n$(Synesthesia:meta_brightness_value)',
			'brightness',
		),
		global_slider_1_rotary: rotary(
			'Global Slider 1 Rotary with Dynamic LCD',
			'$(Synesthesia:global_slider_1_name)\n$(Synesthesia:global_slider_1_value)',
			'slider',
			'1',
		),
		global_slider_rotary: templatedRotary('Global Slider Rotary', 'SLIDER\n$(local:position)', 'slider'),
		global_knob_rotary: templatedRotary('Global Knob Rotary', 'KNOB\n$(local:position)', 'knob'),
		global_toggle: {
			type: 'simple',
			name: 'Global Toggle',
			localVariables: [localVariable('position', '1')],
			style: style('TOGGLE\n$(local:position)', purple),
			steps: [{ down: [action('toggle_global_toggle', { position: expression('$(local:position)') })], up: [] }],
			feedbacks: [
				feedback(
					'global_toggle',
					{ position: expression('$(local:position)'), state: true },
					{ bgcolor: 0x00cc44, color: 0x000000 },
				),
			],
		},
		global_bang: bangButton(),
		current_scene: display('Current Scene', 'SCENE\n$(Synesthesia:current_scene)', blue),
		listener_status: statusButton(
			'OSC Feedback Listener Status',
			'OSC LISTENER\nCLOSED',
			'OSC LISTENER\nREADY',
			'listener_ready',
			'socket_listening',
		),
		feedback_status: statusButton(
			'OSC Feedback Freshness',
			'OSC FEEDBACK\nSTALE',
			'OSC FEEDBACK\nFRESH',
			'feedback_fresh',
			'feedback_fresh',
		),
		osc_last_address: display('Last OSC Address Received', 'OSC LAST\n$(Synesthesia:osc_last_address)', blue),
		current_scene_match: {
			type: 'simple',
			name: 'Current Scene Match',
			localVariables: [localVariable('scene', '')],
			style: style('SCENE\n$(local:scene)', red),
			steps: [],
			feedbacks: [
				feedback(
					'current_scene',
					{ scene: expression('$(local:scene)'), caseSensitive: false },
					{ bgcolor: green, color: white },
				),
			],
		},
	}

	for (let position = 1; position <= 10; position++) {
		presets[`favslot_${position}`] = button(
			`Favslot ${position}`,
			`FAV\n${position}`,
			purple,
			action('favslot_trigger', { position: String(position) }),
		)
	}

	self.setPresetDefinitions(structure, presets)
}

function positionTemplate(id: string, name: string, presetId: string) {
	return { id, name, type: 'template' as const, presetId, templateVariableName: 'position', templateValues: positions }
}

function button(
	name: string,
	text: string,
	bgcolor: number,
	presetAction: CompanionPresetAction<ActionsSchema>,
): SimplePresetDefinition {
	return { type: 'simple', name, style: style(text, bgcolor), steps: [{ down: [presetAction], up: [] }], feedbacks: [] }
}

function templatedButton(
	name: string,
	text: string,
	bgcolor: number,
	variableName: string,
	presetAction: CompanionPresetAction<ActionsSchema>,
): SimplePresetDefinition {
	return { ...button(name, text, bgcolor, presetAction), localVariables: [localVariable(variableName, '1')] }
}

function longPressButton(
	name: string,
	text: string,
	bgcolor: number,
	presetAction: CompanionPresetAction<ActionsSchema>,
): SimplePresetDefinition {
	return {
		type: 'simple',
		name,
		style: style(text, bgcolor),
		steps: [{ down: [], up: [], 1000: { options: { runWhileHeld: true }, actions: [presetAction] } }],
		feedbacks: [],
	}
}

function presetLaunchButton(name: string, channel: 'all' | 'scene' | 'meta' | 'media') {
	return button(name, `PRESET\n${channel.toUpperCase()}`, purple, action('launch_preset', { name: '', channel }))
}

function bankButton(
	name: string,
	text: string,
	bank: 'scene' | 'meta',
	operation: 'default' | 'random' | 'undo' | 'lock',
	locked = true,
) {
	return button(name, text, purple, action('bank_operation', { bank, operation, locked }))
}

function rotary(
	name: string,
	text: string,
	type: 'slider' | 'knob',
	position: string | ReturnType<typeof expression>,
): PresetDefinition {
	return {
		type: 'simple',
		name,
		keywords: ['rotary', 'dial', 'encoder'],
		style: style(text, blue),
		steps: [
			{
				down: [],
				up: [],
				rotate_left: [action('adjust_global_scalar', { type, position, delta: '-0.05' })],
				rotate_right: [action('adjust_global_scalar', { type, position, delta: '0.05' })],
			},
		],
		feedbacks: [],
	}
}

function templatedRotary(name: string, text: string, type: 'slider' | 'knob') {
	return {
		...rotary(name, text, type, expression('$(local:position)')),
		localVariables: [localVariable('position', '1')],
	}
}

function metaRotary(name: string, text: string, controlName: string): SimplePresetDefinition {
	return {
		type: 'simple',
		name,
		keywords: ['rotary', 'dial', 'encoder', 'meta'],
		style: style(text, blue),
		steps: [
			{
				down: [],
				up: [],
				rotate_left: [action('adjust_meta_scalar', { name: controlName, delta: '-0.05' })],
				rotate_right: [action('adjust_meta_scalar', { name: controlName, delta: '0.05' })],
			},
		],
		feedbacks: [],
	}
}

function bangButton(): SimplePresetDefinition {
	const position = expression('$(local:position)')
	return {
		type: 'simple',
		name: 'Global Bang',
		localVariables: [localVariable('position', '1')],
		style: style('BANG\n$(local:position)', purple),
		steps: [
			{
				down: [action('set_global_control', { type: 'bang', position, values: '1', raw: false })],
				up: [action('set_global_control', { type: 'bang', position, values: '0', raw: false })],
			},
		],
		feedbacks: [],
	}
}

function bankLockButton(bank: 'scene' | 'meta'): SimplePresetDefinition {
	const label = bank.toUpperCase()
	const variable = `${bank}_bank_locked`
	return {
		type: 'simple',
		name: `Toggle ${label} Control Bank Lock`,
		style: expressionStyle(`bool($(Synesthesia:${variable})) ? '${label}\\nLOCKED' : '${label}\\nUNLOCKED'`, green),
		steps: [{ down: [action('toggle_bank_lock', { bank })], up: [] }],
		feedbacks: [feedback('bank_locked', { bank, locked: true }, { bgcolor: red, color: white })],
	}
}

function display(name: string, text: string, bgcolor: number): PresetDefinition {
	return { type: 'simple', name, style: style(text, bgcolor), steps: [], feedbacks: [] }
}

function statusButton(
	name: string,
	inactiveText: string,
	activeText: string,
	feedbackId: 'listener_ready' | 'feedback_fresh',
	variableId: 'socket_listening' | 'feedback_fresh',
): PresetDefinition {
	return {
		type: 'simple',
		name,
		style: expressionStyle(
			`bool($(Synesthesia:${variableId})) ? '${activeText.replace('\n', '\\n')}' : '${inactiveText.replace('\n', '\\n')}'`,
			red,
		),
		steps: [],
		feedbacks: [feedback(feedbackId, {}, { bgcolor: green, color: white })],
	}
}

function style(text: string, bgcolor: number) {
	return { text, size: 'auto' as const, color: white, bgcolor, show_topbar: false }
}

function expressionStyle(text: string, bgcolor: number) {
	return { ...style(text, bgcolor), textExpression: true }
}

function localVariable(variableName: string, startupValue: string) {
	return { variableName, variableType: 'simple' as const, startupValue }
}

function expression(value: string) {
	return { isExpression: true as const, value }
}

type PresetAction<TKey extends keyof ActionsSchema> = Extract<CompanionPresetAction<ActionsSchema>, { actionId: TKey }>

function action<TKey extends keyof ActionsSchema>(
	actionId: TKey,
	options: PresetAction<TKey>['options'],
): PresetAction<TKey> {
	return { actionId, options } as PresetAction<TKey>
}

type PresetFeedback<TKey extends keyof FeedbacksSchema> = Extract<
	CompanionPresetFeedback<FeedbacksSchema>,
	{ feedbackId: TKey }
>

function feedback<TKey extends keyof FeedbacksSchema>(
	feedbackId: TKey,
	options: PresetFeedback<TKey>['options'],
	styleResult: PresetFeedback<TKey>['style'],
): PresetFeedback<TKey> {
	return { feedbackId, options, style: styleResult } as PresetFeedback<TKey>
}
