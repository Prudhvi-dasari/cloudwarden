-- Do not run this until 20261029180000_billing_apply_and_reconcile.sql is applied.
-- Do not guess the email. In the Dodo dashboard, open the payment.succeeded
-- event recorded at 2026-10-29 06:33:04 UTC (billing_events.outcome = unmatched_user,
-- user_id and plan_code are null). Copy that customer's email and the real
-- payment id. Use yearly only if that checkout was the yearly product.
--
-- This writes billing_entitlements and sets itransfer_accounts.plan to pro.
-- It does not refund, capture, or call Dodo.

select public.reconcile_billing_by_email(
  'payer@example.com',
  'monthly',
  'pay_from_dodo_dashboard'
);
