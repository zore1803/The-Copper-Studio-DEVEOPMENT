import mongoose from "mongoose";
import { defineModel } from "../db/defineModel.js";

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    generatedAt: { type: String, default: "" },
    validity: { type: String, default: "" },
    validUntil: { type: Date, index: true },
    amountType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    amount: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Applied", "Redeemed", "Not used", "Expired", "Cancelled", "Revoked", "Active", "Draft"],
      default: "Not used",
      index: true
    },
    clientName: { type: String, default: "" },
    companyName: { type: String, default: "", index: true },
    email: { type: String, lowercase: true, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    packageName: { type: String, default: "" },
    redeemedAt: { type: Date },
    revokedAt: { type: Date }
  },
  { timestamps: true, strict: false }
);

export default defineModel({
  name: "Coupon",
  table: "coupons",
  schema,
  defaults: {
    generatedAt: "",
    validity: "",
    validUntil: null,
    amountType: "percentage",
    amount: "",
    status: "Not used",
    clientName: "",
    companyName: "",
    email: "",
    phone: "",
    packageName: ""
  }
});
