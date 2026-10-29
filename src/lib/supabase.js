import { createClient } from '@supabase/supabase-js';
import { applyTheme } from './theme.js';

export { applyTheme };

const productionUrl = 'https://giyeepztahdbsejsozog.supabase.co';
const productionPublishableKey = 'sb_publishable_XenT3T8l2M0-SWsHDJZpUg_3elJqmVU';
const configuredUrl = import.meta.env.VITE_SUPABASE_URL || '';
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseUrl = configuredUrl || (import.meta.env.DEV ? 'http://127.0.0.1:54321' : productionUrl);
export const supabaseAnonKey = configuredKey || (import.meta.env.DEV ? 'local-dev-publishable-key' : productionPublishableKey);

// 1. Client with session persistence for Auth, user metadata, and settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Storage calls stay on the anon key and must not share the signed-in session.
// A second client with the default storage key registers another GoTrueClient
// on the same lock, which is the "Multiple GoTrueClient instances" warning.
export const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-public-transfer-auth',
  },
});

export const STORAGE_BUCKET = 'transfers';
export const SUPABASE_STORAGE_URL = `${supabaseUrl}/storage/v1`;

// Theme options
export const THEMES = [
  { id: 'indigo', name: 'Indigo (Default)', color: '#4f46e5' },
  { id: 'emerald', name: 'Emerald Green', color: '#059669' },
  { id: 'violet', name: 'Royal Violet', color: '#7c3aed' },
  { id: 'rose', name: 'Ruby Rose', color: '#e11d48' },
  { id: 'cyan', name: 'Ocean Cyan', color: '#0891b2' },
  { id: 'amber', name: 'Warm Amber', color: '#d97706' },
];
