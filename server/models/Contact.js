import mongoose from "mongoose";
import { defineModel } from "../db/defineModel.js";

const schema = new mongoose.Schema(
  {
    id: { type: String, index: true },
    name: { type: String, required: true, trim: true, index: true },
    company: { type: String, trim: true, index: true, default: "" },
    email: { type: String, trim: true, lowercase: true, index: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    department: { type: String, default: "" },
    notes: { type: String, default: "" }
  },
  { timestamps: true, strict: false }
);

export default defineModel({
  name: "Contact",
  table: "contacts",
  schema,
  defaults: {
    company: "",
    email: "",
    phone: "",
    designation: "",
    department: "",
    notes: ""
  }
});
