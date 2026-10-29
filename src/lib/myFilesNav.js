/**
 * Home keeps its dashboard tab. Every other page opens the uploads drawer
 * that page already owns, or the drawer mounted with the navigation.
 */
export function myFilesAction({ hasDashboardToggle = false, hasParentDrawer = false } = {}) {
  if (hasDashboardToggle) return 'dashboard';
  if (hasParentDrawer) return 'parent-drawer';
  return 'local-drawer';
}

/** Download and file-request headers have no dashboard tab. Guests see no control. */
export function myFilesForCompactHeader(user) {
  if (!user) return 'hidden';
  return myFilesAction();
}
