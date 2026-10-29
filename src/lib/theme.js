export function applyTheme(themeId) {
  if (typeof document === 'undefined') return;
  if (!themeId || themeId === 'indigo') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', themeId);
  }
}
