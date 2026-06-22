import mongoose from "mongoose";
import { defineModel } from "../db/defineModel.js";

const schema = new mongoose.Schema(
  {
    id: { type: String, index: true },
    title: { type: String, required: true, trim: true, index: true },
    project: { type: String, trim: true, index: true, default: "" },
    status: { type: String, default: "Backlog", index: true },
    priority: { type: String, default: "Medium", index: true },
    assignee: { type: String, default: "A" },
    deadline: { type: String, default: "" },
    description: { type: String, default: "" },
    subtasks: { type: Number, default: 0 },
    comments: { type: Number, default: 0 }
  },
  { timestamps: true, strict: false }
);

export default defineModel({
  name: "Task",
  table: "tasks",
  schema,
  defaults: {
    project: "",
    status: "Backlog",
    priority: "Medium",
    assignee: "A",
    deadline: "",
    description: "",
    subtasks: 0,
    comments: 0
  }
});
