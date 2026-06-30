import bcrypt from "bcryptjs";
import express from "express";
import User from "../models/User.js";
import Settings from "../models/Settings.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireRole("superadmin"));

// Workspace settings are a single shared document — fetch it, creating it on
// first use so every section always has a row to update against.
async function getSingleton() {
  const existing = await Settings.findOne({});
  if (existing) return existing;
  return Settings.create({});
}

router.get("/", async (req, res, next) => {
  try {
    const [user, settings] = await Promise.all([
      User.findById(req.auth.sub).select("-passwordHash -invite -resetPassword"),
      getSingleton()
    ]);
    if (!user) return res.status(404).json({ message: "Admin user not found." });

    res.json({
      profile: {
        fullName: user.name,
        email: user.email,
        phone: user.phone || "",
        title: user.jobTitle || "",
        timezone: user.preferences?.timezone || "Asia/Kolkata",
        publicUrl: settings.workspace?.publicUrl || ""
      },
      company: settings.company,
      billing: settings.billing,
      email: settings.email,
      notifications: settings.notifications,
      security: settings.security
    });
  } catch (error) {
    next(error);
  }
});

router.put("/workspace", async (req, res, next) => {
  try {
    const { publicUrl = "" } = req.body;
    await Settings.findOneAndUpdate({}, { $set: { workspace: { publicUrl } } }, { upsert: true, new: true });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.put("/company", async (req, res, next) => {
  try {
    const { studioName = "", legalName = "", gstin = "", billingEmail = "", website = "", billingAddress = "" } = req.body;
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { company: { studioName, legalName, gstin, billingEmail, website, billingAddress } } },
      { upsert: true, new: true }
    );
    res.json({ company: settings.company });
  } catch (error) {
    next(error);
  }
});

router.put("/billing", async (req, res, next) => {
  try {
    const {
      gateway = "Razorpay", apiBase = "", invoicePrefix = "INV",
      defaultRole = "user", autoInviteAfterPayment = true, allowCouponAtCheckout = true
    } = req.body;
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { billing: { gateway, apiBase, invoicePrefix, defaultRole, autoInviteAfterPayment, allowCouponAtCheckout } } },
      { upsert: true, new: true }
    );
    res.json({ billing: settings.billing });
  } catch (error) {
    next(error);
  }
});

router.put("/email", async (req, res, next) => {
  try {
    const {
      senderName = "", senderEmail = "",
      onboardingPath = "/client-secure-onboarding/access-setup"
    } = req.body;
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { email: { senderName, senderEmail, onboardingPath } } },
      { upsert: true, new: true }
    );
    res.json({ email: settings.email });
  } catch (error) {
    next(error);
  }
});

router.put("/notifications", async (req, res, next) => {
  try {
    const {
      paymentSuccess = true, failedPayments = true,
      portalInviteSent = true, overdueInvoices = true
    } = req.body;
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { notifications: { paymentSuccess, failedPayments, portalInviteSent, overdueInvoices } } },
      { upsert: true, new: true }
    );
    res.json({ notifications: settings.notifications });
  } catch (error) {
    next(error);
  }
});

router.put("/security", async (req, res, next) => {
  try {
    const { inviteExpiry = "48 hours", otpExpiry = "10 minutes" } = req.body;
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { security: { inviteExpiry, otpExpiry } } },
      { upsert: true, new: true }
    );
    res.json({ security: settings.security });
  } catch (error) {
    next(error);
  }
});

// Re-confirms the admin's password before unlocking the Security &
// Integrations tab — doesn't change anything, just gates access to the
// credential-bearing fields for that session.
router.post("/verify-password", async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: "Enter your password to continue." });

    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(404).json({ message: "Admin user not found." });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ message: "Incorrect password." });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
