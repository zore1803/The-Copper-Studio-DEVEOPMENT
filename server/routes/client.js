import bcrypt from "bcryptjs";
import express from "express";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Project from "../models/Project.js";
import Document from "../models/Document.js";
import Meeting from "../models/Meeting.js";
import Task from "../models/Task.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    company: user.company || "",
    jobTitle: user.jobTitle || "",
    role: user.role,
    status: user.status,
    preferences: user.preferences || {}
  };
}

router.get("/profile", async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.put("/profile", async (req, res, next) => {
  try {
    const { name, phone, company, jobTitle, preferences } = req.body;
    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (company !== undefined) user.company = company.trim();
    if (jobTitle !== undefined) user.jobTitle = jobTitle.trim();
    if (preferences && typeof preferences === "object") {
      user.preferences = { ...(user.preferences || {}), ...preferences };
    }
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.put("/change-password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Current password and a new 8+ character password are required." });
    }
    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(404).json({ message: "User not found." });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect." });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(404).json({ message: "User not found." });
    const orders = await Order.find({ "customer.customerEmail": user.email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get("/projects", async (req, res, next) => {
  try {
    const projects = await Project.find({ clientId: req.auth.sub }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/tasks", async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, clientId: req.auth.sub });
    if (!project) return res.status(404).json({ message: "Project not found." });

    const projectIds = [String(project._id), project.id].filter(Boolean);
    const tasks = await Task.find({
      $or: [{ projectId: { $in: projectIds } }, { project: { $in: projectIds } }]
    }).sort({ startDate: 1, createdAt: 1 });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get("/documents", async (req, res, next) => {
  try {
    const docs = await Document.find({
      clientId: req.auth.sub,
      scope: { $ne: "internal" }
    }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    next(error);
  }
});

router.get("/meetings", async (req, res, next) => {
  try {
    const meetings = await Meeting.find({ clientId: req.auth.sub }).sort({ createdAt: -1 });
    res.json(meetings);
  } catch (error) {
    next(error);
  }
});

router.post("/meetings", async (req, res, next) => {
  try {
    const { title, type, preferredDate, preferredTime, agenda, projectId } = req.body;
    if (!title) return res.status(400).json({ message: "Meeting title is required." });

    const meeting = await Meeting.create({
      title,
      type: type || "discovery_session",
      clientId: req.auth.sub,
      projectId: projectId || undefined,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
      preferredTime: preferredTime || "",
      agenda: agenda || "",
      status: "requested"
    });
    res.status(201).json(meeting);
  } catch (error) {
    next(error);
  }
});

export default router;
