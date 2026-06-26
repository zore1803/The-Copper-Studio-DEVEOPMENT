import express from "express";
import Company from "../models/Company.js";
import Contact from "../models/Contact.js";
import Coupon from "../models/Coupon.js";
import CrmLead from "../models/CrmLead.js";
import Deal from "../models/Deal.js";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import Document from "../models/Document.js";
import Meeting from "../models/Meeting.js";
import Note from "../models/Note.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";
import User from "../models/User.js";
import { syncPaidOrderFinance } from "../services/finance.js";
import { sendContactCreatedEmail } from "../services/email.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

// Throttle record creation to stop accidental double-submits and abuse.
// Coupons get a tighter budget because each one is a distinct marketing asset.
const couponCreateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  name: "coupon-create",
  message: "Too many coupons created in a short time. Please wait a minute before creating more."
});
const writeLimiter = rateLimit({ windowMs: 60_000, max: 40, name: "crm-write" });

function createLimiter(req, res, next) {
  return (req.params.type === "coupons" ? couponCreateLimiter : writeLimiter)(req, res, next);
}
const models = {
  companies: Company,
  contacts: Contact,
  coupons: Coupon,
  deals: Deal,
  leads: CrmLead,
  tasks: Task,
  projects: Project,
  documents: Document,
  meetings: Meeting,
  notes: Note,
  orders: Order,
  payments: Payment,
  invoices: Invoice
};

const companyLinkedTypes = new Set(["projects", "documents", "meetings", "notes"]);

const expirableCouponStatuses = ["Active", "Applied", "Not used"];

function validateType(req, res, next) {
  if (!models[req.params.type]) {
    return res.status(404).json({ message: "CRM collection not found." });
  }
  next();
}

function asPublicRecord(record) {
  const data = record.toObject();
  return { ...data, id: data.id || data._id.toString(), _id: data._id.toString() };
}

function toDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function couponPayload(body) {
  const payload = { ...body };
  const validUntil = toDate(payload.validUntil || payload.validity);
  if (validUntil) {
    payload.validUntil = validUntil;
    payload.validity = validUntil.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true
    });
  }
  if (payload.status === "Revoked" && !payload.revokedAt) payload.revokedAt = new Date();
  if (payload.status === "Redeemed" && !payload.redeemedAt) payload.redeemedAt = new Date();
  return payload;
}

async function expireOldCoupons() {
  await Coupon.updateMany(
    { status: { $in: expirableCouponStatuses }, validUntil: { $lte: new Date() } },
    { $set: { status: "Expired" } }
  );
}

async function withClientLink(type, payload) {
  if (!companyLinkedTypes.has(type) || !payload.companyId || payload.clientId) return payload;
  const company = await Company.findById(payload.companyId).select("userId userIds").catch(() => null);
  const primaryClientId = company?.userIds?.[0] || company?.userId;
  if (primaryClientId) return { ...payload, clientId: primaryClientId };
  return payload;
}

// A record's `clientId` only tracks one "primary" client account for legacy
// admin views — actual client-portal visibility for companies with several
// linked accounts is resolved by company membership (see routes/client.js),
// not by this field, so we just keep it pointed at the first linked user.
async function cascadeClientLink(companyId, userIds) {
  const primaryClientId = (Array.isArray(userIds) ? userIds[0] : userIds) || null;
  const filter = { companyId };
  const update = { $set: { clientId: primaryClientId } };
  await Promise.all([
    Project.updateMany(filter, update),
    Document.updateMany(filter, update),
    Meeting.updateMany(filter, update),
    Note.updateMany(filter, update)
  ]);
}

router.get("/:type", validateType, async (req, res, next) => {
  try {
    const Model = models[req.params.type];
    if (req.params.type === "coupons") await expireOldCoupons();
    if (["payments", "invoices"].includes(req.params.type)) await syncPaidOrderFinance();
    const records = await Model.find({}).sort({ updatedAt: -1 });
    res.json(records.map(asPublicRecord));
  } catch (error) {
    next(error);
  }
});

router.post("/:type", createLimiter, validateType, async (req, res, next) => {
  try {
    const { type } = req.params;
    const Model = models[type];
    let payload = type === "coupons" ? couponPayload(req.body) : req.body;
    payload = await withClientLink(type, payload);
    const record = await Model.create(payload);
    if (type === "contacts") {
      sendContactCreatedEmail({ name: record.name, email: record.email, phone: record.phone, company: record.company }).catch(() => {});
    }
    res.status(201).json(asPublicRecord(record));
  } catch (error) {
    next(error);
  }
});

router.put("/:type/:id", validateType, async (req, res, next) => {
  try {
    const { type } = req.params;
    const Model = models[type];
    let payload = type === "coupons" ? couponPayload(req.body) : req.body;
    payload = await withClientLink(type, payload);
    const record = await Model.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!record) return res.status(404).json({ message: "CRM record not found." });
    if (type === "companies" && (Object.prototype.hasOwnProperty.call(payload, "userId") || Object.prototype.hasOwnProperty.call(payload, "userIds"))) {
      await cascadeClientLink(record._id, record.userIds?.length ? record.userIds : record.userId);
    }
    res.json(asPublicRecord(record));
  } catch (error) {
    next(error);
  }
});

// Kept driver-agnostic (works on both Mongo and the Supabase fallback): we
// find() then delete each by id, and unlink array references by loading,
// modifying, and saving the parent record.
async function deleteEachById(Model, records) {
  await Promise.all(
    records.map((r) =>
      Model.findByIdAndDelete(r._id).catch((err) =>
        console.warn(`Cascade delete failed for ${Model.modelName || Model.table}/${r._id}:`, err.message)
      )
    )
  );
}

// Remove a (now-deleted) portal user from every company's userIds/userId links.
async function unlinkUserFromCompanies(userId) {
  if (!userId) return;
  const uid = String(userId);
  const companies = await Company.find({}).catch(() => []);
  for (const company of companies) {
    const ids = (company.userIds || []).map(String);
    const isMember = ids.includes(uid);
    const isPrimary = company.userId && String(company.userId) === uid;
    if (!isMember && !isPrimary) continue;
    company.userIds = ids.filter((id) => id !== uid);
    if (isPrimary) company.userId = company.userIds[0] || null;
    await company.save().catch((err) => console.warn(`Failed to unlink user ${uid} from company ${company._id}:`, err.message));
  }
}

// When a record is deleted from the admin side, also remove the records that
// only exist because of it — most importantly the provisioned client-portal
// login — so nothing is left orphaned in the database.
async function cascadeDelete(type, record) {
  if (type === "contacts") {
    // A contact IS a client: drop its portal login and unlink it everywhere.
    if (record.userId) {
      await User.findByIdAndDelete(record.userId).catch(() => {});
      await unlinkUserFromCompanies(record.userId);
    }
    return;
  }

  if (type === "companies") {
    const companyId = String(record._id);
    const contacts = await Contact.find({ $or: [{ companyId }, { company: record.name }] }).catch(() => []);

    // Delete every portal login linked to the company (its own + its contacts').
    const userIds = [
      ...(record.userIds || []),
      ...(record.userId ? [record.userId] : []),
      ...contacts.map((c) => c.userId).filter(Boolean)
    ];
    await Promise.all(
      [...new Set(userIds.map(String))].map((uid) => User.findByIdAndDelete(uid).catch(() => {}))
    );

    // Delete the contacts and every company-scoped record.
    await deleteEachById(Contact, contacts);
    for (const Model of [Project, Document, Meeting, Note]) {
      const linked = await Model.find({ companyId }).catch(() => []);
      await deleteEachById(Model, linked);
    }
    return;
  }

  if (type === "projects") {
    const projectId = String(record._id);
    const [tasks, docs] = await Promise.all([
      Task.find({ project: record.name }).catch(() => []),
      Document.find({ projectId }).catch(() => [])
    ]);
    await deleteEachById(Task, tasks);
    await deleteEachById(Document, docs);
    return;
  }
}

router.delete("/:type/:id", validateType, async (req, res, next) => {
  try {
    const Model = models[req.params.type];
    const record = await Model.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: "CRM record not found." });
    // Cascade cleanup never blocks the delete response; failures are logged.
    await cascadeDelete(req.params.type, record).catch((err) =>
      console.warn(`Cascade cleanup error for ${req.params.type}/${req.params.id}:`, err.message)
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
