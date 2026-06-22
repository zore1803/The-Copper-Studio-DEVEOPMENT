import mongoose from "mongoose";
import { defineModel } from "../db/defineModel.js";

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, default: "discovery_session" },
    status: {
      type: String,
      enum: ["requested", "confirmed", "completed", "cancelled"],
      default: "requested"
    },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    preferredDate: { type: Date },
    preferredTime: { type: String, default: "" },
    scheduledAt: { type: Date },
    duration: { type: Number, default: 45 },
    meetingLink: { type: String, default: "" },
    agenda: { type: String, default: "" },
    notes: { type: String, default: "" },
    calendlyEventUri: { type: String, default: "", index: true },
    participants: [
      {
        name: { type: String },
        email: { type: String },
        initials: { type: String }
      }
    ]
  },
  { timestamps: true, strict: false }
);

export default defineModel({
  name: "Meeting",
  table: "meetings",
  schema,
  defaults: {
    type: "discovery_session",
    status: "requested",
    clientId: null,
    companyId: null,
    preferredTime: "",
    duration: 45,
    meetingLink: "",
    agenda: "",
    notes: "",
    calendlyEventUri: "",
    participants: []
  }
});
