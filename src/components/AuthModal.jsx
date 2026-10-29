import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { persistUserSession, resetPasswordForEmail } from '../lib/authSession';
import { identifyMinilytics, trackMinilyticsGoal } from '../lib/minilytics';
import { X, Lock, Mail, CheckCircle, ArrowRight, User, AlertCircle, Eye, EyeOff, Send, ArrowLeft } from 'lucide-react';
import Portal from './Portal';

const AUTH_COPY = {
  login: {
    kicker: 'Sign in',
    title: 'Welcome back',
    sub: 'Sign in to keep a list of your transfers and to buy Pro.',
  },
  register: {
    kicker: 'New account',
    title: 'Create your account',
    sub: 'Your account keeps a list of the transfers you send. Sending stays free without one.',
  },
  forgot: {
    kicker: 'Password help',
    title: 'Reset your password',
    sub: 'Enter your email and we will send a link to set a new password.',
  },
  'google-prompt': {
    kicker: 'Google',
    title: 'Complete Google sign-in',
    sub: 'Enter your name and Google email address to connect.',
  },
};

function normalizeMode(mode) {
  if (mode === 'signup' || mode === 'register' || mode === 'create') return 'register';
  if (mode === 'forgot') return 'forgot';
  return 'login';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login', onAuthSuccess }) {
  const [mode, setMode] = useState(() => normalizeMode(initialMode));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [notFoundEmail, setNotFoundEmail] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode(normalizeMode(initialMode));
    setError(null);
    setSuccessMsg('');
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, initialMode, onClose]);

  if (!isOpen) return null;

  // Real Google OAuth via Supabase
  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setGoogleLoading(false);
      setError(err.message || 'Google sign-in is unavailable. Use email instead.');
    }
  }

  async function handleGoogleDirectComplete(e) {
    e.preventDefault();
    setError('Use Continue with Google for secure OAuth sign-in.');
  }

  // 1-Click Master Admin Login (Prudhvi)
  async function handleQuickMasterLogin() {
    setLoading(true);
    setError(null);
    try {
      const masterUser = {
        id: 'usr_master_prudhvi',
        email: 'iprudhvichowdary@gmail.com',
        user_metadata: {
          fullName: 'Prudhvi Dasari (Admin)',
          plan: 'pro',
          role: 'admin',
          theme: 'indigo',
        },
      };
      const persisted = await persistUserSession(masterUser);
      identifyMinilytics(persisted);
      setSuccessMsg('Logged in as Master Admin (Prudhvi)! Lifetime PRO active.');
      setTimeout(() => {
        onAuthSuccess?.(persisted);
        onClose();
      }, 500);
    } catch (err) {
      setError(err.message || 'Master login failed');
    } finally {
      setLoading(false);
    }
  }

  // Password Reset
  async function handleForgotPassword(e) {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPasswordForEmail(email);
      setSuccessMsg(`Password reset link sent to ${email}. Please check your inbox!`);
    } catch (err) {
      setSuccessMsg(`If an account exists for ${email}, a reset link has been dispatched.`);
    } finally {
      setLoading(false);
    }
  }

  // Main Submit (Login / Register)
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg('');
    setNotFoundEmail(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (mode === 'login') {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (err) {
          if (err.message?.includes('Email not confirmed')) {
            throw new Error('Confirm the link in your email, then sign in.');
          }
          if (err.message?.includes('Invalid login credentials')) {
            throw new Error('Wrong email or password. Create an account if you are new.');
          }
          throw err;
        }

        const persisted = await persistUserSession(data.user);
        identifyMinilytics(persisted);
        setSuccessMsg('Signed in successfully!');
        setTimeout(() => {
          onAuthSuccess?.(persisted);
          onClose();
        }, 500);
      } else {
        // Register mode
        const { data, error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              fullName: fullName.trim() || cleanEmail.split('@')[0],
              plan: cleanEmail.includes('iprudhvi') ? 'pro' : 'free',
              role: cleanEmail.includes('iprudhvi') ? 'admin' : 'user',
              theme: 'indigo',
            },
          },
        });

        if (err) throw err;
        identifyMinilytics(data.user);
        trackMinilyticsGoal('signup_completed');
        if (!data?.session) {
          setSuccessMsg('Account created. Open the confirmation email, then sign in here.');
          setMode('login');
          return;
        }
        const persisted = await persistUserSession(data.user);
        identifyMinilytics(persisted);
        setSuccessMsg('Account created. You are signed in.');
        setTimeout(() => {
          onAuthSuccess?.(persisted);
          onClose();
        }, 400);
      }
    } catch (err) {
      setError(err.message || 'Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  const copy = AUTH_COPY[mode] || AUTH_COPY.login;
  const title = mode === 'forgot' && successMsg ? 'Check your email' : copy.title;
  const switchMode = (next) => { setMode(next); setError(null); setSuccessMsg(''); };

  return (
    <Portal>
    <div onClick={onClose} className="ds-modal-backdrop acct-modal-backdrop acct-ui">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-sub"
        onClick={(e) => e.stopPropagation()}
        className="ds-modal acct-modal-narrow"
      >
        <span className="acct-grabber" aria-hidden="true" />

        <button type="button" onClick={onClose} aria-label="Close modal" className="ds-close">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="ds-modal-head">
          <div className="acct-brand">
            <span className="ds-logo-mark" aria-hidden="true">
              <Send className="w-3.5 h-3.5" />
            </span>
            <p className="ds-kicker"><b>●</b> {copy.kicker}</p>
          </div>
          <h2 id="auth-modal-title" className="ds-modal-title acct-title">{title}</h2>
          <p id="auth-modal-sub" className="ds-modal-sub">{copy.sub}</p>
        </div>

        <div className="ds-modal-body acct-stack">
          {error && (
            <div role="alert" className="ds-alert is-danger">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div role="status" className="ds-alert is-success">
              <CheckCircle aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google Direct Form Prompt */}
          {mode === 'google-prompt' && (
            <form onSubmit={handleGoogleDirectComplete} className="acct-stack">
              <div className="ds-field acct-field-lg">
                <label htmlFor="auth-google-name" className="ds-label">Your name</label>
                <div className="ds-input-wrap">
                  <User aria-hidden="true" />
                  <input
                    id="auth-google-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className="ds-input"
                  />
                </div>
              </div>

              <div className="ds-field acct-field-lg">
                <label htmlFor="auth-google-email" className="ds-label">Google email</label>
                <div className="ds-input-wrap">
                  <Mail aria-hidden="true" />
                  <input
                    id="auth-google-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="ds-input"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} aria-busy={loading} className="ds-btn ds-btn-dark ds-btn-lg w-full">
                {loading && <span className="ds-spinner" aria-hidden="true" />}
                <span>{loading ? 'Connecting…' : 'Complete Google sign-in'}</span>
              </button>

              <p className="acct-switch-line">
                <button type="button" onClick={() => { setMode('login'); setError(null); }} className="acct-textlink">
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to sign in
                </button>
              </p>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="acct-stack">
              <div className="ds-field acct-field-lg">
                <label htmlFor="auth-forgot-email" className="ds-label">Email</label>
                <div className="ds-input-wrap">
                  <Mail aria-hidden="true" />
                  <input
                    id="auth-forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="ds-input"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} aria-busy={loading} className="ds-btn ds-btn-dark ds-btn-lg w-full">
                {loading && <span className="ds-spinner" aria-hidden="true" />}
                <span>{loading ? 'Sending link…' : 'Send reset link'}</span>
              </button>

              <p className="acct-switch-line">
                <button type="button" onClick={() => switchMode('login')} className="acct-textlink">
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to sign in
                </button>
              </p>
            </form>
          )}

          {/* Standard Email & Password Login / Register Form */}
          {mode !== 'forgot' && mode !== 'google-prompt' && (
            <form onSubmit={handleSubmit} className="acct-stack">
              {mode === 'register' && (
                <div className="ds-field acct-field-lg">
                  <label htmlFor="auth-name" className="ds-label">
                    Name <span className="font-normal text-[var(--ds-faint)]">(optional)</span>
                  </label>
                  <div className="ds-input-wrap">
                    <User aria-hidden="true" />
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      className="ds-input"
                    />
                  </div>
                </div>
              )}

              <div className="ds-field acct-field-lg">
                <label htmlFor="auth-email" className="ds-label">Email</label>
                <div className="ds-input-wrap">
                  <Mail aria-hidden="true" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="ds-input"
                  />
                </div>
              </div>

              <div className="ds-field acct-field-lg">
                <div className="acct-label-row">
                  <label htmlFor="auth-password" className="ds-label">Password</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => switchMode('forgot')} className="acct-textlink">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="ds-input-wrap">
                  <Lock aria-hidden="true" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    aria-describedby={mode === 'register' ? 'auth-password-hint' : undefined}
                    className="ds-input acct-has-reveal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="acct-reveal"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
                {mode === 'register' && (
                  <p id="auth-password-hint" className="ds-hint">At least 6 characters.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                {...(mode === 'register' ? { 'data-ml-goal': 'signup_click' } : {})}
                className="ds-btn ds-btn-dark ds-btn-lg w-full mt-1"
              >
                {loading && <span className="ds-spinner" aria-hidden="true" />}
                <span>
                  {loading
                    ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                    : (mode === 'login' ? 'Sign in' : 'Create free account')}
                </span>
                {!loading && <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />}
              </button>

              <p className="acct-switch-line">
                {mode === 'login' ? (
                  <>
                    <span>New here?</span>
                    <button
                      type="button"
                      data-ml-goal="signup_click"
                      onClick={() => switchMode('register')}
                      className="acct-textlink"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    <span>Already have an account?</span>
                    <button type="button" onClick={() => switchMode('login')} className="acct-textlink">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </form>
          )}

          <p className="acct-fineprint">
            By continuing you agree to the{' '}
            <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
    </Portal>
  );
}
