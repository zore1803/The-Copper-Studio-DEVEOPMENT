import express from "express";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import { buildInvoiceModel, renderInvoiceHtml } from "../services/invoiceTemplate.js";
import { htmlToPdfBuffer } from "../services/pdf.js";

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

// Record ids are Postgres UUIDs for new rows, or the original MongoDB ObjectId
// hex for migrated rows. A non-id path segment (e.g. an invoice number like
// "INV-123456") is looked up by its business key instead.
function isObjectId(value) {
  const str = String(value || "");
  return UUID_RE.test(str) || OBJECT_ID_RE.test(str);
}

function safeFileName(invoiceNumber) {
  return `${String(invoiceNumber || "invoice").replace(/[^a-z0-9-]/gi, "-")}.pdf`;
}

async function loadByOrderId(orderId) {
  if (!isObjectId(orderId)) return null;
  const order = await Order.findById(orderId);
  if (!order) return null;
  const invoice = await Invoice.findOne({ sourceOrderId: order._id });
  return { order, invoice };
}

async function loadByInvoiceId(invoiceId) {
  let invoice = null;
  if (isObjectId(invoiceId)) invoice = await Invoice.findById(invoiceId);
  if (!invoice) invoice = await Invoice.findOne({ invoiceNumber: invoiceId });
  if (!invoice) return null;
  const order = invoice.sourceOrderId ? await Order.findById(invoice.sourceOrderId) : null;
  return { order, invoice };
}

async function respond(res, data, format) {
  if (!data || (!data.order && !data.invoice)) {
    return res.status(404).json({ message: "Invoice not found." });
  }
  const model = buildInvoiceModel(data);
  const html = renderInvoiceHtml(model);

  if (format === "html") {
    res.type("html").send(html);
    return;
  }

  try {
    const pdf = await htmlToPdfBuffer(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFileName(model.invoiceNumber)}"`);
    res.send(pdf);
  } catch (error) {
    // Graceful fallback for any PDF rendering failure (missing Chromium, OOM
    // mid-render on low-memory hosts, etc.) so the client always gets a
    // viewable/printable invoice instead of a bare 500.
    console.warn("PDF generation failed, serving HTML invoice instead:", error.message);
    res.type("html").send(html);
  }
}

router.get("/by-order/:orderId/html", async (req, res, next) => {
  try {
    respond(res, await loadByOrderId(req.params.orderId), "html");
  } catch (error) {
    next(error);
  }
});

router.get("/by-order/:orderId/pdf", async (req, res, next) => {
  try {
    await respond(res, await loadByOrderId(req.params.orderId), "pdf");
  } catch (error) {
    next(error);
  }
});

router.get("/:invoiceId/html", async (req, res, next) => {
  try {
    respond(res, await loadByInvoiceId(req.params.invoiceId), "html");
  } catch (error) {
    next(error);
  }
});

router.get("/:invoiceId/pdf", async (req, res, next) => {
  try {
    await respond(res, await loadByInvoiceId(req.params.invoiceId), "pdf");
  } catch (error) {
    next(error);
  }
});

export default router;
