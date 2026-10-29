import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Minus } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import PaymentModal from '../components/PaymentModal';
import CheckoutReturnNotice from '../components/CheckoutReturnNotice';
import AnimatedHeadline from '../components/ds/AnimatedHeadline';
import PlanCards, { PAID_FALLBACK } from '../components/ds/PlanCards';
import { HomeFaq } from '../components/home/HomeSections';
import { getStoredUser, clearUserSession, isUserPro, persistUserSession } from '../lib/authSession';
import { supabase } from '../lib/supabase';
import { checkoutAccessToken } from '../lib/checkoutSession';

const COMPARE = [
  ['Size of one transfer', '6 GB', '250 GB'],
  ['Longest link', '7 days', '180 days'],
  ['Shortest link', '1 hour', '1 hour'],
  ['Account to send', 'Not required', 'Required for checkout'],
  ['Recipient account', 'Never', 'Never'],
  ['Password on the download', true, true],
  ['Email, link, device, request', true, true],
  ['Ads', 'None', 'None'],
];

const NOT_FOR_SALE = ['Team billing', 'Shared storage', 'SSO', 'Custom domain'];

const PRICING_FAQS = [
  {
    q: 'When does Pro start working?',
    a: 'After Dodo confirms the payment to our server. The page you return to after checkout does not grant access by itself, so it can take a moment.',
  },
  {
    q: 'Do I need an account to pay?',
    a: 'Yes. Sign in first so the plan is attached to your account. Sending on the free plan never needs one.',
  },
  {
    q: 'What does the yearly plan cost per month?',
    a: 'The yearly price divided by twelve. The Dodo checkout page shows the exact amount before you pay.',
  },
  {
    q: 'Can my team share one plan?',
    a: 'Not yet. Teams is not a billed plan. There is no shared storage, SSO, custom domain, or team billing today.',
  },
  {
    q: 'Can I use a discount code?',
    a: 'If you have one, the Dodo checkout page has a field for it.',
  },
];

export default function PricingPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [offers, setOffers] = useState(null);
  const [pendingPlan, setPendingPlan] = useState('');
  const [busyPlan, setBusyPlan] = useState('');
  const [note, setNote] = useState('');
  const [notePlan, setNotePlan] = useState('');
  const userIsPro = isUserPro(user);
  const paidPlans = offers?.plans?.length ? offers.plans : PAID_FALLBACK;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'return') return undefined;
    let stopped = false;
    let tries = 0;
    async function refreshAccount() {
      const { data } = await supabase.auth.getUser();
      if (stopped || !data?.user) return;
      const next = await persistUserSession(data.user);
      if (!stopped && next) setUser(next);
    }
    refreshAccount();
    const timer = setInterval(() => {
      tries += 1;
      if (tries > 6) {
        clearInterval(timer);
        return;
      }
      refreshAccount();
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/payment?action=offers')
      .then((response) => response.json())
      .then((body) => { if (alive) setOffers(body); })
      .catch(() => { if (alive) setOffers(null); });
    return () => { alive = false; };
  }, []);

  async function startCheckout(plan) {
    setBusyPlan(plan);
    setNote('');
    setNotePlan(plan);
    let opened = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const token = await checkoutAccessToken(() => supabase.auth.getSession());
      if (!token) {
        setPendingPlan(plan);
        setAuthMode('login');
        setIsAuthOpen(true);
        setNote('Sign in before starting checkout.');
        return;
      }
      const response = await fetch('/api/payment?action=checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.checkoutUrl) {
        setNote(body.error || 'Checkout could not open.');
        return;
      }
      opened = true;
      window.location.assign(body.checkoutUrl);
    } catch {
      setNote(controller.signal.aborted ? 'Checkout did not respond. Try again.' : 'Checkout could not open.');
    } finally {
      clearTimeout(timer);
      if (!opened) setBusyPlan('');
    }
  }

  return (
    <div className="ds-page">
      <div
        className="absolute inset-x-0 top-0 h-[560px] pointer-events-none"
        style={{ background: 'radial-gradient(60% 70% at 50% 0%, #e8f0ff 0%, rgba(255,255,255,0) 70%)' }}
        aria-hidden="true"
      />
      <Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />
      <CheckoutReturnNotice />

      <main className="relative z-10">
        <section className="ds-wrap pt-14 sm:pt-20 pb-12 text-center">
          <p className="ds-kicker justify-center"><b>●</b> Pricing</p>
          <AnimatedHeadline
            text="Send free. Pay when the file is bigger."
            accent={2}
            className="ds-h1 mt-4 mx-auto max-w-4xl"
          />
          <p className="ds-lead mt-5 mx-auto max-w-2xl">
            Free is 6 GB for up to 7 days, with no account. Pro is 250 GB with links open for 180 days, billed monthly or yearly through Dodo.
          </p>
          {userIsPro && (
            <p className="mt-4 inline-flex ds-badge ds-badge-green">This account is marked Pro. The larger limit applies once the server confirms a payment.</p>
          )}
          {note && !notePlan && <p className="ds-lead mt-4" role="status">{note}</p>}
        </section>

        <section className="ds-wrap pb-6" aria-label="Plans">
          <div className="max-w-4xl mx-auto">
            <PlanCards
              plans={paidPlans}
              onCheckout={startCheckout}
              busyPlan={busyPlan}
              note={note}
              notePlan={notePlan}
              freeHref="/"
              isPro={userIsPro}
            />
          </div>
        </section>

        <section className="ds-section" aria-labelledby="compare-title">
          <div className="ds-wrap">
            <div className="ds-section-head is-center" data-reveal>
              <p className="ds-kicker justify-center"><b>●</b> Side by side</p>
              <h2 id="compare-title" className="ds-h2">What changes when you pay.</h2>
            </div>
            <div className="mt-10 max-w-4xl mx-auto ds-card overflow-hidden" data-reveal style={{ '--d': '80ms' }}>
              <table className="w-full text-left text-[0.9375rem]">
                <thead>
                  <tr className="border-b border-[#e6e8ee] bg-[#f6f7f9]">
                    <th scope="col" className="px-5 py-4 font-semibold text-[#6b7486]">Limit</th>
                    <th scope="col" className="px-5 py-4 font-semibold text-[#060a12]">Free</th>
                    <th scope="col" className="px-5 py-4 font-semibold text-[#060a12]">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map(([label, free, pro]) => (
                    <tr key={label} className="border-b border-[#e6e8ee] last:border-0">
                      <th scope="row" className="px-5 py-4 font-medium text-[#1b2230]">{label}</th>
                      {[free, pro].map((value, i) => (
                        <td key={i} className="px-5 py-4 text-[#060a12]">
                          {value === true ? (
                            <Check className="w-4 h-4 text-[#12a150]" aria-label="Included" />
                          ) : value === false ? (
                            <Minus className="w-4 h-4 text-[#9aa1af]" aria-label="Not included" />
                          ) : (
                            <span className={i === 1 ? 'font-semibold' : ''}>{value}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="ds-wrap" aria-labelledby="teams-title">
          <div className="ds-card-soft p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6" data-reveal>
            <div>
              <p className="ds-kicker"><b>●</b> Not for sale</p>
              <h2 id="teams-title" className="ds-h3 mt-2 text-[1.35rem]">Teams is not a billed plan yet.</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {NOT_FOR_SALE.map((item) => (
                  <span key={item} className="ds-chip text-[#6b7486]"><Minus className="w-3.5 h-3.5" aria-hidden="true" />{item}</span>
                ))}
              </div>
            </div>
            <Link to="/teams" className="ds-link shrink-0">How a team sends today<ArrowRight className="w-4 h-4" /></Link>
          </div>
        </section>

        <HomeFaq
          faqs={PRICING_FAQS}
          title="Billing questions, answered."
          lead="How checkout works, when Pro switches on, and what is not for sale."
        />
      </main>

      <Footer />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => { setIsAuthOpen(false); setPendingPlan(''); }}
        initialMode={authMode}
        onAuthSuccess={(u) => {
          setUser(u);
          const plan = pendingPlan;
          setPendingPlan('');
          if (plan) startCheckout(plan);
        }}
      />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={() => { clearUserSession(); setUser(null); }}
        onOpenUpgrade={() => setIsPaymentOpen(true)}
      />
      <PaymentModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} />
    </div>
  );
}
