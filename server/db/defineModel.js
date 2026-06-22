import mongoose from "mongoose";
import { createModel as createSupabaseModel } from "./model.js";

/**
 * Storage backend switch.
 *
 * Defaults to Supabase. Set DB_DRIVER=mongo (with MONGO_URI) to run the whole
 * app on MongoDB instead — e.g. to switch back later. Every model file carries
 * BOTH a Supabase `defaults` map and a Mongoose `schema`, so flipping this one
 * env var swaps the entire data layer with no other code changes. The routes and
 * services are written against the Mongoose-style API that both backends expose.
 */
export const dbDriver = (process.env.DB_DRIVER || "supabase").toLowerCase();

export function defineModel({ name, table, defaults = {}, schema }) {
  if (dbDriver === "mongo") {
    if (!schema) throw new Error(`Model "${name}" has no Mongoose schema (needed for DB_DRIVER=mongo).`);
    // Reuse an already-registered model so `node --watch` reloads don't throw
    // Mongoose's OverwriteModelError.
    return mongoose.models[name] || mongoose.model(name, schema);
  }
  return createSupabaseModel(table, { defaults });
}

export default defineModel;
