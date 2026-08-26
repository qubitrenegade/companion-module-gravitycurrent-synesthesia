import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeConfig, validateConfig } from '../dist/config.js'
import { UpgradeScripts } from '../dist/upgrades.js'

test('configuration applies the suggested defaults and validates hosts, addresses, and ports', () => {
	const config = normalizeConfig({})
	assert.deepEqual(config, {
		host: '127.0.0.1',
		targetPort: 9000,
		enableFeedback: true,
		listenAddress: '0.0.0.0',
		listenPort: 9001,
		feedbackValueMode: 'normalized',
		freshnessTimeoutMs: 5000,
	})
	assert.equal(validateConfig(config), undefined)
	assert.match(validateConfig({ ...config, host: 'bad host!' }), /Target host/)
	assert.match(validateConfig({ ...config, targetPort: 70000 }), /input port/)
	assert.match(validateConfig({ ...config, listenAddress: '::1' }), /IPv4/)
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
	assert.equal(result.updatedConfig.listenPort, 9001)
})
