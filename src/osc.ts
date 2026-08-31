import { Server } from 'node-osc'
import type { FeedbackValueMode } from './config.js'
import {
	GLOBAL_CONTROL_POSITIONS,
	GLOBAL_CONTROL_TYPES,
	metaControlDefinition,
	parseGlobalValue,
	type GlobalControlType,
	SynesthesiaState,
	unwrapOscValue,
} from './state.js'

export type IncomingOscMessage = {
	address: string
	args: unknown[]
}

export type OscServerLike = {
	on(event: string, listener: (...args: any[]) => void): OscServerLike
	removeAllListeners(): OscServerLike
	close(): Promise<void> | undefined
}

export type OscServerFactory = (port: number, host: string) => OscServerLike

export type ListenerCallbacks = {
	onListening: () => void
	onMessage: (message: IncomingOscMessage) => void
	onError: (error: Error) => void
	onClose: () => void
}

const defaultServerFactory: OscServerFactory = (port, host) => new Server(port, host)

export class FeedbackListener {
	private server?: OscServerLike
	private generation = 0

	constructor(private readonly createServer: OscServerFactory = defaultServerFactory) {}

	async start(port: number, host: string, callbacks: ListenerCallbacks): Promise<void> {
		await this.stop()
		const generation = ++this.generation

		/*
		 * A config change replaces the UDP server instead of mutating it. Keeping a
		 * generation token around every callback prevents a late event from the old
		 * socket from overwriting readiness or state belonging to the new socket.
		 */
		const current = (): boolean => generation === this.generation
		try {
			const server = this.createServer(port, host)
			this.server = server
			server.on('listening', () => {
				if (current()) callbacks.onListening()
			})
			server.on('message', (message: unknown) => {
				if (!current()) return
				const parsed = normalizeIncomingMessage(message)
				if (parsed) callbacks.onMessage(parsed)
			})
			server.on('bundle', (bundle: unknown) => {
				if (!current()) return
				for (const message of flattenBundle(bundle)) callbacks.onMessage(message)
			})
			server.on('error', (error: unknown) => {
				if (current()) callbacks.onError(error instanceof Error ? error : new Error(String(error)))
			})
			server.on('close', () => {
				if (current()) callbacks.onClose()
			})
		} catch (error) {
			callbacks.onError(error instanceof Error ? error : new Error(String(error)))
		}
	}

	async stop(): Promise<void> {
		this.generation++
		const server = this.server
		this.server = undefined
		if (!server) return
		server.removeAllListeners()
		try {
			await server.close()
		} catch {
			// Closing an OSC server that failed before bind may reject. It is already unusable.
		}
	}
}

export class InboundOscProcessor {
	private readonly unknownPaths = new Map<string, number>()

	constructor(
		private readonly state: SynesthesiaState,
		private valueMode: FeedbackValueMode,
		private readonly debug: (message: string) => void,
		private readonly now: () => number = Date.now,
	) {}

	setValueMode(mode: FeedbackValueMode): void {
		this.valueMode = mode
	}

	process(message: IncomingOscMessage): boolean {
		this.state.markOscReceived(message.address)
		if (!message.address.startsWith('/')) {
			this.logUnsupported('<malformed-address>')
			return false
		}

		const sceneMatch = /^\/scenes\/([^/]+)$/.exec(message.address)
		if (sceneMatch) {
			this.state.setScene(sceneMatch[1])
			this.state.markSupportedFeedbackReceived()
			return true
		}

		const nameMatch = /^\/controls\/global\/(slider|knob|toggle|bang|xy|color|dropdown)\/(\d+)\/name$/.exec(
			message.address,
		)
		if (nameMatch) {
			const type = nameMatch[1] as GlobalControlType
			const position = Number(nameMatch[2])
			const name = unwrapOscValue(message.args[0])
			if (position < 1 || position > GLOBAL_CONTROL_POSITIONS || typeof name !== 'string') {
				this.logUnsupported(message.address)
				return false
			}
			// Empty strings are deliberate clear events when a scene has fewer than 16 controls.
			this.state.setControlName(type, position, name)
			this.state.markSupportedFeedbackReceived()
			return true
		}

		const componentMatch = /^\/controls\/global\/(xy|color)\/(\d+)\/(x|y|r|g|b)(\/raw)?$/.exec(message.address)
		if (componentMatch) {
			const type = componentMatch[1] as 'xy' | 'color'
			const position = Number(componentMatch[2])
			const component = componentMatch[3]
			const isRaw = componentMatch[4] === '/raw'
			this.state.observeFeedbackMode(isRaw ? 'raw' : 'normalized', this.valueMode)
			const componentMatchesType =
				(type === 'xy' && (component === 'x' || component === 'y')) ||
				(type === 'color' && (component === 'r' || component === 'g' || component === 'b'))
			const value = unwrapOscValue(message.args[0])
			const safeRawNormalized =
				this.valueMode === 'normalized' &&
				isRaw &&
				type === 'color' &&
				typeof value === 'number' &&
				value >= 0 &&
				value <= 1
			if (
				position < 1 ||
				position > GLOBAL_CONTROL_POSITIONS ||
				!componentMatchesType ||
				typeof value !== 'number' ||
				!Number.isFinite(value) ||
				((this.valueMode === 'raw') !== isRaw && !safeRawNormalized)
			)
				return false
			this.state.setNumericComponent(type, position, component, value)
			this.state.markSupportedFeedbackReceived()
			return true
		}

		const valueMatch = /^\/controls\/global\/(slider|knob|toggle|bang|xy|color|dropdown)\/(\d+)(\/raw)?$/.exec(
			message.address,
		)
		if (valueMatch) {
			const type = valueMatch[1] as GlobalControlType
			const position = Number(valueMatch[2])
			const isRaw = valueMatch[3] === '/raw'
			this.state.observeFeedbackMode(isRaw ? 'raw' : 'normalized', this.valueMode)
			const rawNumbers = message.args.map(unwrapOscValue)
			const safeRawNormalized =
				this.valueMode === 'normalized' &&
				isRaw &&
				(type === 'toggle' || type === 'bang' || type === 'color') &&
				rawNumbers.every((value) => typeof value === 'number' && value >= 0 && value <= 1)
			if (
				position < 1 ||
				position > GLOBAL_CONTROL_POSITIONS ||
				((this.valueMode === 'raw') !== isRaw && !safeRawNormalized)
			)
				return false
			const value = parseGlobalValue(type, message.args)
			if (!value) {
				this.logUnsupported(message.address)
				return false
			}
			this.state.setControlValue(type, position, value)
			this.state.markSupportedFeedbackReceived()
			return true
		}

		const metaComponentMatch = /^\/controls\/meta\/([a-z0-9_]+)\/(x|y|r|g|b)(\/raw)?$/.exec(message.address)
		if (metaComponentMatch) {
			const name = metaComponentMatch[1]
			const component = metaComponentMatch[2]
			const isRaw = metaComponentMatch[3] === '/raw'
			const value = unwrapOscValue(message.args[0])
			const declaredKind = metaControlDefinition(name)?.kind
			const componentMatchesType =
				((component === 'x' || component === 'y') && declaredKind === undefined) ||
				((component === 'r' || component === 'g' || component === 'b') &&
					(declaredKind === undefined || declaredKind === 'color'))
			this.state.observeFeedbackMode(isRaw ? 'raw' : 'normalized', this.valueMode)
			const safeRawNormalized =
				this.valueMode === 'normalized' &&
				isRaw &&
				(component === 'r' || component === 'g' || component === 'b') &&
				typeof value === 'number' &&
				value >= 0 &&
				value <= 1
			if (
				!componentMatchesType ||
				typeof value !== 'number' ||
				!Number.isFinite(value) ||
				((this.valueMode === 'raw') !== isRaw && !safeRawNormalized)
			)
				return false
			this.state.setMetaNumericComponent(name, component, value)
			this.state.markSupportedFeedbackReceived()
			return true
		}

		const metaMatch = /^\/controls\/meta\/([a-z0-9_]+)(\/raw)?$/.exec(message.address)
		if (metaMatch) {
			const isRaw = metaMatch[2] === '/raw'
			this.state.observeFeedbackMode(isRaw ? 'raw' : 'normalized', this.valueMode)
			const declaredKind = metaControlDefinition(metaMatch[1])?.kind
			const rawNumbers = message.args.map(unwrapOscValue)
			const safeRawNormalized =
				this.valueMode === 'normalized' &&
				isRaw &&
				(declaredKind === 'toggle' || declaredKind === 'bang' || declaredKind === 'color') &&
				rawNumbers.every((value) => typeof value === 'number' && value >= 0 && value <= 1)
			if ((this.valueMode === 'raw') !== isRaw && !safeRawNormalized) return false
			const numbers = message.args.map(unwrapOscValue)
			if (numbers.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
				this.logUnsupported(message.address)
				return false
			}
			const value =
				numbers.length === 1
					? { kind: 'scalar' as const, value: numbers[0] as number }
					: numbers.length === 2
						? { kind: 'xy' as const, x: numbers[0] as number, y: numbers[1] as number }
						: numbers.length === 3
							? { kind: 'color' as const, r: numbers[0] as number, g: numbers[1] as number, b: numbers[2] as number }
							: undefined
			if (!value) {
				this.logUnsupported(message.address)
				return false
			}
			this.state.setMetaControlValue(metaMatch[1], value)
			this.state.markSupportedFeedbackReceived()
			return true
		}

		this.logUnsupported(message.address)
		return false
	}

	private logUnsupported(path: string): void {
		const now = this.now()
		const last = this.unknownPaths.get(path)
		if (last !== undefined && now - last < 30000) return
		/*
		 * High-volume audio routes and future API additions are expected. Retaining a
		 * bounded, rate-limited path set keeps diagnostics useful without turning an
		 * enabled audio-variable stream into unbounded memory growth or log spam.
		 */
		if (!this.unknownPaths.has(path) && this.unknownPaths.size >= 64) {
			const oldest = this.unknownPaths.keys().next().value
			if (oldest !== undefined) this.unknownPaths.delete(oldest)
		}
		this.unknownPaths.set(path, now)
		this.debug(`Ignoring unsupported or malformed OSC message: ${path}`)
	}
}

export function normalizeIncomingMessage(message: unknown): IncomingOscMessage | undefined {
	if (!Array.isArray(message) || typeof message[0] !== 'string') return undefined
	return { address: message[0], args: message.slice(1) }
}

export function flattenBundle(bundle: unknown): IncomingOscMessage[] {
	if (!bundle || typeof bundle !== 'object' || !('elements' in bundle)) return []
	const elements = bundle.elements
	if (!Array.isArray(elements)) return []
	const messages: IncomingOscMessage[] = []
	for (const element of elements) {
		const message = normalizeIncomingMessage(element)
		if (message) messages.push(message)
		else messages.push(...flattenBundle(element))
	}
	return messages
}

export function isGlobalControlType(value: string): value is GlobalControlType {
	return (GLOBAL_CONTROL_TYPES as readonly string[]).includes(value)
}
