import Company from "../models/Company.js";
import Invoice from "../models/Invoice.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { nextInvoiceNumber } from "./invoiceNumber.js";

const BACKFILL_INTERVAL_MS = 5 * 60 * 1000;
let lastBackfillAt = 0;
let backfillInFlight = null;

function asDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Reuses the invoice number already assigned for this order (idempotent re-sync);
// otherwise mints the next sequential CS/INV/<legal year>/<seq> number.
async function invoiceNumberFor(order, paidAt) {
  const existing = await Invoice.findOne({ sourceOrderId: order._id }).select("invoiceNumber").catch(() => null);
  if (existing?.invoiceNumber) return existing.invoiceNumber;
  return nextInvoiceNumber(paidAt);
}

function paymentIdFor(order) {
  return order.payment?.razorpayPaymentId || `PAY-${String(order._id).slice(-8).toUpperCase()}`;
}

function isPaidStatus(status) {
  return ["paid", "completed", "success", "received"].includes(String(status || "").toLowerCase());
}

function projectAmount(project) {
  return Number(project.finalAmount ?? project.packageValue ?? project.budget ?? 0) || 0;
}

function projectInvoiceStatus(project) {
  if (isPaidStatus(project.paymentStatus)) return { status: "Paid", paymentStatus: "Paid" };
  const raw = String(project.paymentStatus || "").trim();
  if (["Generated", "Sent", "Overdue", "Cancelled"].includes(raw)) return { status: raw, paymentStatus: raw };
  return { status: "Draft", paymentStatus: "Draft" };
}

async function findLinkedCompany(order, clientId) {
  const companyName = order.customer?.customerCompany?.trim();
  if (clientId) {
    const id = String(clientId);
    const companies = await Company.find({}).select("_id name userId userIds").catch(() => []);
    const company = companies.find((c) => String(c.userId || "") === id || (c.userIds || []).map(String).includes(id));
    if (company) return company;
  }
  if (!companyName) return null;
  return Company.findOne({ name: new RegExp(`^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })
    .select("_id name userId")
    .catch(() => null);
}

export async function syncFinanceForOrder(orderInput) {
  const order = typeof orderInput?.toObject === "function" ? orderInput.toObject() : orderInput;
  if (!order?._id || order.payment?.status !== "paid") return null;

  const customer = order.customer || {};
  const pkg = order.package || {};
  const paidAt = asDate(order.payment?.paidAt) || asDate(order.createdAt) || new Date();
  const client = customer.customerEmail
    ? await User.findOne({ email: String(customer.customerEmail).toLowerCase() }).select("_id name email").catch(() => null)
    : null;
  const company = await findLinkedCompany(order, client?._id);
  const invoiceNumber = await invoiceNumberFor(order, paidAt);
  const paymentId = paymentIdFor(order);
  const total = Number(pkg.total || pkg.price || 0);
  const taxableBase = total ? Math.round(total / 1.18) : 0;
  const gst = total ? total - taxableBase : 0;
  const project = await Project.findOne({ orderId: order._id }).select("_id name projectName").catch(() => null);

  const shared = {
    sourceOrderId: order._id,
    orderId: String(order._id),
    projectId: project?._id || null,
    companyId: company?._id || null,
    clientId: client?._id || company?.userId || null,
    company: company?.name || customer.customerCompany || "",
    client: customer.customerName || client?.name || "",
    customerEmail: customer.customerEmail || "",
    project: project?.name || project?.projectName || customer.projectName || "",
    package: pkg.name || "",
    amount: total,
    currency: "INR",
    invoiceId: invoiceNumber,
    invoiceNumber,
    razorpayOrderId: order.payment?.razorpayOrderId || "",
    razorpayPaymentId: order.payment?.razorpayPaymentId || "",
    paidAt
  };

  const payment = await Payment.findOneAndUpdate(
    { sourceOrderId: order._id },
    {
      $set: {
        ...shared,
        id: `payment-${order._id}`,
        paymentId,
        method: "Razorpay",
        paymentMethod: "Razorpay",
        gateway: order.payment?.provider || "Razorpay",
        status: "Success"
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const invoice = await Invoice.findOneAndUpdate(
    { sourceOrderId: order._id },
    {
      $set: {
        ...shared,
        id: `invoice-${order._id}`,
        paymentId,
        total,
        tax: gst,
        gst,
        issueDate: paidAt,
        date: paidAt,
        status: "Paid",
        paymentStatus: "Paid",
        provider: order.payment?.provider || "Razorpay"
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (order.payment?.invoiceId !== invoiceNumber) {
    await Order.findByIdAndUpdate(order._id, { "payment.invoiceId": invoiceNumber }).catch(() => {});
  }

  return { payment, invoice };
}

export async function syncPaidOrderFinance() {
  const now = Date.now();
  if (backfillInFlight) return backfillInFlight;
  if (now - lastBackfillAt < BACKFILL_INTERVAL_MS) return null;

  backfillInFlight = (async () => {
    const [paymentOrderIds, invoiceOrderIds] = await Promise.all([
      Payment.distinct("sourceOrderId", { sourceOrderId: { $ne: null } }),
      Invoice.distinct("sourceOrderId", { sourceOrderId: { $ne: null } })
    ]);
    const invoiced = new Set(invoiceOrderIds.map(String));
    const fullySyncedIds = paymentOrderIds.filter((id) => invoiced.has(String(id)));

    const missingOrders = await Order.find({
      "payment.status": "paid",
      _id: { $nin: fullySyncedIds }
    })
      .sort({ createdAt: -1 })
      .limit(50);

    await Promise.all(missingOrders.map((order) => syncFinanceForOrder(order)));
    lastBackfillAt = Date.now();
    return missingOrders.length;
  })();

  try {
    return await backfillInFlight;
  } finally {
    backfillInFlight = null;
  }
}

export async function syncStandaloneProjectInvoices() {
  const projects = await Project.find({
    $or: [{ orderId: { $exists: false } }, { orderId: null }],
    $and: [{
      $or: [
        { finalAmount: { $gt: 0 } },
        { packageValue: { $gt: 0 } },
        { budget: { $gt: 0 } }
      ]
    }]
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .catch(() => []);

  let synced = 0;
  for (const project of projects) {
    const amount = projectAmount(project);
    if (!amount) continue;

    const existingByProject = await Invoice.findOne({ projectId: project._id }).catch(() => null);
    const existingByLink = project.linkedInvoiceId
      ? await Invoice.findById(project.linkedInvoiceId).catch(() => null)
      : null;
    const existing = existingByProject || existingByLink;

    const company = project.companyId
      ? await Company.findById(project.companyId).select("_id name userId").catch(() => null)
      : null;
    const issuedAt = asDate(project.startDate) || asDate(project.createdAt) || new Date();
    const gst = amount ? amount - Math.round(amount / 1.18) : 0;
    const status = existing
      ? (isPaidStatus(project.paymentStatus)
          ? { status: "Paid", paymentStatus: "Paid" }
          : { status: existing.status || "Draft", paymentStatus: existing.paymentStatus || existing.status || "Draft" })
      : projectInvoiceStatus(project);
    const invoiceFields = {
      projectId: project._id,
      companyId: company?._id || project.companyId || null,
      clientId: project.clientId || company?.userId || null,
      company: company?.name || project.companyName || project.client || "",
      client: project.primaryContact || project.clientName || "",
      project: project.name || project.projectName || "",
      package: project.packageName || project.packagePurchased || project.template || "Unassigned",
      total: amount,
      amount,
      tax: gst,
      gst,
      issueDate: issuedAt,
      date: issuedAt,
      dueDate: asDate(project.expectedEndDate) || issuedAt,
      provider: project.paymentProvider || "",
      ...status,
      paidAt: status.status === "Paid" ? (asDate(project.paidAt) || issuedAt) : null
    };

    if (existing) {
      await Invoice.findByIdAndUpdate(existing._id, { $set: invoiceFields }).catch(() => {});
      if (!project.linkedInvoiceId || String(project.linkedInvoiceId) !== String(existing._id)) {
        await Project.findByIdAndUpdate(project._id, { linkedInvoiceId: existing._id }).catch(() => {});
      }
      synced += 1;
      continue;
    }

    const invoiceNumber = await nextInvoiceNumber(issuedAt);
    const invoice = await Invoice.create({
      id: `invoice-${project._id}`,
      invoiceNumber,
      invoiceId: invoiceNumber,
      ...invoiceFields
    });

    await Project.findByIdAndUpdate(project._id, { linkedInvoiceId: invoice._id }).catch(() => {});
    synced += 1;
  }
  return synced;
}
