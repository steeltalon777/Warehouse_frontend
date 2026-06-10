import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8001';

  try {
    const response = await fetch(`${baseURL}/healthz/`);
    if (!response.ok) {
      console.warn(`⚠ Django health check failed: ${response.status}`);
    } else {
      console.log('✓ Django health check passed');
    }
  } catch (e) {
    console.warn('⚠ Django stand not available. Some tests may fail.');
    console.warn('  Start the stand: Django :8001 + SyncServer :8000');
  }

  const syncHealthUrl = process.env.E2E_SYNC_HEALTH_URL || 'http://localhost:8000/api/v1/health';
  try {
    const response = await fetch(syncHealthUrl);
    if (!response.ok) {
      console.warn(`⚠ SyncServer health check failed: ${response.status}`);
    } else {
      console.log('✓ SyncServer health check passed');
    }
  } catch (e) {
    console.warn('⚠ SyncServer stand not available. Some tests may fail.');
    console.warn('  Start the stand: SyncServer :8000');
  }
}

export default globalSetup;
