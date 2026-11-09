import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The renderer runs with nodeIntegration, so Node/Electron modules are loaded at runtime
// through window.require (see src/renderer/electron.ts) and never bundled.
export default defineConfig({
	plugins: [react()],
	base: './',
	publicDir: false,
	build: {
		outDir: 'build/renderer',
		emptyOutDir: true,
		target: 'chrome130',
	},
	server: {
		port: 5173,
		strictPort: true,
		watch: { ignored: ['**/ext/**', '**/dist/**', '**/build/**'] },
	},
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.ts'],
		setupFiles: ['src/renderer/test-setup.ts'],
	},
});
