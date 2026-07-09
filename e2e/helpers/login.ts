import { Page } from '@playwright/test';

export interface RoleCredentials {
  username: string;
  password: string;
}

type RoleSource = {
  usernameEnv: string[];
  passwordEnv: string[];
  defaultUsername: string;
  defaultPassword: string;
};

function readEnv(keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return fallback;
}

const ROLE_SOURCES: Record<string, RoleSource> = {
  root: {
    usernameEnv: ['E2E_USERNAME_ROOT'],
    passwordEnv: ['E2E_PASSWORD_ROOT'],
    defaultUsername: 'admin',
    defaultPassword: 'admin123',
  },
  chief: {
    usernameEnv: ['E2E_USERNAME_CHIEF', 'E2E_USERNAME_CHIEF_STORAGEKEEPER'],
    passwordEnv: ['E2E_PASSWORD_CHIEF', 'E2E_PASSWORD_CHIEF_STORAGEKEEPER'],
    defaultUsername: 'chief_storagekeeper',
    defaultPassword: '089786',
  },
  chief_storagekeeper: {
    usernameEnv: ['E2E_USERNAME_CHIEF_STORAGEKEEPER', 'E2E_USERNAME_CHIEF'],
    passwordEnv: ['E2E_PASSWORD_CHIEF_STORAGEKEEPER', 'E2E_PASSWORD_CHIEF'],
    defaultUsername: 'chief_storagekeeper',
    defaultPassword: '089786',
  },
  storekeeper: {
    usernameEnv: ['E2E_USERNAME_STOREKEEPER'],
    passwordEnv: ['E2E_PASSWORD_STOREKEEPER'],
    defaultUsername: 'aksha',
    defaultPassword: '089786',
  },
  observer: {
    usernameEnv: ['E2E_USERNAME_OBSERVER', 'E2E_USERNAME_BUH_OBSERVER'],
    passwordEnv: ['E2E_PASSWORD_OBSERVER', 'E2E_PASSWORD_BUH_OBSERVER'],
    defaultUsername: 'buh_observer',
    defaultPassword: '089786',
  },
  buh_observer: {
    usernameEnv: ['E2E_USERNAME_BUH_OBSERVER', 'E2E_USERNAME_OBSERVER'],
    passwordEnv: ['E2E_PASSWORD_BUH_OBSERVER', 'E2E_PASSWORD_OBSERVER'],
    defaultUsername: 'buh_observer',
    defaultPassword: '089786',
  },
  spa_user: {
    usernameEnv: ['E2E_USERNAME_SPA', 'E2E_USERNAME_STOREKEEPER'],
    passwordEnv: ['E2E_PASSWORD_SPA', 'E2E_PASSWORD_STOREKEEPER'],
    defaultUsername: 'aksha',
    defaultPassword: '089786',
  },
};

export function getRoleCredentials(role: string): RoleCredentials {
  const source = ROLE_SOURCES[role];
  if (!source) throw new Error(`Unknown role: ${role}`);

  return {
    username: readEnv(source.usernameEnv, source.defaultUsername),
    password: readEnv(source.passwordEnv, source.defaultPassword),
  };
}

export const ROLE_CREDENTIALS: Record<string, RoleCredentials> = Object.fromEntries(
  Object.keys(ROLE_SOURCES).map(role => [role, getRoleCredentials(role)]),
);

export async function loginAsRole(page: Page, role: string): Promise<void> {
  const creds = getRoleCredentials(role);
  await page.goto('/users/login/', { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', creds.username);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

export async function loginAsRoot(page: Page): Promise<void> {
  return loginAsRole(page, 'root');
}
