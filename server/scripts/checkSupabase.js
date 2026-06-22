/**
 * Health check for the Supabase setup.
 *   npm run check:supabase
 *
 * Confirms the SUPABASE_* keys work and that all 14 tables exist. Run this after
 * applying supabase/schema.sql to verify the database is ready.
 */
import "dotenv/config";
import { supabase } from "../db/supabase.js";

const tables = [
  "users", "orders", "leads", "contacts", "companies", "crm_leads", "deals",
  "projects", "tasks", "meetings", "documents", "invoices", "payments", "coupons"
];

const missing = [];
for (const t of tables) {
  const { error } = await supabase.from(t).select("id", { count: "exact", head: true });
  if (error) missing.push(`${t} (${error.message})`);
}

if (missing.length) {
  console.log("Supabase reachable, but these tables are not ready:");
  for (const m of missing) console.log("  - " + m);
  console.log("\n=> Run supabase/schema.sql in the Supabase SQL editor, then re-run this check.");
  process.exit(1);
}

console.log("All 14 Supabase tables are reachable. The database is ready.");
