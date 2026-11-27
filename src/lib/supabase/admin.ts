import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Only for server code that must bypass RLS; never import from components.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
