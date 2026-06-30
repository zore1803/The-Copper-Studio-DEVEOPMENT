import mongoose from "mongoose";

/**
 * Registers a Mongoose model. The `table` and `defaults` fields are accepted
 * and ignored — they remain in the model files only so the call sites don't
 * need editing.
 */
export function defineModel({ name, schema }) {
  if (!schema) throw new Error(`Model "${name}" has no Mongoose schema.`);
  // Reuse an already-registered model so `node --watch` reloads don't throw
  // Mongoose's OverwriteModelError.
  return mongoose.models[name] || mongoose.model(name, schema);
}

export default defineModel;
