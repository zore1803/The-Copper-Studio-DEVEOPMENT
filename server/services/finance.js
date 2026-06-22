import Company from "../models/Company.js";
import Invoice from "../models/Invoice.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
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

async function findLinkedCompany(order, clientId) {
  const companyName = order.customer?.customerCompany?.trim();
  if (clientId) {
    const company = await Company.findOne({ userId: clientId }).select("_id name userId").catch(() => null);
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

  const shared = {
    sourceOrderId: order._id,
    orderId: String(order._id),
    companyId: company?._id || null,
    clientId: client?._id || company?.userId || null,
    company: company?.name || customer.customerCompany || "",
    client: customer.customerName || client?.name || "",
    customerEmail: customer.customerEmail || "",
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
