import { useEffect, useState } from 'react';
import { X, Crown, Check, ArrowRight, AlertCircle } from 'lucide-react';
import Portal from './Portal';
import { supabase } from '../lib/supabase';
import { checkoutAccessToken } from '../lib/checkoutSession';
import { labelForCurrency, readPricingGeo } from '../lib/pricingCurrency';

const PLAN_COPY = {
  monthly: { label: 'Monthly', inr: '₹799', usd: '$15', note: 'Billed every month' },
  yearly: { label: 'Yearly', inr: '₹7,999', usd: '$150', note: 'Billed once a year' },
};

export default function PaymentModal({ isOpen, onClose }) {
  const [billingCycle, setBillingCycle] = useState('yearly');
  const [offers, setOffers] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setPhase('idle');
    setNote('');
    fetch('/api/payment?action=offers')
      .then((response) => response.json())
      .then((body) => { if (alive) setOffers(body); })
      .catch(() => { if (alive) setOffers(null); });
    return () => { alive = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const planOffer = offers?.plans?.find((plan) => plan.code === billingCycle);
  const canPurchase = Boolean(offers?.purchasable && planOffer?.purchasable && planOffer?.productConfigured);
  const currency = offers?.currency === 'INR' || offers?.currency === 'USD' ? offers.currency : readPricingGeo().currency;
  const choices = Object.entries(PLAN_COPY).map(([id, plan]) => {
    const offer = offers?.plans?.find((item) => item.code === id);
    const price = offer?.currencyFallback && offer.chargeLabel
      ? offer.chargeLabel
      : (offer ? labelForCurrency(offer, currency) : (currency === 'INR' ? plan.inr : plan.usd));
    return [id, { ...plan, price }];
  });

  async function startCheckout() {
    if (!canPurchase || phase === 'submitting') return;
    setPhase('submitting');
    setNote('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let opened = false;
    try {
      const token = await checkoutAccessToken(() => supabase.auth.getSession());
      if (!token) {
        setNote('Sign in before starting checkout.');
        return;
      }
      const response = await fetch('/api/payment?action=checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: billingCycle }),
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
      if (!opened) setPhase('idle');
    }
  }

  const busy = phase === 'submitting';

  return (
    <Portal>
    <div className="ds-modal-backdrop acct-modal-backdrop acct-ui" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="ds-modal"
      >
        <span className="acct-grabber" aria-hidden="true" />

        <button type="button" onClick={onClose} className="ds-close" aria-label="Close">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="ds-modal-head">
          <div className="acct-brand">
            <span className="ds-icon is-dark is-sm" aria-hidden="true"><Crown /></span>
            <p className="ds-kicker"><b>●</b> Pro</p>
          </div>
          <h2 id="payment-modal-title" className="ds-modal-title acct-title">Upgrade to Pro</h2>
          <p className="ds-modal-sub">Pay with Dodo Payments. Pro applies after the server confirms the payment.</p>
        </div>

        <div className="ds-modal-body acct-stack">
          <div className="acct-plan-opts" role="group" aria-label="Billing cycle">
            {choices.map(([id, plan]) => (
              <button
                key={id}
                type="button"
                data-ml-goal="pricing_cta"
                data-ml-goal-plan={id}
                aria-pressed={billingCycle === id}
                onClick={() => setBillingCycle(id)}
                className="acct-plan-opt"
              >
                <span className="acct-plan-tick" aria-hidden="true"><Check className="w-3 h-3" strokeWidth={3} /></span>
                <small>{plan.label}</small>
                <strong>{plan.price}</strong>
                <span>{plan.note}</span>
              </button>
            ))}
          </div>

          <ul className="ds-checks">
            {['250 GB on one transfer after payment is confirmed', 'The link can stay open for 180 days', 'Dodo charges the price on its checkout page'].map((item) => (
              <li key={item}>
                <Check strokeWidth={3} aria-hidden="true" /> {item}
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={!canPurchase || busy}
            aria-busy={busy}
            data-ml-goal="checkout_click"
            data-ml-goal-plan={billingCycle}
            onClick={startCheckout}
            className="ds-btn ds-btn-dark ds-btn-lg w-full"
          >
            {busy && <span className="ds-spinner" aria-hidden="true" />}
            <span>{busy ? 'Opening checkout…' : canPurchase ? 'Continue to checkout' : 'Checkout is closed'}</span>
            {!busy && canPurchase && <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />}
          </button>
          {note ? (
            <p role="status" className="ds-alert is-warn">
              <AlertCircle aria-hidden="true" />
              <span>{note}</span>
            </p>
          ) : (
            <p className="acct-fineprint">
              {offers?.reason || (canPurchase
                ? 'Secure checkout by Dodo Payments. Sign in first so the plan lands on your account.'
                : 'A Dodo product and a paid transfer limit are not configured. This button cannot take payment, and a return from Dodo does not grant access.')}
            </p>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
