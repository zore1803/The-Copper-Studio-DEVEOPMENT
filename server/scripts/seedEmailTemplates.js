import EmailTemplate from "../models/EmailTemplate.js";

const DEFAULT_EMAIL_TEMPLATES = [
  {
    category: "Welcome",
    name: "Welcome to The Copper Studio",
    subject: "Welcome aboard, {{client_name}}!",
    body: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
  <h2 style="margin:0 0 12px">Welcome, {{client_name}}</h2>
  <p>Your payment for <strong>{{company_name}}</strong> is complete. Please set your password to access your client portal.</p>
  <p>
    <a href="{{portal_link}}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 16px;border-radius:10px;text-decoration:none;font-weight:700">
      Set password
    </a>
  </p>
  <p style="font-size:13px;color:#6b7280">This secure link expires in 48 hours.</p>
</div>`,
  },
  {
    category: "OTP",
    name: "OTP Verification",
    subject: "Your {{label}} code — The Copper Studio",
    body: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
  <h2 style="margin:0 0 12px">Verify your {{label}}</h2>
  <p>Use this code to complete your request on The Copper Studio:</p>
  <p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:18px 0;color:#2563eb">{{coupon_code}}</p>
  <p style="font-size:13px;color:#6b7280">This code expires in 10 minutes. Ignore this email if you did not request it.</p>
</div>`,
  },
  {
    category: "Consultation Booked",
    name: "Consultation Confirmation",
    subject: "Your consultation is confirmed, {{client_name}}",
    body: "Hi {{client_name}},\n\nThanks for booking a consultation with us. We've confirmed your slot and look forward to discussing {{company_name}}'s goals.\n\nWe'll send a calendar invite with the meeting link shortly.\n\nSee you soon,\nThe Copper Studio Team",
  },
  {
    category: "Proposal Sent",
    name: "Proposal Delivered",
    subject: "Your proposal {{proposal_id}} is ready",
    body: "Hi {{client_name}},\n\nWe've prepared proposal {{proposal_id}} for {{company_name}}. Please review it at your convenience and let us know if you have any questions.\n\nLooking forward to working with you,\nThe Copper Studio Team",
  },
  {
    category: "Proposal Reminder",
    name: "Proposal Follow-up",
    subject: "Following up on proposal {{proposal_id}}",
    body: "Hi {{client_name}},\n\nJust a friendly reminder about proposal {{proposal_id}} we sent over for {{company_name}}. Let us know if you'd like to discuss any part of it or move forward.\n\nBest,\nThe Copper Studio Team",
  },
  {
    category: "Coupon Issued",
    name: "Coupon Code Issued",
    subject: "Here's your coupon code, {{client_name}}",
    body: "Hi {{client_name}},\n\nAs promised, here's your coupon code: {{coupon_code}}. Apply it at checkout to redeem your discount.\n\nThanks for choosing The Copper Studio,\nThe Copper Studio Team",
  },
  {
    category: "Payment Success",
    name: "Payment Received",
    subject: "Payment received - thank you, {{client_name}}",
    body: "Hi {{client_name}},\n\nWe've received your payment of {{payment_amount}}. Thank you! A receipt will follow shortly.\n\nBest,\nThe Copper Studio Team",
  },
  {
    category: "Payment Cancelled",
    name: "Payment Not Completed",
    subject: "Payment not completed | The Copper Studio",
    body: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
  <h2 style="margin:0 0 12px">Payment Not Completed, {{client_name}}</h2>
  <p>Your payment for <strong>{{company_name}}</strong> was cancelled or could not be completed successfully.</p>
  <p>No successful order has been created from this payment attempt.</p>
  <div style="margin:16px 0;padding:14px 16px;border:1px solid #fde2d6;background:#fff8f6;border-radius:12px">
    <p style="margin:0;font-weight:700;color:#884c2d">If money was deducted</p>
    <p style="margin:6px 0 0;font-size:14px;color:#525866">Any deducted amount is usually reversed by Razorpay or your bank within a few working days. Please do not make a duplicate payment if your bank shows a debit — contact support with the payment reference.</p>
  </div>
</div>`,
  },
  {
    category: "Invoice Generated",
    name: "Payment Successful — Invoice",
    subject: "Payment successful — Invoice {{invoice_id}} | The Copper Studio",
    body: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
  <h2 style="margin:0 0 12px">Payment Successful, {{client_name}} 🎉</h2>
  <p>Your payment for <strong>{{company_name}}</strong> has been received successfully.</p>
  <p>Please find your tax invoice <strong>{{invoice_id}}</strong> for <strong>{{payment_amount}}</strong> attached to this email as a PDF.</p>
  <p style="font-size:13px;color:#6b7280">This is a computer-generated invoice. No further amount is due against it.</p>
</div>`,
  },
  {
    category: "Project Started",
    name: "Project Kickoff",
    subject: "{{project_name}} has officially started",
    body: "Hi {{client_name}},\n\nGreat news - {{project_name}} is now underway! We'll keep you posted as we hit each milestone.\n\nExcited to get started,\nThe Copper Studio Team",
  },
  {
    category: "Project Update",
    name: "Project Status Update",
    subject: "Update on {{project_name}}",
    body: "Hi {{client_name}},\n\nHere's a quick update on {{project_name}}: current status is {{project_status}}.\n\nReach out if you have any questions.\n\nBest,\nThe Copper Studio Team",
  },
  {
    category: "Testing Started",
    name: "Testing Phase Started",
    subject: "{{project_name}} has entered testing",
    body: "Hi {{client_name}},\n\n{{project_name}} has moved into the testing phase. We'll share results and next steps soon.\n\nThanks for your patience,\nThe Copper Studio Team",
  },
  {
    category: "Project Delivered",
    name: "Project Delivered",
    subject: "{{project_name}} is complete!",
    body: "Hi {{client_name}},\n\nWe're excited to let you know that {{project_name}} has been delivered. Thank you for trusting The Copper Studio with this project.\n\nWarm regards,\nThe Copper Studio Team",
  },
  {
    category: "Support Follow-up",
    name: "Support Follow-up",
    subject: "Checking in, {{client_name}}",
    body: "Hi {{client_name}},\n\nJust checking in to see how things are going with {{company_name}}. Let us know if you need any support or have questions.\n\nBest,\nThe Copper Studio Team",
  },
];

// Inserts missing default email templates and upgrades any that were previously
// seeded with plain-text bodies but now have a proper HTML body in the defaults.
// Never overwrites a template the admin has manually edited (body won't match seed).
export async function seedEmailTemplates() {
  const existing = await EmailTemplate.find({}).lean();
  const existingByCategory = Object.fromEntries(existing.map((t) => [t.category, t]));

  let inserted = 0;
  let upgraded = 0;

  for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
    const seedId = `email-template-seed-${tpl.category.replace(/\s+/g, "-").toLowerCase()}`;
    const existing = existingByCategory[tpl.category];

    if (!existing) {
      await EmailTemplate.create({ ...tpl, id: seedId, status: "Active" });
      inserted++;
    } else if (existing.id === seedId && existing.body !== tpl.body) {
      // Only upgrade if this record was originally seeded by us (same id prefix)
      await EmailTemplate.updateOne({ _id: existing._id }, { $set: { body: tpl.body, subject: tpl.subject, name: tpl.name } });
      upgraded++;
    }
  }

  if (inserted || upgraded) {
    console.log(`Email templates: ${inserted} inserted, ${upgraded} upgraded.`);
  }
}

