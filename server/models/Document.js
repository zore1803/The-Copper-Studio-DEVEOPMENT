import mongoose from "mongoose";
import { defineModel } from "../db/defineModel.js";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fileType: { type: String, default: "pdf" },
    fileSize: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending_review", "approved", "final_delivery", "internal"],
      default: "pending_review"
    },
    scope: {
      type: String,
      enum: ["client_shared", "internal"],
      default: "client_shared"
    },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    uploadedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedByName: { type: String, default: "The Copper Studio" },
    version: { type: String, default: "1.0" },
    feedback: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: { type: String },
        comment: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true, strict: false }
);

export default defineModel({
  name: "Document",
  table: "documents",
  schema,
  defaults: {
    fileType: "pdf",
    fileSize: "",
    fileUrl: "",
    status: "pending_review",
    scope: "client_shared",
    companyId: null,
    clientId: null,
    uploadedByName: "The Copper Studio",
    version: "1.0",
    feedback: []
  }
});
