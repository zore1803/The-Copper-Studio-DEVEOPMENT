import mongoose from "mongoose";
import { defineModel } from "../db/defineModel.js";

const schema = new mongoose.Schema(
  {
    id: { type: String, index: true },
    paymentId: { type: String, required: true, index: true },
    orderId: { type: String, index: true, default: "" },
    sourceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    company: { type: String, default: "" },
    client: { type: String, default: "" },
    customerEmail: { type: String, trim: true, lowercase: true, default: "", index: true },
    package: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    method: { type: String, default: "Razorpay" },
    paymentMethod: { type: String, default: "Razorpay" },
    gateway: { type: String, default: "Razorpay" },
    status: { type: String, default: "Success", index: true },
    invoiceId: { type: String, default: "", index: true },
    invoiceNumber: { type: String, default: "", index: true },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    paidAt: { type: Date }
  },
  { timestamps: true, strict: false }
);

schema.index({ sourceOrderId: 1 }, { unique: true, sparse: true });

export default defineModel({
  name: "Payment",
  table: "payments",
  schema,
  defaults: {
    orderId: "",
    companyId: null,
    clientId: null,
    company: "",
    client: "",
    customerEmail: "",
    package: "",
    amount: 0,
    currency: "INR",
    method: "Razorpay",
    paymentMethod: "Razorpay",
    gateway: "Razorpay",
    status: "Success",
    invoiceId: "",
    invoiceNumber: "",
    razorpayOrderId: "",
    razorpayPaymentId: ""
  }
});
