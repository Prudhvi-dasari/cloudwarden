import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { persistUserSession, resetPasswordForEmail } from '../lib/authSession';
import { X, Lock, Mail, Loader2, Sparkles, CheckCircle, ArrowRight, ShieldCheck, KeyRound, User, AlertCircle } from 'lucide-react';
import Portal from './Portal';

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
      setSuccessMsg('Logged in as Master Admin (Prudhvi)! Lifetime PRO active.');
      setTimeout(() => {
        onAuthSuccess(persisted);
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
        setSuccessMsg('Signed in successfully!');
        setTimeout(() => {
          onAuthSuccess(persisted);
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
        if (!data?.session) {
          setSuccessMsg('Account created. Open the confirmation email, then sign in here.');
          setMode('login');
          return;
        }
        const persisted = await persistUserSession(data.user);
        setSuccessMsg('Account created. You are signed in.');
        setTimeout(() => {
          onAuthSuccess(persisted);
          onClose();
        }, 400);
      }
    } catch (err) {
      setError(err.message || 'Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Portal>
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto cursor-default"
      >
        
        {/* Mobile handle indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-all cursor-pointer z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Icon & Heading */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-500/20">
            {mode === 'forgot' ? <KeyRound className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {mode === 'login' && 'Sign in to iTransfer'}
            {mode === 'register' && 'Create your iTransfer Account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'google-prompt' && 'Complete Google Sign-In'}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {mode === 'login' && 'Access transfer history, saved settings, and Pro bandwidth'}
            {mode === 'register' && 'Free account with multi-gigabyte transfers and dark mode'}
            {mode === 'forgot' && 'Enter your email to receive a secure password reset link'}
            {mode === 'google-prompt' && 'Enter your name and Google email address to connect'}
          </p>
        </div>

        {/* Error / Success alert */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold leading-relaxed animate-fadeIn">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Mode Tabs (Sign In / Sign Up) */}
        {mode !== 'forgot' && mode !== 'google-prompt' && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-5 text-xs font-black">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccessMsg(''); }}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setSuccessMsg(''); }}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Google Direct Form Prompt */}
        {mode === 'google-prompt' && (
          <form onSubmit={handleGoogleDirectComplete} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Your Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Prudhvi Dasari"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Google Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Complete Google Sign-In</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600"
              >
                Back to Standard Login
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Your Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Send Password Reset Link</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessMsg(''); }}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* Standard Email & Password Login / Register Form */}
        {mode !== 'forgot' && mode !== 'google-prompt' && (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Prudhvi Dasari"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); setSuccessMsg(''); }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{mode === 'login' ? 'Sign In to Account' : 'Create Free Account'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

      </div>
    </div>
    </Portal>
  );
}
