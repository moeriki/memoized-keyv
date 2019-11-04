module.exports = {
	extends: ['eslint-config-noise-node'],
	parserOptions: { sourceType: 'script' },
	root: true,
	rules: {
		'no-underscore-dangle': ['error', {
			allow: ['_getKeyPrefix', 'arguments_'],
		}],
		'prefer-reflect': 'off',
		'prefer-rest-params': 'off',
		'prefer-spread': 'off',
		'prettier/prettier': [
			'error',
			{
				arrowParens: 'always',
				singleQuote: true,
				trailingComma: 'none'
			}
		],
		'promise/no-nesting': 'off',
		strict: ['error', 'global'],
		'unicorn/prefer-spread': 'off',
	}
};
