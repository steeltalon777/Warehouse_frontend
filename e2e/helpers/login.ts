import { Page } from '@playwright/test';

export interface RoleCredentials {
  username: string;
  password: string;
}

export const ROLE_CREDENTIALS: Record<string, RoleCredentials> = {
  root: {
    username: process.env.E2E_USERNAME_ROOT || 'admin',
    password: process.env.E2E_PASSWORD_ROOT || 'admin123',
  },
  chief: {
    username: process.env.E2E_USERNAME_CHIEF || 'chief',
    password: process.env.E2E_PASSWORD_CHIEF || 'chief123',
  },
  storekeeper: {
    username: process.env.E2E_USERNAME_STOREKEEPER || 'storekeeper',
    password: process.env.E2E_PASSWORD_STOREKEEPER || 'storekeeper123',
  },
  observer: {
    username: process.env.E2E_USERNAME_OBSERVER || 'observer',
    password: process.env.E2E_PASSWORD_OBSERVER || 'observer123',
  },
  spa_user: {
    username: process.env.E2E_USERNAME_SPA || 'test_spa_user',
    password: process.env.E2E_PASSWORD_SPA || 'test_spa_password',
  },
};

export async function loginAsRole(page: Page, role: string): Promise<void> {
  const creds = ROLE_CREDENTIALS[role];
  if (!creds) throw new Error(`Unknown role: ${role}`);
  await page.goto('/users/login/', { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', creds.username);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

export async function loginAsRoot(page: Page): Promise<void> {
  return loginAsRole(page, 'root');
}
