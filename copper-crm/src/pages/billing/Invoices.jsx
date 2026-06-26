import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Download, FileText, Plus, ReceiptText, Save, Search, Send, WalletCards } from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import { generateInvoiceNumber } from "../../lib/invoiceDefaults";

const INVOICE_STATUSES = ["Draft", "Generated", "Sent", "Paid", "Overdue", "Cancelled"];

function parseMoney(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isPaidInvoice(invoice) {
  return String(invoice.status || invoice.paymentStatus || "").toLowerCase() === "paid";
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff1ec] text-[#884c2d]">
          <Icon size={17} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
          <p className="mt-0.5 text-lg font-bold text-[#111827]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      {options ? (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d]">
          {options.map((opt) => <option key={opt}>{opt}</option>)}
        </select>
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20" />
      )}
    </label>
  );
}

function InvoiceModal({ companies, onClose, onSave }) {
  const [form, setForm] = useState({ company: "", project: "", total: "", tax: "", issueDate: "", dueDate: "", status: "Draft" });
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      title="Generate Invoice"
      subtitle="Create an invoice linked to a company and project."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save Invoice"}</Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" value={form.company} onChange={set("company")} options={["", ...companies.map((c) => c.name)]} />
        <Field label="Project" value={form.project} onChange={set("project")} />
        <Field label="Amount" type="number" value={form.total} onChange={set("total")} />
        <Field label="GST / Tax" type="number" value={form.tax} onChange={set("tax")} />
        <Field label="Issue date" type="date" value={form.issueDate} onChange={set("issueDate")} />
        <Field label="Due date" type="date" value={form.dueDate} onChange={set("dueDate")} />
        <Field label="Status" value={form.status} onChange={set("status")} options={INVOICE_STATUSES} />
      </div>
    </SidePanel>
  );
}

export default function Invoices() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [creating, setCreating] = useState(() => Boolean(location.state?.openCreate));
  const { records: invoices, save: saveInvoice } = useCrmRecords("invoices");
  const { records: companies } = useCrmRecords("companies");
  const { showToast } = useToast();

  useEffect(() => {
    if (location.state?.openCreate) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => invoices.filter((invoice) => {
    const invoiceStatus = invoice.status || "Draft";
    const matchesStatus = status === "All" || invoiceStatus === status;
    const haystack = `${invoice.invoiceNumber || invoice.id || ""} ${invoice.company || invoice.client || ""} ${invoice.project || ""} ${invoiceStatus}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [invoices, query, status]);

  const totals = useMemo(() => {
    const paidInvoices = invoices.filter(isPaidInvoice);
    return {
      paidRevenue: paidInvoices.reduce((sum, invoice) => sum + parseMoney(invoice.total || invoice.amount), 0),
      paidTax: paidInvoices.reduce((sum, invoice) => sum + parseMoney(invoice.tax || invoice.gst), 0),
      paid: paidInvoices.length,
      overdue: invoices.filter((invoice) => invoice.status === "Overdue").length,
    };
  }, [invoices]);

  async function handleCreate(form) {
    const invoiceNumber = generateInvoiceNumber(invoices, form.issueDate || new Date());
    const created = await saveInvoice({ ...form, id: `invoice-${Date.now()}`, invoiceNumber, createdAt: new Date().toISOString() });
    setCreating(false);
    showToast({ title: "Invoice generated", message: `${created.invoiceNumber || invoiceNumber} saved.` });
  }

  async function handleStatusChange(invoice, nextStatus) {
    const now = new Date().toISOString();
    const updated = {
      ...invoice,
      status: nextStatus,
      paymentStatus: nextStatus,
      paidAt: nextStatus === "Paid" ? (invoice.paidAt || now) : null,
      updatedAt: now
    };
    await saveInvoice(updated);
    showToast({
      title: "Invoice updated",
      message: `${invoice.invoiceNumber || invoice.id || "Invoice"} marked ${nextStatus}.`
    });
  }

  function downloadInvoice(invoice) {
    // Opens the server-rendered GST tax invoice (single source of truth shared
    // with the customer + email PDF). Prefer the linked order, which carries the
    // package line-item detail; fall back to the invoice id / number.
    const base = import.meta.env.VITE_API_BASE_URL || "";
    const orderId = invoice.sourceOrderId || invoice.orderId;
    const path = orderId
      ? `/api/invoices/by-order/${orderId}/pdf`
      : `/api/invoices/${invoice._id || invoice.id || invoice.invoiceNumber}/pdf`;
    window.open(`${base}${path}`, "_blank", "noopener");
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F1F1F5]">
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">Invoices</h1>
          <p className="text-xs text-[#525866] mt-0.5">Legal billing documents, PDF generation, customer mapping, and payment mapping.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={14} /> Generate Invoice</Button>
      </div>

      <div className="p-5 xl:p-6">
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Paid Revenue" value={money(totals.paidRevenue)} icon={WalletCards} />
        <Metric label="Paid GST / Tax" value={money(totals.paidTax)} icon={ReceiptText} />
        <Metric label="Paid" value={totals.paid} icon={FileText} />
        <Metric label="Overdue" value={totals.overdue} icon={Send} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#f3f4f6] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {["All", ...INVOICE_STATUSES].map((item) => (
              <button key={item} onClick={() => setStatus(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === item ? "bg-[#884c2d] text-white" : "bg-[#f3f4f6] text-[#6b7280]"}`}>{item}</button>
            ))}
          </div>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3">
            <Search size={14} className="text-[#9ca3af]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoices" className="w-64 bg-transparent text-sm outline-none" />
          </div>
        </div>

        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
                <tr>
                  {["Invoice Number", "Company", "Project", "Amount", "GST", "Issue Date", "Due Date", "Status", "PDF"].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-medium text-[#525866]">{head}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {filtered.map((invoice) => (
                  <tr key={invoice._id || invoice.id || invoice.invoiceNumber} className="hover:bg-[#fafafa]">
                    <td className="px-4 py-3 font-mono text-xs text-[#6b7280]">{invoice.invoiceNumber || invoice.id || invoice._id}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{invoice.company || invoice.client || "Not linked"}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{invoice.project || "Not linked"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#111827]">{money(parseMoney(invoice.total || invoice.amount))}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{money(parseMoney(invoice.tax || invoice.gst))}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{formatDate(invoice.issueDate || invoice.date)}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{formatDate(invoice.dueDate)}</td>
                    <td className="px-4 py-3"><StatusSelect value={invoice.status || "Draft"} onChange={(nextStatus) => handleStatusChange(invoice, nextStatus)} /></td>
                    <td className="px-4 py-3"><button onClick={() => downloadInvoice(invoice)} className="text-[#884c2d] hover:underline"><Download size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#111827]">No invoices yet.</p>
            <p className="mt-1 text-sm text-[#6b7280]">Invoices should be generated from successful payments and stored as PDFs in Document Center.</p>
          </div>
        )}
      </section>

      {creating && <InvoiceModal companies={companies} onClose={() => setCreating(false)} onSave={handleCreate} />}
      </div>
    </div>
  );
}

function StatusSelect({ value, onChange }) {
  const tone = value === "Paid"
    ? "bg-emerald-50 text-emerald-700"
    : value === "Overdue"
      ? "bg-red-50 text-red-600"
      : value === "Sent"
        ? "bg-blue-50 text-blue-700"
        : "bg-[#f3f4f6] text-[#6b7280]";

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-full border-0 px-2 py-1 text-xs font-semibold outline-none ring-1 ring-transparent transition focus:ring-[#884c2d]/30 ${tone}`}
      aria-label="Invoice status"
    >
      {INVOICE_STATUSES.map((status) => (
        <option key={status} value={status}>{status}</option>
      ))}
    </select>
  );
}
