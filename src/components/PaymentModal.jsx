import { useState } from 'react';
import { X, Crown, Check } from 'lucide-react';
import Portal from './Portal';

const PLANS = {
  monthly: { label: 'Monthly', price: '₹799', note: 'Billed every month' },
  yearly: { label: 'Yearly', price: '₹5,999', note: 'Billed once a year' },
};

export default function PaymentModal({ isOpen, onClose }) {
  const [billingCycle, setBillingCycle] = useState('yearly');

  if (!isOpen) return null;

  return (
    <Portal>
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#111] text-white border border-white/10 p-6 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Pro</p>
            <h2 className="mt-1 text-2xl font-semibold flex items-center gap-2">
              <Crown className="w-5 h-5 text-white" /> Upgrade with Dodo
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {Object.entries(PLANS).map(([id, plan]) => (
            <button
              key={id}
              type="button"
              onClick={() => setBillingCycle(id)}
              className={`rounded-2xl border px-3 py-3 text-left ${
                billingCycle === id ? 'border-white bg-white/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <p className="text-xs text-white/55">{plan.label}</p>
              <p className="text-lg font-semibold">{plan.price}</p>
              <p className="text-[11px] text-white/45">{plan.note}</p>
            </button>
          ))}
        </div>

        <ul className="mt-5 space-y-2 text-sm text-white/75">
          {['Larger transfers are not available yet', 'Longer retention is not available yet', 'Checkout does not raise the 6 GB limit'].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-white" /> {item}
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled
          className="mt-6 w-full py-3 rounded-full bg-white/15 text-white/70 font-semibold cursor-not-allowed"
        >
          Not available yet
        </button>
        <p className="mt-3 text-center text-[11px] text-white/40">Cards, UPI, and wallets are handled by Dodo Payments.</p>
      </div>
    </div>
    </Portal>
  );
}
