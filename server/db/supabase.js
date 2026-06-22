import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
// Server-side code uses the service-role key so it bypasses RLS. Never expose
// this key to the browser (the CRM frontend never imports this file).
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env."
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export default supabase;
