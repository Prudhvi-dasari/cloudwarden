import { recommendPlan } from '../lib/upgradeFlow';

const NAMES = {
  pass: 'Pass',
  creator_monthly: 'Creator',
  pro_monthly: 'Pro',
};

export default function UpgradeFlow({
  totalBytes,
  totalLabel,
  step,
  plan,
  signedIn,
  onPick,
  onCheckout,
  onRefresh,
  onBack,
}) {
  const suggestion = plan?.code ? plan : recommendPlan(totalBytes);
  const other = suggestion?.also ? NAMES[suggestion.also] : '';

  return (
    <div className="snd-panel" role="status">
      <p className="ds-kicker"><b>●</b> This send is larger than the free limit</p>
      {step === 'explain' && (
        <>
          <p className="snd-sub">{suggestion?.reason || 'Pick a plan that fits these files.'} The files stay on this page.</p>
          <p className="ds-row-title">{totalLabel}</p>
          {suggestion?.code ? (
            <div className="snd-pair-btns">
              <button type="button" className="ds-btn ds-btn-dark" onClick={() => onPick(suggestion)}>
                Continue with {suggestion.name}
              </button>
              {suggestion.also ? (
                <button type="button" className="ds-btn ds-btn-ghost" onClick={() => onPick({ code: suggestion.also, name: other, reason: suggestion.reason })}>
                  {other} instead
                </button>
              ) : null}
            </div>
          ) : (
            <p className="snd-sub">Remove a file, or split the folder, then try again.</p>
          )}
        </>
      )}
      {step === 'auth' && (
        <>
          <p className="snd-sub">Sign in so {suggestion?.name || 'the plan'} is attached to you. These files stay selected.</p>
          <button type="button" className="ds-btn ds-btn-dark" onClick={() => onPick(suggestion, { auth: true })}>
            {signedIn ? 'Continue' : 'Create an account or sign in'}
          </button>
        </>
      )}
      {step === 'checkout' && (
        <>
          <p className="snd-sub">Checkout opens for {suggestion?.name}. The plan starts only after payment is confirmed. You can cancel and come back to these files.</p>
          <div className="snd-pair-btns">
            <button type="button" className="ds-btn ds-btn-dark" onClick={onCheckout}>Continue to checkout</button>
            <button type="button" className="ds-btn ds-btn-ghost" onClick={onBack}>Back</button>
          </div>
        </>
      )}
      {step === 'activating' && (
        <p className="snd-sub">Activating your plan… This page is waiting for the payment confirmation. It does not switch the plan on from the return link alone.</p>
      )}
      {step === 'failed' && (
        <>
          <p className="snd-sub">The payment did not go through. The files are still here.</p>
          <button type="button" className="ds-btn ds-btn-dark" onClick={onBack}>Try again</button>
        </>
      )}
      {step === 'cancelled' && (
        <>
          <p className="snd-sub">Checkout was cancelled. Nothing was charged, and the files are still here.</p>
          <button type="button" className="ds-btn ds-btn-dark" onClick={onBack}>Back to plans</button>
        </>
      )}
      {step === 'timeout' && (
        <>
          <p className="snd-sub">The payment is still confirming. Refresh to check again, or write to support from the help page if it stays here.</p>
          <button type="button" className="ds-btn ds-btn-dark" onClick={onRefresh}>Refresh</button>
        </>
      )}
      {step === 'ready' && (
        <p className="snd-sub">Your plan is active. Sending these files now.</p>
      )}
    </div>
  );
}
