import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { labelForCurrency, readPricingGeo, rememberDisplayCurrency } from '../../lib/pricingCurrency';

export const PAID_FALLBACK = [
  { code: 'creator_monthly', tier: 'creator', priceLabel: '₹299', inrLabel: '₹299', usdLabel: '$5', interval: 'Billed every month', transfer: '50 GB', storage: '200 GB', retention: '30 days', purchasable: true },
  { code: 'pro_monthly', tier: 'pro', priceLabel: '₹799', inrLabel: '₹799', usdLabel: '$15', interval: 'Billed every month', transfer: '250 GB', storage: '1 TB', retention: '180 days', purchasable: true },
  { code: 'pro_yearly', tier: 'pro', priceLabel: '₹7,999', inrLabel: '₹7,999', usdLabel: '$150', interval: 'Billed once a year', transfer: '250 GB', storage: '1 TB', retention: '180 days', purchasable: true },
  { code: 'studio_monthly', tier: 'studio', priceLabel: '₹2,499', inrLabel: '₹2,499', usdLabel: '$39', interval: 'Billed every month', transfer: '250 GB', storage: '3 TB', retention: '1 year', purchasable: true },
  { code: 'pass', tier: 'pass', priceLabel: '₹149', inrLabel: '₹149', usdLabel: '$2', interval: 'One transfer', transfer: '100 GB', storage: 'One transfer', retention: '30 days', oneTime: true, purchasable: true },
  { code: 'monthly', tier: 'pro', priceLabel: '₹799', inrLabel: '₹799', usdLabel: '$15', interval: 'Billed every month', transfer: '250 GB', storage: '1 TB', retention: '180 days', hidden: true, purchasable: true },
  { code: 'yearly', tier: 'pro', priceLabel: '₹7,999', inrLabel: '₹7,999', usdLabel: '$150', interval: 'Billed once a year', transfer: '250 GB', storage: '1 TB', retention: '180 days', hidden: true, purchasable: true },
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
  currency,
}) {
  return (
    <article className={`ds-plan${featured ? ' is-featured' : ''}`} data-reveal>
      <div className="ds-plan-top">
        <div className="min-w-0">
          <h3 className="ds-h3">{title}</h3>
          <p className="ds-plan-sub">{sub}</p>
        </div>
      </div>
      <p className="ds-plan-price" data-currency={currency || undefined}>
        <span className="ds-price-num">{price}</span>
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
            <ArrowRight className="ds-btn-arrow w-4 h-4" />
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
  currency = '',
}) {
  const list = plans.length ? plans : PAID_FALLBACK;
  const creator = list.find((plan) => plan.code === 'creator_monthly') || list.find((plan) => plan.tier === 'creator');
  const studio = list.find((plan) => plan.code === 'studio_monthly') || list.find((plan) => plan.tier === 'studio');
  const proMonthly = list.find((plan) => plan.code === 'pro_monthly') || list.find((plan) => plan.code === 'monthly') || PAID_FALLBACK[1];
  const proYearly = list.find((plan) => plan.code === 'pro_yearly') || list.find((plan) => plan.code === 'yearly') || PAID_FALLBACK[2];
  const pass = list.find((plan) => plan.oneTime || plan.code === 'pass');
  const [cycle, setCycle] = useState('yearly');
  const chargeCurrency = currency === 'INR' || currency === 'USD' ? currency : readPricingGeo().currency;
  const [displayCurrency, setDisplayCurrency] = useState(() => readPricingGeo().displayCurrency || chargeCurrency);
  const pro = cycle === 'yearly' ? proYearly : proMonthly;
  const tiered = Boolean(creator || studio);
  const price = (plan) => labelForCurrency(plan, displayCurrency);
  const fallback = [creator, proMonthly, proYearly, studio, pass].some((plan) => plan?.currencyFallback);

  useEffect(() => {
    if (readPricingGeo().hasDisplayOverride) return;
    setDisplayCurrency(chargeCurrency);
  }, [chargeCurrency]);

  function chooseCurrency(next) {
    setDisplayCurrency(rememberDisplayCurrency(next));
  }

  const freeCta = freeHref.startsWith('#') ? (
    <a href={freeHref} className="ds-btn ds-btn-ghost ds-btn-lg w-full" data-ml-goal="pricing_cta">
      Send a file free
      <ArrowRight className="ds-btn-arrow w-4 h-4" />
    </a>
  ) : (
    <Link to={freeHref} className="ds-btn ds-btn-ghost ds-btn-lg w-full" data-ml-goal="pricing_cta">
      Send a file free
      <ArrowRight className="ds-btn-arrow w-4 h-4" />
    </Link>
  );

  return (
    <div>
      <div className="ds-plan-toolbar">
        <p className="ds-plan-note">
          {chargeCurrency === 'INR' ? 'Prices for India' : 'Prices in US dollars'}
        </p>
        <div className="ds-switch" role="group" aria-label="Currency">
          <button type="button" aria-pressed={displayCurrency === 'INR'} onClick={() => chooseCurrency('INR')}>₹ INR</button>
          <button type="button" aria-pressed={displayCurrency === 'USD'} onClick={() => chooseCurrency('USD')}>$ USD</button>
        </div>
      </div>
      {displayCurrency !== chargeCurrency ? (
        <p className="ds-plan-note ds-plan-currency-note" role="status">
          Checkout still charges the {chargeCurrency === 'INR' ? 'rupee' : 'dollar'} price for your connection.
        </p>
      ) : null}
      {fallback && displayCurrency === chargeCurrency ? (
        <p className="ds-plan-note ds-plan-currency-note" role="status">
          Checkout bills in rupees until a dollar product is configured.
        </p>
      ) : null}
      <div className={`ds-plans${tiered ? ' is-tiers' : ''}`}>
        <article className="ds-plan" data-reveal>
          <div className="ds-plan-top">
            <div className="ds-plan-kicker">
              <h3 className="ds-h3">Free</h3>
              <span className="ds-badge">No checkout</span>
            </div>
            <p className="ds-plan-sub">For the file you need to send today.</p>
          </div>
          <p className="ds-plan-price" data-currency={displayCurrency}>
            <span className="ds-price-num">{displayCurrency === 'INR' ? '₹0' : '$0'}</span>
            <small>forever</small>
          </p>
          <p className="ds-plan-note">No card required</p>
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
            price={price(creator)}
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
            currency={displayCurrency}
          />
        ) : null}

        <TierCard
          title="Pro"
          sub="For big folders and links that stay open."
          price={price(pro)}
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
          currency={displayCurrency}
          extra={(
            <div className="ds-switch" role="group" aria-label="Pro billing cycle">
              <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>Monthly</button>
              <button type="button" aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')}>Yearly</button>
            </div>
          )}
        />

        {studio ? (
          <TierCard
            title="Studio"
            sub="For a year of project files."
            price={price(studio)}
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
            currency={displayCurrency}
          />
        ) : null}
      </div>
      {pass ? (
        <aside className="ds-pass" aria-label="Pass">
          <div className="min-w-0">
            <h3 className="ds-h3">Pass</h3>
            <p className="ds-plan-sub">One transfer up to {pass.transfer}, kept {pass.retention}.</p>
            {notePlan === pass.code && note ? <p className="ds-plan-alert" role="status">{note}</p> : null}
          </div>
          <p className="ds-plan-price" data-currency={displayCurrency}>
            <span className="ds-price-num">{price(pass)}</span>
          </p>
          {onCheckout ? (
            <button
              type="button"
              className="ds-btn ds-btn-dark ds-btn-lg"
              data-ml-goal="checkout_click"
              data-ml-goal-plan={pass.code}
              disabled={busyPlan === pass.code || pass.purchasable === false || pass.productConfigured === false}
              onClick={() => onCheckout(pass.code)}
            >
              {busyPlan === pass.code ? 'Opening checkout…' : 'Buy a Pass'}
              {busyPlan === pass.code ? null : <ArrowRight className="ds-btn-arrow w-4 h-4" />}
            </button>
          ) : (
            <Link to="/pricing" className="ds-btn ds-btn-dark ds-btn-lg">
              Buy a Pass
              <ArrowRight className="ds-btn-arrow w-4 h-4" />
            </Link>
          )}
        </aside>
      ) : null}
    </div>
  );
}
