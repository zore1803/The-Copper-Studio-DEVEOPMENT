import "dotenv/config";
import cors from "cors";
import crypto from "node:crypto";
import dns from "node:dns";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import { supabase } from "./db/supabase.js";
import { dbDriver } from "./db/defineModel.js";
import Order from "./models/Order.js";
import Lead from "./models/Lead.js";
import User from "./models/User.js";
import Coupon from "./models/Coupon.js";
import Project from "./models/Project.js";
import Company from "./models/Company.js";
import Contact from "./models/Contact.js";
import authRoutes from "./routes/auth.js";
import crmRoutes from "./routes/crm.js";
import clientRoutes from "./routes/client.js";
import adminRoutes from "./routes/admin.js";
import settingsRoutes from "./routes/settings.js";
import calendlyRoutes from "./routes/calendly.js";
import invoiceRoutes from "./routes/invoices.js";
import { packages } from "./data/packages.js";
import { sendInvoiceEmail } from "./services/email.js";
import { sendPortalInvite } from "./services/portalInvite.js";
import { sendOtp, verifyOtp, isVerified } from "./services/otp.js";
import { syncFinanceForOrder } from "./services/finance.js";
import { buildInvoiceModel, renderInvoiceHtml } from "./services/invoiceTemplate.js";
import { htmlToPdfBuffer } from "./services/pdf.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const port = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, "..");
const requestedSupabaseBootCheckTimeoutMs = Number.parseInt(process.env.SUPABASE_BOOT_CHECK_TIMEOUT_MS || "8000", 10);
const supabaseBootCheckTimeoutMs =
  Number.isFinite(requestedSupabaseBootCheckTimeoutMs) && requestedSupabaseBootCheckTimeoutMs > 0
    ? requestedSupabaseBootCheckTimeoutMs
    : 8000;
const strictSupabaseBootCheck = process.env.STRICT_SUPABASE_BOOT_CHECK === "true";
const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      })
    : null;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "12mb", verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); } }));
app.use("/api/auth", authRoutes);
app.use("/api/crm", crmRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/settings", settingsRoutes);
app.use("/api/calendly", calendlyRoutes);
app.use("/api/invoices", invoiceRoutes);

// Build + email the tax invoice for a paid order. Failures are logged but never
// block the order/payment response (the invoice is always retrievable via the API).
async function emailInvoiceForOrder(order, invoice) {
  try {
    if (!order || order.payment?.status !== "paid") return;
    const customer = order.customer || {};
    if (!customer.customerEmail) return;

    const model = buildInvoiceModel({ order, invoice });
    const html = renderInvoiceHtml(model);

    let pdfBuffer = null;
    try {
      pdfBuffer = await htmlToPdfBuffer(html);
    } catch (pdfError) {
      console.warn("Invoice PDF generation failed; sending confirmation email without the PDF attachment:", pdfError.message);
    }

    // The email body is ALWAYS the short confirmation message. The invoice only
    // ever travels as a PDF attachment — never dumped inline as HTML.
    await sendInvoiceEmail({
      to: customer.customerEmail,
      name: customer.customerName,
      invoiceNumber: model.invoiceNumber,
      packageName: model.items?.[0]?.name,
      total: model.totals?.total,
      pdfBuffer
    });
  } catch (error) {
    console.error("Failed to email invoice:", error.message);
  }
}

// Drops a link to the paid order's invoice PDF into the project's Files tab,
// using the same project.documents shape ProjectFiles.jsx's manual uploads use.
async function attachInvoiceToProjectFiles(order, invoice) {
  try {
    if (!order || order.payment?.status !== "paid") return;
    const project = await Project.findOne({ orderId: order._id });
    if (!project) return;

    const docId = `inv-${order._id}`;
    if ((project.documents || []).some((doc) => doc._id === docId)) return;

    const invoiceNumber = invoice?.invoiceNumber || order.payment?.invoiceId || String(order._id);
    const base = process.env.RENDER_EXTERNAL_URL || process.env.API_PUBLIC_URL || "";
    const fileUrl = `${base}/api/invoices/by-order/${order._id}/pdf`;

    const newDoc = {
      _id: docId,
      name: `Tax Invoice - ${invoiceNumber}.pdf`,
      category: "Invoices",
      type: "pdf",
      sizeMB: 0,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      uploadedBy: "System",
      fileUrl
    };

    project.documents = [newDoc, ...(project.documents || [])];
    await project.save();
  } catch (error) {
    console.error("Failed to attach invoice to project files:", error.message);
  }
}

async function createPortalInvite(order) {
  if (order.payment.status !== "paid") return null;

  const customer = order.customer;
  const result = await sendPortalInvite({
    email: customer.customerEmail,
    name: customer.customerName,
    phone: customer.customerPhone,
    company: customer.customerCompany || "",
    packageName: order.package?.name || ""
  });

  order.email.credentialsQueued = false;
  order.workspace.status = "created";
  order.workspace.createdAt = new Date();
  await order.save();

  return result;
}

// First 4 DISTINCT letters of the company name (repeats skipped), e.g.
// "DATACENTRIC" -> "DATC". Padded with X if fewer than 4 distinct letters.
function companyCodeFromName(name) {
  const letters = String(name || "").toUpperCase().replace(/[^A-Z]/g, "");
  const seen = new Set();
  let code = "";
  for (const ch of letters) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    code += ch;
    if (code.length === 4) break;
  }
  return code.padEnd(4, "X");
}

// Structured project code: CS-<4 letters>-<project #>-<MMYY>, e.g. CS-DATC-02-0626.
function buildProjectCode(companyName, projectNumber, date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const num = String(projectNumber || 1).padStart(2, "0");
  return `CS-${companyCodeFromName(companyName)}-${num}-${mm}${yy}`;
}

function buildDefaultProjectName(companyName, projectNumber, date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${companyName}-Project ${projectNumber || 1}-${mm}${yy}`;
}

async function nextProjectNumberForCompany(companyId) {
  if (!companyId) return 1;
  const count = await Project.countDocuments({ companyId }).catch(() => 0);
  return count + 1;
}

// Finds the checkout customer's company by name, creating it if it doesn't
// exist yet, so the project/contact created from a paid order land under a
// real Company record instead of just a free-text name.
async function ensureCompanyForOrder(order) {
  const customer = order.customer || {};
  const companyName = String(customer.customerCompany || "").trim();
  if (!companyName) return null;

  const companies = await Company.find({}).catch(() => []);
  const existing = companies.find((c) => String(c.name || "").trim().toLowerCase() === companyName.toLowerCase());
  if (existing) return existing;

  return Company.create({
    name: companyName,
    website: customer.companyWebsite || "",
    gstin: customer.companyGstin || "",
    status: "Active"
  });
}

// Anyone who fills out checkout and pays is a client, so they should show up
// as a Contact in the CRM — not just an Order/User in the background.
// Upserts by email so retries/backfills never create duplicates.
async function ensureContactForOrder(order, company) {
  const customer = order.customer || {};
  const email = String(customer.customerEmail || "").trim().toLowerCase();
  if (!email) return null;

  const fullPhone = customer.customerPhone
    ? `${customer.customerCountryCode || "+91"} ${customer.customerPhone}`
    : "";

  const payload = {
    name: customer.customerName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
    email,
    phone: fullPhone,
    designation: customer.designation || "",
    company: company?.name || customer.customerCompany || "",
    companyId: company?._id || null,
    linkedin: customer.linkedinUrl || "",
    status: "Active",
    isPrimary: true
  };

  const existing = await Contact.findOne({ email }).catch(() => null);
  if (existing) return Contact.findByIdAndUpdate(existing._id, payload, { new: true });
  return Contact.create(payload);
}

// On a paid order, create the client's project using the name they chose at
// checkout, so it appears immediately in their multi-project portal. Idempotent
// per order so retries/backfills never create duplicates.
async function ensureProjectForOrder(order, clientId, company) {
  if (order.payment?.status !== "paid") return null;
  const orderId = order._id;
  const existing = await Project.findOne({ orderId }).catch(() => null);
  if (existing) return existing;

  const customer = order.customer || {};
  const companyName = company?.name || customer.customerCompany || "";

  const projectNumber = await nextProjectNumberForCompany(company?._id);
  const generatedProjectName = companyName ? buildDefaultProjectName(companyName, projectNumber, new Date()) : "";

  return Project.create({
    name: customer.projectName || generatedProjectName || `${order.package?.name || "New"} project`,
    projectId: companyName ? buildProjectCode(companyName, projectNumber, new Date()) : "",
    clientId: clientId || null,
    companyId: company?._id || null,
    orderId,
    packageName: order.package?.name || "",
    status: "not_started",
    clientStatus: "in_progress",
    progress: 0,
    currentPhase: "Onboarding"
  });
}

function computeCouponDiscount(coupon, packagePrice) {
  if (!coupon) return 0;
  const numericAmount = Number(String(coupon.amount || "").replace(/[^\d.]/g, "")) || 0;
  if (coupon.amountType === "fixed") return Math.min(packagePrice, numericAmount);
  return Math.min(packagePrice, Math.round((packagePrice * numericAmount) / 100));
}

function couponExpiryDate(coupon) {
  if (coupon.validUntil) return new Date(coupon.validUntil);
  if (!coupon.validity) return null;
  const parsed = new Date(coupon.validity);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function validateCouponForPackage(code, selectedPackage) {
  if (!code) return { coupon: null, discount: 0, subtotal: selectedPackage.price, total: Math.round(selectedPackage.price * 1.18) };

  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  if (!coupon) {
    const error = new Error("Coupon code not found.");
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();

  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    const error = new Error(`Coupon is not active yet. It starts on ${new Date(coupon.validFrom).toLocaleString("en-IN")}.`);
    error.statusCode = 400;
    throw error;
  }

  const expiryDate = couponExpiryDate(coupon);
  if (expiryDate && expiryDate <= now && ["Active", "Applied", "Not used"].includes(coupon.status)) {
    coupon.status = "Expired";
    await coupon.save();
  }

  if (!["Active", "Not used"].includes(coupon.status)) {
    const error = new Error(`Coupon is ${coupon.status.toLowerCase()} and cannot be applied.`);
    error.statusCode = 400;
    throw error;
  }

  const discount = computeCouponDiscount(coupon, selectedPackage.price);
  const subtotal = Math.max(0, selectedPackage.price - discount);
  const total = Math.round(subtotal * 1.18);

  return {
    coupon,
    discount,
    subtotal,
    total
  };
}

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    service: "the-copper-studio-api",
    routes: {
      health: "/api/health",
      packages: "/api/packages",
      pricing: "/pricing",
      checkout: "/checkout",
      razorpayConfig: "/api/razorpay/config",
      latestOrder: "/api/orders/latest"
    }
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "the-copper-studio-api" });
});

app.get("/api/packages", (_req, res) => {
  res.json(packages);
});

const OTP_CHANNELS = new Set(["phone", "email"]);

app.post("/api/otp/send", async (req, res, next) => {
  try {
    const { email, channel, phone, dialCode } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "A valid email address is required." });
    }
    if (!OTP_CHANNELS.has(channel)) {
      return res.status(400).json({ message: "Invalid OTP channel." });
    }
    if (channel === "phone" && !/^\d{10}$/.test(String(phone || ""))) {
      return res.status(400).json({ message: "A valid 10-digit mobile number is required." });
    }

    const result = await sendOtp({ email, channel, phone, dialCode });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/otp/verify", (req, res, next) => {
  try {
    const { email, channel, code } = req.body;
    if (!email || !OTP_CHANNELS.has(channel) || !code) {
      return res.status(400).json({ message: "Email, channel, and code are required." });
    }

    const result = verifyOtp({ email, channel, code: String(code) });
    if (!result.ok) return res.status(400).json({ message: result.message });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/coupons/validate", async (req, res, next) => {
  try {
    const { code, selectedPackageId } = req.body;
    if (!code) return res.status(400).json({ message: "Coupon code is required." });
    const selectedPackage = packages.find((item) => item.id === selectedPackageId);
    if (!selectedPackage) return res.status(400).json({ message: "Invalid package selected." });

    const result = await validateCouponForPackage(code, selectedPackage);
    res.json({
      code: result.coupon.code,
      amount: result.coupon.amount,
      amountType: result.coupon.amountType,
      status: result.coupon.status,
      validUntil: result.coupon.validUntil,
      discount: result.discount,
      subtotal: result.subtotal,
      gst: Math.round(result.subtotal * 0.18),
      total: result.total,
      packageName: selectedPackage.name
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/razorpay/config", (_req, res) => {
  if (!process.env.RAZORPAY_KEY_ID) {
    return res.status(503).json({ message: "Razorpay key id is not configured." });
  }

  res.json({ keyId: process.env.RAZORPAY_KEY_ID });
});

app.post("/api/razorpay/order", async (req, res, next) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ message: "Razorpay credentials are not configured." });
    }

    const { selectedPackageId, couponCode } = req.body;
    const selectedPackage = packages.find((item) => item.id === selectedPackageId);
    if (!selectedPackage) return res.status(400).json({ message: "Invalid package selected." });

    const couponResult = await validateCouponForPackage(couponCode, selectedPackage);
    const total = couponResult.total;
    const razorpayOrder = await razorpay.orders.create({
      amount: total * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        couponCode: couponResult.coupon?.code || "",
        couponDiscount: String(couponResult.discount)
      }
    });

    res.status(201).json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      package: selectedPackage,
      coupon: couponResult.coupon ? {
        code: couponResult.coupon.code,
        amount: couponResult.coupon.amount,
        amountType: couponResult.coupon.amountType,
        discount: couponResult.discount
      } : null,
      subtotal: couponResult.subtotal,
      gst: Math.round(couponResult.subtotal * 0.18),
      total
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/razorpay/verify", async (req, res, next) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ message: "Razorpay secret is not configured." });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      selectedPackageId,
      couponCode,
      customer,
      verified
    } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid Razorpay payment signature." });
    }

    const selectedPackage = packages.find((item) => item.id === selectedPackageId);
    if (!selectedPackage) return res.status(400).json({ message: "Invalid package selected." });

    if (!customer?.customerName || !customer?.customerPhone || !customer?.customerEmail) {
      return res.status(400).json({ message: "Customer name, phone, and email are required." });
    }

    if (!isVerified({ email: customer.customerEmail, channel: "phone" }) || !isVerified({ email: customer.customerEmail, channel: "email" })) {
      return res.status(400).json({ message: "Mobile and email must be OTP-verified before order creation." });
    }

    const couponResult = await validateCouponForPackage(couponCode, selectedPackage);
    const total = couponResult.total;
    const order = await Order.create({
      package: { ...selectedPackage, total },
      customer,
      verification: {
        phoneVerified: true,
        emailVerified: true
      },
      payment: {
        status: "paid",
        provider: "razorpay",
        invoiceId: `INV-${Date.now().toString().slice(-6)}`,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        paidAt: new Date()
      }
    });
    if (couponResult.coupon) {
      couponResult.coupon.status = "Redeemed";
      couponResult.coupon.redeemedAt = new Date();
      couponResult.coupon.discountAmount = couponResult.discount;
      await couponResult.coupon.save();
    }
    const invite = await createPortalInvite(order);
    const company = await ensureCompanyForOrder(order);
    await ensureContactForOrder(order, company);
    await ensureProjectForOrder(order, invite?.userId, company);
    const finance = await syncFinanceForOrder(order);

    // PDF generation (headless Chromium) can be slow/flaky on the free-tier host —
    // never let it block or risk the payment-success response. Both helpers already
    // catch and log their own failures internally.
    emailInvoiceForOrder(order, finance?.invoice);
    attachInvoiceToProjectFiles(order, finance?.invoice);

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

app.post("/api/invoices/manual", async (req, res, next) => {
  try {
    const {
      companyId,
      companyName,
      customerEmail,
      customerPhone,
      customerName,
      billingAddressLine1,
      billingAddressLine2,
      city,
      state,
      pincode,
      companyGstin,
      companyWebsite,
      projectName,
      packageName,
      amount
    } = req.body;

    const total = Number(amount);
    if (!total || total <= 0) {
      return res.status(400).json({ message: "A valid invoice amount is required." });
    }
    if (!companyId && !String(companyName || "").trim()) {
      return res.status(400).json({ message: "Select an existing company or enter a company name." });
    }

    let company = null;
    let resolvedCompanyName = String(companyName || "").trim();

    if (companyId) {
      company = await Company.findById(companyId).catch(() => null);
      if (!company) return res.status(404).json({ message: "Selected company not found." });
      resolvedCompanyName = company.name;
    }
    const lockedProjectName = company
      ? buildDefaultProjectName(resolvedCompanyName, await nextProjectNumberForCompany(company._id), new Date())
      : "";

    const order = await Order.create({
      package: {
        id: "manual",
        name: packageName || "Custom Package",
        price: total,
        total
      },
      customer: {
        customerName: customerName || "Admin Created",
        customerEmail: customerEmail || company?.email || "manual@example.com",
        customerPhone: customerPhone || company?.phone || "0000000000",
        customerCompany: resolvedCompanyName,
        projectName: lockedProjectName || projectName || "Custom Project",
        companyWebsite: companyWebsite || company?.website || "",
        companyGstin: companyGstin || company?.gstin || "",
        billingAddressLine1: billingAddressLine1 || company?.address || "",
        billingAddressLine2: billingAddressLine2 || "",
        city: city || company?.city || "",
        state: state || company?.state || "",
        pincode: pincode || company?.pincode || ""
      },
      verification: {
        phoneVerified: true,
        emailVerified: true
      },
      payment: {
        status: "paid",
        provider: "manual",
        invoiceId: `INV-${Date.now().toString().slice(-6)}`,
        paidAt: new Date()
      }
    });

    if (!company) company = await ensureCompanyForOrder(order);
    await ensureContactForOrder(order, company);

    const primaryClientId = company?.userIds?.[0] || company?.userId || null;
    const project = await ensureProjectForOrder(order, primaryClientId, company);
    const finance = await syncFinanceForOrder(order);

    emailInvoiceForOrder(order, finance?.invoice).catch((error) => {
      console.error("Background invoice email failed:", error.message);
    });

    res.status(201).json({ order, company, project, invoice: finance?.invoice, payment: finance?.payment });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (req, res, next) => {
  try {
    const { selectedPackageId, customer, verified, paymentStatus, paidAt, invoiceId, couponCode } = req.body;
    const selectedPackage = packages.find((item) => item.id === selectedPackageId);

    if (!selectedPackage) {
      return res.status(400).json({ message: "Invalid package selected." });
    }

    if (!customer?.customerName || !customer?.customerPhone || !customer?.customerEmail) {
      return res.status(400).json({ message: "Customer name, phone, and email are required." });
    }

    if (!isVerified({ email: customer.customerEmail, channel: "phone" }) || !isVerified({ email: customer.customerEmail, channel: "email" })) {
      return res.status(400).json({ message: "Mobile and email must be OTP-verified before order creation." });
    }

    const couponResult = await validateCouponForPackage(couponCode, selectedPackage);
    const total = couponResult.total;
    const order = await Order.create({
      package: { ...selectedPackage, total },
      customer,
      verification: {
        phoneVerified: true,
        emailVerified: true
      },
      payment: {
        status: paymentStatus === "paid" ? "paid" : "pending",
        provider: "razorpay",
        invoiceId: invoiceId || `INV-${Date.now().toString().slice(-6)}`,
        paidAt: paidAt ? new Date(paidAt) : new Date()
      }
    });
    if (couponResult.coupon && order.payment.status === "paid") {
      couponResult.coupon.status = "Redeemed";
      couponResult.coupon.redeemedAt = new Date();
      couponResult.coupon.discountAmount = couponResult.discount;
      await couponResult.coupon.save();
    }
    const invite = await createPortalInvite(order);
    const company = await ensureCompanyForOrder(order);
    if (order.payment.status === "paid") await ensureContactForOrder(order, company);
    await ensureProjectForOrder(order, invite?.userId, company);
    const finance = await syncFinanceForOrder(order);
    if (order.payment.status === "paid") await emailInvoiceForOrder(order, finance?.invoice);

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

app.post("/api/leads", async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      customerName,
      linkedinUrl,
      customerPhone,
      customerCountryCode,
      customerEmail,
      projectName,
      customerCompany,
      companyWebsite,
      companyGstin,
      billingAddressLine1,
      billingAddressLine2,
      city,
      state,
      pincode,
      selectedPackageId
    } = req.body;

    if (!firstName || !lastName || !customerPhone || !customerEmail || !projectName) {
      return res.status(400).json({ message: "First name, last name, phone, email, and project name are required." });
    }
    if (!billingAddressLine1 || !city || !state || !pincode) {
      return res.status(400).json({ message: "Billing address, city, state, and pincode are required." });
    }
    if (companyGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$/i.test(companyGstin)) {
      return res.status(400).json({ message: "Company GSTIN is not a valid format." });
    }
    if (!isVerified({ email: customerEmail, channel: "phone" }) || !isVerified({ email: customerEmail, channel: "email" })) {
      return res.status(400).json({ message: "Mobile and email must be OTP-verified before continuing." });
    }

    const lead = await Lead.create({
      firstName,
      lastName,
      customerName: customerName || `${firstName} ${lastName}`.trim(),
      linkedinUrl: linkedinUrl || "",
      customerPhone,
      customerCountryCode: customerCountryCode || "+91",
      customerEmail,
      projectName,
      customerCompany: customerCompany || "",
      companyWebsite: companyWebsite || "",
      companyGstin: companyGstin || "",
      billingAddressLine1,
      billingAddressLine2: billingAddressLine2 || "",
      city,
      state,
      pincode,
      selectedPackageId: selectedPackageId || "",
      verification: {
        phoneVerified: true,
        emailVerified: true
      }
    });

    res.status(201).json({ id: lead._id });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(siteRoot));
app.get(["/pricing", "/packages"], (_req, res) => {
  res.sendFile(path.join(siteRoot, "index.html"));
});
app.get("/checkout", (_req, res) => {
  res.sendFile(path.join(siteRoot, "checkout.html"));
});
app.get("/payment", (_req, res) => {
  res.sendFile(path.join(siteRoot, "payment.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Server error." });
});

function cleanSupabaseBootError(error) {
  const rawMessage = error?.message || String(error);
  if (rawMessage.includes("<!DOCTYPE") || rawMessage.includes("<html")) {
    return "Supabase returned an HTML error page instead of JSON, usually a Cloudflare/proxy 5xx from the Supabase API.";
  }
  if (
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    rawMessage.includes("AbortError") ||
    rawMessage.includes("TimeoutError")
  ) {
    return `Supabase request timed out after ${supabaseBootCheckTimeoutMs}ms.`;
  }
  return rawMessage.length > 500 ? `${rawMessage.slice(0, 500)}...` : rawMessage;
}

async function checkSupabaseAtStartup() {
  try {
    const { error: pingError } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(supabaseBootCheckTimeoutMs));

    if (pingError) {
      throw pingError;
    }

    return true;
  } catch (error) {
    const message =
      `Supabase startup check failed: ${cleanSupabaseBootError(error)} ` +
      "Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, confirm supabase/schema.sql has been applied, " +
      "and verify the Supabase project is not paused or degraded.";

    if (strictSupabaseBootCheck) {
      throw new Error(message);
    }

    console.warn(message);
    console.warn("Continuing startup because STRICT_SUPABASE_BOOT_CHECK is not true; database-backed routes may fail until Supabase recovers.");
    return false;
  }
}

async function start() {
  let databaseReady = true;

  // Connect to whichever backend DB_DRIVER selects (defaults to MongoDB).
  if (dbDriver === "mongo") {
    if (!process.env.MONGO_URI) {
      throw new Error("DB_DRIVER=mongo but MONGO_URI is missing. Add it to .env.");
    }
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  } else {
    databaseReady = await checkSupabaseAtStartup();
  }

  if (process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_PASSWORD) {
    if (databaseReady) {
      const bcrypt = await import("bcryptjs");
      await User.findOneAndUpdate(
        { email: process.env.SUPERADMIN_EMAIL.toLowerCase() },
        {
          $set: { role: "superadmin", status: "active" },
          $setOnInsert: {
            name: process.env.SUPERADMIN_NAME || "Super Admin",
            email: process.env.SUPERADMIN_EMAIL.toLowerCase(),
            passwordHash: await bcrypt.default.hash(process.env.SUPERADMIN_PASSWORD, 12)
          }
        },
        { upsert: true }
      );
    } else {
      console.warn("Skipping superadmin seed because the database was not reachable during startup.");
    }
  }

  app.listen(port, () => {
    console.log(`API running at http://localhost:${port} (DB: ${dbDriver})`);
  });
}

start().catch((error) => {
  console.error("Failed to start API:", error.message);
  process.exit(1);
});
