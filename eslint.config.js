export default [
	{
		files: ['src/**/*.{js,jsx}'],
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: 'module',
			globals: {
				console: 'readonly',
				location: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				document: 'readonly',
				structuredClone: 'readonly',
				WebSocket: 'readonly',
				Blob: 'readonly',
				URL: 'readonly',
				requestAnimationFrame: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				localStorage: 'readonly',
				sessionStorage: 'readonly',
				ResizeObserver: 'readonly',
				atob: 'readonly',
				btoa: 'readonly',
				crypto: 'readonly',
			},
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
		rules: {
			'no-undef': 'error',
			'no-unused-vars': 'off',
		},
	},
];
