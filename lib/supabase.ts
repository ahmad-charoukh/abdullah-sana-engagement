import { createClient } from '@supabase/supabase-js';

let cached: any = undefined;

export function supabaseAdmin() {
  if (cached !== undefined) return cached;

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY are missing');
    }
    cached = null;
    return null;
  }

  cached = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
