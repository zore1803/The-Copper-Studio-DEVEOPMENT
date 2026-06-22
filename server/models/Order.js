import mongoose from "mongoose";
import { defineModel } from "../db/defineModel.js";

const customerSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    customerName: { type: String, required: true, trim: true },
    linkedinUrl: { type: String, trim: true, default: "" },
    customerPhone: { type: String, required: true, trim: true },
    customerCountryCode: { type: String, default: "+91" },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    projectName: { type: String, trim: true, default: "" },
    customerCompany: { type: String, trim: true, default: "" },
    companyWebsite: { type: String, trim: true, default: "" },
    companyGstin: { type: String, trim: true, default: "" },
    billingAddressLine1: { type: String, trim: true, default: "" },
    billingAddressLine2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const packageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    label: { type: String, default: "" },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
    duration: { type: String, default: "" },
    includes: [{ type: String }]
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    package: { type: packageSchema, required: true },
    customer: { type: customerSchema, required: true },
    verification: {
      phoneVerified: { type: Boolean, default: false },
      emailVerified: { type: Boolean, default: false }
    },
    payment: {
      status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
      provider: { type: String, default: "razorpay" },
      invoiceId: { type: String, required: true },
      razorpayOrderId: { type: String, default: "" },
      razorpayPaymentId: { type: String, default: "" },
      paidAt: { type: Date }
    },
    email: {
      credentialsQueued: { type: Boolean, default: true },
      invoiceQueued: { type: Boolean, default: true },
      welcomeQueued: { type: Boolean, default: true }
    },
    workspace: {
      status: { type: String, enum: ["pending", "created"], default: "pending" },
      createdAt: { type: Date }
    }
  },
  { timestamps: true }
);

export default defineModel({
  name: "Order",
  table: "orders",
  schema,
  defaults: {
    verification: { phoneVerified: false, emailVerified: false },
    payment: {
      status: "pending",
      provider: "razorpay",
      invoiceId: "",
      razorpayOrderId: "",
      razorpayPaymentId: "",
      paidAt: null
    },
    email: { credentialsQueued: true, invoiceQueued: true, welcomeQueued: true },
    workspace: { status: "pending", createdAt: null }
  }
});
