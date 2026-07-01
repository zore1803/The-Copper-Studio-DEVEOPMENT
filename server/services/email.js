import sgMail from "@sendgrid/mail";
import Settings from "../models/Settings.js";
import EmailTemplate from "../models/EmailTemplate.js";
import { seller, signatory } from "../data/sellerConfig.js";

// Email signature block. The signature image uses mix-blend-mode:multiply so a
// white background drops out against the white email body (supported clients);
// where it isn't supported, a white-on-white image is still effectively invisible.
function signatureHtml() {
  const img = signatory.image
    ? `<img src="${signatory.image}" alt="${signatory.name}" style="display:block;max-height:56px;max-width:200px;object-fit:contain;mix-blend-mode:multiply;margin:0 0 4px" />`
    : "";
  return `
    <div style="margin-top:26px;border-top:1px solid #e5e7eb;padding-top:14px;font-family:Inter,Arial,sans-serif;color:#111827">
      ${img}
      <p style="margin:0;font-weight:700">${signatory.name}${signatory.title ? `, ${signatory.title}` : ""}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#6b7280">${seller.legalName}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#6b7280">${seller.email} &nbsp;·&nbsp; ${seller.mobile}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#6b7280">${seller.website}</p>
    </div>`;
}

function clean(value) {
  return String(value || "").trim();
}

async function getMailConfig() {
  let settingsEmail = {};
  try {
    const settings = await Settings.findOne({});
    settingsEmail = settings?.email || {};
  } catch {
    // Email should still work from .env even if the settings row is unavailable.
  }

  const fromEmail = clean(process.env.MAIL_FROM_EMAIL || settingsEmail.senderEmail);
  const fromName = clean(process.env.MAIL_FROM_NAME || settingsEmail.senderName || "The Copper Studio");
  const apiKey = clean(process.env.SENDGRID_API_KEY);

  return { fromEmail, fromName, apiKey };
}

async function sendMail(message) {
  const config = await getMailConfig();

  if (!config.apiKey || !config.fromEmail) {
    const missing = [!config.apiKey && "SENDGRID_API_KEY", !config.fromEmail && "MAIL_FROM_EMAIL"].filter(Boolean).join(", ");
    console.warn(`SendGrid is not configured. Email skipped: ${message.subject}. Missing: ${missing}`);
    return { skipped: true, reason: "sendgrid_not_configured", missing };
  }

  sgMail.setApiKey(config.apiKey);
  const { to, subject, html, attachments } = message;

  try {
    await sgMail.send({
      to,
      from: { email: config.fromEmail, name: config.fromName },
      subject,
      html,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        type: attachment.contentType,
        // SendGrid needs base64. Normalize Buffers/Uint8Arrays (Puppeteer v23+
        // returns a Uint8Array) to base64; pass through already-encoded strings.
        content:
          typeof attachment.content === "string"
            ? attachment.content
            : Buffer.from(attachment.content).toString("base64"),
        disposition: "attachment"
      }))
    });
    return { skipped: false, provider: "sendgrid" };
  } catch (error) {
    console.error("SendGrid delivery failed:", error.response?.body || error.message);
    const deliveryError = new Error("Email delivery failed via SendGrid. Check SENDGRID_API_KEY and that MAIL_FROM_EMAIL is a verified sender identity.");
    deliveryError.statusCode = 502;
    throw deliveryError;
  }
}

// Replace {{variable}} tokens in a string with the given vars map.
function interpolate(text = "", vars = {}) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// Convert a JSON block array → HTML (mirrors the frontend blocksToHtml).
function blocksToHtml(blocks) {
  return blocks.map((b) => {
    const t = b.text || "";
    switch (b.type) {
      case "heading": return `<h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">${t}</h2>`;
      case "muted": return `<p style="margin:0 0 12px;font-size:13px;color:#6b7280">${t}</p>`;
      case "button": return `<p style="margin:16px 0"><a href="${b.href || "#"}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">${t}</a></p>`;
      case "otp": return `<p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:18px 0;color:#2563eb">${t}</p>`;
      case "box": return `<div style="margin:16px 0;padding:14px 16px;border:1px solid #fde2d6;background:#fff8f6;border-radius:12px">${b.title ? `<p style="margin:0 0 6px;font-weight:700;color:#884c2d">${b.title}</p>` : ""}<p style="margin:0;font-size:14px;color:#525866">${t}</p></div>`;
      case "divider": return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">`;
      default: return `<p style="margin:0 0 12px">${t.replace(/\n/g, "<br>")}</p>`;
    }
  }).join("\n");
}

// Convert any body format (JSON blocks | legacy HTML | plain text) → HTML.
function bodyAnyToHtml(body = "") {
  const s = body.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    try { return blocksToHtml(JSON.parse(s)); } catch { /* fall through */ }
  }
  if (/<[a-z][\s\S]*>/i.test(s)) return s;
  return s.split(/\n\n+/).map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`).join("\n");
}

// Look up an Active (or any) EmailTemplate by category, apply variable
// substitution, and return { subject, html }. Returns null if no template found.
async function resolveEmailTemplate(category, vars = {}) {
  try {
    const tpl = await EmailTemplate.findOne({ category, status: "Active" })
      || await EmailTemplate.findOne({ category });
    if (!tpl || !tpl.body) return null;
    const bodyHtml = bodyAnyToHtml(interpolate(tpl.body, vars));
    return {
      subject: interpolate(tpl.subject || category, vars),
      html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">${bodyHtml}${signatureHtml()}</div>`,
    };
  } catch {
    return null;
  }
}

function portalInviteCopy(packageName) {
  if (packageName) {
    return `Your payment for <strong>${packageName}</strong> is complete. Please set your password to access your client portal.`;
  }
  return "Your client portal is ready. Please set your password to access your workspace.";
}

export async function sendPortalInviteEmail({ to, name, setPasswordUrl, packageName }) {
  const vars = { client_name: name || "", company_name: packageName || "", portal_link: setPasswordUrl || "" };
  const resolved = await resolveEmailTemplate("Welcome", vars);
  if (resolved) {
    return sendMail({ to, subject: resolved.subject, html: resolved.html });
  }
  // Fallback to hardcoded
  return sendMail({
    to,
    subject: "Your DataCircles CRM portal is ready",
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Welcome${name ? `, ${name}` : ""}</h2>
        <p>${portalInviteCopy(packageName)}</p>
        <p><a href="${setPasswordUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 16px;border-radius:10px;text-decoration:none;font-weight:700">Set password</a></p>
        <p style="font-size:13px;color:#6b7280">This secure link expires in 48 hours.</p>
      </div>
    `
  });
}

export async function sendInvoiceEmail({ to, name, invoiceNumber, packageName, total, pdfBuffer }) {
  const amount = typeof total === "number"
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(total)
    : total;

  const vars = {
    client_name: name || "",
    company_name: packageName || "",
    invoice_id: invoiceNumber || "",
    payment_amount: amount || "",
  };

  const resolved = await resolveEmailTemplate("Invoice Generated", vars)
    || await resolveEmailTemplate("Payment Success", vars);

  const attachments = pdfBuffer
    ? [{ filename: `${String(invoiceNumber || "invoice").replace(/[^a-z0-9-]/gi, "-")}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
    : undefined;

  if (resolved) {
    return sendMail({ to, subject: resolved.subject, html: resolved.html, attachments });
  }

  // Fallback to hardcoded
  const invoiceLine = pdfBuffer
    ? `Please find your tax invoice <strong>${invoiceNumber}</strong>${amount ? ` for <strong>${amount}</strong>` : ""} attached to this email as a PDF.`
    : `Your tax invoice <strong>${invoiceNumber}</strong>${amount ? ` for <strong>${amount}</strong>` : ""} is available to download from your client portal.`;

  return sendMail({
    to,
    subject: `Payment successful — Invoice ${invoiceNumber} | The Copper Studio`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Payment Successful${name ? `, ${name}` : ""} 🎉</h2>
        <p>Your payment${packageName ? ` for <strong>${packageName}</strong>` : ""} has been received successfully.</p>
        <p>${invoiceLine}</p>
        <p style="font-size:13px;color:#6b7280">This is a computer-generated invoice. No further amount is due against it.</p>
        ${signatureHtml()}
      </div>
    `,
    attachments,
  });
}

export async function sendPaymentCancelledEmail({ to, name, packageName, amount, reason, razorpayOrderId, razorpayPaymentId }) {
  const formattedAmount = typeof amount === "number" && Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
    : amount;

  const vars = { client_name: name || "", company_name: packageName || "", payment_amount: formattedAmount || "" };
  const resolved = await resolveEmailTemplate("Payment Cancelled", vars);
  if (resolved) return sendMail({ to, subject: resolved.subject, html: resolved.html });
  const referenceRows = [
    packageName && `<strong>Package:</strong> ${packageName}`,
    formattedAmount && `<strong>Amount attempted:</strong> ${formattedAmount}`,
    razorpayOrderId && `<strong>Razorpay order:</strong> ${razorpayOrderId}`,
    razorpayPaymentId && `<strong>Payment reference:</strong> ${razorpayPaymentId}`,
    reason && `<strong>Reason:</strong> ${reason}`,
  ].filter(Boolean);

  return sendMail({
    to,
    subject: "Payment not completed | The Copper Studio",
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Payment Not Completed${name ? `, ${name}` : ""}</h2>
        <p>Your payment${packageName ? ` for <strong>${packageName}</strong>` : ""} was cancelled or could not be completed successfully.</p>
        <p>No successful order has been created from this payment attempt.</p>
        <div style="margin:16px 0;padding:14px 16px;border:1px solid #fde2d6;background:#fff8f6;border-radius:12px">
          <p style="margin:0;font-weight:700;color:#884c2d">If money was deducted</p>
          <p style="margin:6px 0 0;font-size:14px;color:#525866">Any deducted amount is usually reversed by Razorpay or your bank within a few working days. Please do not make a duplicate payment if your bank shows a debit and contact support with the payment reference.</p>
        </div>
        ${referenceRows.length ? `<p style="font-size:13px;color:#6b7280">${referenceRows.join("<br/>")}</p>` : ""}
        ${signatureHtml()}
      </div>
    `
  });
}

export async function sendOtpEmail({ to, code, label }) {
  return sendMail({
    to,
    subject: `Your ${label || "verification"} code — The Copper Studio`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Verify your ${label || "details"}</h2>
        <p>Use this code to complete checkout on The Copper Studio:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:18px 0;color:#2563eb">${code}</p>
        <p style="font-size:13px;color:#6b7280">This code expires in 10 minutes. Ignore this email if you did not request it.</p>
      </div>
    `
  });
}

export async function sendContactCreatedEmail({ name, email, phone, company }) {
  const to = clean(process.env.CONTACT_NOTIFY_EMAIL || process.env.SUPERADMIN_EMAIL);
  if (!to) return { skipped: true, reason: "no_notify_recipient" };

  return sendMail({
    to,
    subject: `New contact added${company ? `: ${company}` : ""}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">New contact added</h2>
        <p><strong>${name || "Unnamed contact"}</strong>${company ? ` at <strong>${company}</strong>` : ""} was just added to the CRM.</p>
        <p style="font-size:13px;color:#6b7280">
          ${email ? `Email: ${email}<br/>` : ""}
          ${phone ? `Phone: ${phone}` : ""}
        </p>
      </div>
    `
  });
}

export async function sendForgotPasswordOtpEmail({ to, name, otp }) {
  return sendMail({
    to,
    subject: "Your DataCircles password reset OTP",
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
        <h2 style="margin:0 0 12px">Password reset request</h2>
        <p>Hello${name ? ` ${name}` : ""}, use this OTP to reset your CRM password:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:18px 0;color:#2563eb">${otp}</p>
        <p style="font-size:13px;color:#6b7280">This OTP expires in 10 minutes. Ignore this email if you did not request it.</p>
      </div>
    `
  });
}
