import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Mail, MessageCircle, Pencil, Plus, Save, Search, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";

const EMAIL_CATEGORIES = [
  "Welcome", "Consultation Booked", "Proposal Sent", "Proposal Reminder",
  "Coupon Issued", "Payment Success", "Payment Cancelled", "Invoice Generated", "Project Started",
  "Project Update", "Testing Started", "Project Delivered", "Support Follow-up",
];

const WHATSAPP_CATEGORIES = [
  "OTP", "Proposal Sent", "Coupon Shared", "Payment Received", "Invoice Generated",
  "Project Started", "Milestone Completed", "Project Delivered", "Reminder",
];

const DEFAULT_EMAIL_TEMPLATES = [
  { category: "Welcome", name: "Welcome to The Copper Studio", subject: "Welcome aboard, {{client_name}}!",
    body: "Hi {{client_name}},\n\nWelcome to The Copper Studio! We're thrilled to have {{company_name}} on board.\n\nOur team will be in touch shortly to kick things off. If you have any questions in the meantime, just reply to this email.\n\nWarm regards,\nThe Copper Studio Team" },
  { category: "Consultation Booked", name: "Consultation Confirmation", subject: "Your consultation is confirmed, {{client_name}}",
    body: "Hi {{client_name}},\n\nThanks for booking a consultation with us. We've confirmed your slot and look forward to discussing {{company_name}}'s goals.\n\nWe'll send a calendar invite with the meeting link shortly.\n\nSee you soon,\nThe Copper Studio Team" },
  { category: "Proposal Sent", name: "Proposal Delivered", subject: "Your proposal {{proposal_id}} is ready",
    body: "Hi {{client_name}},\n\nWe've prepared proposal {{proposal_id}} for {{company_name}}. Please review it at your convenience and let us know if you have any questions.\n\nLooking forward to working with you,\nThe Copper Studio Team" },
  { category: "Proposal Reminder", name: "Proposal Follow-up", subject: "Following up on proposal {{proposal_id}}",
    body: "Hi {{client_name}},\n\nJust a friendly reminder about proposal {{proposal_id}} we sent over for {{company_name}}. Let us know if you'd like to discuss any part of it or move forward.\n\nBest,\nThe Copper Studio Team" },
  { category: "Coupon Issued", name: "Coupon Code Issued", subject: "Here's your coupon code, {{client_name}}",
    body: "Hi {{client_name}},\n\nAs promised, here's your coupon code: {{coupon_code}}. Apply it at checkout to redeem your discount.\n\nThanks for choosing The Copper Studio,\nThe Copper Studio Team" },
  { category: "Payment Success", name: "Payment Received", subject: "Payment received - thank you, {{client_name}}",
    body: "Hi {{client_name}},\n\nWe've received your payment of {{payment_amount}}. Thank you! A receipt will follow shortly.\n\nBest,\nThe Copper Studio Team" },
  { category: "Payment Cancelled", name: "Payment Not Completed", subject: "Payment not completed | The Copper Studio",
    body: "Hi {{client_name}},\n\nYour payment for {{company_name}} was cancelled or could not be completed successfully.\n\nNo successful order has been created from this payment attempt. If any amount was deducted, it is usually reversed by your payment provider within a few working days. Please do not make a duplicate payment — contact us with your payment reference if needed.\n\nBest,\nThe Copper Studio Team" },
  { category: "Invoice Generated", name: "New Invoice", subject: "Invoice {{invoice_id}} for {{company_name}}",
    body: "Hi {{client_name}},\n\nPlease find invoice {{invoice_id}} attached for {{company_name}}. Let us know if you have any questions about the charges.\n\nThanks,\nThe Copper Studio Team" },
  { category: "Project Started", name: "Project Kickoff", subject: "{{project_name}} has officially started",
    body: "Hi {{client_name}},\n\nGreat news - {{project_name}} is now underway! We'll keep you posted as we hit each milestone.\n\nExcited to get started,\nThe Copper Studio Team" },
  { category: "Project Update", name: "Project Status Update", subject: "Update on {{project_name}}",
    body: "Hi {{client_name}},\n\nHere's a quick update on {{project_name}}: current status is {{project_status}}.\n\nReach out if you have any questions.\n\nBest,\nThe Copper Studio Team" },
  { category: "Testing Started", name: "Testing Phase Started", subject: "{{project_name}} has entered testing",
    body: "Hi {{client_name}},\n\n{{project_name}} has moved into the testing phase. We'll share results and next steps soon.\n\nThanks for your patience,\nThe Copper Studio Team" },
  { category: "Project Delivered", name: "Project Delivered", subject: "{{project_name}} is complete!",
    body: "Hi {{client_name}},\n\nWe're excited to let you know that {{project_name}} has been delivered. Thank you for trusting The Copper Studio with this project.\n\nWarm regards,\nThe Copper Studio Team" },
  { category: "Support Follow-up", name: "Support Follow-up", subject: "Checking in, {{client_name}}",
    body: "Hi {{client_name}},\n\nJust checking in to see how things are going with {{company_name}}. Let us know if you need any support or have questions.\n\nBest,\nThe Copper Studio Team" },
];

const DEFAULT_WHATSAPP_TEMPLATES = [
  { category: "OTP", name: "OTP Verification",
    body: "Your Copper Studio verification code is {{coupon_code}}. Do not share this code with anyone." },
  { category: "Proposal Sent", name: "Proposal Sent",
    body: "Hi {{client_name}}, your proposal {{proposal_id}} from The Copper Studio is ready for review. Check your email for details." },
  { category: "Coupon Shared", name: "Coupon Shared",
    body: "Hi {{client_name}}, here's your coupon code: {{coupon_code}}. Use it at checkout to redeem your discount." },
  { category: "Payment Received", name: "Payment Received",
    body: "Hi {{client_name}}, we've received your payment of {{payment_amount}}. Thank you for choosing The Copper Studio!" },
  { category: "Invoice Generated", name: "Invoice Generated",
    body: "Hi {{client_name}}, invoice {{invoice_id}} for {{company_name}} has been generated. Please check your email for the details." },
  { category: "Project Started", name: "Project Started",
    body: "Hi {{client_name}}, great news - {{project_name}} has officially started! We'll keep you updated on progress." },
  { category: "Milestone Completed", name: "Milestone Completed",
    body: "Hi {{client_name}}, a milestone for {{project_name}} has been completed. Current status: {{project_status}}." },
  { category: "Project Delivered", name: "Project Delivered",
    body: "Hi {{client_name}}, {{project_name}} has been delivered! Thank you for trusting The Copper Studio." },
  { category: "Reminder", name: "Reminder",
    body: "Hi {{client_name}}, just a quick reminder regarding {{company_name}}. Reach out anytime if you have questions." },
];

const VARIABLES = [
  "client_name", "company_name", "proposal_id", "invoice_id",
  "coupon_code", "project_name", "project_status", "payment_amount",
];

function KpiCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#E1E4EA] bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
          <Icon size={16} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
          <p className="mt-0.5 text-lg font-bold text-[#111827]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
        <MessageCircle size={20} />
      </div>
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#6b7280]">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Render a live preview of the template body — HTML is rendered directly,
// plain text is wrapped in simple paragraph styling.
function TemplatePreview({ subject, body, type }) {
  const isHtml = /<[a-z][\s\S]*>/i.test(body || "");
  const previewHtml = isHtml
    ? body
    : (body || "")
        .split(/\n\n+/)
        .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");

  return (
    <div className="flex h-full flex-col">
      {subject && (
        <div className="mb-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">Subject</span>
          <p className="mt-0.5 text-sm font-medium text-[#111827]">{subject || <span className="text-[#9ca3af]">No subject</span>}</p>
        </div>
      )}
      <div className="flex-1 overflow-auto rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-inner">
        <div
          style={{ fontFamily: "Inter,Arial,sans-serif", lineHeight: 1.6, color: "#111827", maxWidth: "100%" }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: previewHtml || `<p style="color:#9ca3af">Preview will appear here…</p>` }}
        />
        {type === "email" && (
          <div style={{ marginTop: 26, borderTop: "1px solid #e5e7eb", paddingTop: 14, fontFamily: "Inter,Arial,sans-serif", color: "#111827" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>The Copper Studio Team</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>contact@thecopperstudio.com</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateModal({ type, categories, template, onClose, onSave }) {
  const [form, setForm] = useState(template);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const isEmail = type === "email";

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/40">
      <div className="ml-auto flex h-full w-full max-w-[75vw] animate-[panel-in_180ms_ease-out] flex-col border-l border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-950">
              {template._id || template.id ? `Edit Template` : `New ${type === "email" ? "Email" : "WhatsApp"} Template`}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">Use <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">{"{{variable}}"}</code> tokens for dynamic content. Body accepts plain text or HTML.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(form)}><Save size={14} /> Save</Button>
            <button onClick={onClose} className="ml-2 grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={16} /></button>
          </div>
        </div>

        {/* Body: form left, preview right */}
        <div className="flex min-h-0 flex-1 divide-x divide-[#f3f4f6]">
          {/* Left — form */}
          <div className="flex w-[380px] shrink-0 flex-col gap-4 overflow-y-auto p-6">
            <label className="block">
              <span className="text-xs font-semibold text-[#374151]">Template name</span>
              <input value={form.name || ""} onChange={(e) => set("name")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#374151]">Category</span>
              <select value={form.category || ""} onChange={(e) => set("category")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d]">
                <option value="">Select…</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            {isEmail && (
              <label className="block">
                <span className="text-xs font-semibold text-[#374151]">Subject line</span>
                <input value={form.subject || ""} onChange={(e) => set("subject")(e.target.value)} placeholder="e.g. Invoice {{invoice_id}} for {{company_name}}" className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20" />
              </label>
            )}
            <label className="block flex-1">
              <span className="text-xs font-semibold text-[#374151]">Body <span className="font-normal text-[#9ca3af]">(plain text or HTML)</span></span>
              <textarea
                value={form.body || ""}
                onChange={(e) => set("body")(e.target.value)}
                rows={16}
                placeholder={"Hi {{client_name}},\n\nYour invoice {{invoice_id}} is attached.\n\nThanks,\nThe Copper Studio Team\n\n— or paste HTML directly —"}
                className="mt-1.5 w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#374151]">Status</span>
              <select value={form.status || "Draft"} onChange={(e) => set("status")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d]">
                {["Draft", "Active"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <div className="rounded-xl bg-[#f9fafb] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">Available variables</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("body")((form.body || "") + `{{${v}}}`)}
                    className="rounded bg-white border border-[#e5e7eb] px-1.5 py-0.5 font-mono text-[11px] text-[#374151] hover:border-[#884c2d] hover:text-[#884c2d]"
                  >{`{{${v}}}`}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Right — live preview */}
          <div className="flex flex-1 flex-col overflow-y-auto bg-[#f8f8fb] p-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#9ca3af]">Live Preview</p>
            <TemplatePreview subject={isEmail ? form.subject : null} body={form.body} type={type} />
          </div>
        </div>
      </div>
    </div>
  );
}

function VariablesModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#111827]">Template Variables</p>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#374151]"><X size={16} /></button>
        </div>
        <p className="mt-1 text-xs text-[#6b7280]">Use these placeholders inside any template body or subject.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {VARIABLES.map((variable) => (
            <span key={variable} className="rounded-lg bg-[#f3f4f6] px-2 py-1 font-mono text-xs text-[#374151]">{`{{${variable}}}`}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplateList({ type, records, categories, onCreate, onEdit, onCopy, onDelete }) {
  const [query, setQuery] = useState("");
  const filtered = records.filter((record) =>
    `${record.name || ""} ${record.category || ""} ${record.subject || ""}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
      <aside className="rounded-xl border border-[#e5e7eb] bg-white p-4">
        <p className="text-sm font-bold text-[#111827]">Categories</p>
        <div className="mt-3 space-y-1">
          {categories.map((category) => (
            <button key={category} onClick={() => setQuery(category)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[#374151] hover:bg-[#fafafa]">
              <span>{category}</span>
              <span className="text-xs text-[#9ca3af]">{records.filter((r) => r.category === category).length}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-xl border border-[#e5e7eb] bg-white">
        <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-3">
          <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3">
            <Search size={14} className="text-[#9ca3af]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${type} templates`} className="w-60 bg-transparent text-sm outline-none" />
          </div>
          <Button onClick={onCreate}><Plus size={14} /> New Template</Button>
        </div>
        {filtered.length ? (
          <div className="divide-y divide-[#f3f4f6]">
            {filtered.map((template) => (
              <div key={template._id || template.id || template.name} className="p-4 hover:bg-[#fafafa] cursor-pointer" onClick={() => onEdit(template)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[#111827]">{template.name || "Untitled template"}</p>
                    <p className="mt-1 text-xs text-[#6b7280]">{template.category || "No category"} - {template.status || "Draft"}</p>
                    {template.subject && <p className="mt-2 text-sm text-[#374151]">{template.subject}</p>}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onEdit(template)} title="Edit" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb]"><Pencil size={13} /></button>
                    <button onClick={() => onCopy(template)} title="Duplicate" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb]"><Copy size={13} /></button>
                    <button onClick={() => onDelete(template)} title="Delete" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#fbdcd2] text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={`No ${type} templates yet.`} text="Create templates with variables so proposal, coupon, payment, invoice, and project updates can be automated." action={<Button onClick={onCreate}><Plus size={14} /> Create Template</Button>} />
        )}
      </section>

      <aside className="rounded-xl border border-[#e5e7eb] bg-white p-4">
        <p className="text-sm font-bold text-[#111827]">Variables</p>
        <p className="mt-1 text-xs text-[#6b7280]">Use these in templates for dynamic client communication.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {VARIABLES.map((variable) => (
            <span key={variable} className="rounded-lg bg-[#f3f4f6] px-2 py-1 font-mono text-xs text-[#374151]">{`{{${variable}}}`}</span>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-[#fff8f6] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#884c2d]">Preview Pattern</p>
          <p className="mt-2 text-sm text-[#374151]">Hello {"{{client_name}}"}, your {"{{proposal_id}}"} is ready for review.</p>
        </div>
      </aside>
    </div>
  );
}

// Dropdown to add ONE specific default template (vs. seeding all of them).
// Defaults already present in the workspace are shown disabled.
function DefaultTemplatesMenu({ defaults, existing, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        <Sparkles size={14} /> Add Default <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg">
          {defaults.map((def) => {
            const added = existing.some((r) => r.category === def.category);
            return (
              <button
                key={def.category}
                disabled={added}
                onClick={() => { onPick(def); setOpen(false); }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[#111827]">{def.name}</span>
                  <span className="block truncate text-xs text-[#9ca3af]">{def.category}</span>
                </span>
                {added ? <span className="shrink-0 text-[10px] font-bold uppercase text-[#9ca3af]">Added</span> : <Plus size={14} className="shrink-0 text-[#884c2d]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CommunicationCenter({ mode = "email" }) {
  const { records: emailTemplates, save: saveEmailTemplate, remove: removeEmailTemplate } = useCrmRecords("emailTemplates");
  const { records: whatsappTemplates, save: saveWhatsappTemplate, remove: removeWhatsappTemplate } = useCrmRecords("whatsappTemplates");
  const { showToast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const page = {
    email: { title: "Email Templates", subtitle: "Reusable email templates for proposals, payments, invoices, project updates, and support.", icon: Mail },
    whatsapp: { title: "WhatsApp Templates", subtitle: "Quick customer communication with Meta-ready template states and variables.", icon: MessageCircle },
  }[mode] || { title: "Email Templates", subtitle: "Reusable client communication templates.", icon: Mail };

  const PageIcon = page.icon;
  const saveTemplate = mode === "whatsapp" ? saveWhatsappTemplate : saveEmailTemplate;
  const removeTemplate = mode === "whatsapp" ? removeWhatsappTemplate : removeEmailTemplate;
  const currentRecords = mode === "whatsapp" ? whatsappTemplates : emailTemplates;
  const currentDefaults = mode === "whatsapp" ? DEFAULT_WHATSAPP_TEMPLATES : DEFAULT_EMAIL_TEMPLATES;

  async function handleSaveTemplate(form) {
    await saveTemplate({ ...form, id: form.id || `${mode}-template-${Date.now()}` });
    setEditingTemplate(null);
    showToast({ title: "Template saved", message: `${form.name || "Template"} saved.` });
  }

  async function handleCopyTemplate(template) {
    const clone = { ...template, name: `${template.name || "Template"} (Copy)`, id: `${mode}-template-${Date.now()}` };
    delete clone._id;
    await saveTemplate(clone);
    showToast({ title: "Template duplicated", message: `Created a copy of ${template.name || "the template"}.` });
  }

  async function handleDeleteTemplate() {
    if (!deletingTemplate) return;
    setDeleting(true);
    try {
      await removeTemplate(deletingTemplate);
      showToast({ title: "Template deleted", message: `${deletingTemplate.name || "Template"} was removed.` });
      setDeletingTemplate(null);
    } catch (err) {
      showToast({ type: "error", title: "Couldn't delete", message: err.message || "Something went wrong." });
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreateSpecificDefault(def) {
    await saveTemplate({ ...def, status: "Active", id: `${mode}-template-${Date.now()}-${def.category.replace(/\s+/g, "-")}` });
    showToast({ title: "Template created", message: `Added the "${def.name}" template.` });
  }

  async function handleCreateDefaults() {
    const existing = mode === "whatsapp" ? whatsappTemplates : emailTemplates;
    const defaults = mode === "whatsapp" ? DEFAULT_WHATSAPP_TEMPLATES : DEFAULT_EMAIL_TEMPLATES;
    const missing = defaults.filter((def) => !existing.some((record) => record.category === def.category));

    if (!missing.length) {
      showToast({ title: "Nothing to create", message: "All default templates already exist." });
      return;
    }

    setSeeding(true);
    try {
      for (const def of missing) {
        await saveTemplate({ ...def, status: "Active", id: `${mode}-template-${Date.now()}-${def.category.replace(/\s+/g, "-")}` });
      }
      showToast({ title: "Templates created", message: `Added ${missing.length} default ${mode} template${missing.length === 1 ? "" : "s"}.` });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F1F1F5]">
      {/* Header strip — matches Companies / Projects style */}
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fff1ec] text-[#884c2d]">
            <PageIcon size={15} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-medium text-[#0E121B]">{page.title}</h1>
            <p className="mt-0.5 truncate text-xs text-[#525866]">{page.subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DefaultTemplatesMenu defaults={currentDefaults} existing={currentRecords} onPick={handleCreateSpecificDefault} />
          <Button variant="secondary" onClick={handleCreateDefaults} disabled={seeding}>
            <Sparkles size={14} /> {seeding ? "Creating..." : "Create All"}
          </Button>
          <Button variant="secondary" onClick={() => setVariablesOpen(true)}><Settings2 size={14} /> Variables</Button>
        </div>
      </div>

      <div className="p-6">
      {mode === "whatsapp" ? (
        <TemplateList
          type="WhatsApp"
          records={whatsappTemplates}
          categories={WHATSAPP_CATEGORIES}
          onCreate={() => setEditingTemplate({ name: "", category: "", body: "", status: "Draft" })}
          onEdit={setEditingTemplate}
          onCopy={handleCopyTemplate}
          onDelete={setDeletingTemplate}
        />
      ) : (
        <TemplateList
          type="email"
          records={emailTemplates}
          categories={EMAIL_CATEGORIES}
          onCreate={() => setEditingTemplate({ name: "", category: "", subject: "", body: "", status: "Draft" })}
          onEdit={setEditingTemplate}
          onCopy={handleCopyTemplate}
          onDelete={setDeletingTemplate}
        />
      )}

      </div>

      {editingTemplate && (
        <TemplateModal
          type={mode === "whatsapp" ? "WhatsApp" : "email"}
          categories={mode === "whatsapp" ? WHATSAPP_CATEGORIES : EMAIL_CATEGORIES}
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveTemplate}
        />
      )}
      {variablesOpen && <VariablesModal onClose={() => setVariablesOpen(false)} />}
      {deletingTemplate && (
        <ConfirmDeleteModal
          title="Delete template?"
          name={deletingTemplate.name || "this template"}
          message="This template will be permanently removed."
          loading={deleting}
          onCancel={() => setDeletingTemplate(null)}
          onConfirm={handleDeleteTemplate}
        />
      )}
    </div>
  );
}
