import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://giyeepztahdbsejsozog.supabase.co';
export const supabaseAnonKey = 'sb_publishable_XenT3T8l2M0-SWsHDJZpUg_3elJqmVU';

// 1. Client with session persistence for Auth, user metadata, and settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 2. Clean client for public file uploads and transfers to bypass any JWT token conflicts
export const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
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

export function applyTheme(themeId) {
  if (!themeId || themeId === 'indigo') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', themeId);
  }
}
