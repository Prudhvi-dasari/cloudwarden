import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';

export const PAID_FALLBACK = [
  { code: 'monthly', priceLabel: '₹799', interval: 'Billed every month', transfer: '250 GB', retention: '180 days', purchasable: true },
  { code: 'yearly', priceLabel: '₹5,999', interval: 'Billed once a year', transfer: '250 GB', retention: '180 days', purchasable: true },
];

const FREE_POINTS = [
  '6 GB per transfer',
  'Link open from 1 hour to 7 days',
  'No account to send or receive',
  'Optional password on the download',
  'Email, link, device, and request',
];

function rupees(label) {
  const n = Number(String(label || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Free card plus one paid card with a Monthly / Yearly switch.
 * Pass `onCheckout` to open checkout in place; without it the paid button links to /pricing.
 */
export default function PlanCards({
  plans = PAID_FALLBACK,
  onCheckout,
  busyPlan = '',
  note = '',
  notePlan = '',
  freeHref = '/',
  isPro = false,
}) {
  const monthly = plans.find((p) => p.code === 'monthly') || PAID_FALLBACK[0];
  const yearly = plans.find((p) => p.code === 'yearly') || PAID_FALLBACK[1];
  const [cycle, setCycle] = useState('yearly');
  const plan = cycle === 'yearly' ? yearly : monthly;

  const monthlyAmount = rupees(monthly.priceLabel);
  const yearlyAmount = rupees(yearly.priceLabel);
  const saving = monthlyAmount && yearlyAmount
    ? Math.round((1 - yearlyAmount / (monthlyAmount * 12)) * 100)
    : 0;
  const perMonth = yearlyAmount ? Math.round(yearlyAmount / 12) : 0;
  const busy = busyPlan === plan.code;

  const freeCta = freeHref.startsWith('#') ? (
    <a href={freeHref} className="ds-btn ds-btn-ghost w-full" data-ml-goal="pricing_cta">
      Send a file free
    </a>
  ) : (
    <Link to={freeHref} className="ds-btn ds-btn-ghost w-full" data-ml-goal="pricing_cta">
      Send a file free
    </Link>
  );

  return (
    <div className="ds-plans">
      <article className="ds-plan" data-reveal aria-labelledby="plan-free-title">
        <div className="ds-plan-top">
          <div>
            <h3 id="plan-free-title" className="ds-h3">Free</h3>
            <p className="ds-plan-sub">For the file you need to send today.</p>
          </div>
          <span className="ds-badge">No checkout</span>
        </div>
        <p className="ds-plan-price">₹0 <small>forever</small></p>
        <ul className="ds-checks">
          {FREE_POINTS.map((point) => (
            <li key={point}><Check strokeWidth={3} aria-hidden="true" />{point}</li>
          ))}
        </ul>
        <div className="ds-plan-foot">{freeCta}</div>
      </article>

      <article className="ds-plan is-featured" data-reveal style={{ '--d': '120ms' }} aria-labelledby="plan-paid-title">
        <div className="ds-plan-top">
          <div>
            <h3 id="plan-paid-title" className="ds-h3">Pro</h3>
            <p className="ds-plan-sub">For big folders and links that stay open.</p>
          </div>
          <div className="ds-switch" role="group" aria-label="Billing cycle">
            <span
              className="ds-switch-thumb"
              style={{ width: 'calc(50% - 4px)', transform: cycle === 'yearly' ? 'translateX(100%)' : 'none' }}
              aria-hidden="true"
            />
            <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>Monthly</button>
            <button type="button" aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')}>
              Yearly
            </button>
          </div>
        </div>

        <p className="ds-plan-price">
          <span key={plan.code} className="ds-price-num">{plan.priceLabel}</span>
          <small>{cycle === 'yearly' ? '/ year' : '/ month'}</small>
        </p>
        <p className="ds-plan-note">
          {cycle === 'yearly' && perMonth
            ? `About ₹${perMonth.toLocaleString('en-IN')} a month${saving > 0 ? `, ${saving}% less than paying monthly` : ''}.`
            : `${plan.interval}.`}
        </p>

        <ul className="ds-checks">
          <li><Check strokeWidth={3} aria-hidden="true" />{plan.transfer || '250 GB'} per transfer</li>
          <li><Check strokeWidth={3} aria-hidden="true" />Links open for up to {plan.retention || '180 days'}</li>
          <li><Check strokeWidth={3} aria-hidden="true" />Everything in Free</li>
          <li><Check strokeWidth={3} aria-hidden="true" />Applies once the server confirms the payment</li>
        </ul>

        <div className="ds-plan-foot">
          {isPro ? (
            <p className="ds-plan-note">This account already has Pro.</p>
          ) : onCheckout ? (
            <button
              type="button"
              data-ml-goal="checkout_click"
              data-ml-goal-plan={plan.code}
              disabled={!plan.purchasable || busy}
              onClick={() => onCheckout(plan.code)}
              className="ds-btn ds-btn-light ds-btn-lg w-full"
            >
              {busy ? 'Opening checkout…' : (plan.purchasable ? 'Continue to checkout' : 'Checkout is closed')}
              {!busy && plan.purchasable && <ArrowRight className="ds-btn-arrow w-4 h-4" />}
            </button>
          ) : (
            <Link to="/pricing" className="ds-btn ds-btn-light ds-btn-lg w-full">
              See Pro
              <ArrowRight className="ds-btn-arrow w-4 h-4" />
            </Link>
          )}
          {note && notePlan === plan.code && (
            <p className="ds-plan-alert" role="status">{note}</p>
          )}
          <p className="ds-plan-note">Secure checkout by Dodo Payments. Sign in first so the plan lands on your account.</p>
        </div>
      </article>
    </div>
  );
}
