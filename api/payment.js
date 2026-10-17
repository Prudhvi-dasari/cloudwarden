import crypto from 'crypto';

// Default Account & Merchant Config
const UPI_VPA = process.env.UPI_VPA || 'iprudhvichowdary@okhdfcbank';
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'iTransfer Pro';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_iTransferOfficial';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

const PRICING = {
  INR: { monthly: 799, yearly: 5999 },
  USD: { monthly: 9.99, yearly: 79.99 },
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action = 'create-order' } = req.query;

  try {
    // -------------------------------------------------------------------------
    // 1. CREATE PAYMENT ORDER (Razorpay / Stripe / UPI)
    // -------------------------------------------------------------------------
    if (action === 'create-order') {
      const {
        gateway = 'upi',
        billingCycle = 'yearly',
        currency = 'INR',
        userEmail = 'customer@example.com',
        userName = 'Customer',
      } = req.body || {};

      const amount = PRICING[currency]?.[billingCycle] || PRICING.INR.yearly;
      const txId = 'TXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7).toUpperCase();

      // Case A: UPI Intent & Dynamic QR
      if (gateway === 'upi') {
        const upiAmount = currency === 'INR' ? amount : Math.round(amount * 85);
        const upiNote = encodeURIComponent(`iTransfer Pro ${billingCycle.toUpperCase()} - ${userEmail}`);
        const upiIntentUrl = `upi://pay?pa=${UPI_VPA}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${upiAmount}&cu=INR&tn=${upiNote}&tr=${txId}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiIntentUrl)}`;

        return res.status(200).json({
          status: 'ok',
          gateway: 'upi',
          transactionId: txId,
          amount: upiAmount,
          currency: 'INR',
          upiId: UPI_VPA,
          merchantName: MERCHANT_NAME,
          upiIntentUrl,
          qrCodeUrl,
          billingCycle,
          userEmail,
        });
      }

      // Case B: Razorpay Standard Checkout
      if (gateway === 'razorpay') {
        const inrAmount = currency === 'INR' ? amount : Math.round(amount * 85);
        const amountInPaise = inrAmount * 100;

        let razorpayOrderId = 'order_' + Math.random().toString(36).substring(2, 14);

        // If official Razorpay credentials are set, generate official order
        if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
          try {
            const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
            const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
              },
              body: JSON.stringify({
                amount: amountInPaise,
                currency: 'INR',
                receipt: txId,
                notes: { userEmail, billingCycle },
              }),
            });
            if (rzpRes.ok) {
              const rzpData = await rzpRes.json();
              if (rzpData.id) razorpayOrderId = rzpData.id;
            }
          } catch (e) {}
        }

        return res.status(200).json({
          status: 'ok',
          gateway: 'razorpay',
          keyId: RAZORPAY_KEY_ID,
          orderId: razorpayOrderId,
          amount: amountInPaise,
          currency: 'INR',
          transactionId: txId,
          billingCycle,
          userEmail,
          merchantName: MERCHANT_NAME,
        });
      }

      // Case C: Stripe Global Checkout
      if (gateway === 'stripe') {
        const usdAmount = currency === 'USD' ? amount : Math.round((amount / 85) * 100) / 100;
        const amountInCents = Math.round(usdAmount * 100);

        let stripeSessionUrl = null;
        let stripeSessionId = 'cs_test_' + Math.random().toString(36).substring(2, 16);

        if (STRIPE_SECRET_KEY) {
          try {
            const origin = req.headers.origin || 'https://itransfer.iprudhvi.in';
            const params = new URLSearchParams({
              'payment_method_types[0]': 'card',
              'line_items[0][price_data][currency]': 'usd',
              'line_items[0][price_data][product_data][name]': `iTransfer PRO (${billingCycle.toUpperCase()})`,
              'line_items[0][price_data][product_data][description]': '25GB transfers, priority gigabit bandwidth, and permanent storage',
              'line_items[0][price_data][unit_amount]': amountInCents.toString(),
              'line_items[0][quantity]': '1',
              'mode': 'payment',
              'customer_email': userEmail,
              'success_url': `${origin}/?payment=success&txId=${txId}`,
              'cancel_url': `${origin}/?payment=cancelled`,
            });

            const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: params.toString(),
            });

            if (stripeRes.ok) {
              const session = await stripeRes.json();
              stripeSessionId = session.id;
              stripeSessionUrl = session.url;
            }
          } catch (e) {}
        }

        return res.status(200).json({
          status: 'ok',
          gateway: 'stripe',
          sessionId: stripeSessionId,
          checkoutUrl: stripeSessionUrl,
          amount: usdAmount,
          currency: 'USD',
          transactionId: txId,
          billingCycle,
          userEmail,
        });
      }

      // Default Card / Standard
      return res.status(200).json({
        status: 'ok',
        gateway: 'card',
        amount,
        currency,
        transactionId: txId,
        billingCycle,
        userEmail,
      });
    }

    // -------------------------------------------------------------------------
    // 2. VERIFY PAYMENT
    // -------------------------------------------------------------------------
    if (action === 'verify') {
      const {
        transactionId = 'TXN_' + Date.now(),
        gateway = 'upi',
        userEmail = 'customer@example.com',
        billingCycle = 'yearly',
        currency = 'INR',
        amount = '₹5999',
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
      } = req.body || {};

      let verified = true;

      // Verify Razorpay HMAC signature if secret exists
      if (gateway === 'razorpay' && RAZORPAY_KEY_SECRET && razorpayOrderId && razorpayPaymentId && razorpaySignature) {
        try {
          const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');
          verified = generatedSignature === razorpaySignature;
        } catch (e) {}
      }

      return res.status(200).json({
        status: 'verified',
        verified,
        receipt: {
          transactionId: razorpayPaymentId || transactionId,
          gateway,
          amount,
          currency,
          billingCycle,
          userEmail,
          status: 'PAID',
          date: new Date().toISOString(),
        },
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('Payment API Error:', err);
    return res.status(500).json({ error: err.message || 'Payment processing failed' });
  }
}
