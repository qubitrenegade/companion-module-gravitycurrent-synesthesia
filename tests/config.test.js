import assert from 'node:assert/strict'
import test from 'node:test'
import { configuredMediaSources, configuredPresetNames, normalizeConfig, validateConfig } from '../dist/config.js'
import { UpgradeScripts } from '../dist/upgrades.js'

test('configuration applies the Synesthesia defaults and validates hosts, addresses, and ports', () => {
	const config = normalizeConfig({})
	assert.deepEqual(config, {
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
	})
	assert.equal(validateConfig(config), undefined)
	assert.match(validateConfig({ ...config, host: 'bad host!' }), /Target host/)
	assert.match(validateConfig({ ...config, targetPort: 70000 }), /input port/)
	assert.match(validateConfig({ ...config, listenAddress: '::1' }), /IPv4/)
})

test('configured media sources preserve exact names while removing blanks and duplicates', () => {
	const config = normalizeConfig({ mediaSourceNames: 'Camera A\n\nNDI Main\nCamera A\n' })
	assert.deepEqual(configuredMediaSources(config), ['Camera A', 'NDI Main'])
	assert.deepEqual(configuredPresetNames(normalizeConfig({ presetNames: 'Gold\nBlue\nGold' })), ['Gold', 'Blue'])
})

test('upgrade preserves the scaffold target port while adding feedback defaults', () => {
	const result = UpgradeScripts[0](
		{ currentConfig: normalizeConfig({}) },
		{
			config: { host: '192.168.1.20', port: 8123 },
			secrets: null,
			actions: [],
			feedbacks: [],
		},
	)
	assert.equal(result.updatedConfig.host, '192.168.1.20')
	assert.equal(result.updatedConfig.targetPort, 8123)
	assert.equal(result.updatedConfig.listenPort, 7000)
})
