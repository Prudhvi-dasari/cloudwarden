import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import PaymentModal from '../components/PaymentModal';
import { getStoredUser, clearUserSession, isUserPro } from '../lib/authSession';
import {
  Crown, Check, Zap, ArrowLeft, ShieldCheck, Sparkles,
  Users, Building, CheckCircle2, ArrowRight, HelpCircle
} from 'lucide-react';

export default function PricingPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState('yearly'); // 'monthly' | 'yearly'

  const userIsPro = isUserPro(user);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-900 bg-dot-grid relative overflow-hidden">
      
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />

      <Navbar
        user={user}
        onOpenAuth={(m) => { setAuthMode(m); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Active Pro Member Banner */}
        {userIsPro && (
          <div className="mb-10 p-6 sm:p-7 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 rounded-3xl text-slate-950 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl animate-fadeIn border border-amber-300">
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                👑
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black">You are an Active PRO Member</h3>
                <p className="text-xs sm:text-sm font-semibold text-slate-950/80">
                  Your account has unlimited 25 GB transfers, extended retention, and gigabit speed unlocked.
                </p>
              </div>
            </div>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-slate-900 transition-colors shrink-0 shadow-md"
            >
              Transfer Files Now
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-indigo-100/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" /> Honest & Transparent Pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            Simple plans for individuals and teams
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed mb-8">
            Send files for free with zero signup. Upgrade for massive 25 GB limits, permanent storage, and custom branding.
          </p>

          {/* Billing Switcher */}
          <div className="inline-flex items-center p-1.5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xs gap-2">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                billingCycle === 'monthly'
                  ? 'theme-btn-primary shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all ${
                billingCycle === 'yearly'
                  ? 'theme-btn-primary shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="text-xs bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded-full">
                Save 33%
              </span>
            </button>
          </div>
        </div>

        {/* 3 Tier Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 items-stretch">
          
          {/* 1. FREE PLAN */}
          <div className="custom-card p-6 sm:p-8 flex flex-col justify-between bg-white/90">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Free Tier</span>
                <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  No Signup Required
                </span>
              </div>

              <div className="mb-6">
                <span className="text-4xl sm:text-5xl font-black text-slate-900">$0</span>
                <span className="text-sm text-slate-500 font-semibold"> / forever</span>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 font-medium mb-6">
                Perfect for quick, one-off file transfers without creating an account.
              </p>

              <ul className="space-y-3.5 text-sm text-slate-700 font-medium mb-8">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span><strong>5 GB</strong> per transfer</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span><strong>Unlimited</strong> Direct Device P2P</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Files stored for up to <strong>7 days</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Password protection & self-destruct</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>In-browser media streaming</span>
                </li>
              </ul>
            </div>

            <Link
              to="/"
              className="w-full py-3.5 rounded-xl border border-slate-300 font-bold text-sm text-slate-800 hover:bg-slate-50 text-center block transition-colors"
            >
              Start Free Transfer
            </Link>
          </div>

          {/* 2. PRO PLAN (HIGHLIGHTED) */}
          <div className="custom-card p-6 sm:p-8 flex flex-col justify-between border-2 border-indigo-500 shadow-xl relative overflow-hidden bg-white">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-600 to-purple-600 text-white text-xs font-black px-4 py-1 rounded-bl-xl uppercase tracking-wider">
              Most Popular
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">iTransfer Pro</span>
              </div>

              <div className="mb-6">
                <span className="text-4xl sm:text-5xl font-black text-slate-900">
                  {billingCycle === 'yearly' ? '$6.66' : '$9.99'}
                </span>
                <span className="text-sm text-slate-500 font-semibold"> / month (or ₹799)</span>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 font-medium mb-6">
                For creators, freelancers, and power users needing huge limits, long expiry, and permanent storage.
              </p>

              <ul className="space-y-3.5 text-sm text-slate-800 font-medium mb-8">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span><strong>25 GB</strong> per transfer</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span><strong>♾️ Never Expire (Permanent) Storage</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Files stored for <strong>30 Days & 1 Year</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Full Private Upload History & Media Previews</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Custom Themes, Invoicing & Priority Speeds</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Instant UPI, Cards & PayPal Checkout</span>
                </li>
              </ul>
            </div>

            {userIsPro ? (
              <div className="py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center font-bold text-sm flex items-center justify-center gap-2">
                <Crown className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                <span>Your Active Plan (PRO)</span>
              </div>
            ) : (
              <button
                onClick={() => setIsPaymentOpen(true)}
                className="theme-btn-primary w-full py-3.5 rounded-xl text-sm font-black shadow-md text-center block transition-all active:scale-98"
              >
                Upgrade to Pro Instantly
              </button>
            )}
          </div>

          {/* 3. TEAMS & ENTERPRISE PLAN */}
          <div className="custom-card p-6 sm:p-8 flex flex-col justify-between bg-white/90">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teams & Business</span>
                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  Custom Domain
                </span>
              </div>

              <div className="mb-6">
                <span className="text-4xl sm:text-5xl font-black text-slate-900">
                  {billingCycle === 'yearly' ? '$15.99' : '$19.99'}
                </span>
                <span className="text-sm text-slate-500 font-semibold"> / user / month</span>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 font-medium mb-6">
                For creative agencies and companies wanting custom branding, subdomains, and admin controls.
              </p>

              <ul className="space-y-3.5 text-sm text-slate-700 font-medium mb-8">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span><strong>50 GB</strong> per transfer</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Custom branding & your domain</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Shared team workspace & audit logs</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Centralized team billing & invoices</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Dedicated support line</span>
                </li>
              </ul>
            </div>

            <Link
              to="/teams"
              className="w-full py-3.5 rounded-xl border border-slate-300 font-bold text-sm text-slate-800 hover:bg-slate-50 text-center block transition-colors"
            >
              Learn About Teams
            </Link>
          </div>

        </div>

      </main>

      <Footer />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onAuthSuccess={(u) => setUser(u)}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={() => {
          clearUserSession();
          setUser(null);
        }}
        onOpenUpgrade={() => setIsPaymentOpen(true)}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        user={user}
        onUpgradeSuccess={(updated) => setUser(updated)}
      />

    </div>
  );
}
