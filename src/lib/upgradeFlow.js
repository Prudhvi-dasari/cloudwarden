const GB = 1_000_000_000;

export const UPGRADE_TIMEOUT_MS = 45_000;

/** Which checkout code fits this transfer. Pass is a single send. Creator and Pro are ongoing. */
export function recommendPlan(totalBytes) {
  const size = Number(totalBytes) || 0;
  if (size <= 6 * GB) return null;
  if (size <= 50 * GB) {
    return { code: 'creator_monthly', name: 'Creator', also: 'pass', reason: 'This send fits Creator, or a one-time Pass.' };
  }
  if (size <= 100 * GB) {
    return { code: 'pass', name: 'Pass', also: 'pro_monthly', reason: 'One send this size fits a Pass. Pro covers it too, and later sends.' };
  }
  if (size <= 250 * GB) {
    return { code: 'pro_monthly', name: 'Pro', also: null, reason: 'This send fits Pro.' };
  }
  return { code: null, name: null, also: null, reason: 'This is over 250 GB. Split it into smaller sends.' };
}

export function createUpgrade(totalBytes) {
  return {
    step: 'explain',
    plan: recommendPlan(totalBytes),
    totalBytes: Number(totalBytes) || 0,
    startedAt: null,
  };
}

export function reduceUpgrade(state, event) {
  const now = Number(event.now) || 0;
  switch (event.type) {
    case 'pick': {
      const plan = event.plan || state.plan;
      if (!plan?.code) return state;
      return { ...state, plan, step: event.signedIn ? 'checkout' : 'auth' };
    }
    case 'signed_in':
      if (event.alreadyCovers) return { ...state, step: 'ready' };
      return { ...state, step: 'checkout' };
    case 'checkout_started':
      return { ...state, step: 'activating', startedAt: now };
    case 'returned':
      if (event.status === 'failed') return { ...state, step: 'failed' };
      if (event.status === 'cancelled') return { ...state, step: 'cancelled' };
      return { ...state, step: 'activating', startedAt: now };
    case 'entitled':
      return { ...state, step: 'ready' };
    case 'tick':
      if (state.step === 'activating' && state.startedAt != null && now - state.startedAt > UPGRADE_TIMEOUT_MS) {
        return { ...state, step: 'timeout' };
      }
      return state;
    case 'retry':
      return { ...state, step: 'activating', startedAt: now };
    case 'back':
      return { ...state, step: 'explain' };
    default:
      return state;
  }
}
