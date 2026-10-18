import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import PaymentModal from '../components/PaymentModal';
import { getStoredUser, clearUserSession, isUserPro } from '../lib/authSession';
import { Crown, Check } from 'lucide-react';

export default function PricingPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState('yearly');

  const userIsPro = isUserPro(user);

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(m) => { setAuthMode(m); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Pricing"
        title="Simple plans for individuals and teams"
        subtitle="6 GB free with no signup. Links last up to 7 days. Larger plans are not available yet."
        nextLabel="Send a file"
        nextTo="/"
      >
        {userIsPro && (
          <div className="rounded-2xl border border-white/40 bg-white/10 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white">You are on Pro</p>
              <p className="text-sm text-white/55 mt-1">Uploads are still limited to 6 GB and 7 days until paid plans are available.</p>
            </div>
            <Link to="/" className="rounded-full bg-white text-black text-xs font-semibold px-4 py-2">Transfer now</Link>
          </div>
        )}

        <div className="flex justify-start">
          <div className="inline-flex items-center p-1 rounded-full border border-white/10 bg-white/5 gap-1">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${billingCycle === 'monthly' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
            >
              Yearly
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-black">Save 33%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          <div className="custom-card p-6 sm:p-7 flex flex-col">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/40 font-semibold">Free</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">$0</p>
            <p className="text-sm text-white/50 mt-1">No signup required</p>
            <ul className="mt-6 space-y-3 text-sm text-white/70 flex-1">
              {['6 GB per transfer', 'Device transfer on your network', 'Up to 7 days', 'Password protection', 'No ads'].map((f) => (
                <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-white shrink-0 mt-0.5" />{f}</li>
              ))}
            </ul>
            <Link to="/" className="mt-6 w-full py-3 rounded-full border border-white/15 text-sm font-semibold text-center hover:bg-white/5">Start free</Link>
          </div>

          <div className="custom-card p-6 sm:p-7 flex flex-col border-white/35 relative">
            <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white text-black">Popular</span>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white font-semibold flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Pro
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">
              {billingCycle === 'yearly' ? '$6.66' : '$9.99'}
            </p>
            <p className="text-sm text-white/50 mt-1">/ month · or ₹799</p>
            <ul className="mt-6 space-y-3 text-sm text-white/80 flex-1">
              {['Not available yet', 'No larger transfer size yet', 'No longer retention yet', 'No paid storage quota yet', 'Same 6 GB limit as Free'].map((f) => (
                <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-white shrink-0 mt-0.5" />{f}</li>
              ))}
            </ul>
            {userIsPro ? (
              <div className="mt-6 py-3 rounded-full bg-white/10 text-center text-sm font-semibold">Your active plan</div>
            ) : (
              <button type="button" disabled className="mt-6 w-full py-3 rounded-full bg-white/15 text-white/70 text-sm font-semibold cursor-not-allowed">
                Not available yet
              </button>
            )}
          </div>

          <div className="custom-card p-6 sm:p-7 flex flex-col">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/40 font-semibold">Teams</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">
              {billingCycle === 'yearly' ? '$15.99' : '$19.99'}
            </p>
            <p className="text-sm text-white/50 mt-1">/ user / month</p>
            <ul className="mt-6 space-y-3 text-sm text-white/70 flex-1">
              {['Not available yet', 'No team storage quota yet', 'No shared workspace yet', 'No team billing yet', 'Same 6 GB limit as Free'].map((f) => (
                <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-white shrink-0 mt-0.5" />{f}</li>
              ))}
            </ul>
            <Link to="/teams" className="mt-6 w-full py-3 rounded-full border border-white/15 text-sm font-semibold text-center hover:bg-white/5">Learn about Teams</Link>
          </div>
        </div>
      </PageFrame>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialMode={authMode} onAuthSuccess={(u) => setUser(u)} />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={() => { clearUserSession(); setUser(null); }}
        onOpenUpgrade={() => setIsPaymentOpen(true)}
      />
      <PaymentModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} user={user} onUpgradeSuccess={(u) => setUser(u)} />
    </>
  );
}
