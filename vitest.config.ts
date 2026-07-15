/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * Standalone Vitest configuration for the Angular frontend.
 *
 * The Angular CLI builder (@angular/build:unit-test) already provides its
 * own configuration via `ng test`, so this file only governs the standalone
 * `npx vitest` / `npm run test:unit` invocation.
 *
 * Per WP cleanup F1: enable Vitest globals (describe, it, expect) and
 * jsdom so the existing spec files run without per-call CLI flags.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
});
