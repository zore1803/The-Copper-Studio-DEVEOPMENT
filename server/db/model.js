import { supabase } from "./supabase.js";

/**
 * A tiny Mongoose-compatible data layer on top of Supabase/Postgres.
 *
 * Each "collection" is a Postgres table shaped as:
 *   id uuid primary key, doc jsonb, created_at timestamptz, updated_at timestamptz
 *
 * The whole Mongoose-style document lives inside the `doc` JSONB column, so we
 * keep the document model the existing routes were written against (embedded
 * sub-documents, mixed shapes, etc.) without designing 13 relational schemas.
 *
 * Only the subset of the Mongoose API that the codebase actually uses is
 * implemented: find / findOne / findById / create / findByIdAndUpdate /
 * findByIdAndDelete / findOneAndUpdate / updateMany / distinct, the chainable
 * query helpers .sort()/.select()/.limit()/.populate(), and document instances
 * with .save() and .toObject().
 */

const META_KEYS = new Set(["_id", "createdAt", "updatedAt"]);

// Maps a reference field name -> the table that field points at, so .populate()
// can resolve it. Only the fields actually populated/looked-up are listed.
const REF_TABLE = {
  clientId: "users",
  userId: "users",
  uploadedById: "users",
  companyId: "companies",
  projectId: "projects",
  orderId: "orders",
  sourceOrderId: "orders"
};

function clone(value) {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function isNullish(value) {
  return value === null || value === undefined;
}

function stripMeta(obj) {
  const out = {};
  for (const key of Object.keys(obj || {})) {
    if (!META_KEYS.has(key)) out[key] = obj[key];
  }
  return out;
}

function getPath(obj, path) {
  if (path.indexOf(".") === -1) return obj?.[path];
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

// Convert a row { id, doc, created_at, updated_at } into the merged view the
// routes expect (top-level _id + all document fields + timestamps).
function toView(row) {
  return {
    _id: row.id,
    ...(row.doc || {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Fill in schema-style defaults for keys missing from the payload (deeply, for
// nested objects) without overwriting anything the caller actually provided.
function applyDefaults(value, defaults) {
  if (isPlainObject(defaults)) {
    const src = isPlainObject(value) ? value : {};
    const out = { ...src };
    for (const key of Object.keys(defaults)) {
      out[key] = key in src ? applyDefaults(src[key], defaults[key]) : clone(defaults[key]);
    }
    return out;
  }
  return value === undefined ? clone(defaults) : value;
}

function toComparable(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return t;
  }
  return value;
}

function equals(a, b) {
  if (a instanceof Date || b instanceof Date) {
    return new Date(a).getTime() === new Date(b).getTime();
  }
  return a === b;
}

function cmp(a, b) {
  const ca = toComparable(a);
  const cb = toComparable(b);
  if (ca < cb) return -1;
  if (ca > cb) return 1;
  return 0;
}

function applyOp(value, op, operand) {
  switch (op) {
    case "$eq":
      return operand === null ? isNullish(value) : equals(value, operand);
    case "$ne":
      return operand === null ? !isNullish(value) : !equals(value, operand);
    case "$in":
      return Array.isArray(operand) && operand.some((o) => equals(value, o));
    case "$nin":
      return !(Array.isArray(operand) && operand.some((o) => equals(value, o)));
    case "$gt":
      return !isNullish(value) && cmp(value, operand) > 0;
    case "$gte":
      return !isNullish(value) && cmp(value, operand) >= 0;
    case "$lt":
      return !isNullish(value) && cmp(value, operand) < 0;
    case "$lte":
      return !isNullish(value) && cmp(value, operand) <= 0;
    case "$exists":
      return operand ? !isNullish(value) : isNullish(value);
    default:
      return false;
  }
}

function hasOperators(cond) {
  return isPlainObject(cond) && Object.keys(cond).some((k) => k.startsWith("$"));
}

function matchCond(value, cond) {
  if (cond instanceof RegExp) return typeof value === "string" && cond.test(value);
  if (hasOperators(cond)) {
    return Object.entries(cond).every(([op, operand]) => applyOp(value, op, operand));
  }
  return equals(value, cond);
}

function matchesFilter(view, filter) {
  if (!filter) return true;
  for (const [key, cond] of Object.entries(filter)) {
    if (key === "$or") {
      if (!cond.some((sub) => matchesFilter(view, sub))) return false;
      continue;
    }
    if (key === "$and") {
      if (!cond.every((sub) => matchesFilter(view, sub))) return false;
      continue;
    }
    if (!matchCond(getPath(view, key), cond)) return false;
  }
  return true;
}

// Merge a Mongoose-style update ($set / $setOnInsert / $inc, or a plain object)
// onto an existing document, returning the new document body.
function applyUpdate(existingDoc, update, { isInsert = false, filter = {} } = {}) {
  let doc = existingDoc ? clone(existingDoc) : {};
  const usesOperators = Object.keys(update).some((k) => k.startsWith("$"));

  if (!usesOperators) {
    return { ...doc, ...stripMeta(update) };
  }

  if (isInsert) {
    for (const [key, val] of Object.entries(filter)) {
      if (!META_KEYS.has(key) && (typeof val !== "object" || val instanceof Date)) {
        doc[key] = val;
      }
    }
    if (update.$setOnInsert) doc = { ...doc, ...stripMeta(update.$setOnInsert) };
  }
  if (update.$set) doc = { ...doc, ...stripMeta(update.$set) };
  if (update.$inc) {
    for (const [key, n] of Object.entries(update.$inc)) doc[key] = (doc[key] || 0) + n;
  }
  return doc;
}

function makeSorter(spec) {
  const keys = Object.entries(spec);
  return (a, b) => {
    for (const [key, dir] of keys) {
      const order = cmp(getPath(a, key), getPath(b, key));
      if (order !== 0) return dir < 0 ? -order : order;
    }
    return 0;
  };
}

function parseSelect(spec) {
  const fields = spec.trim().split(/\s+/).filter(Boolean);
  const exclude = fields.some((f) => f.startsWith("-"));
  return { exclude, fields: fields.map((f) => f.replace(/^-/, "")) };
}

function applySelect(view, { exclude, fields }) {
  if (exclude) {
    const out = { ...view };
    for (const f of fields) delete out[f];
    return out;
  }
  const out = { _id: view._id };
  for (const f of fields) out[f] = view[f];
  return out;
}

function pickFields(view, fields) {
  if (!fields) return view;
  const out = { _id: view._id };
  for (const f of fields.trim().split(/\s+/).filter(Boolean)) out[f] = view[f];
  return out;
}

// Read every row of a table, paging past the API row cap so callers always get
// the full collection to filter in memory.
async function fetchAll(table) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw new Error(`[${table}] ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

class Document {
  constructor(model, view) {
    Object.defineProperty(this, "_model", { value: model, enumerable: false, writable: true });
    Object.assign(this, view);
  }

  toObject() {
    return { ...this };
  }

  toJSON() {
    return { ...this };
  }

  async save() {
    const doc = {};
    for (const key of Object.keys(this)) {
      if (!META_KEYS.has(key)) doc[key] = this[key];
    }
    const { data, error } = await supabase
      .from(this._model.table)
      .update({ doc, updated_at: new Date().toISOString() })
      .eq("id", this._id)
      .select()
      .single();
    if (error) throw new Error(`[${this._model.table}] ${error.message}`);
    this.updatedAt = data.updated_at;
    return this;
  }
}

class Query {
  constructor(model, filter, { single = false } = {}) {
    this._model = model;
    this._filter = filter || {};
    this._single = single;
    this._sort = null;
    this._limit = null;
    this._select = null;
    this._populate = [];
  }

  sort(spec) {
    this._sort = spec;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  select(spec) {
    this._select = parseSelect(spec);
    return this;
  }

  populate(path, fields) {
    this._populate.push({ path, fields });
    return this;
  }

  async _run() {
    const rows = await fetchAll(this._model.table);
    let views = rows.map(toView).filter((v) => matchesFilter(v, this._filter));
    if (this._sort) views.sort(makeSorter(this._sort));
    if (this._single) views = views.slice(0, 1);
    else if (this._limit != null) views = views.slice(0, this._limit);

    for (const spec of this._populate) await populateViews(views, spec);
    if (this._select) views = views.map((v) => applySelect(v, this._select));

    const docs = views.map((v) => new Document(this._model, v));
    return this._single ? docs[0] || null : docs;
  }

  then(resolve, reject) {
    return this._run().then(resolve, reject);
  }

  catch(reject) {
    return this._run().catch(reject);
  }
}

async function populateViews(views, { path, fields }) {
  const table = REF_TABLE[path];
  if (!table) return;
  const ids = new Set(views.map((v) => v[path]).filter(Boolean).map(String));
  if (!ids.size) return;
  const rows = await fetchAll(table);
  const byId = new Map(rows.map((r) => [String(r.id), toView(r)]));
  for (const view of views) {
    if (!view[path]) continue;
    const ref = byId.get(String(view[path]));
    if (ref) view[path] = pickFields(ref, fields);
  }
}

export function createModel(table, { defaults = {} } = {}) {
  const model = {
    table,
    modelName: table,

    find(filter = {}) {
      return new Query(model, filter, { single: false });
    },

    findOne(filter = {}) {
      return new Query(model, filter, { single: true });
    },

    findById(id) {
      return new Query(model, { _id: id }, { single: true });
    },

    async create(payload) {
      const doc = applyDefaults(stripMeta(payload), defaults);
      const { data, error } = await supabase.from(table).insert({ doc }).select().single();
      if (error) throw new Error(`[${table}] ${error.message}`);
      return new Document(model, toView(data));
    },

    async findByIdAndUpdate(id, update, options = {}) {
      const rows = await fetchAll(table);
      const row = rows.find((r) => String(r.id) === String(id));
      if (!row) return null;
      const doc = applyUpdate(row.doc, update, { filter: { _id: id } });
      const { data, error } = await supabase
        .from(table)
        .update({ doc, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`[${table}] ${error.message}`);
      return new Document(model, toView(options.new === false ? row : data));
    },

    async findByIdAndDelete(id) {
      const rows = await fetchAll(table);
      const row = rows.find((r) => String(r.id) === String(id));
      if (!row) return null;
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(`[${table}] ${error.message}`);
      return new Document(model, toView(row));
    },

    async findOneAndUpdate(filter, update, options = {}) {
      const rows = await fetchAll(table);
      const match = rows.find((r) => matchesFilter(toView(r), filter));

      if (match) {
        const doc = applyUpdate(match.doc, update, { filter });
        const { data, error } = await supabase
          .from(table)
          .update({ doc, updated_at: new Date().toISOString() })
          .eq("id", match.id)
          .select()
          .single();
        if (error) throw new Error(`[${table}] ${error.message}`);
        return new Document(model, toView(options.new === false ? match : data));
      }

      if (!options.upsert) return null;

      let doc = applyUpdate({}, update, { isInsert: true, filter });
      doc = applyDefaults(doc, defaults);
      const { data, error } = await supabase.from(table).insert({ doc }).select().single();
      if (error) throw new Error(`[${table}] ${error.message}`);
      return new Document(model, toView(data));
    },

    async updateMany(filter, update) {
      const rows = await fetchAll(table);
      const matches = rows.filter((r) => matchesFilter(toView(r), filter));
      for (const row of matches) {
        const doc = applyUpdate(row.doc, update, { filter });
        const { error } = await supabase
          .from(table)
          .update({ doc, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (error) throw new Error(`[${table}] ${error.message}`);
      }
      return { matchedCount: matches.length, modifiedCount: matches.length };
    },

    async distinct(field, filter = {}) {
      const rows = await fetchAll(table);
      const values = new Set();
      for (const row of rows) {
        const view = toView(row);
        if (!matchesFilter(view, filter)) continue;
        const value = getPath(view, field);
        if (!isNullish(value)) values.add(value);
      }
      return [...values];
    }
  };

  return model;
}

export default createModel;
