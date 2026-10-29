export function identifyMinilytics(user) {
  if (typeof window === 'undefined' || !user) return;
  const userId = user.id || user.user_id;
  if (!userId) return;
  const name = user.user_metadata?.fullName || user.user_metadata?.name || user.name || '';
  window.minilytics?.('identify', {
    user_id: userId,
    email: user.email || '',
    name,
  });
}

export function trackMinilyticsGoal(goal, props) {
  if (typeof window === 'undefined' || !goal) return;
  if (props) window.minilytics?.('goal', goal, props);
  else window.minilytics?.('goal', goal);
}

export function getMinilyticsAttribution() {
  if (typeof window === 'undefined') return { ml_visitor_id: '', ml_session_id: '' };
  return window.minilytics?.attribution?.() || { ml_visitor_id: '', ml_session_id: '' };
}
