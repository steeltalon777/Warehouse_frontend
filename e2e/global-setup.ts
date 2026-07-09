import { FullConfig } from '@playwright/test';

async function probe(url: string, label: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      console.warn(`⚠ ${label} health check failed: ${response.status}`);
      return;
    }

    console.log(`✓ ${label} health check passed`);
  } catch {
    console.warn(`⚠ ${label} stand not available. Some tests may fail.`);
  }
}

async function globalSetup(config: FullConfig) {
  const configuredBaseUrl = config.projects[0]?.use?.baseURL;
  const baseURL = process.env.E2E_BASE_URL || (typeof configuredBaseUrl === 'string' ? configuredBaseUrl : 'http://localhost:8001');
  await probe(`${baseURL}/healthz/`, 'Django');

  const syncHealthUrl = process.env.E2E_SYNC_HEALTH_URL || 'http://localhost:8000/api/v1/health';
  await probe(syncHealthUrl, 'SyncServer');
}

export default globalSetup;
