import mongoose from "mongoose";
import { defineModel } from "../db/defineModel.js";

// Single workspace-wide settings document — there is only ever one row.
const schema = new mongoose.Schema(
  {
    workspace: {
      publicUrl: { type: String, default: "" }
    },
    company: {
      studioName: { type: String, default: "The Copper Studio" },
      legalName: { type: String, default: "" },
      gstin: { type: String, default: "" },
      billingEmail: { type: String, default: "" },
      website: { type: String, default: "" },
      billingAddress: { type: String, default: "" }
    },
    billing: {
      gateway: { type: String, default: "Razorpay" },
      apiBase: { type: String, default: "" },
      invoicePrefix: { type: String, default: "INV" },
      defaultRole: { type: String, default: "user" },
      autoInviteAfterPayment: { type: Boolean, default: true },
      allowCouponAtCheckout: { type: Boolean, default: true }
    },
    email: {
      senderName: { type: String, default: "The Copper Studio" },
      senderEmail: { type: String, default: "" },
      smtpHost: { type: String, default: "" },
      smtpPort: { type: String, default: "587" },
      onboardingPath: { type: String, default: "/client-secure-onboarding/access-setup" }
    },
    notifications: {
      paymentSuccess: { type: Boolean, default: true },
      failedPayments: { type: Boolean, default: true },
      portalInviteSent: { type: Boolean, default: true },
      overdueInvoices: { type: Boolean, default: true }
    },
    security: {
      inviteExpiry: { type: String, default: "48 hours" },
      otpExpiry: { type: String, default: "10 minutes" }
    }
  },
  { timestamps: true, strict: false }
);

export default defineModel({
  name: "Settings",
  table: "settings",
  schema,
  defaults: {
    workspace: { publicUrl: "" },
    company: {
      studioName: "The Copper Studio",
      legalName: "",
      gstin: "",
      billingEmail: "",
      website: "",
      billingAddress: ""
    },
    billing: {
      gateway: "Razorpay",
      apiBase: "",
      invoicePrefix: "INV",
      defaultRole: "user",
      autoInviteAfterPayment: true,
      allowCouponAtCheckout: true
    },
    email: {
      senderName: "The Copper Studio",
      senderEmail: "",
      smtpHost: "",
      smtpPort: "587",
      onboardingPath: "/client-secure-onboarding/access-setup"
    },
    notifications: {
      paymentSuccess: true,
      failedPayments: true,
      portalInviteSent: true,
      overdueInvoices: true
    },
    security: {
      inviteExpiry: "48 hours",
      otpExpiry: "10 minutes"
    }
  }
});
