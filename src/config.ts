import { Regex, type SomeCompanionConfigField } from '@companion-module/base'
import { isIP } from 'node:net'

export type FeedbackValueMode = 'normalized' | 'raw'

export type ModuleConfig = {
	host: string
	targetPort: number
	enableFeedback: boolean
	listenAddress: string
	listenPort: number
	feedbackValueMode: FeedbackValueMode
	freshnessTimeoutMs: number
	mediaSourceNames: string
	presetNames: string
	presetCatalog: string
}

export const DEFAULT_CONFIG: ModuleConfig = {
	host: '127.0.0.1',
	targetPort: 6000,
	enableFeedback: true,
	listenAddress: '0.0.0.0',
	listenPort: 7000,
	feedbackValueMode: 'normalized',
	freshnessTimeoutMs: 5000,
	mediaSourceNames: '',
	presetNames: '',
	presetCatalog: '{}',
}

export function normalizeConfig(config: Partial<ModuleConfig>): ModuleConfig {
	return {
		host: String(config.host || DEFAULT_CONFIG.host).trim(),
		targetPort: Number(config.targetPort ?? DEFAULT_CONFIG.targetPort),
		enableFeedback: config.enableFeedback ?? DEFAULT_CONFIG.enableFeedback,
		listenAddress: String(config.listenAddress || DEFAULT_CONFIG.listenAddress).trim(),
		listenPort: Number(config.listenPort ?? DEFAULT_CONFIG.listenPort),
		feedbackValueMode: config.feedbackValueMode === 'raw' ? 'raw' : 'normalized',
		freshnessTimeoutMs: Number(config.freshnessTimeoutMs ?? DEFAULT_CONFIG.freshnessTimeoutMs),
		mediaSourceNames: String(config.mediaSourceNames ?? DEFAULT_CONFIG.mediaSourceNames),
		presetNames: String(config.presetNames ?? DEFAULT_CONFIG.presetNames),
		presetCatalog: normalizePresetCatalog(config.presetCatalog),
	}
}

export function validateConfig(config: ModuleConfig): string | undefined {
	if (!isHostOrAddress(config.host)) return 'Target host must be an IPv4, IPv6, or DNS hostname'
	if (!isPort(config.targetPort)) return 'Synesthesia input port must be between 1 and 65535'
	if (!isListenAddress(config.listenAddress)) return 'Listen address must be a local IPv4 address'
	if (!isPort(config.listenPort)) return 'Feedback listen port must be between 1 and 65535'
	if (
		!Number.isInteger(config.freshnessTimeoutMs) ||
		config.freshnessTimeoutMs < 500 ||
		config.freshnessTimeoutMs > 60000
	) {
		return 'Feedback freshness timeout must be between 500 and 60000 ms'
	}
	return undefined
}

function isPort(value: number): boolean {
	return Number.isInteger(value) && value >= 1 && value <= 65535
}

function isHostOrAddress(value: string): boolean {
	if (isIP(value)) return true
	if (value.length < 1 || value.length > 253) return false
	return value.split('.').every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
}

function isListenAddress(value: string): boolean {
	return isIP(value) === 4
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'setup',
			width: 12,
			label: 'OSC port layout',
			value:
				'Enable OSC Input in Synesthesia and send Companion actions to the input port. For state, enable Synesthesia OSC Output and set its destination to this Companion machine and feedback listen port.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Synesthesia host or IP',
			width: 8,
			default: DEFAULT_CONFIG.host,
		},
		{
			type: 'number',
			id: 'targetPort',
			label: 'Synesthesia OSC input port',
			width: 4,
			min: 1,
			max: 65535,
			default: DEFAULT_CONFIG.targetPort,
		},
		{
			type: 'checkbox',
			id: 'enableFeedback',
			label: 'Listen for OSC feedback',
			width: 12,
			default: DEFAULT_CONFIG.enableFeedback,
		},
		{
			type: 'textinput',
			id: 'listenAddress',
			label: 'Local feedback listen address',
			tooltip: 'Use 0.0.0.0 to listen on all IPv4 interfaces.',
			width: 8,
			default: DEFAULT_CONFIG.listenAddress,
			regex: Regex.IP,
			isVisibleExpression: '$(options:enableFeedback) == true',
		},
		{
			type: 'number',
			id: 'listenPort',
			label: 'Local feedback listen port',
			width: 4,
			min: 1,
			max: 65535,
			default: DEFAULT_CONFIG.listenPort,
			isVisibleExpression: '$(options:enableFeedback) == true',
		},
		{
			type: 'dropdown',
			id: 'feedbackValueMode',
			label: 'Expected Synesthesia control output values',
			width: 6,
			default: DEFAULT_CONFIG.feedbackValueMode,
			choices: [
				{ id: 'normalized', label: 'Normalized (0 to 1)' },
				{ id: 'raw', label: 'Raw (scaled)' },
			],
			isVisibleExpression: '$(options:enableFeedback) == true',
		},
		{
			type: 'number',
			id: 'freshnessTimeoutMs',
			label: 'Feedback freshness timeout (ms)',
			width: 6,
			min: 500,
			max: 60000,
			default: DEFAULT_CONFIG.freshnessTimeoutMs,
			isVisibleExpression: '$(options:enableFeedback) == true',
		},
		{
			type: 'textinput',
			id: 'mediaSourceNames',
			label: 'Optional quick media/live source names',
			tooltip:
				'One exact Synesthesia media/source name per line. These become direct-selection buttons; omit USB devices you never want selected. Native Media Previous/Next is always available but cannot filter sources.',
			width: 12,
			multiline: true,
			default: DEFAULT_CONFIG.mediaSourceNames,
		},
		{
			type: 'static-text',
			id: 'presetNavigationInfo',
			width: 12,
			label: 'Preset navigation',
			value:
				'Preset Previous/Next remembers presets created through Companion per scene and preserves that catalog across restarts. Synesthesia does not expose existing preset names or native preset-step routes over OSC; Fav 1 through 10 remain available for existing presets.',
		},
	]
}

export type PresetCatalog = Record<string, string[]>

export function parsePresetCatalog(config: ModuleConfig): PresetCatalog {
	try {
		const parsed = JSON.parse(config.presetCatalog) as unknown
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
		const result: PresetCatalog = {}
		for (const [scene, names] of Object.entries(parsed)) {
			if (!Array.isArray(names)) continue
			result[scene] = names.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
		}
		return result
	} catch {
		return {}
	}
}

export function serializePresetCatalog(catalog: PresetCatalog): string {
	return JSON.stringify(catalog)
}

export function configuredMediaSources(config: ModuleConfig): string[] {
	return configuredNames(config.mediaSourceNames)
}

export function configuredPresetNames(config: ModuleConfig): string[] {
	return configuredNames(config.presetNames)
}

function configuredNames(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((name) => name.trim())
		.filter((name, index, names) => name.length > 0 && names.indexOf(name) === index)
}

function normalizePresetCatalog(value: unknown): string {
	if (typeof value !== 'string') return DEFAULT_CONFIG.presetCatalog
	try {
		const parsed = JSON.parse(value)
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? JSON.stringify(parsed) : '{}'
	} catch {
		return '{}'
	}
}
