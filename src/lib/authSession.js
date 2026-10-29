async function db() {
  const { supabase } = await import('./supabase.js');
  return supabase;
}

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

function isAuthUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function applyAccountRow(cleanUser, row) {
  if (!row) return cleanUser;
  const expiredTrial = row.plan === 'trial' && row.trial_expires_at && new Date(row.trial_expires_at).getTime() <= Date.now();
  const recurring = row.plan === 'creator' || row.plan === 'pro' || row.plan === 'studio';
  const expiredPaid = recurring && row.plan_expires_at && new Date(row.plan_expires_at).getTime() <= Date.now();
  cleanUser.user_metadata.plan = isAdmin(cleanUser) ? 'pro' : (expiredTrial || expiredPaid ? 'free' : (row.plan || 'free'));
  cleanUser.user_metadata.theme = row.theme || cleanUser.user_metadata.theme;
  cleanUser.user_metadata.fullName = row.display_name || cleanUser.user_metadata.fullName;
  cleanUser.user_metadata.trial_started_at = row.trial_started_at || null;
  cleanUser.user_metadata.trial_expires_at = row.trial_expires_at || null;
  cleanUser.user_metadata.plan_expires_at = row.plan_expires_at || null;
  return cleanUser;
}

async function loadAccountRow(userId) {
  const supabase = await db();
  const { data, error } = await supabase
    .from('itransfer_accounts')
    .select('plan, theme, display_name, trial_started_at, trial_expires_at, plan_expires_at, email')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Create the account row if needed, then read plan, theme, and name from the database.
 */
export async function syncAccount(authUser) {
  const supabase = await db();
  const cleanUser = buildStoredUser(authUser);
  if (!isAuthUuid(authUser?.id)) {
    writeStoredUser(cleanUser);
    return cleanUser;
  }

  const { error: insertError } = await supabase.from('itransfer_accounts').insert({
    user_id: authUser.id,
    email: authUser.email,
    display_name: cleanUser.user_metadata.fullName,
    theme: cleanUser.user_metadata.theme || 'indigo',
    plan: 'free',
  });
  if (insertError && insertError.code !== '23505') {
    console.warn('Account sync:', insertError.message);
  }

  try {
    const row = await loadAccountRow(authUser.id);
    applyAccountRow(cleanUser, row);
  } catch (e) {
    console.warn('Account read:', e.message);
  }

  writeStoredUser(cleanUser);
  try {
    const { data: sessionWrap } = await supabase.auth.getSession();
    const accessToken = sessionWrap?.session?.access_token;
    if (accessToken) {
      const { claimGuestTransfers } = await import('./guestSession');
      claimGuestTransfers(accessToken).catch(() => {});
    }
  } catch (e) {}
  return cleanUser;
}

/**
 * Activate 7-Day Free Pro Trial for User (Zero Credit Card Required)
 */
export async function startProTrial(user) {
  const supabase = await db();
  if (!user) return null;
  const { data, error } = await supabase.rpc('start_itransfer_trial');
  if (error) throw error;
  const updatedUser = applyAccountRow(buildStoredUser(user), data);
  writeStoredUser(updatedUser);
  return updatedUser;
}

export async function saveBrandLogo(user, logoUrl) {
  const supabase = await db();
  if (!user || !isAuthUuid(user.id)) return user;
  const value = String(logoUrl || '').trim();
  let stored = '';
  if (value) {
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error('Use an https logo link.'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new Error('Use an https logo link.');
    }
    stored = parsed.toString().slice(0, 500);
  }
  const { error } = await supabase
    .from('itransfer_accounts')
    .update({ brand_logo_url: stored || null })
    .eq('user_id', user.id);
  if (error) throw error;
  return user;
}

export async function saveAccountTheme(user, themeId) {
  const supabase = await db();
  if (!user || !isAuthUuid(user.id)) return user;
  const { error } = await supabase
    .from('itransfer_accounts')
    .update({ theme: themeId })
    .eq('user_id', user.id);
  if (error) throw error;
  const updatedUser = buildStoredUser({
    ...user,
    user_metadata: { ...(user.user_metadata || {}), theme: themeId },
  });
  writeStoredUser(updatedUser);
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
      tierName: isMaster ? 'Master Admin (Lifetime Pro)' : 'SendToAnyone Pro',
      plan: 'pro',
      maxFileSizeBytes: 250_000_000_000,
      maxFileSizeLabel: '250 GB',
      allowedExpiryHours: [1, 24, 72, 168, 720, 2160, 4320],
      maxRetentionDays: 180,
      allowsPermanent: false,
      hasCustomBranding: false,
      hasPriorityBandwidth: false,
      storageEngine: 'Cloudflare R2',
    };
  }

  if (isOnTrial) {
    return {
      tierName: '7-Day Pro Trial',
      plan: 'trial',
      maxFileSizeBytes: 6_000_000_000,
      maxFileSizeLabel: '6 GB',
      allowedExpiryHours: [1, 24, 72, 168],
      maxRetentionDays: 7,
      allowsPermanent: false,
      hasCustomBranding: false,
      hasPriorityBandwidth: false,
      storageEngine: 'Cloudflare R2',
      trialExpiresAt: user.user_metadata?.trial_expires_at,
    };
  }

  // Free / Guest tier
  return {
    tierName: 'Free Tier',
    plan: 'free',
    maxFileSizeBytes: 6_000_000_000,
    maxFileSizeLabel: '6 GB',
    allowedExpiryHours: [1, 24, 72, 168], // up to 7 days
    maxRetentionDays: 7,
    allowsPermanent: false,
    hasCustomBranding: false,
    hasPriorityBandwidth: false,
    storageEngine: 'Cloudflare R2 Standard',
  };
}

function writeStoredUser(cleanUser) {
  try {
    if (!cleanUser) localStorage.removeItem(USER_SESSION_KEY);
    else localStorage.setItem(USER_SESSION_KEY, JSON.stringify(cleanUser));
  } catch (e) {}
}

function buildStoredUser(user) {
  const isMaster = isAdmin(user);
  const existingPlan = user.user_metadata?.plan || (isMaster ? 'pro' : 'free');
  return {
    id: user.id,
    email: user.email,
    user_metadata: {
      ...(user.user_metadata || {}),
      plan: isMaster ? 'pro' : existingPlan,
      role: isMaster ? 'admin' : (user.user_metadata?.role || 'user'),
      theme: user.user_metadata?.theme || 'indigo',
      fullName: user.user_metadata?.fullName || user.user_metadata?.full_name || (isMaster ? 'Prudhvi Dasari (Admin)' : user.email?.split('@')[0]),
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    },
    last_sign_in_at: new Date().toISOString(),
  };
}

/**
 * Persist user session to localStorage and sync plan, theme, and name with the account table.
 */
export async function persistUserSession(user) {
  if (!user) {
    writeStoredUser(null);
    return null;
  }
  if (isAuthUuid(user.id)) return syncAccount(user);
  const cleanUser = buildStoredUser(user);
  writeStoredUser(cleanUser);
  return cleanUser;
}

export const GOOGLE_CLIENT_ID = '981546493798-u1sb43686ppkckor354cvandakhk3pe4.apps.googleusercontent.com';

/**
 * Initiate Google Sign-In with OAuth
 */
export async function signInWithGoogle() {
  const supabase = await db();
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
  const supabase = await db();
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
  const supabase = await db();
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
  const supabase = await db();
  try {
    localStorage.removeItem(USER_SESSION_KEY);
  } catch (e) {}

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {}
}
