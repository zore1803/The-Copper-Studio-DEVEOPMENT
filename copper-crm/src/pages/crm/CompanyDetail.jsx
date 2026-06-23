import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  AlertTriangle, Building2, Calendar, CheckCircle2, Clock3, CreditCard, Download,
  Edit2, Eye, FileText, Filter, FolderKanban, FolderOpen, FolderPlus, Globe,
  Layers, LayoutGrid, Link as LinkIcon, List as ListIcon, Mail, MessageSquare, Phone, Plus, ReceiptText,
  Save, Search, Send, StickyNote, Target, Trash2, Unlink, Users
} from "lucide-react";
import { Avatar, Button, StatusBadge } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import { useAuth } from "../../auth/useAuth";
import { apiGet } from "../../lib/api";
import { buildProjectPayload } from "../../lib/projectDefaults";
import SidePanel from "../../components/SidePanel";
import ProjectFormPanel from "../../components/ProjectFormPanel";
import CompanyFormPanel from "../../components/CompanyFormPanel";

const TABS = ["Projects", "Contacts", "Invoices", "Documents", "Tasks", "Notes", "Meetings", "Activity"];
const PROJECT_STATUS = ["Pending", "Confirmed", "Requirement Gathering", "Design", "Development", "Testing", "Review", "Deployment", "Completed", "Cancelled", "On Hold"];
const TASK_VIEWS = ["List", "Board", "Calendar", "Gantt"];
const PROJECT_VIEWS = ["Table", "Board", "Timeline", "Gantt"];

function LinkedInGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM7.119 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM5.337 20.452h3.564V9H5.337v11.452z" />
    </svg>
  );
}

function InstagramGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.347 3.608 1.322.975.975 1.26 2.242 1.322 3.608.058 1.266.069 1.646.069 4.85s-.012 3.584-.07 4.85c-.062 1.366-.347 2.633-1.322 3.608-.975.975-2.242 1.26-3.608 1.322-1.266.058-1.646.069-4.85.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.347-3.608-1.322-.975-.975-1.26-2.242-1.322-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.347-2.633 1.322-3.608.975-.975 2.242-1.26 3.608-1.322C8.416 2.175 8.796 2.163 12 2.163zm0 1.802c-3.157 0-3.51.012-4.74.068-1.012.046-1.562.215-1.927.358-.485.188-.83.412-1.194.776-.364.364-.588.709-.776 1.194-.143.365-.312.915-.358 1.927-.056 1.23-.068 1.583-.068 4.74s.012 3.51.068 4.74c.046 1.012.215 1.562.358 1.927.188.485.412.83.776 1.194.364.364.709.588 1.194.776.365.143.915.312 1.927.358 1.23.056 1.583.068 4.74.068s3.51-.012 4.74-.068c1.012-.046 1.562-.215 1.927-.358.485-.188.83-.412 1.194-.776.364-.364.588-.709.776-1.194.143-.365.312-.915.358-1.927.056-1.23.068-1.583.068-4.74s-.012-3.51-.068-4.74c-.046-1.012-.215-1.562-.358-1.927a3.121 3.121 0 0 0-.776-1.194 3.121 3.121 0 0 0-1.194-.776c-.365-.143-.915-.312-1.927-.358-1.23-.056-1.583-.068-4.74-.068zm0 4.595a5.44 5.44 0 1 1 0 10.88 5.44 5.44 0 0 1 0-10.88zm0 1.802a3.638 3.638 0 1 0 0 7.276 3.638 3.638 0 0 0 0-7.276zm6.926-2.585a1.27 1.27 0 1 1-2.54 0 1.27 1.27 0 0 1 2.54 0z" />
    </svg>
  );
}

function FacebookGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.022 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.797c0-2.508 1.493-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562v1.876h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.918 8.437-9.94z" />
    </svg>
  );
}

function XGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIAL_BRAND_STYLES = {
  Website: { color: "#0EA5E9", bg: "#E0F2FE" },
  LinkedIn: { color: "#0A66C2", bg: "#E1ECF8" },
  Instagram: { color: "#D6249F", bg: "#FCE4F1" },
  Facebook: { color: "#1877F2", bg: "#E5EFFF" },
  X: { color: "#111827", bg: "#F1F1F5" },
  "Personal site": { color: "#7C3AED", bg: "#EFE6FD" },
};

// Icon-only social button for the header row — shows just the platform's
// logo in its brand colour, and renders nothing when the company has no
// value for that field.
function SocialIconLink({ href, icon: Icon, label }) {
  if (!href) return null;
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  const brand = SOCIAL_BRAND_STYLES[label] || { color: "#6b7280", bg: "#f3f4f6" };
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      style={{ color: brand.color, backgroundColor: brand.bg }}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent transition-transform hover:scale-110"
    >
      <Icon size={13} />
    </a>
  );
}

function useClickOutside(ref, onOutside, active) {
  useEffect(() => {
    if (!active) return;
    function onDocMouseDown(event) {
      if (ref.current && !ref.current.contains(event.target)) onOutside();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [active, onOutside, ref]);
}

function parseMoney(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function formatINR(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d8c2b9] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff1ec] text-[#884c2d]">
        <Icon size={20} />
      </div>
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-[#6b7280]">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function KpiChip({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#6b7280]">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#6b7280]">{label}</p>
          <p className="mt-0.5 text-base font-bold leading-tight text-[#111827]" title={String(value)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function ContactPanel({ company, contact, onClose, onSave }) {
  const [form, setForm] = useState(contact || {
    salutation: "",
    firstName: "",
    lastName: "",
    designation: "",
    email: "",
    whatsapp: "",
    alternatePhone: "",
    department: "",
    isDecisionMaker: false,
    isPrimary: false,
    isBillingContact: false,
    isTechnicalContact: false,
    linkedin: "",
    website: "",
    preferences: "",
    notes: "",
    meetingNotes: "",
    status: "Active",
  });
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <SidePanel
      title={contact?._id || contact?.id ? "Edit Contact" : "Add Contact"}
      subtitle={`Link this person to ${company.name}.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}><Save size={14} /> Save Contact</Button>
        </div>
      }
    >
      <div className="space-y-6">
        <FormSection title="Personal Information">
          <Input label="Salutation" value={form.salutation} onChange={set("salutation")} />
          <Input label="Designation" value={form.designation} onChange={set("designation")} />
          <Input label="First name" value={form.firstName} onChange={set("firstName")} />
          <Input label="Last name" value={form.lastName} onChange={set("lastName")} />
        </FormSection>

        <FormSection title="Communication">
          <Input label="Work email" value={form.email} onChange={set("email")} />
          <Input label="WhatsApp number" value={form.whatsapp} onChange={set("whatsapp")}
            hint="Primary WhatsApp number used for project updates." />
          <Input label="Alternative number" value={form.alternatePhone} onChange={set("alternatePhone")} />
        </FormSection>

        <FormSection title="Company Mapping">
          <Input label="Associated company" value={company.name} disabled />
          <Input label="Department" value={form.department} onChange={set("department")} />
          <Checkbox span label="Decision maker" checked={form.isDecisionMaker} onChange={set("isDecisionMaker")} />
          <Checkbox label="Primary contact" checked={form.isPrimary} onChange={set("isPrimary")} />
          <Checkbox label="Billing contact" checked={form.isBillingContact} onChange={set("isBillingContact")} />
          <Checkbox label="Technical contact" checked={form.isTechnicalContact} onChange={set("isTechnicalContact")} />
        </FormSection>

        <FormSection title="Social">
          <Input label="LinkedIn" value={form.linkedin} onChange={set("linkedin")} />
          <Input label="Website" value={form.website} onChange={set("website")} />
        </FormSection>

        <FormSection title="Notes">
          <Textarea span label="Preferences" value={form.preferences} onChange={set("preferences")} />
          <Textarea span label="Important notes" value={form.notes} onChange={set("notes")} />
          <Textarea span label="Meeting notes" value={form.meetingNotes} onChange={set("meetingNotes")} />
        </FormSection>
      </div>
    </SidePanel>
  );
}

function LinkClientPanel({ company, clients, loading, onClose, onLink, onUnlink }) {
  const [query, setQuery] = useState("");
  const linkedUser = clients.find((u) => String(u._id) === String(company.userId));
  const filtered = clients.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <SidePanel
      title="Link Client Portal Account"
      subtitle={`Connect ${company.name} to a client login so project and timeline updates appear in their portal.`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {linkedUser && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Currently Linked</p>
              <p className="mt-1 text-sm font-semibold text-[#111827]">{linkedUser.name}</p>
              <p className="text-xs text-[#6b7280]">{linkedUser.email}</p>
            </div>
            <Button variant="secondary" onClick={onUnlink}><Unlink size={14} /> Unlink</Button>
          </div>
        )}
        <div className="flex h-10 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3">
          <Search size={14} className="text-[#9ca3af]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client accounts by name or email" className="w-full bg-transparent text-sm outline-none" />
        </div>
        {loading ? (
          <p className="text-sm text-[#6b7280]">Loading client accounts…</p>
        ) : filtered.length ? (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {filtered.map((user) => (
              <button
                key={user._id}
                onClick={() => onLink(user)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${String(user._id) === String(company.userId) ? "border-[#884c2d] bg-[#fff1ec]" : "border-[#e5e7eb] hover:bg-[#f9fafb]"}`}
              >
                <div>
                  <p className="font-semibold text-[#111827]">{user.name}</p>
                  <p className="text-xs text-[#6b7280]">{user.email}</p>
                </div>
                {String(user._id) === String(company.userId) && <CheckCircle2 size={16} className="text-[#884c2d]" />}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6b7280]">No client accounts found. Clients get an account automatically after their first paid order.</p>
        )}
      </div>
    </SidePanel>
  );
}

const DOCUMENT_CATEGORIES = ["Contracts", "Invoices", "Proposals", "Design Files", "Source Code", "Deliverables"];

function fileExt(filename) {
  return (filename || "").split(".").pop().toLowerCase();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function DocumentUploadPanel({ company, onClose, onSave, defaultCategory = "" }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: "", category: defaultCategory || "Contracts", fileType: "pdf", fileUrl: "", fileSize: "", notes: "" });
  const [fileReady, setFileReady] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleBrowse(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast({ type: "error", title: "File too large", message: "Files must be 8 MB or smaller. Paste a hosted file URL instead for larger files." });
      event.target.value = "";
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setForm((prev) => ({
      ...prev,
      name: prev.name || file.name,
      fileType: fileExt(file.name) || prev.fileType,
      fileUrl: dataUrl,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    }));
    setFileReady(true);
  }

  return (
    <SidePanel
      title="Upload Document"
      subtitle={`Attach a file to ${company.name}.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name.trim()}><Save size={14} /> Save Document</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">File *</span>
          <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-dashed border-[#d8c2b9] bg-[#fff8f6] px-3 py-3">
            <input id="doc-browse" type="file" className="hidden" onChange={handleBrowse} />
            <label htmlFor="doc-browse" className="cursor-pointer rounded-lg bg-[#884c2d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6f381a]">
              Browse…
            </label>
            <span className="truncate text-xs text-[#6b7280]">
              {fileReady ? `${form.name} (${form.fileSize})` : "No file selected"}
            </span>
          </div>
        </label>
        <Input span label="File name *" value={form.name} onChange={set("name")} />
        <Select label="Category" value={form.category} onChange={set("category")} options={DOCUMENT_CATEGORIES} />
        <Select label="File type" value={form.fileType} onChange={set("fileType")} options={["pdf", "doc", "docx", "xlsx", "png", "jpg", "zip"]} />
        <Input span label="...or paste a file URL" value={fileReady ? "" : form.fileUrl} onChange={set("fileUrl")} disabled={fileReady} hint="Link to an already-hosted file (Drive, S3, etc.) — only used if you don't browse a file above." />
        <Textarea span label="Notes" value={form.notes} onChange={set("notes")} />
      </div>
    </SidePanel>
  );
}

function TaskPanel({ company, projects, onClose, onSave, defaultDueDate = "" }) {
  const [form, setForm] = useState({ title: "", projectId: "", priority: "Medium", status: "Backlog", assignedTo: "", dueDate: defaultDueDate, description: "" });
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <SidePanel
      title="New Task"
      subtitle={`Add a task linked to ${company.name}.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}><Save size={14} /> Create Task</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input span label="Task title *" value={form.title} onChange={set("title")} />
        <Select label="Project" value={form.projectId} onChange={set("projectId")}
          options={projects.map((p) => ({ value: String(p._id || p.id), label: p.name }))} />
        <Select label="Priority" value={form.priority} onChange={set("priority")} options={["Low", "Medium", "High", "Critical"]} />
        <Select label="Status" value={form.status} onChange={set("status")} options={["Backlog", "To Do", "In Progress", "Review", "Completed", "Blocked"]} />
        <Input label="Assigned to" value={form.assignedTo} onChange={set("assignedTo")} />
        <Input type="date" label="Due date" value={form.dueDate} onChange={set("dueDate")} />
        <Textarea span label="Description" value={form.description} onChange={set("description")} />
      </div>
    </SidePanel>
  );
}

function InvoicePanel({ invoice, onClose, onDownload, onMarkPaid }) {
  if (!invoice) return null;
  return (
    <SidePanel
      title={`Invoice ${invoice.invoiceId || invoice.id || invoice._id}`}
      subtitle="Invoice amount, payment status, and linked company details."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="secondary" onClick={() => onMarkPaid(invoice)}><CheckCircle2 size={14} /> Mark Paid</Button>
          <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(`Invoice ${invoice.invoiceId || invoice.id || invoice._id}`)}><Send size={14} /> Send Invoice</Button>
          <Button onClick={() => onDownload(invoice)}><Download size={14} /> PDF</Button>
        </div>
      }
    >
      <div className="mb-4 rounded-xl border border-[#e5e7eb] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#9ca3af]">PDF Preview</p>
        <div className="mt-4 rounded-lg border border-dashed border-[#d8c2b9] bg-[#fff8f6] p-5">
          <p className="text-lg font-bold text-[#111827]">The Copper Studio</p>
          <p className="mt-1 text-sm text-[#6b7280]">Invoice {invoice.invoiceId || invoice.id || invoice._id}</p>
          <p className="mt-5 text-2xl font-bold text-[#884c2d]">{formatINR(parseMoney(invoice.total || invoice.amount))}</p>
        </div>
      </div>
      <div className="space-y-4">
        <DetailRow label="Invoice ID" value={invoice.invoiceId || invoice.id || invoice._id} />
        <DetailRow label="Amount" value={formatINR(parseMoney(invoice.total || invoice.amount))} />
        <DetailRow label="Invoice Status" value={invoice.status || "Pending"} />
        <DetailRow label="Payment Status" value={invoice.paymentStatus || invoice.status || "Pending"} />
        <DetailRow label="GST" value={invoice.gst || invoice.gstAmount || "Not added"} />
        <DetailRow label="Discount" value={invoice.discount || "Not added"} />
        <DetailRow label="Coupon" value={invoice.coupon || invoice.couponCode || "Not linked"} />
        <DetailRow label="Payment ID" value={invoice.paymentId || invoice.razorpayPaymentId || "Not linked"} />
        <DetailRow label="Transaction ID" value={invoice.transactionId || invoice.paymentId || "Not linked"} />
        <DetailRow label="Order ID" value={invoice.orderId || "Not linked"} />
        <DetailRow label="Issue Date" value={invoice.date || invoice.createdAt || "Not added"} />
        <DetailRow label="Due Date" value={invoice.dueDate || "Not added"} />
        <DetailRow label="History" value={invoice.history || "Generated / Sent / Paid events will appear here."} />
      </div>
    </SidePanel>
  );
}

function ContactDetailPanel({ contact, projects, meetings, onClose, onEdit, onDelete, onPrimary }) {
  if (!contact) return null;
  const name = contact.name || `${contact.salutation || ""} ${contact.firstName || ""} ${contact.lastName || ""}`.trim();
  return (
    <SidePanel
      title={name || "Contact"}
      subtitle={contact.designation || "Company contact"}
      onClose={onClose}
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="secondary" onClick={() => onDelete(contact)}><Trash2 size={14} /> Delete</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onPrimary(contact)}><CheckCircle2 size={14} /> Make Primary</Button>
            <Button onClick={() => onEdit(contact)}><Edit2 size={14} /> Edit</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <Avatar name={name} size="md" />
          <div>
            <p className="font-bold text-[#111827]">{name}</p>
            <p className="text-sm text-[#6b7280]">{contact.email || "No email"}</p>
          </div>
        </div>
        <DetailRow label="WhatsApp" value={contact.whatsapp} />
        <DetailRow label="Alternative Number" value={contact.alternatePhone} />
        <DetailRow label="Department" value={contact.department} />
        <DetailRow
          label="Roles"
          value={[
            contact.isDecisionMaker && "Decision Maker",
            contact.isPrimary && "Primary Contact",
            contact.isBillingContact && "Billing Contact",
            contact.isTechnicalContact && "Technical Contact",
          ].filter(Boolean).join(", ") || "Not set"}
        />
        <DetailRow label="LinkedIn" value={contact.linkedin} />
        <DetailRow label="Website" value={contact.website} />
        <DetailRow label="Status" value={contact.status || "Active"} />
        <DetailRow label="Communication History" value="Emails, WhatsApp, calls, and notes will be logged here." />
        <DetailRow label="Projects Involved" value={projects.map((project) => project.name).join(", ") || "No projects linked"} />
        <DetailRow label="Meetings" value={`${meetings.length} meetings linked`} />
        <DetailRow label="Preferences" value={contact.preferences || "No preferences added"} />
        <DetailRow label="Notes" value={contact.notes || "No notes added"} />
        <DetailRow label="Meeting Notes" value={contact.meetingNotes || "No meeting notes added"} />
      </div>
    </SidePanel>
  );
}

function FormSection({ title, children }) {
  return (
    <div className="space-y-3 border-t border-[#f3f4f6] pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-bold uppercase tracking-wide text-[#884c2d]">{title}</h4>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", disabled = false, span = false, hint }) {
  return (
    <label className={`block ${span ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        type={type}
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className={`mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20 ${disabled ? "bg-[#f9fafb] text-[#6b7280]" : ""}`}
      />
      {hint && <span className="mt-1 block text-[11px] text-[#9ca3af]">{hint}</span>}
    </label>
  );
}

function Textarea({ label, value, onChange, span = false }) {
  return (
    <label className={`block ${span ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <textarea
        value={value || ""}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
      />
    </label>
  );
}

function Select({ label, value, onChange, options = [], span = false }) {
  const normalized = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
  return (
    <label className={`block ${span ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
      >
        <option value="">Select…</option>
        {normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange, span = false }) {
  return (
    <label className={`flex items-center gap-2 rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm font-medium text-[#374151] cursor-pointer hover:bg-[#f9fafb] ${span ? "sm:col-span-2" : ""}`}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[#d1d5db] text-[#884c2d] focus:ring-[#884c2d]/30"
      />
      {label}
    </label>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#111827]">{value || "Not added"}</p>
    </div>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "No date";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "No date";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildActivity(linked, company) {
  const items = [
    ...linked.invoices.map((invoice) => ({
      type: "Invoice",
      title: `Invoice ${invoice.invoiceId || invoice.id || invoice._id} ${invoice.status || "created"}`,
      date: invoice.paidAt || invoice.date || invoice.createdAt,
      icon: ReceiptText,
    })),
    ...linked.projects.map((project) => ({
      type: "Project",
      title: `${project.name || "Project"} ${project.status || project.currentPhase || "created"}`,
      date: project.updatedAt || project.createdAt || project.startDate,
      icon: FolderKanban,
    })),
    ...linked.tasks.map((task) => ({
      type: "Task",
      title: `${task.title || task.taskName || "Task"} ${task.status || "updated"}`,
      date: task.updatedAt || task.createdAt || task.dueDate,
      icon: StickyNote,
    })),
    ...linked.contacts.map((contact) => ({
      type: "Contact",
      title: `${contact.name || contact.email || "Contact"} added`,
      date: contact.createdAt,
      icon: Users,
    })),
    ...linked.meetings.map((meeting) => ({
      type: "Meeting",
      title: meeting.title || meeting.subject || "Meeting scheduled",
      date: meeting.scheduled || meeting.scheduledAt || meeting.createdAt,
      icon: Calendar,
    })),
    ...(company.createdAt ? [{ type: "Company", title: "Company created", date: company.createdAt, icon: Building2 }] : []),
  ];
  return items
    .map((item) => ({ ...item, sortDate: new Date(item.date || 0), dateLabel: formatDateTime(item.date) }))
    .sort((a, b) => b.sortDate - a.sortDate);
}

export default function CompanyDetail() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("Projects");
  const [creatingProject, setCreatingProject] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef(null);
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactQuery, setContactQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [linkingClient, setLinkingClient] = useState(false);
  const [clientUsers, setClientUsers] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [viewingFolder, setViewingFolder] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [projectView, setProjectView] = useState("Table");
  const [taskView, setTaskView] = useState("List");
  const [projectStatusFilter, setProjectStatusFilter] = useState("All");
  const [projectPackageFilter, setProjectPackageFilter] = useState("All");
  const [projectManagerFilter, setProjectManagerFilter] = useState("All");
  const [projectTimelineFilter, setProjectTimelineFilter] = useState("All");
  const { records: companies, loading: companiesLoading, save: saveCompany } = useCrmRecords("companies");
  const { records: projects, save: saveProject } = useCrmRecords("projects");
  const { records: contacts, save: saveContact, remove: removeContact } = useCrmRecords("contacts");
  const { records: invoices, save: saveInvoice } = useCrmRecords("invoices");
  const { records: tasks, save: saveTask, remove: removeTask } = useCrmRecords("tasks");
  const { records: meetings } = useCrmRecords("meetings");
  const { records: documents, save: saveDocument, remove: removeDocument } = useCrmRecords("documents");
  const { records: notes, save: saveNote, remove: removeNote } = useCrmRecords("notes");

  useClickOutside(addMenuRef, () => setAddMenuOpen(false), addMenuOpen);

  const company = useMemo(() => companies.find((c) => String(c.id || c._id) === companyId), [companies, companyId]);
  const linked = useMemo(() => {
    const name = company?.name || "";
    // Companies can be referenced by their real Mongo _id or their human-readable custom id —
    // match against both since either may have been stored on a linked record.
    const isCompanyMatch = (value) => {
      const str = String(value || "");
      return Boolean(str) && (str === String(company?._id) || str === String(company?.id) || str === companyId);
    };
    const linkedProjects = projects.filter((p) => isCompanyMatch(p.companyId) || p.client === name || p.company === name || p.companyName === name);
    // Index by both id forms — tasks/documents created at different times may reference
    // a project by either its real Mongo _id or its human-readable custom id.
    const linkedProjectIds = new Set(linkedProjects.flatMap((project) => [String(project.id), String(project._id)]));
    return {
      projects: linkedProjects,
      contacts: contacts.filter((c) => isCompanyMatch(c.companyId) || c.company === name || c.companyName === name),
      invoices: invoices.filter((i) => isCompanyMatch(i.companyId) || i.company === name || i.client === name || i.companyName === name),
      tasks: tasks.filter((t) => isCompanyMatch(t.companyId) || t.company === name || t.companyName === name || linkedProjectIds.has(String(t.projectId)) || linkedProjectIds.has(String(t.project))),
      meetings: meetings.filter((m) => isCompanyMatch(m.companyId) || m.company === name),
      documents: documents.filter((d) => isCompanyMatch(d.companyId) || d.company === name || d.companyName === name || linkedProjectIds.has(String(d.projectId))),
      notes: notes.filter((n) => isCompanyMatch(n.companyId) || n.company === name),
    };
  }, [company, companyId, contacts, documents, invoices, meetings, notes, projects, tasks]);
  const allDocsForFolders = useMemo(
    () => [
      ...linked.documents,
      ...linked.projects.flatMap((project) =>
        (project.documents || []).map((doc, index) => ({
          ...doc,
          projectName: project.name,
          _sourceProjectId: String(project.id || project._id),
          _docIndex: index,
        }))
      ),
    ],
    [linked.documents, linked.projects]
  );
  const filteredContacts = useMemo(() => linked.contacts.filter((contact) => {
    const fullName = `${contact.salutation || ""} ${contact.firstName || ""} ${contact.lastName || ""} ${contact.name || ""}`;
    return `${fullName} ${contact.email} ${contact.phone} ${contact.designation}`.toLowerCase().includes(contactQuery.toLowerCase());
  }), [contactQuery, linked.contacts]);

  useEffect(() => {
    if (!linkingClient) return;
    let alive = true;
    apiGet("/api/admin/clients", token)
      .then((users) => { if (alive) setClientUsers(Array.isArray(users) ? users : []); })
      .catch(() => { if (alive) setClientUsers([]); })
      .finally(() => { if (alive) setLoadingClients(false); });
    return () => { alive = false; };
  }, [linkingClient, token]);

  function openLinkClient() {
    setLoadingClients(true);
    setLinkingClient(true);
  }

  if (!company && companiesLoading) {
    return (
      <div className="m-6 rounded-xl border border-[#e5e7eb] bg-white p-12 text-center">
        <p className="text-sm font-semibold text-[#6b7280]">Loading company…</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="m-6 rounded-xl border border-[#e5e7eb] bg-white p-12 text-center">
        <p className="text-sm font-semibold text-[#6b7280]">Company not found.</p>
        <button onClick={() => navigate("/admin/companies")} className="mt-4 text-sm font-semibold text-[#884c2d] hover:underline">
          Back to Companies
        </button>
      </div>
    );
  }

  const collected = linked.invoices.filter((i) => String(i.status || "").toLowerCase() === "paid").reduce((sum, i) => sum + parseMoney(i.total || i.amount), 0);
  const outstanding = linked.invoices.filter((i) => String(i.status || "").toLowerCase() !== "paid").reduce((sum, i) => sum + parseMoney(i.total || i.amount), 0);
  const today = new Date();
  const activeTasks = linked.tasks.filter((task) => !["completed", "done"].includes(String(task.status || "").toLowerCase())).length;
  const overdueTasks = linked.tasks.filter((task) => {
    const due = new Date(task.dueDate || task.deadline || "");
    return !Number.isNaN(due.getTime()) && due < today && !["completed", "done"].includes(String(task.status || "").toLowerCase());
  }).length;
  const primaryContact = linked.contacts.find((contact) => contact.isPrimary || contact.name === company.primaryContact || contact.email === company.primaryContactEmail) || linked.contacts[0];
  const activityItems = buildActivity(linked, company);
  const projectsCompleted = linked.projects.filter((project) => String(project.status || project.currentPhase || "").toLowerCase() === "completed").length;
  const activeProjects = linked.projects.length - projectsCompleted;
  const totalSignals = linked.projects.length + linked.contacts.length + linked.invoices.length + activeTasks;
  const riskPenalty = overdueTasks * 12 + (outstanding > 0 ? 8 : 0);
  const companyHealthScore = Math.max(0, Math.min(100, 68 + Math.min(totalSignals * 3, 24) - riskPenalty));
  const tabCounts = {
    Projects: linked.projects.length,
    Contacts: linked.contacts.length,
    Invoices: linked.invoices.length,
    Documents: linked.documents.length,
    Tasks: activeTasks,
    Notes: linked.notes.length,
    Meetings: linked.meetings.length,
  };
  const projectPackages = ["All", ...Array.from(new Set(linked.projects.map((project) => project.packageName || project.package).filter(Boolean)))];
  const projectManagers = ["All", ...Array.from(new Set(linked.projects.map((project) => project.projectManager || project.manager).filter(Boolean)))];
  const visibleProjects = linked.projects.filter((project) => {
    const due = new Date(project.dueDate || project.expectedEndDate || "");
    const statusOk = projectStatusFilter === "All" || project.status === projectStatusFilter || project.currentPhase === projectStatusFilter;
    const packageOk = projectPackageFilter === "All" || project.packageName === projectPackageFilter || project.package === projectPackageFilter;
    const managerOk = projectManagerFilter === "All" || project.projectManager === projectManagerFilter || project.manager === projectManagerFilter;
    const timelineOk = projectTimelineFilter === "All" ||
      (projectTimelineFilter === "Overdue" && !Number.isNaN(due.getTime()) && due < today) ||
      (projectTimelineFilter === "Due Soon" && !Number.isNaN(due.getTime()) && due >= today && due <= new Date(Date.now() + 7 * 86400000));
    return statusOk && packageOk && managerOk && timelineOk;
  });

  async function handleCreateProject(targetCompany, form) {
    if (!form.name.trim()) {
      showToast({ type: "error", title: "Project name required", message: "Add a name before creating the project." });
      return;
    }
    const { payload, starterTasks } = buildProjectPayload(form, targetCompany);
    const created = await saveProject(payload);
    const realProjectId = created._id || created.id;
    await Promise.all(starterTasks.map((task) => saveTask({ ...task, projectId: realProjectId })));
    setCreatingProject(false);
    showToast({ title: "Project workspace created", message: `${created.name} now has timeline, tasks, documents, and activity.` });
  }

  async function handleSaveContact(form) {
    const fullName = `${form.salutation || ""} ${form.firstName || ""} ${form.lastName || ""}`.trim();
    if (!fullName && !form.name) {
      showToast({ type: "error", title: "Contact name required", message: "Add at least a first name or contact name." });
      return;
    }
    const savedContact = await saveContact({
      ...form,
      id: form.id || form._id || `contact-${Date.now()}`,
      name: form.name || fullName,
      phone: form.phone || form.whatsapp || form.alternatePhone,
      companyId: company.id || company._id,
      company: company.name,
      companyName: company.name,
    });
    if (form.isPrimary) {
      await saveCompany({
        ...company,
        primaryContact: savedContact.name || fullName,
        primaryContactEmail: savedContact.email,
        contact: savedContact.name || company.contact,
      });
    }
    setEditingContact(null);
    showToast({ title: "Contact saved", message: `${fullName || form.name} is linked to ${company.name}.` });
  }

  async function handleDeleteContact(contact) {
    await removeContact(contact);
    showToast({ title: "Contact deleted", message: `${contact.name || contact.email || "Contact"} removed from ${company.name}.` });
  }

  async function handleMakePrimary(contact) {
    await saveCompany({
      ...company,
      primaryContact: contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
      primaryContactEmail: contact.email,
      contact: contact.name || company.contact,
    });
    showToast({ title: "Primary contact updated", message: `${contact.name || contact.email} is now the primary contact.` });
  }

  async function handleLinkClient(user) {
    await saveCompany({ ...company, userId: user._id });
    showToast({ title: "Client account linked", message: `${company.name} is now connected to ${user.email}. Projects and updates will sync to their portal.` });
    setLinkingClient(false);
  }

  async function handleUnlinkClient() {
    await saveCompany({ ...company, userId: null });
    showToast({ title: "Client account unlinked", message: `${company.name} is no longer connected to a client login.` });
    setLinkingClient(false);
  }

  async function handleSaveCompanyEdit(form) {
    await saveCompany({ ...form, projects: Number(form.projects) || 0 });
    setEditingCompany(false);
    showToast({ title: "Company updated", message: `${form.name || "Company"} saved.` });
  }

  async function handleUploadDocument(form) {
    if (!form.name.trim()) {
      showToast({ type: "error", title: "File name required", message: "Add a name before uploading." });
      return;
    }
    await saveDocument({
      ...form,
      companyId: company._id || company.id,
      company: company.name,
    });
    setUploadingDocument(false);
    showToast({ title: "Document uploaded", message: `${form.name} was added to ${company.name}.` });
  }

  async function handleDeleteDocument(doc) {
    if (doc._sourceProjectId) {
      const project = linked.projects.find((p) => String(p.id || p._id) === doc._sourceProjectId);
      if (project) {
        const remaining = (project.documents || []).filter((_, index) => index !== doc._docIndex);
        await saveProject({ ...project, documents: remaining });
      }
    } else {
      await removeDocument(doc);
    }
    showToast({ title: "Document deleted", message: `${doc.fileName || doc.name || "Document"} removed from ${company.name}.` });
  }

  async function handleCreateDocumentGroup(name, folders) {
    const trimmed = name.trim();
    if (!trimmed || !folders.length) return;
    const groups = [...(company.documentGroups || []).filter((g) => g.name !== trimmed), { name: trimmed, folders }];
    await saveCompany({ ...company, documentGroups: groups });
    showToast({ title: "Group created", message: `"${trimmed}" now includes ${folders.length} folder${folders.length === 1 ? "" : "s"}.` });
  }

  async function handleDeleteDocumentGroup(name) {
    const groups = (company.documentGroups || []).filter((g) => g.name !== name);
    await saveCompany({ ...company, documentGroups: groups });
    showToast({ title: "Group deleted", message: `"${name}" group removed.` });
  }

  async function handleSaveNote(form) {
    if (!form.title.trim() && !form.body.trim()) {
      showToast({ type: "error", title: "Note is empty", message: "Add a title or some text before saving." });
      return;
    }
    await saveNote({ ...form, companyId: company._id || company.id, company: company.name });
    setEditingNote(null);
    showToast({ title: "Note saved", message: `Saved to ${company.name}.` });
  }

  async function handleDeleteNote(note) {
    await removeNote(note);
    showToast({ title: "Note deleted", message: "The note was removed." });
  }

  async function handleSaveCalendlyLink(url) {
    await saveCompany({ ...company, calendlyUrl: url });
    showToast({ title: "Calendly link saved", message: url ? "Meetings can now be booked from this tab." : "Calendly link removed." });
  }

  async function handleCreateTask(form) {
    if (!form.title.trim()) {
      showToast({ type: "error", title: "Task title required", message: "Add a title before creating the task." });
      return;
    }
    await saveTask({
      ...form,
      id: `task-${Date.now()}`,
      companyId: company._id || company.id,
      company: company.name,
    });
    setCreatingTask(false);
    showToast({ title: "Task created", message: `${form.title} was added to ${company.name}.` });
  }

  async function handleDeleteTask(task) {
    await removeTask(task);
    showToast({ title: "Task deleted", message: `${task.title || task.taskName || "Task"} removed from ${company.name}.` });
  }

  async function handleMarkInvoicePaid(invoice) {
    await saveInvoice({
      ...invoice,
      status: "Paid",
      paymentStatus: "Paid",
      paidAt: new Date().toISOString(),
    });
    setSelectedInvoice(null);
    showToast({ title: "Invoice marked paid", message: `${invoice.invoiceId || invoice.id || "Invoice"} has been updated.` });
  }

  async function downloadInvoicePdf(invoice) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const invoiceNo = invoice.invoiceId || invoice.id || invoice._id;
    doc.setFillColor(136, 76, 45);
    doc.rect(0, 0, 595, 118, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("The Copper Studio", 48, 52);
    doc.setFontSize(12);
    doc.text(`Invoice ${invoiceNo}`, 48, 78);
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(16);
    doc.text(company.name || "Company", 48, 158);
    doc.setFontSize(10);
    const rows = [
      ["Invoice ID", invoiceNo],
      ["Company", company.name],
      ["Amount", formatINR(parseMoney(invoice.total || invoice.amount))],
      ["Status", invoice.status || "Pending"],
      ["Payment ID", invoice.paymentId || invoice.razorpayPaymentId || "-"],
      ["Order ID", invoice.orderId || "-"],
      ["Issue Date", invoice.date || invoice.createdAt || "-"],
      ["Due Date", invoice.dueDate || "-"],
    ];
    rows.forEach(([label, value], index) => {
      const y = 205 + index * 28;
      doc.setFont("helvetica", "bold");
      doc.text(label, 48, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value || "-"), 180, y);
    });
    doc.save(`${String(invoiceNo || "invoice").replace(/[^a-z0-9-]/gi, "-")}.pdf`);
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f8fafc]">
      <div className="border-b border-[#e5e7eb] bg-white">
        <div className="px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#e5e7eb] bg-[#fff8f6]">
                <Building2 size={24} className="text-[#884c2d]" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold text-[#111827]">{company.name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6b7280]">
                  {company.industry && <span>{company.industry}</span>}
                  {company.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {company.phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(company.website || company.linkedin || company.instagram || company.facebook || company.twitter || company.personalWebsite) && (
                <div className="flex items-center gap-1.5 pr-2">
                  <SocialIconLink href={company.website} icon={Globe} label="Website" />
                  <SocialIconLink href={company.linkedin} icon={LinkedInGlyph} label="LinkedIn" />
                  <SocialIconLink href={company.instagram} icon={InstagramGlyph} label="Instagram" />
                  <SocialIconLink href={company.facebook} icon={FacebookGlyph} label="Facebook" />
                  <SocialIconLink href={company.twitter} icon={XGlyph} label="X" />
                  <SocialIconLink href={company.personalWebsite} icon={Globe} label="Personal site" />
                </div>
              )}
              <Button
                variant={company.userId ? "secondary" : "primary"}
                onClick={openLinkClient}
              >
                <LinkIcon size={14} /> {company.userId ? "Client Linked" : "Link Client Portal"}
              </Button>
              <Button variant="secondary" onClick={() => setEditingCompany(true)}><Edit2 size={14} /> Edit Company</Button>
              <div className="relative" ref={addMenuRef}>
                <Button onClick={() => setAddMenuOpen((open) => !open)}><Plus size={14} /> Add New</Button>
                {addMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                    <button
                      onClick={() => { setCreatingProject(true); setAddMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
                    >
                      <FolderKanban size={14} /> Add Project
                    </button>
                    <button
                      onClick={() => { setEditingContact({}); setAddMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
                    >
                      <Users size={14} /> Add Contact
                    </button>
                    <button
                      onClick={() => { setCreatingTask(true); setAddMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
                    >
                      <StickyNote size={14} /> Add Task
                    </button>
                    <button
                      onClick={() => { setUploadingDocument(true); setAddMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
                    >
                      <FolderOpen size={14} /> Add Document
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-[#f1f1f5] bg-[#fafafa] p-4 sm:grid-cols-3 lg:grid-cols-5">
            <InfoLine label="GSTIN" value={company.gstin} />
            <InfoLine label="Client Since" value={formatDate(company.createdAt || company.clientSince)} />
            <InfoLine label="Primary Contact" value={primaryContact?.name || company.primaryContact} />
            <InfoLine label="Lead Source" value={company.leadSource} />
            <InfoLine label="Owner" value={company.owner || company.companyOwner} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pb-5 sm:grid-cols-3 lg:grid-cols-5">
          <KpiChip label="Total Revenue" value={formatINR(collected)} icon={CreditCard} />
          <KpiChip label="Outstanding Due" value={formatINR(outstanding)} icon={AlertTriangle} />
          <KpiChip label="Active Projects" value={activeProjects} icon={FolderKanban} />
          <KpiChip label="Completed Projects" value={projectsCompleted} icon={CheckCircle2} />
          <KpiChip label="Company Health" value={`${companyHealthScore}%`} icon={Target} />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto px-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab ? "border-[#C57E5B] text-[#C57E5B]" : "border-transparent text-[#1D1E22] hover:text-[#884c2d]"}`}
            >
              {tab}
              {Boolean(tabCounts[tab]) && (
                <span
                  className={`grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold ${
                    activeTab === tab ? "bg-[#C57E5B] text-white" : "bg-[#e5e7eb] text-[#374151]"
                  }`}
                >
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6">
        {activeTab === "Projects" && (
          <ProjectsWorkspace
            projects={visibleProjects}
            allProjects={linked.projects}
            companyId={companyId}
            view={projectView}
            onView={setProjectView}
            onOpen={navigate}
            onCreate={() => setCreatingProject(true)}
            statusFilter={projectStatusFilter}
            packageFilter={projectPackageFilter}
            managerFilter={projectManagerFilter}
            timelineFilter={projectTimelineFilter}
            onStatusFilter={setProjectStatusFilter}
            onPackageFilter={setProjectPackageFilter}
            onManagerFilter={setProjectManagerFilter}
            onTimelineFilter={setProjectTimelineFilter}
            packages={projectPackages}
            managers={projectManagers}
          />
        )}
        {activeTab === "Contacts" && (
          <Section title="Contacts" action={<Button size="sm" onClick={() => setEditingContact({})}><Plus size={14} /> Contact</Button>}>
            <ContactToolbar query={contactQuery} onQuery={setContactQuery} />
            {filteredContacts.length ? <ContactsTable contacts={filteredContacts} onEdit={setEditingContact} onDelete={handleDeleteContact} onView={setSelectedContact} onPrimary={handleMakePrimary} /> : <EmptyState icon={Users} title="No contacts linked." />}
          </Section>
        )}
        {activeTab === "Invoices" && (
          <Section title="Invoices">
            {linked.invoices.length ? <InvoicesTable invoices={linked.invoices} onView={setSelectedInvoice} onDownload={downloadInvoicePdf} /> : <EmptyState icon={FileText} title="No invoices linked." />}
          </Section>
        )}
        {activeTab === "Documents" && (
          <DocumentsTab
            documents={linked.documents}
            projects={linked.projects}
            groups={company.documentGroups || []}
            onUpload={() => setUploadingDocument(true)}
            onOpenFolder={(category) => setViewingFolder({ label: category, folders: [category] })}
            onOpenGroup={(group) => setViewingFolder({ label: group.name, folders: group.folders })}
            onCreateGroup={handleCreateDocumentGroup}
            onDeleteGroup={handleDeleteDocumentGroup}
            onDelete={handleDeleteDocument}
          />
        )}
        {activeTab === "Tasks" && (
          <TasksWorkspace
            tasks={linked.tasks}
            projects={linked.projects}
            view={taskView}
            onView={setTaskView}
            onCreate={() => setCreatingTask(true)}
            onMoveTask={(task, status) => saveTask({ ...task, status })}
            onDelete={handleDeleteTask}
          />
        )}
        {activeTab === "Notes" && (
          <NotesTab notes={linked.notes} onCreate={() => setEditingNote({})} onEdit={setEditingNote} onDelete={handleDeleteNote} />
        )}
        {activeTab === "Meetings" && (
          <MeetingsTab meetings={linked.meetings} calendlyUrl={company.calendlyUrl} onSaveCalendlyUrl={handleSaveCalendlyLink} token={token} />
        )}
        {activeTab === "Activity" && <ActivityTimeline items={activityItems} full />}
      </div>

      {editingCompany && <CompanyFormPanel company={company} onClose={() => setEditingCompany(false)} onSave={handleSaveCompanyEdit} />}
      {creatingProject && <ProjectFormPanel company={company} companies={companies} contacts={linked.contacts} invoices={linked.invoices} projects={linked.projects} onClose={() => setCreatingProject(false)} onSave={handleCreateProject} />}
      {editingContact && <ContactPanel company={company} contact={editingContact._id || editingContact.id ? editingContact : null} onClose={() => setEditingContact(null)} onSave={handleSaveContact} />}
      {editingNote && <NotePanel company={company} note={editingNote._id || editingNote.id ? editingNote : null} onClose={() => setEditingNote(null)} onSave={handleSaveNote} />}
      {selectedContact && <ContactDetailPanel contact={selectedContact} projects={linked.projects} meetings={linked.meetings} onClose={() => setSelectedContact(null)} onEdit={(contact) => { setSelectedContact(null); setEditingContact(contact); }} onDelete={handleDeleteContact} onPrimary={handleMakePrimary} />}
      {selectedInvoice && <InvoicePanel invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onDownload={downloadInvoicePdf} onMarkPaid={handleMarkInvoicePaid} />}
      {linkingClient && (
        <LinkClientPanel
          company={company}
          clients={clientUsers}
          loading={loadingClients}
          onClose={() => setLinkingClient(false)}
          onLink={handleLinkClient}
          onUnlink={handleUnlinkClient}
        />
      )}
      {uploadingDocument && (
        <DocumentUploadPanel
          company={company}
          defaultCategory={typeof uploadingDocument === "string" ? uploadingDocument : ""}
          onClose={() => setUploadingDocument(false)}
          onSave={handleUploadDocument}
        />
      )}
      {creatingTask && (
        <TaskPanel
          company={company}
          projects={linked.projects}
          defaultDueDate={typeof creatingTask === "string" ? creatingTask : ""}
          onClose={() => setCreatingTask(false)}
          onSave={handleCreateTask}
        />
      )}
      {viewingFolder && (
        <FolderViewerPanel
          category={viewingFolder.label}
          documents={allDocsForFolders.filter((doc) => {
            const tag = String(doc.category || doc.folder || doc.fileType || "").toLowerCase();
            return viewingFolder.folders.some((folder) => tag.includes(folder.toLowerCase().split(" ")[0]));
          })}
          onClose={() => setViewingFolder(null)}
          onDelete={handleDeleteDocument}
          onUpload={() => setUploadingDocument(viewingFolder.folders.length === 1 ? viewingFolder.folders[0] : true)}
        />
      )}
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <section className="rounded-xl border border-[#e5e7eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#f3f4f6] px-5 py-4">
        <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const ACTIVITY_PERIODS = ["All time", "Today", "This Week", "This Month", "Last 7 Days", "Last 30 Days"];

function isWithinActivityPeriod(date, period) {
  if (period === "All time") return true;
  const now = new Date();
  if (period === "Today") return sameDay(date, now);
  if (period === "This Week") return date >= startOfWeek(now);
  if (period === "This Month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (period === "Last 7 Days") return date >= new Date(now.getTime() - 7 * 86400000);
  if (period === "Last 30 Days") return date >= new Date(now.getTime() - 30 * 86400000);
  return true;
}

function ActivityTimeline({ items, full = false }) {
  const [period, setPeriod] = useState("All time");
  const filteredItems = useMemo(
    () => (full ? items.filter((item) => isWithinActivityPeriod(item.sortDate || new Date(item.date || 0), period)) : items),
    [items, period, full]
  );
  return (
    <Section
      title="Activity Timeline"
      action={
        full ? (
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-[#e5e7eb] px-2.5 py-1.5 text-xs">
            {ACTIVITY_PERIODS.map((item) => <option key={item}>{item}</option>)}
          </select>
        ) : null
      }
    >
      {filteredItems.length ? (
        <div className="space-y-4">
          {filteredItems.map((item, index) => {
            const Icon = item.icon || MessageSquare;
            return (
              <div key={`${item.type}-${item.title}-${index}`} className="flex gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff1ec] text-[#884c2d]">
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#9ca3af]">{item.dateLabel}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827]">{item.title}</p>
                  {full && <p className="text-xs text-[#6b7280]">{item.type}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : <EmptyState icon={Clock3} title={full && period !== "All time" ? "No activity in this period." : "No activity yet."} />}
    </Section>
  );
}

function InfoLine({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-0.5 text-[#374151]">{value || "Not added"}</p>
    </div>
  );
}

function ProjectsTable({ projects, companyId, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#f3f4f6] text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            <th className="py-3 pr-4">Project</th>
            <th className="py-3 pr-4">Package</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Progress</th>
            <th className="py-3 pr-4">Due</th>
            <th className="py-3 pr-4">Project Manager</th>
            <th className="py-3 text-right">Budget</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id || project._id} onClick={() => onOpen(`/admin/companies/${companyId}/projects/${project.id || project._id}`)} className="cursor-pointer border-b border-[#f9fafb] hover:bg-[#fafafa]">
              <td className="py-3 pr-4 font-semibold text-[#111827]">{project.name || "Untitled project"}</td>
              <td className="py-3 pr-4 text-[#374151]">{project.packageName || project.package || "Not linked"}</td>
              <td className="py-3 pr-4"><StatusBadge status={project.status || project.currentPhase || "Not Started"} /></td>
              <td className="py-3 pr-4 text-[#374151]">{Number(project.progress) || 0}%</td>
              <td className="py-3 pr-4 text-[#374151]">{project.dueDate || project.expectedEndDate || "Not set"}</td>
              <td className="py-3 pr-4 text-[#374151]">{project.projectManager || project.manager || "Unassigned"}</td>
              <td className="py-3 text-right font-semibold text-[#111827]">{formatINR(Number(project.budget || project.value || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkspaceToggle({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-white p-1">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold ${value === option ? "bg-[#884c2d] text-white" : "text-[#6b7280] hover:bg-[#f9fafb]"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function ProjectsWorkspace({ projects, allProjects, companyId, view, onView, onOpen, onCreate, statusFilter, packageFilter, managerFilter, timelineFilter, onStatusFilter, onPackageFilter, onManagerFilter, onTimelineFilter, packages, managers }) {
  return (
    <Section title="Projects" action={<Button size="sm" onClick={onCreate}><Plus size={14} /> Project</Button>}>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-2 sm:grid-cols-4">
          <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)} className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm">
            {["All", ...PROJECT_STATUS].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={packageFilter} onChange={(event) => onPackageFilter(event.target.value)} className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm">
            {packages.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={managerFilter} onChange={(event) => onManagerFilter(event.target.value)} className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm">
            {managers.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={timelineFilter} onChange={(event) => onTimelineFilter(event.target.value)} className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm">
            {["All", "Due Soon", "Overdue"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <WorkspaceToggle options={PROJECT_VIEWS} value={view} onChange={onView} />
      </div>
      {!allProjects.length ? <EmptyState icon={FolderKanban} title="No projects yet." action={<Button onClick={onCreate}><Plus size={14} /> New Project</Button>} /> : null}
      {allProjects.length && !projects.length ? <EmptyState icon={Filter} title="No projects match these filters." /> : null}
      {projects.length && view === "Table" ? <ProjectsTable projects={projects} companyId={companyId} onOpen={onOpen} /> : null}
      {projects.length && view === "Board" ? <ProjectBoard projects={projects} companyId={companyId} onOpen={onOpen} /> : null}
      {projects.length && view === "Timeline" ? <ProjectTimeline projects={projects} /> : null}
      {projects.length && view === "Gantt" ? <ProjectGanttMini projects={projects} /> : null}
    </Section>
  );
}

function ProjectBoard({ projects, companyId, onOpen }) {
  const stages = PROJECT_STATUS.filter((stage) => projects.some((project) => (project.status || project.currentPhase) === stage));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(stages.length ? stages : ["Unassigned"]).map((stage) => (
        <div key={stage} className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#6b7280]">{stage}</p>
          <div className="space-y-2">
            {projects.filter((project) => (project.status || project.currentPhase || "Unassigned") === stage).map((project) => (
              <button key={project.id || project._id} onClick={() => onOpen(`/admin/companies/${companyId}/projects/${project.id || project._id}`)} className="w-full rounded-lg border border-[#e5e7eb] bg-white p-3 text-left">
                <p className="font-semibold text-[#111827]">{project.name}</p>
                <p className="text-xs text-[#6b7280]">{project.progress || 0}% / {project.packageName || "No package"}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectTimeline({ projects }) {
  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <div key={project.id || project._id} className="flex gap-3 rounded-xl border border-[#e5e7eb] bg-white p-4">
          <div className="mt-1 h-3 w-3 rounded-full bg-[#884c2d]" />
          <div>
            <p className="font-semibold text-[#111827]">{project.name}</p>
            <p className="text-sm text-[#6b7280]">{project.startDate || "No start"} to {project.dueDate || project.expectedEndDate || "No due date"} / {project.status || project.currentPhase || "Not started"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectGanttMini({ projects }) {
  return <TaskGantt tasks={projects.map((project) => ({ ...project, title: project.name, dueDate: project.dueDate || project.expectedEndDate }))} projects={projects} />;
}

function ProjectOverviewGrid({ projects, companyId, onOpen }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {projects.map((project) => {
        const progress = Number(project.progress) || 0;
        return (
          <button
            key={project.id || project._id}
            onClick={() => onOpen(`/admin/companies/${companyId}/projects/${project.id || project._id}`)}
            className="rounded-xl border border-[#e5e7eb] bg-white p-5 text-left hover:border-[#884c2d]/40 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-[#111827]">{project.name || "Untitled project"}</p>
                <p className="mt-1 text-sm text-[#6b7280]">{project.packageName || project.package || "No package linked"}</p>
              </div>
              <StatusBadge status={project.status || project.currentPhase || "Not Started"} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <DetailMini label="Manager" value={project.projectManager || project.manager || "Not assigned"} />
              <DetailMini label="Primary Contact" value={project.primaryContact || project.contact || "Not linked"} />
              <DetailMini label="Start" value={project.startDate || "Not set"} />
              <DetailMini label="Due" value={project.dueDate || project.expectedEndDate || "Not set"} />
              <DetailMini label="Budget" value={formatINR(Number(project.budget || project.value || 0))} />
              <DetailMini label="Current Stage" value={project.currentPhase || project.status || "Not started"} />
            </div>
            <div className="mt-5">
              <div className="mb-1 flex justify-between text-xs font-semibold text-[#6b7280]">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
                <div className="h-full rounded-full bg-[#884c2d]" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DetailMini({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f9fafb] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-1 truncate font-semibold text-[#374151]">{value || "Not added"}</p>
    </div>
  );
}

function ContactToolbar({ query, onQuery }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#884c2d]/20">
        <Search size={14} className="text-[#9ca3af]" />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Filter contacts by name, email, phone, designation" className="w-full bg-transparent text-sm outline-none" />
      </div>
      <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e5e7eb] px-3 text-sm font-semibold text-[#6b7280]">
        <Filter size={14} />
        Filter
      </div>
    </div>
  );
}

function ContactsTable({ contacts, onEdit, onDelete, onView, onPrimary }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#f3f4f6] text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            <th className="py-3 pr-4">Contact</th>
            <th className="py-3 pr-4">Email</th>
            <th className="py-3 pr-4">Phone</th>
            <th className="py-3 pr-4">WhatsApp</th>
            <th className="py-3 pr-4">LinkedIn</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f3f4f6]">
          {contacts.map((contact) => {
            const name = contact.name || `${contact.salutation || ""} ${contact.firstName || ""} ${contact.lastName || ""}`.trim();
            return (
            <tr key={contact.id || contact._id}>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <div>
                    <p className="font-semibold text-[#111827]">{name || "Unnamed contact"}</p>
                    <p className="text-xs text-[#6b7280]">{contact.designation || "No designation"}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 pr-4 text-[#374151]"><span className="inline-flex items-center gap-1"><Mail size={12} /> {contact.email || "No email"}</span></td>
              <td className="py-3 pr-4 text-[#374151]"><span className="inline-flex items-center gap-1"><Phone size={12} /> {contact.phone || "No phone"}</span></td>
              <td className="py-3 pr-4 text-[#374151]">{contact.whatsapp || "No WhatsApp"}</td>
              <td className="py-3 pr-4 text-[#374151]">{contact.linkedin ? <a className="text-[#884c2d] hover:underline" href={contact.linkedin} target="_blank" rel="noreferrer">Open</a> : "No LinkedIn"}</td>
              <td className="py-3 pr-4"><StatusBadge status={contact.status || "Active"} /></td>
              <td className="py-3 text-right">
                <div className="inline-flex items-center gap-2">
                  <button onClick={() => onView(contact)} className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#884c2d]"><Eye size={14} /></button>
                  <button onClick={() => onEdit(contact)} className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#884c2d]"><Edit2 size={14} /></button>
                  <button onClick={() => onPrimary(contact)} className="rounded-lg p-2 text-[#6b7280] hover:bg-emerald-50 hover:text-emerald-700"><CheckCircle2 size={14} /></button>
                  <button onClick={() => onDelete(contact)} className="rounded-lg p-2 text-[#6b7280] hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesTable({ invoices, onView, onDownload }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#f3f4f6] text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            <th className="py-3 pr-4">Invoice ID</th>
            <th className="py-3 pr-4">Amount</th>
            <th className="py-3 pr-4">Date</th>
            <th className="py-3 pr-4">Due Date</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Payment</th>
            <th className="py-3 pr-4">Transaction ID</th>
            <th className="py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f3f4f6]">
          {invoices.map((invoice) => (
            <tr key={invoice.id || invoice._id}>
              <td className="py-3 pr-4 font-mono text-xs text-[#6b7280]">{invoice.invoiceId || invoice.id || invoice._id}</td>
              <td className="py-3 pr-4 font-semibold text-[#111827]">{formatINR(parseMoney(invoice.total || invoice.amount))}</td>
              <td className="py-3 pr-4 text-[#374151]">{invoice.date || invoice.createdAt || "No date"}</td>
              <td className="py-3 pr-4 text-[#374151]">{invoice.dueDate || "No due date"}</td>
              <td className="py-3 pr-4"><StatusBadge status={invoice.status || "Pending"} /></td>
              <td className="py-3 pr-4"><StatusBadge status={invoice.paymentStatus || invoice.status || "Pending"} /></td>
              <td className="py-3 pr-4 font-mono text-xs text-[#6b7280]">{invoice.transactionId || invoice.paymentId || invoice.razorpayPaymentId || "Not linked"}</td>
              <td className="py-3 text-right">
                <div className="inline-flex items-center gap-2">
                  <button onClick={() => onView(invoice)} className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#884c2d]"><Eye size={14} /></button>
                  <button onClick={() => onDownload(invoice)} className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#884c2d]"><Download size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskGantt({ tasks, projects }) {
  const projectNames = Object.fromEntries(projects.map((project) => [String(project.id || project._id), project.name]));
  const rows = tasks.map((task) => {
    const start = new Date(task.startDate || task.createdAt || Date.now());
    const end = new Date(task.dueDate || task.deadline || task.expectedEndDate || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return { ...task, safeStart, safeEnd: safeEnd < safeStart ? safeStart : safeEnd };
  });
  const min = Math.min(...rows.map((row) => row.safeStart.getTime()));
  const max = Math.max(...rows.map((row) => row.safeEnd.getTime()), min + 86400000);
  const range = Math.max(max - min, 86400000);

  const months = [];
  const cursor = new Date(min);
  cursor.setDate(1);
  const maxDate = new Date(max);
  while (cursor <= maxDate) {
    months.push({
      label: cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      left: ((cursor.getTime() - min) / range) * 100,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <Section title="Project Tasks Gantt Chart">
      <div className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div />
          <div className="relative h-6 border-b border-[#e5e7eb]">
            {months.map((month) => (
              <span key={month.label + month.left} className="absolute top-0 -translate-x-1/2 text-[10px] font-bold uppercase text-[#9ca3af]" style={{ left: `${month.left}%` }}>
                {month.label}
              </span>
            ))}
          </div>
        </div>
        {rows.map((task) => {
          const left = ((task.safeStart.getTime() - min) / range) * 100;
          const width = Math.max(((task.safeEnd.getTime() - task.safeStart.getTime()) / range) * 100, 8);
          const dateRange = `${task.safeStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${task.safeEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
          return (
            <div key={task.id || task._id} className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
              <div>
                <p className="text-sm font-semibold text-[#111827]">{task.title || task.taskName || "Untitled task"}</p>
                <p className="text-xs text-[#6b7280]">{projectNames[String(task.projectId || task.project)] || task.projectName || "No project"} / {task.status || "Backlog"}</p>
              </div>
              <div className="relative h-9 rounded-lg bg-[#f3f4f6]">
                <div
                  className="absolute top-1.5 flex h-6 items-center justify-center rounded-lg bg-[#884c2d] px-1.5 text-[10px] font-bold text-white"
                  style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                  title={dateRange}
                >
                  <span className="truncate">{dateRange}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function DocumentsTab({ documents, projects, groups, onUpload, onOpenFolder, onOpenGroup, onCreateGroup, onDeleteGroup, onDelete }) {
  const [view, setView] = useState("Grid");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupFolders, setGroupFolders] = useState([]);
  const categories = ["Contracts", "Invoices", "Proposals", "Design Files", "Source Code", "Deliverables"];
  const projectDocs = projects.flatMap((project) =>
    (project.documents || []).map((doc, index) => ({
      ...doc,
      projectName: project.name,
      _sourceProjectId: String(project.id || project._id),
      _docIndex: index,
    }))
  );
  const allDocs = [...documents, ...projectDocs];

  function docsForFolders(folders) {
    return allDocs.filter((doc) => {
      const tag = String(doc.category || doc.folder || doc.fileType || "").toLowerCase();
      return folders.some((folder) => tag.includes(folder.toLowerCase().split(" ")[0]));
    });
  }

  function toggleGroupFolder(folder) {
    setGroupFolders((prev) => (prev.includes(folder) ? prev.filter((f) => f !== folder) : [...prev, folder]));
  }

  function submitGroup() {
    if (!groupName.trim() || !groupFolders.length) return;
    onCreateGroup(groupName, groupFolders);
    setGroupName("");
    setGroupFolders([]);
    setCreatingGroup(false);
  }

  return (
    <Section
      title="Documents"
      action={
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-[#e5e7eb] bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("Grid")}
              className={`rounded-md p-1.5 ${view === "Grid" ? "bg-[#fff1ec] text-[#884c2d]" : "text-[#9ca3af] hover:text-[#374151]"}`}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setView("List")}
              className={`rounded-md p-1.5 ${view === "List" ? "bg-[#fff1ec] text-[#884c2d]" : "text-[#9ca3af] hover:text-[#374151]"}`}
              title="List view"
            >
              <ListIcon size={15} />
            </button>
          </div>
          <Button variant="secondary" onClick={() => setCreatingGroup((open) => !open)}><FolderPlus size={14} /> New Group</Button>
          <Button variant="secondary" onClick={onUpload}><Plus size={14} /> Upload Document</Button>
        </div>
      }
    >
      {creatingGroup && (
        <div className="mb-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
          <input
            autoFocus
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name, e.g. Client Onboarding"
            className="w-full rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
          />
          <p className="mt-3 text-xs font-semibold text-[#374151]">Select folders to include in this group</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {categories.map((folder) => (
              <label key={folder} className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#374151]">
                <input type="checkbox" checked={groupFolders.includes(folder)} onChange={() => toggleGroupFolder(folder)} />
                {folder}
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setCreatingGroup(false); setGroupName(""); setGroupFolders([]); }}>Cancel</Button>
            <Button size="sm" onClick={submitGroup} disabled={!groupName.trim() || !groupFolders.length}>Create Group</Button>
          </div>
        </div>
      )}

      {view === "Grid" ? (
        <div className="grid gap-4 md:grid-cols-3">
          {groups.map((group) => {
            const docs = docsForFolders(group.folders);
            return (
              <div
                key={group.name}
                role="button"
                tabIndex={0}
                onClick={() => onOpenGroup(group)}
                onKeyDown={(e) => e.key === "Enter" && onOpenGroup(group)}
                className="relative cursor-pointer rounded-xl border border-[#e5e7eb] bg-[#fff8f6] p-4 text-left transition-colors hover:border-[#884c2d]/40 hover:bg-white"
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.name); }}
                  className="absolute right-2 top-2 rounded-lg p-1.5 text-[#9ca3af] hover:bg-red-50 hover:text-red-600"
                  title="Delete group"
                >
                  <Trash2 size={13} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#884c2d]"><Layers size={17} /></div>
                  <div>
                    <p className="font-bold text-[#111827]">{group.name}</p>
                    <p className="text-xs text-[#6b7280]">{docs.length} files · {group.folders.join(", ")}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {categories.map((category) => {
            const docs = docsForFolders([category]);
            return (
              <div
                key={category}
                role="button"
                tabIndex={0}
                onClick={() => onOpenFolder(category)}
                onKeyDown={(e) => e.key === "Enter" && onOpenFolder(category)}
                className="relative cursor-pointer rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 text-left transition-colors hover:border-[#884c2d]/40 hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#884c2d]"><FolderOpen size={17} /></div>
                  <div>
                    <p className="font-bold text-[#111827]">{category}</p>
                    <p className="text-xs text-[#6b7280]">{docs.length} files</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {docs.slice(0, 3).map((doc) => (
                    <div key={doc.id || doc._id || doc.fileName || doc.name} className="rounded-lg bg-white px-3 py-2 text-xs text-[#374151]">
                      {doc.fileName || doc.name || "Untitled document"}
                    </div>
                  ))}
                  {!docs.length && <p className="text-xs text-[#9ca3af]">No files yet.</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DocumentList documents={allDocs} onDelete={onDelete} />
      )}
    </Section>
  );
}

function DocumentList({ documents, onDelete }) {
  if (!documents.length) return <EmptyState icon={FolderOpen} title="No documents yet." />;
  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const name = doc.fileName || doc.name || "Untitled document";
        const canOpen = Boolean(doc.fileUrl);
        return (
          <div key={doc.id || doc._id || name} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111827]">{name}</p>
              <p className="text-xs text-[#6b7280]">
                {(doc.fileType || "file").toUpperCase()} {doc.fileSize ? `· ${doc.fileSize}` : ""} {doc.category || doc.folder ? `· ${doc.category || doc.folder}` : ""} {doc.projectName ? `· ${doc.projectName}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canOpen ? (
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#884c2d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6f381a]">
                  View
                </a>
              ) : (
                <span className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#9ca3af]">No file</span>
              )}
              {onDelete ? (
                <button onClick={() => onDelete(doc)} className="rounded-lg p-2 text-[#6b7280] hover:bg-red-50 hover:text-red-600" title="Delete document">
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FolderViewerPanel({ category, documents, onClose, onDelete, onUpload }) {
  return (
    <SidePanel title={category} subtitle={`${documents.length} file${documents.length === 1 ? "" : "s"} in this folder.`} onClose={onClose}>
      {onUpload && (
        <Button className="mb-4" onClick={onUpload}><Plus size={14} /> Upload to this folder</Button>
      )}
      {documents.length ? (
        <div className="space-y-2">
          {documents.map((doc) => {
            const name = doc.fileName || doc.name || "Untitled document";
            const canOpen = Boolean(doc.fileUrl);
            return (
              <div key={doc.id || doc._id || name} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">{name}</p>
                  <p className="text-xs text-[#6b7280]">{(doc.fileType || "file").toUpperCase()} {doc.fileSize ? `· ${doc.fileSize}` : ""} {doc.projectName ? `· ${doc.projectName}` : ""}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canOpen ? (
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#884c2d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6f381a]">
                      View
                    </a>
                  ) : (
                    <span className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#9ca3af]">No file</span>
                  )}
                  {onDelete ? (
                    <button onClick={() => onDelete(doc)} className="rounded-lg p-2 text-[#6b7280] hover:bg-red-50 hover:text-red-600" title="Delete document">
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={FolderOpen} title="No files in this folder yet." />
      )}
    </SidePanel>
  );
}

const TASK_BOARD_STATUSES = ["Backlog", "To Do", "In Progress", "Review", "Completed", "Blocked"];
const TASK_PRIORITY_STYLE = {
  High: "bg-red-50 text-red-600 border-red-100",
  Medium: "bg-amber-50 text-amber-700 border-amber-100",
  Low: "bg-gray-50 text-gray-500 border-gray-200",
};

function TaskKanbanBoard({ tasks, onMoveTask, onDelete }) {
  async function handleDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const task = tasks.find((t) => String(t.id || t._id) === draggableId);
    if (task) await onMoveTask(task, destination.droppableId);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {TASK_BOARD_STATUSES.map((status) => {
          const columnTasks = tasks.filter((task) => (task.status || "Backlog") === status);
          return (
            <div key={status} className="flex flex-col rounded-xl border border-[#e5e7eb] bg-[#f9fafb]">
              <p className="px-3 pt-3 pb-2 text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                {status} <span className="ml-1 text-[#9ca3af]">{columnTasks.length}</span>
              </p>
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 space-y-2 p-2.5 transition-colors duration-200 ${snapshot.isDraggingOver ? "bg-[#fff1ec]" : ""}`}
                    style={{ minHeight: 90 }}
                  >
                    {columnTasks.map((task, index) => (
                      <Draggable key={task.id || task._id} draggableId={String(task.id || task._id)} index={index}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-[box-shadow,border-color] duration-200 active:cursor-grabbing ${
                              snap.isDragging ? "border-[#884c2d]/40 shadow-lg" : "border-[#e5e7eb] hover:border-[#884c2d]/30 hover:shadow-md"
                            }`}
                            style={{
                              ...prov.draggableProps.style,
                              transition: snap.isDropAnimating ? "transform 180ms cubic-bezier(.2,1,.2,1)" : prov.draggableProps.style?.transition,
                            }}
                          >
                            <div className={snap.isDragging ? "kanban-card-lift" : ""}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-[#111827]">{task.title || task.taskName || "Untitled task"}</p>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDelete(task); }}
                                  className="shrink-0 rounded-lg p-1 text-[#9ca3af] hover:bg-red-50 hover:text-red-600"
                                  title="Delete task"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${TASK_PRIORITY_STYLE[task.priority] || TASK_PRIORITY_STYLE.Medium}`}>
                                  {task.priority || "Medium"}
                                </span>
                                <span className="text-[11px] text-[#9ca3af]">{task.assignedTo || "Unassigned"}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {!columnTasks.length && (
                      <div className="grid h-16 place-items-center rounded-lg border border-dashed border-[#e5e7eb] text-[11px] font-semibold text-[#9ca3af]">
                        Drop here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

function TasksWorkspace({ tasks, projects, view, onView, onCreate, onMoveTask, onDelete }) {
  const [ganttProjectFilter, setGanttProjectFilter] = useState("All");
  const [ganttStatusFilter, setGanttStatusFilter] = useState("All");
  const [ganttPriorityFilter, setGanttPriorityFilter] = useState("All");

  if (!tasks.length) {
    return <EmptyState icon={StickyNote} title="No tasks linked." action={<Button onClick={onCreate}><Plus size={14} /> New Task</Button>} />;
  }

  const projectOptions = ["All", ...projects.map((project) => project.name).filter(Boolean)];
  const ganttTasks = tasks.filter((task) => {
    const projectName = projects.find((project) => String(project.id || project._id) === String(task.projectId || task.project))?.name || task.projectName;
    const projectOk = ganttProjectFilter === "All" || projectName === ganttProjectFilter;
    const statusOk = ganttStatusFilter === "All" || (task.status || "Backlog") === ganttStatusFilter;
    const priorityOk = ganttPriorityFilter === "All" || (task.priority || "Medium") === ganttPriorityFilter;
    return projectOk && statusOk && priorityOk;
  });

  return (
    <Section
      title="Tasks"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {view === "Gantt" && (
            <>
              <select value={ganttProjectFilter} onChange={(e) => setGanttProjectFilter(e.target.value)} className="rounded-lg border border-[#e5e7eb] px-2.5 py-1.5 text-xs">
                {projectOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={ganttStatusFilter} onChange={(e) => setGanttStatusFilter(e.target.value)} className="rounded-lg border border-[#e5e7eb] px-2.5 py-1.5 text-xs">
                {["All", ...TASK_BOARD_STATUSES].map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={ganttPriorityFilter} onChange={(e) => setGanttPriorityFilter(e.target.value)} className="rounded-lg border border-[#e5e7eb] px-2.5 py-1.5 text-xs">
                {["All", "Low", "Medium", "High", "Critical"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </>
          )}
          <Button size="sm" onClick={onCreate}><Plus size={14} /> Task</Button>
          <WorkspaceToggle options={TASK_VIEWS} value={view} onChange={onView} />
        </div>
      }
    >
      {view === "List" && <TasksTable tasks={tasks} projects={projects} onDelete={onDelete} />}
      {view === "Board" && <TaskKanbanBoard tasks={tasks} onMoveTask={onMoveTask} onDelete={onDelete} />}
      {view === "Calendar" && <CalendarTaskView tasks={tasks} onCreate={onCreate} />}
      {view === "Gantt" && (ganttTasks.length ? <TaskGantt tasks={ganttTasks} projects={projects} /> : <EmptyState icon={Filter} title="No tasks match these filters." />)}
    </Section>
  );
}

function TasksTable({ tasks, projects, onDelete }) {
  const projectNames = Object.fromEntries(projects.map((project) => [String(project.id || project._id), project.name]));
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#f3f4f6] text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            <th className="py-3 pr-4">Task</th>
            <th className="py-3 pr-4">Assigned To</th>
            <th className="py-3 pr-4">Priority</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Due Date</th>
            <th className="py-3 pr-4">Project</th>
            <th className="py-3 pr-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f3f4f6]">
          {tasks.map((task) => (
            <tr key={task.id || task._id}>
              <td className="py-3 pr-4 font-semibold text-[#111827]">{task.title || task.taskName || "Untitled task"}</td>
              <td className="py-3 pr-4 text-[#374151]">{task.assignedTo || task.assigned || "Unassigned"}</td>
              <td className="py-3 pr-4"><StatusBadge status={task.priority || "Medium"} /></td>
              <td className="py-3 pr-4"><StatusBadge status={task.status || "Backlog"} /></td>
              <td className="py-3 pr-4 text-[#374151]">{task.dueDate || task.deadline || "No due date"}</td>
              <td className="py-3 pr-4 text-[#374151]">{projectNames[String(task.projectId || task.project)] || task.projectName || "No project"}</td>
              <td className="py-3 pr-4 text-right">
                <button onClick={() => onDelete(task)} className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-red-50 hover:text-red-600" title="Delete task">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function taskDueDate(task) {
  const raw = task.dueDate || task.deadline;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const CALENDAR_VIEWS = ["Month", "Week", "Day"];

function startOfWeek(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CalendarTaskView({ tasks, onCreate }) {
  const todayDate = useMemo(() => new Date(), []);
  const [calendarView, setCalendarView] = useState("Month");
  const [cursor, setCursor] = useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()));
  const [selectedDay, setSelectedDay] = useState(null);

  const tasksWithDates = useMemo(
    () => tasks.map((task) => ({ task, due: taskDueDate(task) })).filter((t) => t.due),
    [tasks]
  );

  function tasksOnDay(date) {
    return tasksWithDates.filter(({ due }) => sameDay(due, date)).map((t) => t.task);
  }

  const monthCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      list.push({ date, tasks: tasksOnDay(date) });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, tasksWithDates]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return { date, tasks: tasksOnDay(date) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, tasksWithDates]);

  const dayTasks = tasksOnDay(cursor);

  function navigate(delta) {
    if (calendarView === "Month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    else if (calendarView === "Week") setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta * 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta));
  }

  const headerLabel = calendarView === "Month"
    ? cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : calendarView === "Week"
      ? `${startOfWeek(cursor).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${weekDays[6].date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
      : cursor.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const selectedTasks = selectedDay ? tasksOnDay(selectedDay) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-bold text-[#374151] hover:bg-[#f9fafb]">← Prev</button>
          <p className="text-sm font-bold text-[#111827]">{headerLabel}</p>
          <button onClick={() => navigate(1)} className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-bold text-[#374151] hover:bg-[#f9fafb]">Next →</button>
        </div>
        <WorkspaceToggle options={CALENDAR_VIEWS} value={calendarView} onChange={setCalendarView} />
      </div>

      {calendarView === "Month" && (
        <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
          <div className="grid grid-cols-7 bg-[#f9fafb]">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((cell, index) => {
              if (!cell) return <div key={`pad-${index}`} className="aspect-square border border-[#f3f4f6] bg-[#fafafa]" />;
              const isToday = sameDay(cell.date, todayDate);
              return (
                <button
                  key={cell.date.toISOString()}
                  onClick={() => setSelectedDay(cell.date)}
                  className={`aspect-square border border-[#f3f4f6] p-1.5 text-left transition-colors hover:bg-[#fff1ec] ${isToday ? "bg-[#fff8f6]" : "bg-white"}`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${isToday ? "bg-[#884c2d] text-white" : "text-[#374151]"}`}>
                    {cell.date.getDate()}
                  </span>
                  {cell.tasks.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {cell.tasks.slice(0, 3).map((task) => (
                        <span key={task.id || task._id} className="h-1.5 w-1.5 rounded-full bg-[#884c2d]" />
                      ))}
                      {cell.tasks.length > 3 && <span className="text-[9px] font-bold text-[#884c2d]">+{cell.tasks.length - 3}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {calendarView === "Week" && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(({ date, tasks: dayTasksList }) => {
            const isToday = sameDay(date, todayDate);
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDay(date)}
                className={`min-h-[120px] rounded-xl border p-2 text-left transition-colors hover:border-[#884c2d]/40 ${isToday ? "border-[#884c2d]/40 bg-[#fff8f6]" : "border-[#e5e7eb] bg-white"}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{WEEKDAY_LABELS[date.getDay()]}</p>
                <span className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-[#884c2d] text-white" : "text-[#374151]"}`}>{date.getDate()}</span>
                <div className="mt-2 space-y-1">
                  {dayTasksList.slice(0, 3).map((task) => (
                    <p key={task.id || task._id} className="truncate rounded bg-[#fff1ec] px-1.5 py-1 text-[10px] font-semibold text-[#884c2d]">{task.title || task.taskName || "Task"}</p>
                  ))}
                  {dayTasksList.length > 3 && <p className="text-[10px] font-bold text-[#884c2d]">+{dayTasksList.length - 3} more</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {calendarView === "Day" && (
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[#111827]">{dayTasks.length} task{dayTasks.length === 1 ? "" : "s"} due</p>
            <Button size="sm" onClick={() => onCreate(toDateInputValue(cursor))}><Plus size={14} /> New Task</Button>
          </div>
          <div className="mt-3 space-y-2">
            {dayTasks.length ? dayTasks.map((task) => (
              <div key={task.id || task._id} className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
                <p className="text-sm font-semibold text-[#111827]">{task.title || task.taskName || "Untitled task"}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge status={task.status || "Backlog"} />
                  <span className="text-xs text-[#6b7280]">{task.priority || "Medium"} priority · {task.assignedTo || "Unassigned"}</span>
                </div>
              </div>
            )) : <EmptyState icon={Calendar} title="No tasks due on this day." />}
          </div>
        </div>
      )}

      {selectedDay && (
        <SidePanel
          title={selectedDay.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          subtitle={`${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"} due this day.`}
          onClose={() => setSelectedDay(null)}
          footer={
            <div className="flex justify-end">
              <Button onClick={() => { onCreate(toDateInputValue(selectedDay)); setSelectedDay(null); }}><Plus size={14} /> New Task</Button>
            </div>
          }
        >
          {selectedTasks.length ? (
            <div className="space-y-2">
              {selectedTasks.map((task) => (
                <div key={task.id || task._id} className="rounded-xl border border-[#e5e7eb] bg-white p-3">
                  <p className="text-sm font-semibold text-[#111827]">{task.title || task.taskName || "Untitled task"}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusBadge status={task.status || "Backlog"} />
                    <span className="text-xs text-[#6b7280]">{task.priority || "Medium"} priority · {task.assignedTo || "Unassigned"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Calendar} title="No tasks due on this day." />
          )}
        </SidePanel>
      )}
    </div>
  );
}

function NotesTab({ notes, onCreate, onEdit, onDelete }) {
  return (
    <Section title="Notes" action={<Button size="sm" onClick={onCreate}><Plus size={14} /> Note</Button>}>
      {notes.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((note) => (
            <div key={note.id || note._id} className="rounded-xl border border-[#e5e7eb] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => onEdit(note)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-bold text-[#111827]">{note.title || "Untitled note"}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-[#6b7280]">{note.body || "No content."}</p>
                </button>
                <button type="button" onClick={() => onDelete(note)} className="shrink-0 rounded-lg p-1.5 text-[#9ca3af] hover:bg-red-50 hover:text-red-600" title="Delete note">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{formatDateTime(note.updatedAt || note.createdAt)}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={StickyNote} title="No notes yet." action={<Button onClick={onCreate}><Plus size={14} /> Add Note</Button>} />
      )}
    </Section>
  );
}

function NotePanel({ company, note, onClose, onSave }) {
  const [form, setForm] = useState(note || { title: "", body: "" });
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <SidePanel
      title={note?._id || note?.id ? "Edit Note" : "Add Note"}
      subtitle={`Saved against ${company.name}.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}><Save size={14} /> Save Note</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input span label="Title" value={form.title} onChange={set("title")} placeholder="e.g. Pricing discussion" />
        <Textarea span label="Note" value={form.body} onChange={set("body")} />
      </div>
    </SidePanel>
  );
}

function MeetingsTab({ meetings, calendlyUrl, onSaveCalendlyUrl, token }) {
  const [eventTypes, setEventTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typesError, setTypesError] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(calendlyUrl || "");

  useEffect(() => {
    let alive = true;
    apiGet("/api/calendly/event-types", token)
      .then((types) => {
        if (!alive) return;
        setEventTypes(Array.isArray(types) ? types : []);
        setSelectedSlug(types?.[0]?.slug || "");
      })
      .catch((err) => { if (alive) setTypesError(err.message || "Could not load Calendly event types."); })
      .finally(() => { if (alive) setLoadingTypes(false); });
    return () => { alive = false; };
  }, [token]);

  const activeEventType = eventTypes.find((type) => type.slug === selectedSlug);
  const schedulingUrl = activeEventType?.schedulingUrl || calendlyUrl;

  function submitUrl() {
    onSaveCalendlyUrl(urlInput.trim());
    setEditingUrl(false);
  }

  return (
    <div className="space-y-5">
      <Section
        title="Book a Meeting"
        action={schedulingUrl ? (
          <a href={schedulingUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#884c2d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6f381a]">
            Open in new tab
          </a>
        ) : null}
      >
        {loadingTypes ? (
          <p className="text-sm text-[#6b7280]">Loading your Calendly event types…</p>
        ) : eventTypes.length ? (
          <div className="space-y-3">
            <p className="text-sm text-[#6b7280]">Pick an event type and a free slot — booking it here creates the meeting automatically.</p>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((type) => (
                <button
                  key={type.slug}
                  type="button"
                  onClick={() => setSelectedSlug(type.slug)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedSlug === type.slug ? "border-[#884c2d] bg-[#fff1ec] text-[#884c2d]" : "border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]"
                  }`}
                >
                  {type.name} · {type.durationMinutes}m
                </button>
              ))}
            </div>
            <iframe src={schedulingUrl} title="Calendly scheduling" className="h-[700px] w-full rounded-xl border border-[#e5e7eb]" />
          </div>
        ) : (
          <div className="space-y-3">
            {typesError && (
              <p className="text-xs text-red-600">{typesError} Add a manual booking link below instead, or check that CALENDLY_ACCESS_TOKEN is configured on the server.</p>
            )}
            {!calendlyUrl || editingUrl ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitUrl()}
                  placeholder="https://calendly.com/your-name/30min"
                  className="flex-1 rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
                />
                <Button size="sm" onClick={submitUrl} disabled={!urlInput.trim()}>Save</Button>
                {calendlyUrl && <Button size="sm" variant="secondary" onClick={() => { setEditingUrl(false); setUrlInput(calendlyUrl); }}>Cancel</Button>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[#6b7280]">Pick a free slot below to finalize the meeting straight onto the calendar.</p>
                  <Button size="sm" variant="secondary" onClick={() => { setUrlInput(calendlyUrl); setEditingUrl(true); }}>Change Link</Button>
                </div>
                <iframe src={calendlyUrl} title="Calendly scheduling" className="h-[700px] w-full rounded-xl border border-[#e5e7eb]" />
              </div>
            )}
          </div>
        )}
      </Section>
      <Section title="Linked Meetings">
        {meetings.length ? <SimpleList items={meetings} /> : <EmptyState icon={Calendar} title="No meetings linked." />}
      </Section>
    </div>
  );
}

function SimpleList({ items }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
      <div className="divide-y divide-[#f3f4f6]">
        {items.map((item) => (
          <div key={item.id || item._id || item.title || item.name} className="py-3 text-sm text-[#374151]">
            {item.title || item.name || item.subject || "Untitled"}
          </div>
        ))}
      </div>
    </div>
  );
}
