import crypto from "node:crypto";
import { sendOtpEmail } from "./email.js";
import { sendSmsOtp, supportsSms } from "./sms.js";

/**
 * OTP verification for the public checkout.
 *
 * Codes are stored in memory (single-instance deployment), hashed, time-limited,
 * and attempt-capped. Each (email, channel) pair has its own code. The "email"
 * channel is always emailed; the "phone" channel is sent as a real SMS via
 * Fast2SMS for +91 numbers (the only route Fast2SMS reliably delivers), and
 * falls back to email for any other country code or if Fast2SMS isn't configured.
 */

const store = new Map(); // `${email}:${channel}` -> { codeHash, expiresAt, attempts, verified }
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function keyFor(email, channel) {
  return `${String(email || "").trim().toLowerCase()}:${channel}`;
}

function hash(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function sweep() {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  for (const [k, entry] of store) {
    if (entry.expiresAt <= now) store.delete(k);
  }
  lastSweep = now;
}

const CHANNEL_LABEL = {
  email: "email verification",
  phone: "mobile verification",
};

/**
 * Generate + deliver a fresh OTP for (email, channel).
 * @returns {Promise<{ sent: boolean, devCode?: string, via?: "sms"|"email" }>}
 */
export async function sendOtp({ email, channel, phone, dialCode }) {
  sweep();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  store.set(keyFor(email, channel), {
    codeHash: hash(code),
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
    verified: false,
  });

  let result;
  let via = "email";
  if (channel === "phone" && supportsSms(dialCode)) {
    via = "sms";
    result = await sendSmsOtp({ phone, code });
  } else {
    result = await sendOtpEmail({ to: email, code, label: CHANNEL_LABEL[channel] || "verification" });
  }
  const sent = !result?.skipped;

  // When the provider isn't configured, surface the code only outside
  // production so the flow remains testable locally. Never leak it in production.
  const devCode = !sent && process.env.NODE_ENV !== "production" ? code : undefined;
  return { sent, devCode, via };
}

/**
 * Verify a submitted code. Only the exact code that was last sent passes;
 * any other value fails.
 */
export function verifyOtp({ email, channel, code }) {
  const k = keyFor(email, channel);
  const entry = store.get(k);
  if (!entry) return { ok: false, message: "No code was requested. Please click Send OTP first." };
  if (Date.now() > entry.expiresAt) {
    store.delete(k);
    return { ok: false, message: "This code has expired. Please request a new one." };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(k);
    return { ok: false, message: "Too many incorrect attempts. Please request a new code." };
  }
  entry.attempts += 1;
  if (entry.codeHash !== hash(code)) {
    return { ok: false, message: "Incorrect code. Please check the email and try again." };
  }
  entry.verified = true;
  return { ok: true };
}

/** Whether (email, channel) has a still-valid, verified code. */
export function isVerified({ email, channel }) {
  const entry = store.get(keyFor(email, channel));
  return Boolean(entry && entry.verified && entry.expiresAt > Date.now());
}

export default { sendOtp, verifyOtp, isVerified };
