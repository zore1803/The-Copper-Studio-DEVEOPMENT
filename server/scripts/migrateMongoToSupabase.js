/**
 * One-time data migration: MongoDB -> Supabase.
 *
 * Reads every collection straight from MongoDB and writes each document into the
 * matching Supabase table as { id, doc, created_at, updated_at }. ObjectIds are
 * stored as their hex string, so cross-document references (clientId, companyId,
 * sourceOrderId, ...) keep pointing at the right rows.
 *
 * Usage (needs both MONGO_URI and the SUPABASE_* keys in .env):
 *   npm run migrate:supabase
 *
 * Safe to re-run: rows are upserted by id.
 */
import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";
import { supabase } from "../db/supabase.js";

// Atlas uses a mongodb+srv:// URI, which needs a DNS SRV lookup. Many ISP/local
// resolvers refuse it (querySrv ECONNREFUSED), so use public DNS like server.js.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// [ mongo collection name, supabase table name ]
const COLLECTIONS = [
  ["users", "users"],
  ["orders", "orders"],
  ["leads", "leads"],
  ["contacts", "contacts"],
  ["companies", "companies"],
  ["crmleads", "crm_leads"],
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

// Deeply convert BSON values (ObjectId, Date, ...) into JSON-friendly forms so
// they round-trip cleanly into the jsonb column.
function normalize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && typeof value.toHexString === "function") {
    return value.toHexString();
  }
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) out[key] = normalize(val);
    return out;
  }
  return value;
}

function toRow(mongoDoc) {
  const { _id, createdAt, updatedAt, __v, ...rest } = mongoDoc;
  const row = { id: String(_id), doc: normalize(rest) };
  if (createdAt) row.created_at = new Date(createdAt).toISOString();
  if (updatedAt) row.updated_at = new Date(updatedAt).toISOString();
  return row;
}

async function migrateCollection(mongoName, table) {
  const docs = await mongoose.connection.db.collection(mongoName).find({}).toArray();
  if (!docs.length) {
    console.log(`  ${mongoName} -> ${table}: 0 documents (skipped)`);
    return;
  }

  const rows = docs.map(toRow);
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
    written += batch.length;
  }
  console.log(`  ${mongoName} -> ${table}: ${written} documents migrated`);
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to read the source data. Add it to .env.");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  console.log("Connected. Migrating collections:\n");

  for (const [mongoName, table] of COLLECTIONS) {
    await migrateCollection(mongoName, table);
  }

  await mongoose.disconnect();
  console.log("\nMigration complete.");
}

main().catch(async (error) => {
  console.error("\nMigration failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
