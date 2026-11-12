import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Component tests: React dialogs rendered in jsdom and used as a person would. The Node unit tests in tests/Unit stay on node --test. */
export default defineConfig({
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'resources/js') } },
    test: {
        environment: 'jsdom',
        include: ['tests/js/**/*.test.jsx'],
        setupFiles: ['tests/js/setup.js'],
        restoreMocks: true,
    },
});
