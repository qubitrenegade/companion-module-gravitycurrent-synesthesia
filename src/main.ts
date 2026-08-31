import {
	InstanceBase,
	InstanceStatus,
	type OSCMetaArgument,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import {
	configuredMediaSources,
	configuredPresetNames,
	GetConfigFields,
	normalizeConfig,
	parsePresetCatalog,
	serializePresetCatalog,
	validateConfig,
	type ModuleConfig,
} from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { FeedbackListener, InboundOscProcessor } from './osc.js'
import {
	displayControlName,
	formatNumber,
	META_CONTROL_DEFINITIONS,
	metaControlDefinition,
	metaControlLabel,
	SynesthesiaState,
	type ActiveGlobalControl,
	type StateChange,
} from './state.js'

export type SurfaceMode = 'scene' | 'meta' | 'media' | 'favs'
type SurfaceButton =
	| { kind: 'all-bank-random'; label: string }
	| { kind: 'bank-random'; bank: 'scene' | 'meta'; label: string }
	| { kind: 'group-lock'; bank: 'scene' | 'meta'; group: string; label: string }
	| { kind: 'global'; control: ActiveGlobalControl; label: string }
	| { kind: 'meta'; name: string; controlKind: 'toggle' | 'bang'; label: string }
	| { kind: 'media-nav'; direction: 'previous' | 'next'; label: string }
	| { kind: 'media'; name: string; label: string }
	| { kind: 'fav'; position: number; label: string }
type SurfaceRotary =
	| { kind: 'global'; control: ActiveGlobalControl; component: string; label: string }
	| { kind: 'meta'; name: string; component: string; label: string }

const SURFACE_BUTTON_SLOTS = 16
const SURFACE_TOP_BUTTON_SLOTS = 7
const SURFACE_BOTTOM_BUTTON_SLOTS = 9
const SURFACE_ROTARY_SLOTS = 6

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config = normalizeConfig({})
	readonly state: SynesthesiaState

	private readonly listener = new FeedbackListener()
	private readonly processor: InboundOscProcessor
	private destroyed = false
	private configuredMediaIndex = -1
	private configuredPresetIndex = -1
	private configuredPresetScene = ''
	private surfaceMode: SurfaceMode = 'scene'
	private surfacePage = 0
	private mediaSourceView = false
	private readonly surfaceComponents = new Map<string, string>()
	private readonly surfaceLocks = new Map<string, boolean>()
	private playlistPlaying = false
	private renderEnabled = true
	private selectedMedia = ''
	private presetCreated = false

	constructor(internal: unknown) {
		super(internal)
		this.state = new SynesthesiaState((change) => this.applyStateChange(change), this.config.freshnessTimeoutMs)
		this.processor = new InboundOscProcessor(this.state, this.config.feedbackValueMode, (message) =>
			this.log('debug', message),
		)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = normalizeConfig(config)
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.setVariableValues(this.state.getInitialVariableValues())
		this.refreshSurface()
		await this.applyConfig()
	}

	async destroy(): Promise<void> {
		this.destroyed = true
		await this.listener.stop()
		this.state.destroy()
		this.log('debug', 'Synesthesia OSC instance destroyed')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = normalizeConfig(config)
		this.configuredMediaIndex = -1
		this.configuredPresetIndex = -1
		this.configuredPresetScene = ''
		this.mediaSourceView = false
		this.state.setFreshnessTimeout(this.config.freshnessTimeoutMs)
		this.processor.setValueMode(this.config.feedbackValueMode)
		this.refreshSurface()
		await this.applyConfig()
	}

	setSurfaceMode(mode: SurfaceMode): void {
		// Selecting Media again is the compact surface's deliberate controls/sources switch.
		if (mode === 'media' && this.surfaceMode === 'media') {
			this.mediaSourceView = !this.mediaSourceView
		} else {
			this.surfaceMode = mode
			this.mediaSourceView = false
		}
		this.surfacePage = 0
		this.refreshSurface()
	}

	changeSurfacePage(direction: 'previous' | 'next'): void {
		const count = this.surfacePageCount()
		this.surfacePage = (this.surfacePage + (direction === 'next' ? 1 : -1) + count) % count
		this.refreshSurface()
	}

	isSurfaceMode(mode: SurfaceMode): boolean {
		return this.surfaceMode === mode
	}

	isSurfaceButtonOn(slot: number): boolean {
		const button = this.surfaceButton(slot)
		if (!button) return false
		if (button.kind === 'global' && button.control.type === 'toggle') {
			return (this.state.getNumericValue('toggle', button.control.position) ?? 0) !== 0
		}
		if (button.kind === 'meta' && button.controlKind === 'toggle') {
			return (this.state.getMetaNumericValue(button.name) ?? 0) !== 0
		}
		if (button.kind === 'group-lock') return false
		return button.kind === 'media' && button.name === this.selectedMedia
	}

	private surfaceButtonKind(button: SurfaceButton | undefined): string {
		if (!button) return ''
		if (button.kind === 'global') return button.control.type
		if (button.kind === 'meta') return button.controlKind
		if (button.kind === 'media-nav') return 'navigation'
		if (button.kind === 'all-bank-random' || button.kind === 'bank-random') return 'bang'
		if (button.kind === 'group-lock') return 'toggle'
		return 'select'
	}

	isSurfaceButtonLocked(slot: number): boolean {
		const button = this.surfaceButton(slot)
		return button?.kind === 'group-lock'
			? (this.surfaceLocks.get(groupLockKey(button.bank, button.group)) ?? false)
			: false
	}

	isSurfaceRotaryLocked(slot: number): boolean {
		const rotary = this.surfaceRotary(slot)
		return rotary ? (this.surfaceLocks.get(rotaryKey(rotary)) ?? false) : false
	}

	triggerSurfaceButton(slot: number, pressed: boolean): void {
		const button = this.surfaceButton(slot)
		if (!button) return
		if (button.kind === 'all-bank-random') {
			if (pressed) this.allBankOperation('random')
			return
		}
		if (button.kind === 'bank-random') {
			if (pressed) this.sendOsc(`/controls/banks/${button.bank}/random`)
			return
		}
		if (button.kind === 'group-lock') {
			if (pressed) {
				const key = groupLockKey(button.bank, button.group)
				const locked = !(this.surfaceLocks.get(key) ?? false)
				this.surfaceLocks.set(key, locked)
				this.sendOsc(`/controls/groups/${button.bank}/${button.group}/lock`, [{ type: 'f', value: locked ? 1 : 0 }])
				this.refreshSurface()
			}
			return
		}
		if (button.kind === 'media') {
			if (pressed) {
				this.sendOsc('/media/name', [{ type: 's', value: button.name }])
				this.selectedMedia = button.name
				this.refreshSurface()
			}
			return
		}
		if (button.kind === 'media-nav') {
			if (pressed) this.sendOsc(`/media/${button.direction}`)
			return
		}
		if (button.kind === 'fav') {
			if (pressed) this.sendOsc(`/favslots/${button.position}`)
			return
		}
		if (button.kind === 'meta') {
			if (button.controlKind === 'bang') {
				this.sendOsc(`/controls/meta/${button.name}`, [{ type: 'f', value: pressed ? 1 : 0 }])
				this.state.setMetaControlValue(button.name, { kind: 'bang', value: pressed })
			} else if (pressed) {
				const next = (this.state.getMetaNumericValue(button.name) ?? 0) === 0
				this.sendOsc(`/controls/meta/${button.name}`, [{ type: 'f', value: next ? 1 : 0 }])
				this.state.setMetaControlValue(button.name, { kind: 'toggle', value: next })
			}
			this.refreshSurface()
			return
		}
		const { type, position } = button.control
		if (type === 'bang') {
			this.sendOsc(`/controls/global/bang/${position}`, [{ type: 'f', value: pressed ? 1 : 0 }])
			this.state.setControlValue('bang', position, { kind: 'bang', value: pressed })
		} else if (type === 'toggle' && pressed) {
			const next = (this.state.getNumericValue('toggle', position) ?? 0) === 0
			this.sendOsc(`/controls/global/toggle/${position}`, [{ type: 'f', value: next ? 1 : 0 }])
			this.state.setControlValue('toggle', position, { kind: 'toggle', value: next })
		}
		this.refreshSurface()
	}

	adjustSurfaceRotary(slot: number, delta: number): void {
		if (this.config.feedbackValueMode !== 'normalized') throw new Error('Dynamic rotary requires normalized values')
		const rotary = this.surfaceRotary(slot)
		if (!rotary || this.isSurfaceRotaryLocked(slot)) return
		if (rotary.kind === 'meta') {
			const current = this.state.getMetaNumericValue(rotary.name, rotary.component)
			if (current === undefined) throw new Error(`No normalized OSC feedback for meta control ${rotary.name}`)
			const next = clamp(current + delta)
			const component = rotary.component === 'value' ? '' : `/${rotary.component}`
			this.sendOsc(`/controls/meta/${rotary.name}${component}`, [{ type: 'f', value: next }])
			this.state.setMetaNumericComponent(rotary.name, rotary.component, next)
		} else {
			const { type, position } = rotary.control
			const current = this.state.getNumericValue(type, position, rotary.component)
			if (current === undefined) throw new Error(`No normalized OSC feedback for global ${type} ${position}`)
			const next = clamp(current + delta)
			const component = type === 'xy' || type === 'color' ? `/${rotary.component}` : ''
			this.sendOsc(`/controls/global/${type}/${position}${component}`, [{ type: 'f', value: next }])
			this.state.setNumericComponent(type, position, rotary.component, next)
		}
		this.refreshSurface()
	}

	resetSurfaceRotary(slot: number): void {
		const rotary = this.surfaceRotary(slot)
		if (!rotary) return
		const path =
			rotary.kind === 'meta'
				? `/controls/meta/${rotary.name}/default`
				: `/controls/global/${rotary.control.type}/${rotary.control.position}/default`
		this.sendOsc(path)
	}

	touchSurfaceRotary(slot: number): void {
		const rotary = this.surfaceRotary(slot)
		if (!rotary) return
		const value = rotary.kind === 'meta' ? this.state.metaValues.get(rotary.name) : rotary.control.value
		const declaredKind = rotary.kind === 'meta' ? metaControlDefinition(rotary.name)?.kind : undefined
		const multidimensionalKind =
			value?.kind === 'xy' || value?.kind === 'color'
				? value.kind
				: rotary.kind === 'global' && (rotary.control.type === 'xy' || rotary.control.type === 'color')
					? rotary.control.type
					: declaredKind === 'color'
						? 'color'
						: undefined
		if (multidimensionalKind) {
			const components = multidimensionalKind === 'xy' ? ['x', 'y'] : ['r', 'g', 'b']
			const key = rotary.kind === 'meta' ? `meta:${rotary.name}` : controlComponentKey(rotary.control)
			const current = this.surfaceComponents.get(key) ?? components[0]
			this.surfaceComponents.set(key, components[(components.indexOf(current) + 1) % components.length])
		} else {
			const key = rotaryKey(rotary)
			const locked = !(this.surfaceLocks.get(key) ?? false)
			this.surfaceLocks.set(key, locked)
			const path =
				rotary.kind === 'meta'
					? `/controls/meta/${rotary.name}/lock`
					: `/controls/global/${rotary.control.type}/${rotary.control.position}/lock`
			this.sendOsc(path, [{ type: 'f', value: locked ? 1 : 0 }])
		}
		this.refreshSurface()
	}

	activeBankOperation(operation: 'default' | 'undo' | 'random'): void {
		if (this.surfaceMode === 'scene' || this.surfaceMode === 'meta') {
			this.sendOsc(`/controls/banks/${this.surfaceMode}/${operation}`)
			return
		}
		if (this.surfaceMode === 'media') {
			if (operation === 'undo') {
				this.sendOsc('/controls/banks/meta/undo')
				return
			}
			for (const control of this.mediaMetaDefinitions()) this.sendOsc(`/controls/meta/${control.name}/default`)
		}
	}

	allBankOperation(operation: 'default' | 'undo' | 'random'): void {
		this.sendOsc(`/controls/banks/scene/${operation}`)
		this.sendOsc(`/controls/banks/meta/${operation}`)
	}

	togglePlaylistPlaying(): void {
		this.playlistPlaying = !this.playlistPlaying
		this.sendOsc('/playlist/toggleplay')
		this.refreshSurface()
	}

	toggleRendering(): void {
		this.renderEnabled = !this.renderEnabled
		this.sendOsc('/render/enabled', [{ type: 'i', value: this.renderEnabled ? 1 : 0 }])
		this.refreshSurface()
	}

	markPresetCreated(): void {
		this.presetCreated = true
		this.refreshSurface()
	}

	clearPresetCreated(): void {
		if (!this.presetCreated) return
		this.presetCreated = false
		this.refreshSurface()
	}

	isPlaylistPlaying(): boolean {
		return this.playlistPlaying
	}

	isRenderingEnabled(): boolean {
		return this.renderEnabled
	}

	isPresetCreated(): boolean {
		return this.presetCreated
	}

	cycleConfiguredMedia(direction: 'previous' | 'next'): string {
		const sources = configuredMediaSources(this.config)
		if (sources.length === 0) throw new Error('No allowed media/live source names are configured')
		if (this.configuredMediaIndex < 0) {
			this.configuredMediaIndex = direction === 'next' ? 0 : sources.length - 1
		} else {
			const offset = direction === 'next' ? 1 : -1
			this.configuredMediaIndex = (this.configuredMediaIndex + offset + sources.length) % sources.length
		}
		return sources[this.configuredMediaIndex]
	}

	rememberPreset(name: string): void {
		const scene = this.state.currentScene || '_unknown'
		const catalog = parsePresetCatalog(this.config)
		const names = catalog[scene] ?? []
		if (names.includes(name)) return
		catalog[scene] = [...names, name]
		this.config = { ...this.config, presetCatalog: serializePresetCatalog(catalog) }
		this.saveConfig(this.config, undefined)
	}

	generatePresetName(): string {
		const date = new Date()
		const pad = (value: number): string => String(value).padStart(2, '0')
		return `${pad(date.getFullYear() % 100)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} - Companion`
	}

	cycleConfiguredPreset(direction: 'previous' | 'next'): string {
		const scene = this.state.currentScene || '_unknown'
		const learned = parsePresetCatalog(this.config)[scene] ?? []
		const names = [...new Set(['default', ...configuredPresetNames(this.config), ...learned])]
		if (this.configuredPresetScene !== scene) {
			this.configuredPresetScene = scene
			this.configuredPresetIndex = -1
		}
		if (names.length === 0) throw new Error('No preset names are configured or remembered')
		if (this.configuredPresetIndex < 0) {
			this.configuredPresetIndex = direction === 'next' ? 0 : names.length - 1
		} else {
			const offset = direction === 'next' ? 1 : -1
			this.configuredPresetIndex = (this.configuredPresetIndex + offset + names.length) % names.length
		}
		return names[this.configuredPresetIndex]
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	sendOsc(address: string, args: OSCMetaArgument[] = []): void {
		const error = validateConfig(this.config)
		if (error) {
			this.log('warn', `OSC message not sent: ${error}`)
			return
		}
		try {
			this.oscSend(this.config.host, this.config.targetPort, address, args)
			this.log('debug', `Sent OSC ${address}`)
		} catch (sendError) {
			this.log('error', `Could not queue OSC ${address}: ${formatError(sendError)}`)
		}
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	private async applyConfig(): Promise<void> {
		const error = validateConfig(this.config)
		if (error) {
			await this.listener.stop()
			this.state.setListenerReady(false)
			this.updateStatus(InstanceStatus.BadConfig, error)
			return
		}

		/*
		 * OSC over UDP has no connect handshake. The status reports whether local
		 * configuration and listener setup succeeded, while the freshness feedback
		 * separately reports whether Synesthesia has sent recent supported state.
		 * Replacing and awaiting the old listener prevents config updates from leaking
		 * sockets or allowing an old port to keep changing current state.
		 */
		await this.listener.stop()
		this.state.setListenerReady(false)
		if (!this.config.enableFeedback) {
			this.updateStatus(InstanceStatus.Ok, 'Outbound OSC configured; feedback listener disabled')
			return
		}

		this.updateStatus(InstanceStatus.Connecting, 'Opening OSC feedback listener')
		await this.listener.start(this.config.listenPort, this.config.listenAddress, {
			onListening: () => {
				if (this.destroyed) return
				this.state.setListenerReady(true)
				this.updateStatus(
					InstanceStatus.Ok,
					`Listening for OSC feedback on ${this.config.listenAddress}:${this.config.listenPort}`,
				)
			},
			onMessage: (message) => {
				if (!this.destroyed) this.processor.process(message)
			},
			onError: (listenerError) => {
				if (this.destroyed) return
				this.state.setListenerReady(false)
				this.updateStatus(InstanceStatus.UnknownError, `OSC feedback listener error: ${listenerError.message}`)
				this.log('error', `OSC feedback listener error: ${listenerError.message}`)
			},
			onClose: () => {
				if (!this.destroyed) this.state.setListenerReady(false)
			},
		})
	}

	private applyStateChange(change: StateChange): void {
		if (this.destroyed) return
		if (Object.keys(change.variables).length) this.setVariableValues(change.variables)
		const [firstFeedback, ...otherFeedbacks] = change.feedbacks
		if (firstFeedback) this.checkFeedbacks(firstFeedback, ...otherFeedbacks)
		this.refreshSurface()
	}

	private surfaceTopButtons(): SurfaceButton[] {
		if (this.surfaceMode === 'scene') {
			return [
				{ kind: 'all-bank-random', label: 'RANDOM ALL' },
				{ kind: 'bank-random', bank: 'scene', label: 'RANDOM SELECTED' },
			]
		}
		if (this.surfaceMode === 'meta') {
			return [
				{ kind: 'all-bank-random', label: 'RANDOM ALL' },
				{ kind: 'bank-random', bank: 'meta', label: 'RANDOM SELECTED' },
				this.groupLockButton('meta', 'color', 'COLOR'),
			]
		}
		if (this.surfaceMode === 'media') {
			return [
				{ kind: 'media-nav', direction: 'previous', label: 'SOURCE\nPREVIOUS' },
				{ kind: 'media-nav', direction: 'next', label: 'SOURCE\nNEXT' },
			]
		}
		return []
	}

	private surfacePagedButtons(): SurfaceButton[] {
		if (this.surfaceMode === 'favs') {
			return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((position) => ({ kind: 'fav', position, label: `FAV ${position}` }))
		}
		if (this.surfaceMode === 'media' && this.mediaSourceView) {
			return configuredMediaSources(this.config).map((name) => ({
				kind: 'media' as const,
				name,
				label: displayControlName(name),
			}))
		}
		const buttons: SurfaceButton[] = []
		if (this.surfaceMode === 'meta') {
			for (const control of this.primaryMetaDefinitions()) {
				if (control.kind === 'toggle' || control.kind === 'bang') {
					buttons.push({
						kind: 'meta',
						name: control.name,
						controlKind: control.kind,
						label: control.label,
					})
				}
			}
		}
		if (this.surfaceMode === 'media') {
			for (const control of this.mediaMetaDefinitions()) {
				if (control.kind === 'toggle' || control.kind === 'bang') {
					buttons.push({
						kind: 'meta',
						name: control.name,
						controlKind: control.kind,
						label: control.label,
					})
				}
			}
		}
		if (this.surfaceMode === 'scene') {
			for (const control of this.state.getActiveControls(['toggle', 'bang'])) {
				buttons.push({
					kind: 'global',
					control,
					label: displayControlName(control.name),
				})
			}
		}
		return buttons
	}

	private groupLockButton(bank: 'scene' | 'meta', group: string, label: string): SurfaceButton {
		const locked = this.surfaceLocks.get(groupLockKey(bank, group)) ?? false
		return { kind: 'group-lock', bank, group, label: `${label}\n${locked ? 'LOCKED' : 'UNLOCKED'}` }
	}

	private surfaceRotaries(): SurfaceRotary[] {
		if (this.surfaceMode === 'media' && this.mediaSourceView) return []
		if (this.surfaceMode === 'scene') {
			return this.state.getActiveControls(['slider', 'knob', 'dropdown', 'xy', 'color']).map((control) => {
				const key = controlComponentKey(control)
				const component =
					control.type === 'xy'
						? (this.surfaceComponents.get(key) ?? 'x')
						: control.type === 'color'
							? (this.surfaceComponents.get(key) ?? 'r')
							: 'value'
				return { kind: 'global', control, component, label: displayControlName(control.name) }
			})
		}
		if (this.surfaceMode === 'meta' || this.surfaceMode === 'media') {
			const definitions = this.surfaceMode === 'meta' ? this.primaryMetaDefinitions() : this.mediaMetaDefinitions()
			const known = definitions
				.filter((control) => control.kind === 'scalar' || control.kind === 'color' || control.kind === 'dropdown')
				.map((control) => [control.name, this.state.getMetaControlValue(control.name)] as const)
			const knownNames = new Set(META_CONTROL_DEFINITIONS.map((control) => control.name))
			const discovered =
				this.surfaceMode === 'meta'
					? [...this.state.metaValues.entries()].filter(([name]) => !knownNames.has(name))
					: []
			return [...known, ...discovered].map(([name, receivedValue]) => {
				const definition = metaControlDefinition(name)
				const value =
					receivedValue ??
					(definition?.kind === 'color'
						? { kind: 'color' as const, r: Number.NaN, g: Number.NaN, b: Number.NaN }
						: undefined)
				const key = `meta:${name}`
				const component =
					value?.kind === 'xy'
						? (this.surfaceComponents.get(key) ?? 'x')
						: value?.kind === 'color'
							? (this.surfaceComponents.get(key) ?? 'r')
							: 'value'
				return { kind: 'meta', name, component, label: metaControlLabel(name) }
			})
		}
		return []
	}

	private surfacePageCount(): number {
		// One shared page index drives every control area. Each area clamps that index
		// to page zero until it has enough controls to need paging of its own.
		return Math.max(1, this.surfaceButtonPageCount(), Math.ceil(this.surfaceRotaries().length / SURFACE_ROTARY_SLOTS))
	}

	private surfaceButton(slot: number): SurfaceButton | undefined {
		if (slot < 1 || slot > SURFACE_BUTTON_SLOTS) return undefined
		if (slot <= SURFACE_TOP_BUTTON_SLOTS) {
			return pageItem(this.surfaceTopButtons(), SURFACE_TOP_BUTTON_SLOTS, slot - 1, this.surfacePage)
		}
		if (this.surfaceMode === 'favs') {
			// The two Fav pages intentionally overlap: 1-9, then 2-10.
			const position = slot - SURFACE_TOP_BUTTON_SLOTS - 1
			const start = this.surfacePage === 0 ? 0 : 1
			return this.surfacePagedButtons()[start + position]
		}
		return centeredPageItem(
			this.surfacePagedButtons(),
			SURFACE_BOTTOM_BUTTON_SLOTS,
			slot - SURFACE_TOP_BUTTON_SLOTS - 1,
			this.surfacePage,
		)
	}

	private surfaceButtonPageCount(): number {
		return Math.max(
			1,
			Math.ceil(this.surfaceTopButtons().length / SURFACE_TOP_BUTTON_SLOTS),
			Math.ceil(this.surfacePagedButtons().length / SURFACE_BOTTOM_BUTTON_SLOTS),
		)
	}

	private primaryMetaDefinitions() {
		return META_CONTROL_DEFINITIONS.filter(
			(control) => !['media-color', 'media-transform', 'video'].includes(control.group),
		)
	}

	private mediaMetaDefinitions() {
		return META_CONTROL_DEFINITIONS.filter((control) =>
			['media-color', 'media-transform', 'video'].includes(control.group),
		)
	}

	private surfaceRotary(slot: number): SurfaceRotary | undefined {
		return this.surfaceRotaries()[this.surfacePage * SURFACE_ROTARY_SLOTS + slot - 1]
	}

	private refreshSurface(): void {
		const pageCount = this.surfacePageCount()
		if (this.surfacePage >= pageCount) this.surfacePage = pageCount - 1
		const values: Record<string, string | number> = {
			surface_mode: this.surfaceMode.toUpperCase(),
			surface_view: this.mediaSourceView ? 'SOURCES' : 'CONTROLS',
			surface_media_sources: this.mediaSourceView ? 1 : 0,
			surface_page: this.surfacePage + 1,
			surface_page_count: pageCount,
			playlist_playing: this.playlistPlaying ? 1 : 0,
			render_enabled: this.renderEnabled ? 1 : 0,
			preset_created: this.presetCreated ? 1 : 0,
		}
		for (let slot = 1; slot <= SURFACE_BUTTON_SLOTS; slot++) {
			const button = this.surfaceButton(slot)
			values[`surface_button_${slot}_label`] = button?.label ?? ''
			values[`surface_button_${slot}_kind`] = this.surfaceButtonKind(button)
			values[`surface_button_${slot}_active`] = button ? 1 : 0
			values[`surface_button_${slot}_on`] = this.isSurfaceButtonOn(slot) ? 1 : 0
			values[`surface_button_${slot}_locked`] = this.isSurfaceButtonLocked(slot) ? 1 : 0
		}
		for (let slot = 1; slot <= SURFACE_ROTARY_SLOTS; slot++) {
			const rotary = this.surfaceRotary(slot)
			let value = ''
			if (rotary?.kind === 'meta') {
				const current = this.state.getMetaNumericValue(rotary.name, rotary.component)
				value = current === undefined ? '' : formatNumber(current)
			}
			if (rotary?.kind === 'global') {
				const current = this.state.getNumericValue(rotary.control.type, rotary.control.position, rotary.component)
				value = current === undefined ? '' : formatNumber(current)
			}
			values[`surface_rotary_${slot}_label`] = rotary?.label ?? ''
			values[`surface_rotary_${slot}_value`] = value
			values[`surface_rotary_${slot}_component`] =
				rotary && rotary.component !== 'value' ? rotary.component.toUpperCase() : ''
			values[`surface_rotary_${slot}_active`] = rotary ? 1 : 0
			values[`surface_rotary_${slot}_locked`] = this.isSurfaceRotaryLocked(slot) ? 1 : 0
		}
		this.setVariableValues(values)
		this.checkFeedbacks(
			'surface_mode',
			'surface_button_on',
			'surface_button_locked',
			'surface_rotary_locked',
			'transport_state',
			'preset_created',
		)
	}
}

function controlComponentKey(control: ActiveGlobalControl): string {
	return `${control.type}:${control.position}`
}

function rotaryKey(rotary: SurfaceRotary): string {
	return rotary.kind === 'meta' ? `meta:${rotary.name}` : `global:${rotary.control.type}:${rotary.control.position}`
}

function groupLockKey(bank: 'scene' | 'meta', group: string): string {
	return `group:${bank}:${group}`
}

function centeredPageItem<T>(
	items: readonly T[],
	capacity: number,
	position: number,
	requestedPage: number,
): T | undefined {
	const pageCount = Math.max(1, Math.ceil(items.length / capacity))
	const page = pageCount === 1 ? 0 : Math.min(requestedPage, pageCount - 1)
	const pageItems = items.slice(page * capacity, (page + 1) * capacity)
	const start = Math.floor((capacity - pageItems.length) / 2)
	return pageItems[position - start]
}

function pageItem<T>(items: readonly T[], capacity: number, position: number, requestedPage: number): T | undefined {
	const pageCount = Math.max(1, Math.ceil(items.length / capacity))
	const page = pageCount === 1 ? 0 : Math.min(requestedPage, pageCount - 1)
	return items[page * capacity + position]
}

function clamp(value: number): number {
	return Math.min(1, Math.max(0, value))
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
