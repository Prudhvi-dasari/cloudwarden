import { opsEvent } from './functions/lib/opsLog.js';

export default {
  async scheduled(_controller, env) {
    if (!env.CLEANUP_SECRET) {
      opsEvent({ event: 'cleanup', result: 'failed', category: 'CLEANUP_UNCONFIGURED' });
      throw new Error('CLEANUP_SECRET is not configured');
    }

    const started = Date.now();
    const appUrl = (env.APP_URL || 'https://sendtoanyone.com').replace(/\/+$/, '');
    const response = await fetch(
      `${appUrl}/api/r2?action=cleanup`,
      {
        method: 'GET',
        headers: {
          'x-cleanup-secret': env.CLEANUP_SECRET,
          'accept': 'application/json',
        },
      },
    );

    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch {
      opsEvent({ event: 'cleanup', result: 'failed', category: 'INVALID_RESPONSE', durationMs: Date.now() - started });
      throw new Error(`Cleanup returned invalid JSON (HTTP ${response.status})`);
    }

    if (
      !response.ok ||
      result.message !== 'Expired R2 objects purged' ||
      typeof result.purgedCount !== 'number'
    ) {
      opsEvent({ event: 'cleanup', result: 'failed', category: 'SCHEDULER_REJECTED', durationMs: Date.now() - started });
      throw new Error(`Cleanup failed (HTTP ${response.status})`);
    }
  },
};
