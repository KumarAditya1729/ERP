import { createClient } from '@supabase/supabase-js';

// Singleton admin client to avoid re-instantiating on every request and leaking keys
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
