import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { THEMES, applyTheme, supabase } from '../lib/supabase';
import { isAdmin, isUserPro, isUserOnTrial, startProTrial, saveAccountTheme, saveBrandKit } from '../lib/authSession';
import { X, User, Crown, Palette, LogOut, Check, Sparkles, ShieldCheck, ArrowRight, Settings, Zap, Clock } from 'lucide-react';
import Portal from './Portal';

function formatStorage(bytes) {
  const size = Number(bytes) || 0;
  if (size >= 1_000_000_000_000) return `${(size / 1_000_000_000_000).toFixed(1)} TB`;
  if (size >= 1_000_000_000) return `${Math.round(size / 1_000_000_000)} GB`;
  if (size >= 1_000_000) return `${Math.round(size / 1_000_000)} MB`;
  return `${Math.max(0, Math.round(size / 1024))} KB`;
}

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
  const [usage, setUsage] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [brandAccent, setBrandAccent] = useState('#1769f5');
  const [brandBackground, setBrandBackground] = useState('');
  const [brandMessage, setBrandMessage] = useState('');
  const [logoNote, setLogoNote] = useState('');

  useEffect(() => {
    if (!isOpen || !user) return undefined;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      fetch('/api/r2?action=account-usage', { headers: { authorization: `Bearer ${token}` } })
        .then((response) => response.json())
        .then((body) => { if (alive && body?.quotaBytes) setUsage(body); })
        .catch(() => {});
    }).catch(() => {});
    return () => { alive = false; };
  }, [isOpen, user]);

  if (!isOpen || !localUser) return null;

  const currentUser = localUser;
  const isPro = isUserPro(currentUser);
  const accountTier = usage?.tier || currentUser.user_metadata?.plan || 'free';
  const planCopy = {
    creator: ['Creator sends up to 50 GB per transfer, stores 200 GB, and keeps links for up to 30 days.', '50 GB · 30 days'],
    pro: ['Pro sends up to 250 GB per transfer, stores 1 TB, and keeps links for up to 180 days.', '250 GB · 180 days'],
    studio: ['Studio sends up to 250 GB per transfer, stores 3 TB, and keeps links for up to 1 year.', '250 GB · 1 year'],
    free: ['Free sends up to 6 GB per transfer, with links open from 1 hour to 7 days and an optional password.', '6 GB · 7 days'],
  };
  const [planSentence, planLimit] = planCopy[accountTier] || planCopy[isPro ? 'pro' : 'free'];
  const planBadge = { creator: 'Creator', studio: 'Studio', pro: 'Pro', trial: 'Pro' }[accountTier] || 'Free';
  const storageFull = usage?.quotaBytes > 0 && usage.usedBytes >= usage.quotaBytes;
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
                ) : planBadge === 'Free' ? (
                  <span className="ds-badge">Free</span>
                ) : (
                  <span className="ds-badge ds-badge-blue">
                    <Crown className="w-3 h-3" aria-hidden="true" /> {planBadge}
                  </span>
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
            <p className="acct-lead mt-2 text-sm">{planSentence}</p>
            <div className="acct-limit">
              <span className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--ds-muted)]" aria-hidden="true" />
                Transfer limit
              </span>
              <b>{planLimit}</b>
            </div>
            {usage?.quotaBytes ? (
              <div className="mt-3">
                <div className="snd-live-row">
                  <span>Stored</span>
                  <span>{formatStorage(usage.usedBytes)} / {formatStorage(usage.quotaBytes)}</span>
                </div>
                <div className="ds-progress" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100))}%` }} />
                </div>
                {usage.near || storageFull ? (
                  <p className="ds-plan-note mt-2">
                    {storageFull
                      ? 'This account is using all of its storage. Delete an older transfer, or upgrade for more room.'
                      : 'This account is close to its storage limit.'}{' '}
                    <Link to="/pricing" className="ds-link" onClick={onClose}>See larger plans</Link>
                  </p>
                ) : null}
              </div>
            ) : null}
            {usage?.brand ? (
              <form
                className="mt-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setLogoNote('');
                  try {
                    await saveBrandKit(currentUser, {
                      logo: logoUrl,
                      accent: brandAccent,
                      background: brandBackground,
                      message: brandMessage,
                    });
                    setLogoNote('Download page branding saved.');
                  } catch (error) {
                    setLogoNote(error?.message || 'Could not save that branding.');
                  }
                }}
              >
                <label htmlFor="brand-logo-url" className="ds-label">Logo on the download page</label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="brand-logo-url"
                    className="ds-input"
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    value={logoUrl}
                    onChange={(event) => setLogoUrl(event.target.value)}
                  />
                  <button type="submit" className="ds-btn ds-btn-ghost shrink-0">Save</button>
                </div>
                <label htmlFor="brand-accent" className="ds-label mt-3">Accent on the download page</label>
                <input id="brand-accent" className="ds-input mt-2" value={brandAccent} onChange={(event) => setBrandAccent(event.target.value)} placeholder="#1769f5" />
                <label htmlFor="brand-bg" className="ds-label mt-3">Background image</label>
                <input id="brand-bg" className="ds-input mt-2" type="url" value={brandBackground} onChange={(event) => setBrandBackground(event.target.value)} placeholder="https://…" />
                <label htmlFor="brand-message" className="ds-label mt-3">Short message</label>
                <input id="brand-message" className="ds-input mt-2" maxLength={240} value={brandMessage} onChange={(event) => setBrandMessage(event.target.value)} placeholder="Thanks for taking a look" />
                {logoNote ? <p className="ds-plan-note mt-2">{logoNote}</p> : null}
              </form>
            ) : null}
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
