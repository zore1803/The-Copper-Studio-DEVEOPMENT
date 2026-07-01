import EmailTemplate from "../models/EmailTemplate.js";

const j = (blocks) => JSON.stringify(blocks, null, 2);

const DEFAULT_EMAIL_TEMPLATES = [
  {
    category: "Welcome",
    name: "Welcome to The Copper Studio",
    subject: "Welcome aboard, {{client_name}}!",
    body: j([
      { type: "heading", text: "Welcome, {{client_name}}" },
      { type: "p", text: "Your payment for {{company_name}} is complete. Please set your password to access your client portal." },
      { type: "button", text: "Set password", href: "{{portal_link}}" },
      { type: "muted", text: "This secure link expires in 48 hours." },
    ]),
  },
  {
    category: "OTP",
    name: "OTP Verification",
    subject: "Your verification code — The Copper Studio",
    body: j([
      { type: "heading", text: "Verify your details" },
      { type: "p", text: "Use this code to complete your request on The Copper Studio:" },
      { type: "otp", text: "{{coupon_code}}" },
      { type: "muted", text: "This code expires in 10 minutes. Ignore this email if you did not request it." },
    ]),
  },
  {
    category: "Consultation Booked",
    name: "Consultation Confirmation",
    subject: "Your consultation is confirmed, {{client_name}}",
    body: j([
      { type: "heading", text: "Consultation Confirmed" },
      { type: "p", text: "Hi {{client_name}}, thanks for booking a consultation with us. We've confirmed your slot and look forward to discussing {{company_name}}'s goals." },
      { type: "p", text: "We'll send a calendar invite with the meeting link shortly." },
      { type: "p", text: "See you soon,\nThe Copper Studio Team" },
    ]),
  },
  {
    category: "Proposal Sent",
    name: "Proposal Delivered",
    subject: "Your proposal {{proposal_id}} is ready",
    body: j([
      { type: "heading", text: "Your Proposal is Ready" },
      { type: "p", text: "Hi {{client_name}}, we've prepared proposal {{proposal_id}} for {{company_name}}. Please review it at your convenience and let us know if you have any questions." },
      { type: "p", text: "Looking forward to working with you,\nThe Copper Studio Team" },
    ]),
  },
  {
    category: "Proposal Reminder",
    name: "Proposal Follow-up",
    subject: "Following up on proposal {{proposal_id}}",
    body: j([
      { type: "heading", text: "Proposal Follow-up" },
      { type: "p", text: "Hi {{client_name}}, just a friendly reminder about proposal {{proposal_id}} we sent over for {{company_name}}. Let us know if you'd like to discuss any part of it or move forward." },
      { type: "p", text: "Best,\nThe Copper Studio Team" },
    ]),
  },
  {
    category: "Coupon Issued",
    name: "Coupon Code Issued",
    subject: "Here's your coupon code, {{client_name}}",
    body: j([
      { type: "heading", text: "Your Coupon Code" },
      { type: "p", text: "Hi {{client_name}}, as promised, here's your coupon code:" },
      { type: "otp", text: "{{coupon_code}}" },
      { type: "p", text: "Apply it at checkout to redeem your discount." },
      { type: "p", text: "Thanks for choosing The Copper Studio,\nThe Copper Studio Team" },
    ]),
  },
  {
    category: "Payment Success",
    name: "Payment Received",
    subject: "Payment received — thank you, {{client_name}}",
    body: j([
      { type: "heading", text: "Payment Received 🎉" },
      { type: "p", text: "Hi {{client_name}}, we've received your payment of {{payment_amount}}. Thank you!" },
      { type: "p", text: "A receipt will follow shortly." },
      { type: "p", text: "Best,\nThe Copper Studio Team" },
    ]),
  },
  {
    category: "Payment Cancelled",
    name: "Payment Not Completed",
    subject: "Payment not completed | The Copper Studio",
    body: j([
      { type: "heading", text: "Payment Not Completed" },
      { type: "p", text: "Hi {{client_name}}, your payment for {{company_name}} was cancelled or could not be completed successfully." },
      { type: "p", text: "No successful order has been created from this payment attempt." },
      { type: "box", title: "If money was deducted", text: "Any deducted amount is usually reversed by Razorpay or your bank within a few working days. Please do not make a duplicate payment if your bank shows a debit — contact support with the payment reference." },
    ]),
  },
  {
    category: "Invoice Generated",
    name: "Payment Successful — Invoice",
    subject: "Payment successful — Invoice {{invoice_id}} | The Copper Studio",
    body: j([
      { type: "heading", text: "Payment Successful, {{client_name}} 🎉" },
      { type: "p", text: "Your payment for {{company_name}} has been received successfully." },
      { type: "p", text: "Please find your tax invoice {{invoice_id}} for {{payment_amount}} attached to this email as a PDF." },
      { type: "muted", text: "This is a computer-generated invoice. No further amount is due against it." },
    ]),
  },
  {
    category: "Project Started",
    name: "Project Kickoff",
    subject: "{{project_name}} has officially started",
    body: j([
      { type: "heading", text: "Project Started 🚀" },
      { type: "p", text: "Hi {{client_name}}, great news — {{project_name}} is now underway! We'll keep you posted as we hit each milestone." },
      { type: "p", text: "Excited to get started,\nThe Copper Studio Team" },
    ]),
  },
  {
    category: "Project Update",
    name: "Project Status Update",
    subject: "Update on {{project_name}}",
    body: j([
      { type: "heading", text: "Project Update" },
      { type: "p", text: "Hi {{client_name}}, here's a quick update on {{project_name}}: current status is {{project_status}}." },
      { type: "p", text: "Reach out if you have any questions.\n\nBest,\nThe Copper Studio Team" },
    ]),
  },
  {
    category: "Testing Started",
    name: "Testing Phase Started",
    subject: "{{project_name}} has entered testing",
    body: j([
      { type: "heading", text: "Testing Has Begun" },
      { type: "p", text: "Hi {{client_name}}, {{project_name}} has moved into the testing phase. We'll share results and next steps soon." },
      { type: "p", text: "Thanks for your patience,\nThe Copper Studio Team" },
    ]),
  },
  {
    category: "Project Delivered",
    name: "Project Delivered",
    subject: "{{project_name}} is complete!",
    body: j([
      { type: "heading", text: "Project Delivered ✅" },
      { type: "p", text: "Hi {{client_name}}, we're excited to let you know that {{project_name}} has been delivered. Thank you for trusting The Copper Studio with this project." },
      { type: "p", text: "Warm regards,\nThe Copper Studio Team" },
    ]),
  },
  {
    category: "Support Follow-up",
    name: "Support Follow-up",
    subject: "Checking in, {{client_name}}",
    body: j([
      { type: "heading", text: "Just Checking In" },
      { type: "p", text: "Hi {{client_name}}, just checking in to see how things are going with {{company_name}}. Let us know if you need any support or have questions." },
      { type: "p", text: "Best,\nThe Copper Studio Team" },
    ]),
  },
];

// Inserts missing default email templates and upgrades seeded ones to JSON format.
// Never overwrites a template the admin has manually edited.
export async function seedEmailTemplates() {
  const existing = await EmailTemplate.find({}).lean();
  const existingByCategory = Object.fromEntries(existing.map((t) => [t.category, t]));

  let inserted = 0;
  let upgraded = 0;

  for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
    const seedId = `email-template-seed-${tpl.category.replace(/\s+/g, "-").toLowerCase()}`;
    const found = existingByCategory[tpl.category];

    if (!found) {
      await EmailTemplate.create({ ...tpl, id: seedId, status: "Active" });
      inserted++;
    } else if (found.id === seedId && found.body !== tpl.body) {
      await EmailTemplate.updateOne({ _id: found._id }, { $set: { body: tpl.body, subject: tpl.subject, name: tpl.name } });
      upgraded++;
    }
  }

  if (inserted || upgraded) {
    console.log(`Email templates: ${inserted} inserted, ${upgraded} upgraded.`);
  }
}
