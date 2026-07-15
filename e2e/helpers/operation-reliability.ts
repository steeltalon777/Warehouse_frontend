/**
 * Shared helpers for operation reliability E2E tests (WP-6).
 *
 * - loginAsAdmin:  reuse the existing loginAsRoot helper
 * - getCsrfToken:  extract CSRF token from Django cookies
 */
import { Page } from '@playwright/test';
import { loginAsRoot } from './login';

/**
 * Login as Django superuser (admin / admin123) via the app login page.
 * Reuses loginAsRoot from ./login (admin is the default root user).
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  return loginAsRoot(page);
}

/**
 * Extract CSRF token from Django cookies.
 * Returns `null` if the cookie is not present.
 */
export async function getCsrfToken(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const csrfCookie = cookies.find(c => c.name === 'csrftoken');
  return csrfCookie?.value ?? null;
}
