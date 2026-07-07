import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Capture URL params BEFORE createClient initialises — Supabase may clear the hash during init
const _h = new URLSearchParams(window.location.hash.slice(1));
const _s = new URLSearchParams(window.location.search);
export const isRecoveryUrl =
  (_h.get('type') === 'recovery' && !!_h.get('access_token')) ||
  (_s.get('type') === 'recovery' && !!_s.get('token_hash')) ||
  !!_s.get('code');
export const recoveryTokenHash = _s.get('token_hash') || null;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { flowType: 'implicit' }, // implicit avoids PKCE localStorage dependency for password reset
});
