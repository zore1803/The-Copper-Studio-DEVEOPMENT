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
import authRoutes from "./routes/auth.js";
import crmRoutes from "./routes/crm.js";
import clientRoutes from "./routes/client.js";
import adminRoutes from "./routes/admin.js";
import calendlyRoutes from "./routes/calendly.js";
import invoiceRoutes from "./routes/invoices.js";
import { packages } from "./data/packages.js";
import { sendPortalInviteEmail, sendInvoiceEmail } from "./services/email.js";
import { sendOtp, verifyOtp, isVerified } from "./services/otp.js";
import { syncFinanceForOrder } from "./services/finance.js";
import { buildInvoiceModel, renderInvoiceHtml } from "./services/invoiceTemplate.js";
import { htmlToPdfBuffer } from "./services/pdf.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const port = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, "..");
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
app.use("/api/calendly", calendlyRoutes);
app.use("/api/invoices", invoiceRoutes);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

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
      console.warn("Invoice PDF generation failed, emailing HTML invoice only:", pdfError.message);
    }

    await sendInvoiceEmail({
      to: customer.customerEmail,
      name: customer.customerName,
      invoiceNumber: model.invoiceNumber,
      packageName: model.items?.[0]?.name,
      total: model.totals?.total,
      html: pdfBuffer ? undefined : html, // attach PDF when available, else inline HTML invoice
      pdfBuffer
    });
  } catch (error) {
    console.error("Failed to email invoice:", error.message);
  }
}

async function createPortalInvite(order) {
  if (order.payment.status !== "paid") return null;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const customer = order.customer;

  const user = await User.findOneAndUpdate(
    { email: customer.customerEmail },
    {
      $set: {
        name: customer.customerName,
        email: customer.customerEmail,
        phone: customer.customerPhone,
        company: customer.customerCompany || "",
        role: "user",
        status: "invited",
        invite: {
          tokenHash: sha256(rawToken),
          expiresAt,
          sentAt: new Date()
        }
      },
      $setOnInsert: { passwordHash: "" }
    },
    { upsert: true, new: true }
  );

  const crmUrl = process.env.CRM_PUBLIC_URL || "http://localhost:5173";
  const setPasswordUrl = `${crmUrl}/client-secure-onboarding/access-setup?token=${rawToken}`;
  await sendPortalInviteEmail({
    to: user.email,
    name: user.name,
    packageName: order.package.name,
    setPasswordUrl
  });

  order.email.credentialsQueued = false;
  order.workspace.status = "created";
  order.workspace.createdAt = new Date();
  await order.save();

  return { userId: user._id, setPasswordUrl };
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

  const expiryDate = couponExpiryDate(coupon);
  if (expiryDate && expiryDate <= new Date() && ["Active", "Applied", "Not used"].includes(coupon.status)) {
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
    const { email, channel } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "A valid email address is required." });
    }
    if (!OTP_CHANNELS.has(channel)) {
      return res.status(400).json({ message: "Invalid OTP channel." });
    }

    const result = await sendOtp({ email, channel });
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
      await couponResult.coupon.save();
    }
    await createPortalInvite(order);
    const finance = await syncFinanceForOrder(order);
    await emailInvoiceForOrder(order, finance?.invoice);

    res.status(201).json(order);
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
      await couponResult.coupon.save();
    }
    await createPortalInvite(order);
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

async function start() {
  // Connect to whichever backend DB_DRIVER selects (defaults to Supabase).
  if (dbDriver === "mongo") {
    if (!process.env.MONGO_URI) {
      throw new Error("DB_DRIVER=mongo but MONGO_URI is missing. Add it to .env.");
    }
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  } else {
    // Smoke-test Supabase up front so a misconfigured key/schema fails loudly at
    // boot instead of on the first request.
    const { error: pingError } = await supabase.from("users").select("id").limit(1);
    if (pingError) {
      throw new Error(
        `Supabase connection failed: ${pingError.message}. ` +
          "Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY and that the schema has been created."
      );
    }
  }

  if (process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_PASSWORD) {
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
  }

  app.listen(port, () => {
    console.log(`API running at http://localhost:${port} (DB: ${dbDriver})`);
  });
}

start().catch((error) => {
  console.error("Failed to start API:", error.message);
  process.exit(1);
});
