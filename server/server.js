import "dotenv/config";
import cors from "cors";
import crypto from "node:crypto";
import dns from "node:dns";
import express from "express";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import Order from "./models/Order.js";
import { packages } from "./data/packages.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const port = process.env.PORT || 5000;
const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      })
    : null;

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    service: "the-copper-studio-api",
    routes: {
      health: "/api/health",
      packages: "/api/packages",
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

    const { selectedPackageId } = req.body;
    const selectedPackage = packages.find((item) => item.id === selectedPackageId);
    if (!selectedPackage) return res.status(400).json({ message: "Invalid package selected." });

    const total = Math.round(selectedPackage.price * 1.18);
    const razorpayOrder = await razorpay.orders.create({
      amount: total * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        packageId: selectedPackage.id,
        packageName: selectedPackage.name
      }
    });

    res.status(201).json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      package: selectedPackage,
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

    if (!verified?.phone || !verified?.email) {
      return res.status(400).json({ message: "Mobile and email must be verified before order creation." });
    }

    const total = Math.round(selectedPackage.price * 1.18);
    const order = await Order.create({
      package: { ...selectedPackage, total },
      customer,
      verification: {
        phoneVerified: Boolean(verified.phone),
        emailVerified: Boolean(verified.email)
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

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (req, res, next) => {
  try {
    const { selectedPackageId, customer, verified, paymentStatus, paidAt, invoiceId } = req.body;
    const selectedPackage = packages.find((item) => item.id === selectedPackageId);

    if (!selectedPackage) {
      return res.status(400).json({ message: "Invalid package selected." });
    }

    if (!customer?.customerName || !customer?.customerPhone || !customer?.customerEmail) {
      return res.status(400).json({ message: "Customer name, phone, and email are required." });
    }

    if (!verified?.phone || !verified?.email) {
      return res.status(400).json({ message: "Mobile and email must be verified before order creation." });
    }

    const total = Math.round(selectedPackage.price * 1.18);
    const order = await Order.create({
      package: { ...selectedPackage, total },
      customer,
      verification: {
        phoneVerified: Boolean(verified.phone),
        emailVerified: Boolean(verified.email)
      },
      payment: {
        status: paymentStatus === "paid" ? "paid" : "pending",
        provider: "razorpay",
        invoiceId: invoiceId || `INV-${Date.now().toString().slice(-6)}`,
        paidAt: paidAt ? new Date(paidAt) : new Date()
      }
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders/latest", async (_req, res, next) => {
  try {
    const order = await Order.findOne().sort({ createdAt: -1 });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/orders/:id/workspace", async (req, res, next) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          "workspace.status": "created",
          "workspace.createdAt": new Date()
        }
      },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Server error." });
});

async function start() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to .env.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  app.listen(port, () => {
    console.log(`API running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start API:", error.message);
  process.exit(1);
});
