import { supabase, publicSupabase } from './supabase';

const USER_SESSION_KEY = 'itransfer_user_session';
export const ADMIN_EMAILS = [
  'iprudhvichowdary@gmail.com',
  'send@iprudhvi.in',
];

/**
 * Check if the user is the master Admin (Prudhvi)
 */
export function isAdmin(user) {
  if (!user || !user.email) return false;
  const email = user.email.toLowerCase();
  return ADMIN_EMAILS.includes(email) || user.user_metadata?.role === 'admin';
}

/**
 * Get the currently logged-in user synchronously from local persistence
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email) return null;
    
    // Auto-grant Pro & Admin to master account
    if (isAdmin(parsed)) {
      parsed.user_metadata = {
        ...(parsed.user_metadata || {}),
        plan: 'pro',
        role: 'admin',
        fullName: parsed.user_metadata?.fullName || 'Prudhvi Dasari (Admin)',
      };
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Check whether a user is currently Pro (either purchased Pro or active Pro Trial)
 */
export function isUserPro(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (user.user_metadata?.plan === 'pro') return true;
  if (user.user_metadata?.plan === 'trial') {
    const expiresAt = user.user_metadata?.trial_expires_at;
    if (!expiresAt) return true;
    return new Date(expiresAt).getTime() > Date.now();
  }
  return false;
}

/**
 * Check whether a user is on an active 7-Day Pro Trial
 */
export function isUserOnTrial(user) {
  if (!user) return false;
  if (user.user_metadata?.plan !== 'trial') return false;
  const expiresAt = user.user_metadata?.trial_expires_at;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

/**
 * Activate 7-Day Free Pro Trial for User (Zero Credit Card Required)
 */
export async function startProTrial(user) {
  if (!user) return null;
  const trialDays = 7;
  const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
  
  const updatedUser = {
    ...user,
    user_metadata: {
      ...(user.user_metadata || {}),
      plan: 'trial',
      trial_started_at: new Date().toISOString(),
      trial_expires_at: expiresAt,
    },
  };
  
  try {
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(updatedUser));
  } catch (e) {}

  try {
    await supabase.auth.updateUser({
      data: { plan: 'trial', trial_expires_at: expiresAt },
    });
  } catch (e) {}

  return updatedUser;
}

/**
 * Get Tier Limits & Capabilities for User
 */
export function getUserPlanLimits(user) {
  const isMaster = isAdmin(user);
  const isPurchasedPro = user?.user_metadata?.plan === 'pro' || isMaster;
  const isOnTrial = isUserOnTrial(user);

  if (isPurchasedPro) {
    return {
      tierName: isMaster ? 'Master Admin (Lifetime Pro)' : 'iTransfer Pro',
      plan: 'pro',
      maxFileSizeBytes: 25 * 1024 * 1024 * 1024, // 25 GB
      maxFileSizeLabel: '25 GB',
      allowedExpiryHours: [1, 24, 72, 168, 720, 0], // up to 30 days & Permanent
      maxRetentionDays: 30,
      allowsPermanent: true,
      hasCustomBranding: true,
      hasPriorityBandwidth: true,
      storageEngine: 'Cloudflare R2 + Turbo Cloud Vault',
    };
  }

  if (isOnTrial) {
    return {
      tierName: '7-Day Pro Trial',
      plan: 'trial',
      maxFileSizeBytes: 15 * 1024 * 1024 * 1024, // 15 GB
      maxFileSizeLabel: '15 GB',
      allowedExpiryHours: [1, 24, 72, 168, 336], // up to 14 days
      maxRetentionDays: 14,
      allowsPermanent: false,
      hasCustomBranding: true,
      hasPriorityBandwidth: true,
      storageEngine: 'Cloudflare R2 Gigabit Stream',
      trialExpiresAt: user.user_metadata?.trial_expires_at,
    };
  }

  // Free / Guest tier
  return {
    tierName: 'Free Tier',
    plan: 'free',
    maxFileSizeBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    maxFileSizeLabel: '5 GB',
    allowedExpiryHours: [1, 24, 72, 168], // up to 7 days
    maxRetentionDays: 7,
    allowsPermanent: false,
    hasCustomBranding: false,
    hasPriorityBandwidth: false,
    storageEngine: 'Cloudflare R2 Standard',
  };
}

/**
 * Persist user session to localStorage and sync with Supabase DB
 */
export async function persistUserSession(user) {
  if (!user) {
    try { localStorage.removeItem(USER_SESSION_KEY); } catch (e) {}
    return null;
  }

  const isMaster = isAdmin(user);
  const existingPlan = user.user_metadata?.plan || (isMaster ? 'pro' : 'free');

  const cleanUser = {
    id: user.id || ('usr_' + btoa(user.email || 'user').replace(/=/g, '')),
    email: user.email,
    user_metadata: {
      plan: isMaster ? 'pro' : existingPlan,
      role: isMaster ? 'admin' : (user.user_metadata?.role || 'user'),
      theme: user.user_metadata?.theme || 'indigo',
      fullName: user.user_metadata?.fullName || user.user_metadata?.full_name || (isMaster ? 'Prudhvi Dasari (Admin)' : user.email?.split('@')[0]),
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      ...(user.user_metadata || {}),
    },
    last_sign_in_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(cleanUser));
  } catch (e) {}

  // Sync to database if possible
  try {
    const { data: dbUser } = await publicSupabase
      .from('users')
      .select('plan, is_pro')
      .eq('email', cleanUser.email)
      .maybeSingle();

    if (dbUser && dbUser.plan) {
      cleanUser.user_metadata.plan = isMaster ? 'pro' : dbUser.plan;
      try { localStorage.setItem(USER_SESSION_KEY, JSON.stringify(cleanUser)); } catch (e) {}
    }
  } catch (e) {}

  // Migrate any previous guest transfers to this user account
  try {
    const { migrateGuestTransfersToUser } = await import('./guestSession');
    migrateGuestTransfersToUser(cleanUser).catch(() => {});
  } catch (e) {}

  return cleanUser;
}

export const GOOGLE_CLIENT_ID = '981546493798-u1sb43686ppkckor354cvandakhk3pe4.apps.googleusercontent.com';

/**
 * Initiate Google Sign-In with OAuth
 */
export async function signInWithGoogle() {
  const origin = window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Send password reset email
 */
export async function resetPasswordForEmail(email) {
  const origin = window.location.origin;
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/?action=reset-password`,
  });
  if (error) throw error;
  return data;
}

/**
 * Upgrade a user to Pro plan with payment details
 */
export async function upgradeUserToPro(user, paymentDetails = {}) {
  if (!user) return null;

  const upgradedMetadata = {
    ...(user.user_metadata || {}),
    plan: 'pro',
    pro_since: new Date().toISOString(),
    plan_expires_at: new Date(Date.now() + (paymentDetails.billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
    last_payment: {
      amount: paymentDetails.amount || '₹799',
      gateway: paymentDetails.gateway || 'upi',
      transactionId: paymentDetails.transactionId || ('TXN_' + Date.now()),
      date: new Date().toISOString(),
    },
  };

  const updatedUser = {
    ...user,
    user_metadata: upgradedMetadata,
  };

  try {
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(updatedUser));
  } catch (e) {}

  try {
    await supabase.auth.updateUser({
      data: { plan: 'pro', role: updatedUser.user_metadata.role },
    });
  } catch (e) {}

  return updatedUser;
}

/**
 * Clear user session on logout cleanly without crashing or hanging
 */
export async function clearUserSession() {
  try {
    localStorage.removeItem(USER_SESSION_KEY);
  } catch (e) {}

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {}
}
