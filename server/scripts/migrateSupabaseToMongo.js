/**
 * Reverse migration: Supabase -> MongoDB.
 *
 * The escape hatch for switching back. Reads every Supabase table and writes the
 * documents back into the matching MongoDB collection, keeping the original ids
 * (24-char hex ids become ObjectIds again, so references line up).
 *
 * Usage (needs MONGO_URI for the target + the SUPABASE_* keys for the source):
 *   npm run migrate:to-mongo
 *
 * Then set DB_DRIVER=mongo and restart. Safe to re-run (upserts by _id).
 *
 * Note: timestamps and any top-level date fields are restored as real Dates;
 * dates nested deep inside documents come back as ISO strings (Mongo stores them
 * fine, and the app re-parses dates on read).
 */
import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";
import { supabase } from "../db/supabase.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

// [ supabase table, mongo collection ]
const COLLECTIONS = [
  ["users", "users"],
  ["orders", "orders"],
  ["leads", "leads"],
  ["contacts", "contacts"],
  ["companies", "companies"],
  ["crm_leads", "crmleads"],
  ["deals", "deals"],
  ["projects", "projects"],
  ["tasks", "tasks"],
  ["meetings", "meetings"],
  ["documents", "documents"],
  ["invoices", "invoices"],
  ["payments", "payments"],
  ["coupons", "coupons"]
];

const CHUNK = 500;

function toMongoId(id) {
  return /^[0-9a-f]{24}$/i.test(String(id)) ? new mongoose.Types.ObjectId(String(id)) : id;
}

async function fetchAll(table) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function migrateCollection(table, collection) {
  const rows = await fetchAll(table);
  if (!rows.length) {
    console.log(`  ${table} -> ${collection}: 0 documents (skipped)`);
    return;
  }

  const db = mongoose.connection.db;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const ops = rows.slice(i, i + CHUNK).map((r) => {
      const doc = { _id: toMongoId(r.id), ...(r.doc || {}) };
      if (r.created_at) doc.createdAt = new Date(r.created_at);
      if (r.updated_at) doc.updatedAt = new Date(r.updated_at);
      return { replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } };
    });
    await db.collection(collection).bulkWrite(ops, { ordered: false });
    written += ops.length;
  }
  console.log(`  ${table} -> ${collection}: ${written} documents migrated`);
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required (the destination database). Add it to .env.");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  console.log("Connected. Migrating Supabase -> MongoDB:\n");

  for (const [table, collection] of COLLECTIONS) {
    await migrateCollection(table, collection);
  }

  await mongoose.disconnect();
  console.log("\nReverse migration complete. Set DB_DRIVER=mongo and restart to use MongoDB.");
}

main().catch(async (error) => {
  console.error("\nReverse migration failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
