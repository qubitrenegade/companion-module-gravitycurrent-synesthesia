import {
	InstanceBase,
	InstanceStatus,
	type OSCMetaArgument,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { GetConfigFields, normalizeConfig, validateConfig, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { FeedbackListener, InboundOscProcessor } from './osc.js'
import { SynesthesiaState, type StateChange } from './state.js'

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
		this.state.setFreshnessTimeout(this.config.freshnessTimeoutMs)
		this.processor.setValueMode(this.config.feedbackValueMode)
		await this.applyConfig()
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
	}
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
