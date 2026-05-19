import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:8001';

  try {
    const response = await fetch(`${baseURL}/healthz/`);
    if (!response.ok) {
      console.warn(`⚠ Django health check failed: ${response.status}`);
    } else {
      console.log('✓ Django health check passed');
    }
  } catch (e) {
    console.warn('⚠ Django stand not available. Some tests may fail.');
    console.warn('  Start the stand: Django :8001 + SyncServer :8000 + SSH tunnel :5434');
  }
}

export default globalSetup;
