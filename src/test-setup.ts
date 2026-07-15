/**
 * Vitest setup file for standalone `npx vitest --run` invocations.
 *
 * The Angular CLI builder (@angular/build:unit-test) initializes the
 * TestBed automatically via its own `init-testbed.js` virtual setup
 * file. Standalone Vitest does not, so this file replicates the minimum
 * needed for `TestBed.configureTestingModule(...)` to work.
 *
 * Per WP cleanup F1: keeps `npx vitest --run` working without CLI flags.
 */
import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

TestBed.initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
  { teardown: { destroyAfterEach: true } },
);
