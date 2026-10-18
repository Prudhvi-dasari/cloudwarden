export default {
  async scheduled(controller, env) {
    if (!env.CLEANUP_SECRET) {
      throw new Error('CLEANUP_SECRET is not configured');
    }

    const response = await fetch(
      'https://itransfer.iprudhvi.in/api/r2?action=cleanup',
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
      throw new Error(`Cleanup returned invalid JSON (HTTP ${response.status})`);
    }

    if (
      !response.ok ||
      result.message !== 'Expired R2 objects purged' ||
      typeof result.purgedCount !== 'number'
    ) {
      throw new Error(`Cleanup failed (HTTP ${response.status}): ${text.slice(0, 300)}`);
    }

    console.log(JSON.stringify({
      event: 'cleanup_completed',
      scheduledTime: controller.scheduledTime,
      purgedCount: result.purgedCount,
      checked: result.checked,
    }));
  },
};
