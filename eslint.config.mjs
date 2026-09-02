import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const config = await generateEslintConfig({
	enableTypescript: true,
})

export default [
	...config,
	{
		files: ['tests/**/*.js'],
		rules: {
			// Tests intentionally exercise the compiled ESM that Companion packages.
			'n/no-unpublished-import': 'off',
		},
	},
]
