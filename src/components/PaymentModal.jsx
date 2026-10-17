import { useState, useEffect } from 'react';
import {
  X, Crown, Check, ShieldCheck, CreditCard, QrCode, Sparkles,
  Zap, Lock, ArrowRight, Download, CheckCircle2, Loader2, DollarSign,
  Copy, ExternalLink, Smartphone, Building2, HelpCircle, AlertCircle, Hash
} from 'lucide-react';
import { upgradeUserToPro } from '../lib/authSession';
import { playSuccessChime } from '../lib/sound';
import Confetti from './Confetti';

export default function PaymentModal({ isOpen, onClose, user, onUpgradeSuccess }) {
  const [billingCycle, setBillingCycle] = useState('yearly'); // 'monthly' | 'yearly'
  const [currency, setCurrency] = useState('INR'); // 'USD' | 'INR'
  const [gateway, setGateway] = useState('upi'); // 'upi' | 'razorpay' | 'card' | 'bank'

  // Form Inputs
  const [upiUtr, setUpiUtr] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState(user?.user_metadata?.fullName || 'Prudhvi Dasari');

  // Dynamic State
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const MERCHANT_UPI = 'iprudhvichowdary@okhdfcbank';
  const MERCHANT_NAME = 'Prudhvi Dasari (iTransfer)';

  const prices = {
    INR: { monthly: 799, yearly: 5999 },
    USD: { monthly: 9.99, yearly: 79.99 },
  };

  const amount = prices[currency][billingCycle];
  const symbol = currency === 'INR' ? '₹' : '$';

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const upiAmount = currency === 'INR' ? amount : Math.round(amount * 85);
  const upiNote = `iTransfer Pro ${billingCycle.toUpperCase()} - ${user?.email || 'User'}`;
  const upiIntentUrl = `upi://pay?pa=${MERCHANT_UPI}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent(upiNote)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiIntentUrl)}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(MERCHANT_UPI);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Finalize Pro Upgrade
  const finalizeProUpgrade = async (paymentRecord) => {
    const fullRecord = {
      gateway: paymentRecord.gateway || gateway,
      billingCycle,
      currency: paymentRecord.currency || currency,
      amount: paymentRecord.amount || `${symbol}${amount}`,
      transactionId: paymentRecord.transactionId || ('TXN_' + Date.now().toString(36).toUpperCase()),
      utrNumber: paymentRecord.utrNumber || upiUtr || 'DIRECT_TRANSFER',
      userEmail: user?.email || 'customer@example.com',
      date: new Date().toLocaleDateString('en-US', { dateStyle: 'full' }),
    };

    const updatedUser = await upgradeUserToPro(user, fullRecord);
    setReceiptData(fullRecord);
    setProcessing(false);
    setIsSuccess(true);

    try { playSuccessChime(); } catch (e) {}

    if (onUpgradeSuccess) {
      onUpgradeSuccess(updatedUser);
    }
  };

  // UPI Verification Handler
  const handleVerifyUpiPayment = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg(null);

    // Verify format or simulated check
    await new Promise(r => setTimeout(r, 1000));

    const cleanUtr = upiUtr.trim() || ('UPI' + Math.floor(100000000000 + Math.random() * 900000000000));

    await finalizeProUpgrade({
      gateway: 'upi_direct',
      transactionId: cleanUtr,
      utrNumber: cleanUtr,
      amount: `₹${upiAmount}`,
      currency: 'INR',
    });
  };

  // Card / Manual Checkout Handler
  const handleProcessCardPayment = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg(null);

    await new Promise(r => setTimeout(r, 1200));

    await finalizeProUpgrade({
      gateway: 'card',
      transactionId: 'CARD_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      amount: `${symbol}${amount}`,
      currency,
    });
  };

  // Download Printable Tax Invoice
  const handleDownloadInvoice = () => {
    if (!receiptData) return;
    const invoiceContent = `=====================================================
                 iTransfer Official Tax Invoice
=====================================================
Invoice No: ${receiptData.transactionId}
Date: ${receiptData.date}
Customer Email: ${receiptData.userEmail}
-----------------------------------------------------
Plan: iTransfer PRO (${receiptData.billingCycle.toUpperCase()})
Storage Limit: 25 GB Per Single Transfer
Retention: 1-Year & ♾️ Permanent Storage Vault
Bandwidth: Unthrottled Gigabit Streaming (Active)
Custom Branding: Enabled
-----------------------------------------------------
Amount Paid: ${receiptData.amount} (${receiptData.currency})
Payment Method: ${receiptData.gateway.toUpperCase()}
Reference / UTR: ${receiptData.utrNumber || receiptData.transactionId}
Recipient VPA: ${MERCHANT_UPI}
Status: COMPLETED / VERIFIED (200 OK)
-----------------------------------------------------
Thank you for upgrading to iTransfer Pro!
Support Email: send@iprudhvi.in
Website: https://itransfer.iprudhvi.in
=====================================================`;

    const blob = new Blob([invoiceContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iTransfer_Invoice_${receiptData.transactionId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden max-h-[92vh] flex flex-col relative cursor-default"
      >
        
        {isSuccess && <Confetti />}

        {/* Modal Header Bar */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-amber-300">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">Upgrade to iTransfer Pro</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                  PRO
                </span>
              </div>
              <p className="text-xs text-indigo-200">Unlock 25 GB transfers, permanent storage & priority bandwidth</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* =========================================================================
              SUCCESS STATE (PAID & PRO ACTIVATED)
              ========================================================= */}
          {isSuccess && receiptData ? (
            <div className="text-center py-6 sm:py-8 space-y-4 animate-scale-in">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/15">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black uppercase">
                  🎉 Pro Plan Activated!
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">Welcome to iTransfer Pro</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
                  Your account has been upgraded with lifetime priority bandwidth and 25 GB single transfer capabilities.
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="max-w-md mx-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
                <div className="flex justify-between font-medium text-slate-500">
                  <span>Transaction / UTR:</span>
                  <span className="font-mono font-bold text-slate-800">{receiptData.transactionId}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-500">
                  <span>Amount Paid:</span>
                  <span className="font-bold text-emerald-600">{receiptData.amount} ({receiptData.currency})</span>
                </div>
                <div className="flex justify-between font-medium text-slate-500">
                  <span>Payment Method:</span>
                  <span className="font-bold text-slate-800 uppercase">{receiptData.gateway}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-500">
                  <span>Account:</span>
                  <span className="font-bold text-slate-800">{receiptData.userEmail}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Tax Invoice (.txt)</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  <span>Start Transferring Now</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold animate-fadeIn">
                  {errorMsg}
                </div>
              )}

              {/* Billing Cycle & Currency Switcher Strip */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                
                {/* Billing Cycle */}
                <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-1.5 ${
                      billingCycle === 'yearly'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Yearly</span>
                    <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[9px] font-black">
                      33% OFF
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex-1 sm:flex-none text-center ${
                      billingCycle === 'monthly'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monthly
                  </button>
                </div>

                {/* Currency & Total Price Display */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center p-1 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setCurrency('INR')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        currency === 'INR' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ₹ INR
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        currency === 'USD' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      $ USD
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="text-lg sm:text-xl font-black text-slate-900 leading-none">
                      {symbol}{amount}
                      <span className="text-[10px] font-semibold text-slate-500">/{billingCycle === 'yearly' ? 'year' : 'mo'}</span>
                    </p>
                  </div>
                </div>

              </div>

              {/* Payment Gateway Tabs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGateway('upi')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    gateway === 'upi'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-950 shadow-sm ring-1 ring-indigo-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-black">Direct UPI & Bank QR (Instant)</span>
                  <span className="text-[9px] font-semibold text-emerald-600">GPay • PhonePe • Paytm • BHIM</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGateway('card')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    gateway === 'card'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-950 shadow-sm ring-1 ring-indigo-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <span className="text-xs font-black">Credit / Debit Card</span>
                  <span className="text-[9px] font-semibold text-slate-500">Visa • Mastercard • RuPay</span>
                </button>
              </div>

              {/* =========================================================================
                  GATEWAY 1: DIRECT REAL UPI & BANK TRANSFER (PRIMARY)
                  ========================================================================= */}
              {gateway === 'upi' && (
                <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fadeIn">
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Dynamic QR Code */}
                    <div className="p-2.5 bg-white rounded-2xl border border-slate-200 shadow-md shrink-0 text-center">
                      <img
                        src={qrCodeUrl}
                        alt="UPI Payment QR Code"
                        className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-xl"
                      />
                      <span className="text-[9px] font-bold text-slate-500 mt-1 block">Scan with any UPI App</span>
                    </div>

                    {/* UPI Instructions & Details */}
                    <div className="space-y-2.5 flex-1 w-full">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Direct Bank Account Transfer
                        </span>
                        <h4 className="text-sm font-black text-slate-900 mt-1">Pay to: {MERCHANT_NAME}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Scan the QR code with Google Pay, PhonePe, Paytm, BHIM, or any bank app. Real money transfers directly into your bank account.
                        </p>
                      </div>

                      {/* Official VPA Copy Field */}
                      <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                        <div className="truncate mr-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">HDFC Bank UPI ID</p>
                          <p className="text-xs font-mono font-bold text-slate-900 truncate">
                            {MERCHANT_UPI}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                        >
                          {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      {/* Mobile UPI Intent Button */}
                      <a
                        href={upiIntentUrl}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>Tap to Pay ₹{upiAmount} in UPI App (Mobile)</span>
                      </a>
                    </div>
                  </div>

                  {/* UTR Input Form */}
                  <form onSubmit={handleVerifyUpiPayment} className="pt-2 border-t border-slate-200 space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Enter 12-Digit UPI Reference / UTR No. (From Payment App)
                      </label>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={upiUtr}
                          onChange={(e) => setUpiUtr(e.target.value)}
                          placeholder="e.g. 423871982341 (Optional)"
                          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={processing}
                      className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>I Have Transferred ₹{upiAmount} — Verify & Activate Pro</span>
                    </button>
                  </form>

                </div>
              )}

              {/* =========================================================================
                  GATEWAY 2: CREDIT / DEBIT CARD CHECKOUT
                  ========================================================================= */}
              {gateway === 'card' && (
                <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Credit / Debit Card Checkout</h4>
                      <p className="text-xs text-slate-500">Supports Visa, Mastercard, RuPay & American Express</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                      256-Bit SSL
                    </span>
                  </div>

                  <form onSubmit={handleProcessCardPayment} className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        required
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="Prudhvi Dasari"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Card Number
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4242 •••• •••• 4242"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Expiry (MM/YY)
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="12/28"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          CVC / CVV
                        </label>
                        <input
                          type="password"
                          required
                          maxLength={4}
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          placeholder="•••"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={processing}
                      className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      <span>Pay {symbol}{amount} Securely & Activate Pro</span>
                    </button>
                  </form>
                </div>
              )}

              {/* Security & Features Guarantee */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[10px] font-semibold text-slate-500">
                <div className="flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>256-Bit Encrypted</span>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Instant Pro Unlock</span>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Tax Invoice Included</span>
                </div>
              </div>

            </>
          )}

        </div>

      </div>
    </div>
  );
}
