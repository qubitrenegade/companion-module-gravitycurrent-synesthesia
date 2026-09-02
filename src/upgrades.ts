import type {
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	CompanionUpgradeContext,
} from '@companion-module/base'
import { normalizeConfig, type ModuleConfig } from './config.js'

function upgradeInitialConfig(
	_context: CompanionUpgradeContext<ModuleConfig>,
	props: CompanionStaticUpgradeProps<ModuleConfig, undefined>,
): CompanionStaticUpgradeResult<ModuleConfig, undefined> {
	if (!props.config) return { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }

	/*
	 * Upgrade scripts form a permanent compatibility boundary. The scaffold used
	 * `port` for its only target port, while the production config names both UDP
	 * directions explicitly. Copy it once and fill new defaults so saved instances
	 * do not silently revert to a different Synesthesia input port.
	 */
	const oldConfig = props.config as unknown as Partial<ModuleConfig> & { port?: unknown }
	const targetPort = oldConfig.targetPort ?? (typeof oldConfig.port === 'number' ? oldConfig.port : undefined)
	return {
		updatedConfig: normalizeConfig({ ...oldConfig, targetPort }),
		updatedActions: [],
		updatedFeedbacks: [],
	}
}

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig>[] = [upgradeInitialConfig]
