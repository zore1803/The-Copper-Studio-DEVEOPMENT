import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    customerCompany: { type: String, trim: true, default: "" }
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

const orderSchema = new mongoose.Schema(
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

export default mongoose.model("Order", orderSchema);
