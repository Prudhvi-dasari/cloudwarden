/**
 * One JSON line for Workers Logs. Fields are an allowlist.
 * Values that are not short tokens are dropped, so a password, address,
 * filename, object key, or signed URL cannot be written by accident.
 */

const TOKEN = /^[A-Za-z0-9_]{1,64}$/;

function token(value) {
  return TOKEN.test(String(value || '')) ? String(value) : '';
}

export function opsEvent(input = {}) {
  const eventName = token(input.event);
  const result = token(input.result);
  if (!eventName || !result) return null;
  const event = { event: eventName, result };
  const category = token(input.category);
  if (category) event.category = category;
  if (Number.isFinite(input.durationMs) && input.durationMs >= 0 && input.durationMs < 600000) {
    event.durationMs = Math.round(input.durationMs);
  }
  if (Number.isFinite(input.count) && input.count >= 0 && input.count < 1000000) {
    event.count = Math.round(input.count);
  }
  console.log(JSON.stringify(event));
  return event;
}
