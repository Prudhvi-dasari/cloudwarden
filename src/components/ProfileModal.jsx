import { useState } from 'react';
import { THEMES, applyTheme } from '../lib/supabase';
import { isAdmin, isUserPro, isUserOnTrial, startProTrial, saveAccountTheme } from '../lib/authSession';
import { X, User, Crown, Palette, LogOut, Check, Sparkles, ShieldCheck, ArrowRight, Settings, Zap, Clock } from 'lucide-react';
import Portal from './Portal';

export default function ProfileModal({
  isOpen,
  onClose,
  user,
  onSignOut,
  currentTheme,
  onThemeChange,
  onAccountChange,
  onOpenUpgrade,
  onOpenAdmin,
}) {
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [localUser, setLocalUser] = useState(user);

  if (!isOpen || !localUser) return null;

  const currentUser = localUser;
  const isPro = isUserPro(currentUser);
  const isMasterAdmin = isAdmin(currentUser);
  const isOnTrial = isUserOnTrial(currentUser);

  // Calculate days remaining if on trial
  const trialExpiresAt = currentUser.user_metadata?.trial_expires_at;
  const daysLeftInTrial = trialExpiresAt
    ? Math.max(1, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 7;

  async function handleStartTrial() {
    setActivatingTrial(true);
    try {
      const updated = await startProTrial(currentUser);
      setLocalUser(updated);
      onAccountChange?.(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setActivatingTrial(false);
    }
  }

  async function handleSelectTheme(themeId) {
    applyTheme(themeId);
    if (onThemeChange) onThemeChange(themeId);
    try {
      const updated = await saveAccountTheme(currentUser, themeId);
      setLocalUser(updated);
      onAccountChange?.(updated);
    } catch (e) {
      console.error(e);
    }
  }

  const handleSignOutClick = () => {
    if (onClose) onClose();
    if (onSignOut) onSignOut();
  };

  return (
    <Portal>
    <div className="ds-modal-backdrop acct-modal-backdrop acct-ui">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        className="ds-modal"
      >
        <span className="acct-grabber" aria-hidden="true" />

        <button type="button" onClick={onClose} aria-label="Close profile" className="ds-close">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* User Badge */}
        <div className="ds-modal-head">
          <p className="ds-kicker"><b>●</b> Your account</p>
          <div className="mt-3 flex items-center gap-3.5 pr-8 min-w-0">
            <div className="acct-avatar" aria-hidden="true">
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 id="profile-modal-title" className="text-base font-semibold text-[var(--ds-ink)] acct-truncate" title={user.email}>
                {user.email}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {isMasterAdmin ? (
                  <span className="ds-badge ds-badge-dark">Admin</span>
                ) : isPro ? (
                  <span className="ds-badge ds-badge-blue">
                    <Crown className="w-3 h-3" aria-hidden="true" /> Pro
                  </span>
                ) : (
                  <span className="ds-badge">Free</span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-[var(--ds-muted)]">
                  <span className="ds-dot-live" aria-hidden="true" /> Signed in
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ds-modal-body">
          {/* Admin Hub Shortcut (For Prudhvi) */}
          {isMasterAdmin && (
            <div className="acct-section">
              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  if (onOpenAdmin) onOpenAdmin();
                }}
                className="ds-btn ds-btn-ghost w-full"
              >
                <Crown className="w-4 h-4" aria-hidden="true" />
                <span>Open admin hub</span>
                <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Plan Section */}
          <div className="acct-section">
            <h3 className="acct-section-title">
              <span className="ds-icon is-blue is-sm" aria-hidden="true"><Zap /></span>
              Your plan
            </h3>
            <p className="acct-lead mt-2 text-sm">
              {isPro
                ? 'Pro sends up to 250 GB per transfer, with links open for up to 180 days.'
                : 'Free sends up to 6 GB per transfer, with links open from 1 hour to 7 days and an optional password.'}
            </p>
            <div className="acct-limit">
              <span className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--ds-muted)]" aria-hidden="true" />
                Transfer limit
              </span>
              <b>{isPro ? '250 GB · 180 days' : '6 GB · 7 days'}</b>
            </div>
          </div>

          {/* Theme Preference Section */}
          <div className="acct-section">
            <h3 className="acct-section-title">
              <span className="ds-icon is-sm" aria-hidden="true"><Palette /></span>
              Accent color
            </h3>
            <div className="acct-swatches">
              {THEMES.map((theme) => {
                const isSelected = currentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectTheme(theme.id)}
                    className="acct-swatch"
                  >
                    <i style={{ backgroundColor: theme.color }} aria-hidden="true" />
                    <span className="acct-truncate">{theme.name.split(' ')[0]}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 ml-auto shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="acct-section pb-0">
            <button
              type="button"
              onClick={handleSignOutClick}
              className="ds-btn ds-btn-ghost acct-signout w-full"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}
