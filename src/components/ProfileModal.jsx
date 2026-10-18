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
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto">
        
        {/* Mobile handle indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* User Badge */}
        <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl theme-bg-light theme-text flex items-center justify-center font-bold text-lg sm:text-xl shadow-inner shrink-0">
            {user.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 truncate">{user.email}</h3>
              {isMasterAdmin ? (
                <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full border border-purple-200">
                  ADMIN
                </span>
              ) : isOnTrial ? (
                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-200">
                  <Zap className="w-3 h-3 text-indigo-600 fill-indigo-600" /> PRO TRIAL ({daysLeftInTrial}d left)
                </span>
              ) : isPro ? (
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                  <Crown className="w-3 h-3 fill-amber-500" /> PRO
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                  Free Account
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Account active & verified
            </p>
          </div>
        </div>

        {/* Admin Hub Shortcut (For Prudhvi) */}
        {isMasterAdmin && (
          <div className="py-4 border-b border-slate-100">
            <button
              onClick={() => {
                if (onClose) onClose();
                if (onOpenAdmin) onOpenAdmin();
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Open Master Admin Hub (Manage Users & Pro)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Plan Section */}
        <div className="py-5 border-b border-slate-100">
          {isOnTrial ? (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                  7-Day Pro Trial Active ({daysLeftInTrial} days remaining)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uploads stay at 6 GB and 7 days. A larger plan is not available yet.
                </p>
              </div>
              <button
                onClick={() => {
                  if (onClose) onClose();
                  if (onOpenUpgrade) onOpenUpgrade();
                }}
                className="w-full py-2.5 px-4 rounded-xl theme-btn-primary text-white text-xs sm:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Upgrade to Full Pro ($9.99/mo or ₹799/mo)
              </button>
            </div>
          ) : isPro ? (
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-500" />
                Pro Membership Active
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Uploads stay at 6 GB and 7 days until a paid plan is available.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Upgrade Your Transfer Power
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Free accounts have a 5GB limit and 7-day retention. Try 15GB with our 7-day free trial or buy Pro.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={handleStartTrial}
                  disabled={activatingTrial}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                  <span>{activatingTrial ? 'Activating...' : 'Start 7-Day Free Trial (No Card)'}</span>
                </button>
                <button
                  onClick={() => {
                    if (onClose) onClose();
                    if (onOpenUpgrade) onOpenUpgrade();
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl theme-btn-primary text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Buy Pro ($9.99/mo)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Preference Section */}
        <div className="py-5 border-b border-slate-100">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-2">
            <Palette className="w-4 h-4 theme-text" /> Interface Theme Accent
          </h4>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {THEMES.map((theme) => {
              const isSelected = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow-2xs shrink-0"
                    style={{ backgroundColor: theme.color }}
                  />
                  <span className="truncate">{theme.name.split(' ')[0]}</span>
                  {isSelected && <Check className="w-3 h-3 ml-auto text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="pt-5">
          <button
            type="button"
            onClick={handleSignOutClick}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

      </div>
    </div>
    </Portal>
  );
}
