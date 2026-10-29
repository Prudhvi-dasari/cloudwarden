import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';

export const PAID_FALLBACK = [
  { code: 'creator_monthly', tier: 'creator', priceLabel: '₹299', usdLabel: '$5', interval: 'Billed every month', transfer: '50 GB', storage: '200 GB', retention: '30 days', purchasable: true },
  { code: 'pro_monthly', tier: 'pro', priceLabel: '₹799', usdLabel: '$15', interval: 'Billed every month', transfer: '250 GB', storage: '1 TB', retention: '180 days', purchasable: true },
  { code: 'pro_yearly', tier: 'pro', priceLabel: '₹7,999', usdLabel: '$150', interval: 'Billed once a year', transfer: '250 GB', storage: '1 TB', retention: '180 days', purchasable: true },
  { code: 'studio_monthly', tier: 'studio', priceLabel: '₹2,499', usdLabel: '$39', interval: 'Billed every month', transfer: '250 GB', storage: '3 TB', retention: '1 year', purchasable: true },
  { code: 'pass', tier: 'pass', priceLabel: '₹149', usdLabel: '$2', interval: 'One transfer', transfer: '100 GB', storage: 'One transfer', retention: '30 days', oneTime: true, purchasable: true },
  { code: 'monthly', tier: 'pro', priceLabel: '₹799', usdLabel: '$15', interval: 'Billed every month', transfer: '250 GB', storage: '1 TB', retention: '180 days', hidden: true, purchasable: true },
  { code: 'yearly', tier: 'pro', priceLabel: '₹7,999', usdLabel: '$150', interval: 'Billed once a year', transfer: '250 GB', storage: '1 TB', retention: '180 days', hidden: true, purchasable: true },
];

const FREE_POINTS = [
  '6 GB per transfer',
  'Link open from 1 hour to 7 days',
  'No account to send or receive',
  'Optional password on the download',
];

function TierCard({
  title,
  sub,
  price,
  usd,
  note,
  points,
  featured = false,
  code,
  onCheckout,
  busy,
  purchasable,
  isCurrent,
  noteText,
  extra,
}) {
  return (
    <article className={`ds-plan${featured ? ' is-featured' : ''}`} data-reveal>
      <div className="ds-plan-top">
        <div>
          <h3 className="ds-h3">{title}</h3>
          <p className="ds-plan-sub">{sub}</p>
        </div>
      </div>
      <p className="ds-plan-price">
        <span className="ds-price-num">{price}</span>
        {usd ? <small> · {usd}</small> : null}
      </p>
      <p className="ds-plan-note">{note}</p>
      {extra}
      <ul className="ds-checks">
        {points.map((point) => (
          <li key={point}><Check strokeWidth={3} aria-hidden="true" />{point}</li>
        ))}
      </ul>
      <div className="ds-plan-foot">
        {isCurrent ? (
          <p className="ds-plan-note">This is your plan.</p>
        ) : onCheckout ? (
          <button
            type="button"
            data-ml-goal="checkout_click"
            data-ml-goal-plan={code}
            disabled={!purchasable || busy}
            onClick={() => onCheckout(code)}
            className={`ds-btn ${featured ? 'ds-btn-light' : 'ds-btn-dark'} ds-btn-lg w-full`}
          >
            {busy ? 'Opening checkout…' : (purchasable ? 'Continue to checkout' : 'Checkout is closed')}
            {!busy && purchasable ? <ArrowRight className="ds-btn-arrow w-4 h-4" /> : null}
          </button>
        ) : (
          <Link to="/pricing" className={`ds-btn ${featured ? 'ds-btn-light' : 'ds-btn-dark'} ds-btn-lg w-full`}>
            See {title}
          </Link>
        )}
        {noteText ? <p className="ds-plan-alert" role="status">{noteText}</p> : null}
      </div>
    </article>
  );
}

export default function PlanCards({
  plans = PAID_FALLBACK,
  onCheckout,
  busyPlan = '',
  note = '',
  notePlan = '',
  freeHref = '/',
  isPro = false,
  currentTier = '',
}) {
  const list = plans.length ? plans : PAID_FALLBACK;
  const creator = list.find((plan) => plan.code === 'creator_monthly') || list.find((plan) => plan.tier === 'creator');
  const studio = list.find((plan) => plan.code === 'studio_monthly') || list.find((plan) => plan.tier === 'studio');
  const proMonthly = list.find((plan) => plan.code === 'pro_monthly') || list.find((plan) => plan.code === 'monthly') || PAID_FALLBACK[1];
  const proYearly = list.find((plan) => plan.code === 'pro_yearly') || list.find((plan) => plan.code === 'yearly') || PAID_FALLBACK[2];
  const pass = list.find((plan) => plan.oneTime || plan.code === 'pass');
  const [cycle, setCycle] = useState('yearly');
  const pro = cycle === 'yearly' ? proYearly : proMonthly;
  const tiered = Boolean(creator || studio);

  const freeCta = freeHref.startsWith('#') ? (
    <a href={freeHref} className="ds-btn ds-btn-ghost w-full" data-ml-goal="pricing_cta">Send a file free</a>
  ) : (
    <Link to={freeHref} className="ds-btn ds-btn-ghost w-full" data-ml-goal="pricing_cta">Send a file free</Link>
  );

  return (
    <div>
      <div className={`ds-plans${tiered ? ' is-tiers' : ''}`}>
        <article className="ds-plan" data-reveal>
          <div className="ds-plan-top">
            <div>
              <h3 className="ds-h3">Free</h3>
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

        {creator ? (
          <TierCard
            title="Creator"
            sub="For a month of client files."
            price={creator.priceLabel}
            usd={creator.usdLabel}
            note={creator.interval}
            points={[
              `${creator.transfer} per transfer`,
              `${creator.storage} stored at a time`,
              `Links open for ${creator.retention}`,
              'Password and a custom expiry',
            ]}
            code={creator.code}
            onCheckout={onCheckout}
            busy={busyPlan === creator.code}
            purchasable={creator.purchasable !== false && creator.productConfigured !== false}
            isCurrent={currentTier === 'creator'}
            noteText={notePlan === creator.code ? note : ''}
          />
        ) : null}

        <TierCard
          title="Pro"
          sub="For big folders and links that stay open."
          price={pro.priceLabel}
          usd={pro.usdLabel}
          note={cycle === 'yearly' ? 'Billed once a year.' : 'Billed every month.'}
          featured
          points={[
            `${pro.transfer || '250 GB'} per transfer`,
            `${pro.storage || '1 TB'} stored at a time`,
            `Links open for ${pro.retention || '180 days'}`,
            'Your logo on the download page',
          ]}
          code={pro.code}
          onCheckout={onCheckout}
          busy={busyPlan === pro.code}
          purchasable={pro.purchasable !== false && pro.productConfigured !== false}
          isCurrent={currentTier === 'pro' || (isPro && !currentTier)}
          noteText={notePlan === pro.code ? note : ''}
          extra={(
            <>
              <div className="ds-switch" role="group" aria-label="Pro billing cycle">
                <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>Monthly</button>
                <button type="button" aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')}>Yearly</button>
              </div>
              {cycle === 'yearly' ? (
                <p className="ds-plan-note">₹7,999 a year instead of ₹9,588. About 17% off.</p>
              ) : null}
              <p className="ds-plan-note">A 2-year Pro plan is not for sale yet.</p>
            </>
          )}
        />

        {studio ? (
          <TierCard
            title="Studio"
            sub="For a year of project files."
            price={studio.priceLabel}
            usd={studio.usdLabel}
            note={studio.interval}
            points={[
              `${studio.transfer} per transfer`,
              `${studio.storage} stored at a time`,
              `Links open for ${studio.retention}`,
              'Logo on the download page',
              'Ready for a team later',
            ]}
            code={studio.code}
            onCheckout={onCheckout}
            busy={busyPlan === studio.code}
            purchasable={studio.purchasable !== false && studio.productConfigured !== false}
            isCurrent={currentTier === 'studio'}
            noteText={notePlan === studio.code ? note : ''}
          />
        ) : null}
      </div>
      {pass ? (
        <p className="ds-plan-note mt-4">
          Need one large send? A Pass is {pass.priceLabel} ({pass.usdLabel}) for a single transfer up to {pass.transfer}, kept {pass.retention}.{' '}
          {onCheckout ? (
            <button type="button" className="ds-link" disabled={busyPlan === pass.code || pass.purchasable === false} onClick={() => onCheckout(pass.code)}>
              {busyPlan === pass.code ? 'Opening checkout…' : 'Buy a Pass'}
            </button>
          ) : (
            <Link to="/pricing" className="ds-link">See the Pass</Link>
          )}
          {notePlan === pass.code && note ? ` ${note}` : ''}
        </p>
      ) : null}
    </div>
  );
}
