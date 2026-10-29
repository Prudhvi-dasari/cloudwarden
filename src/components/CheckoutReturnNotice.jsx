import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Info } from 'lucide-react';
import { checkoutReturnState } from '../lib/checkoutReturn';

export default function CheckoutReturnNotice() {
  const [params] = useSearchParams();
  const state = checkoutReturnState(params);
  if (!state) return null;
  const pending = state.tone === 'pending';
  return (
    <p
      role="status"
      className={`ds-callout acct-ui acct-return ${pending ? 'is-blue' : 'is-warn'}`}
      data-checkout-return={state.tone}
    >
      {pending ? <Info aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
      <span>{state.message}</span>
    </p>
  );
}
