import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Download, FileText, Plus, ReceiptText, Save, Search, Send, WalletCards } from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import { generateInvoiceNumber } from "../../lib/invoiceDefaults";

function parseMoney(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
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
          {options.map((opt) => typeof opt === "string" ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20" />
      )}
    </label>
  );
}

function InvoiceModal({ companies, onClose, onSave }) {
  const [mode, setMode] = useState("existing");
  const [form, setForm] = useState({ 
    companyId: "", 
    companyName: "", 
    customerEmail: "",
    customerPhone: "",
    customerName: "",
    billingAddressLine1: "",
    billingAddressLine2: "",
    city: "",
    state: "",
    pincode: "",
    companyGstin: "",
    projectName: "", 
    packageName: "",
    amount: ""
  });
  
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || "";
      const res = await fetch(`${base}/api/invoices/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate invoice");
      
      await onSave(data.invoice);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      title="Generate Invoice (Manual Payment)"
      subtitle="Create an invoice linked to a company and project. A new project will be auto-generated."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save Invoice"}</Button>
        </div>
      }
    >
      <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
        <button onClick={() => setMode("existing")} className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${mode === "existing" ? "bg-white shadow" : "text-gray-500"}`}>Existing Company</button>
        <button onClick={() => setMode("new")} className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${mode === "new" ? "bg-white shadow" : "text-gray-500"}`}>New Company</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "existing" ? (
          <div className="sm:col-span-2">
            <Field label="Select Company" value={form.companyId} onChange={set("companyId")} options={[{ id: "", name: "-- Select Company --" }, ...companies].map(c => c.name ? { value: c._id || c.id, label: c.name } : null).filter(Boolean)} />
          </div>
        ) : (
          <>
            <div className="sm:col-span-2"><Field label="Company Name" value={form.companyName} onChange={set("companyName")} /></div>
            <Field label="Customer Full Name" value={form.customerName} onChange={set("customerName")} />
            <Field label="Customer Email" value={form.customerEmail} onChange={set("customerEmail")} />
            <Field label="Customer Phone" value={form.customerPhone} onChange={set("customerPhone")} />
            <Field label="GSTIN (Optional)" value={form.companyGstin} onChange={set("companyGstin")} />
            <div className="sm:col-span-2"><Field label="Address Line 1" value={form.billingAddressLine1} onChange={set("billingAddressLine1")} /></div>
            <div className="sm:col-span-2"><Field label="Address Line 2" value={form.billingAddressLine2} onChange={set("billingAddressLine2")} /></div>
            <Field label="City" value={form.city} onChange={set("city")} />
            <Field label="State" value={form.state} onChange={set("state")} />
            <Field label="Pincode" value={form.pincode} onChange={set("pincode")} />
          </>
        )}

        <div className="sm:col-span-2 mt-4 border-t pt-4">
          <h4 className="mb-3 text-sm font-bold text-gray-800">Project & Invoice Details</h4>
        </div>
        
        <div className="sm:col-span-2"><Field label="Project Name" value={form.projectName} onChange={set("projectName")} /></div>
        <Field label="Package / Service Name" value={form.packageName} onChange={set("packageName")} />
        <Field label="Amount (INR)" type="number" value={form.amount} onChange={set("amount")} />
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

  const totals = useMemo(() => ({
    gross: invoices.reduce((sum, invoice) => sum + parseMoney(invoice.total || invoice.amount), 0),
    tax: invoices.reduce((sum, invoice) => sum + parseMoney(invoice.tax || invoice.gst), 0),
    paid: invoices.filter((invoice) => invoice.status === "Paid").length,
    overdue: invoices.filter((invoice) => invoice.status === "Overdue").length,
  }), [invoices]);

  async function handleCreate(form) {
    const invoiceNumber = generateInvoiceNumber(invoices, form.issueDate || new Date());
    const created = await saveInvoice({ ...form, id: `invoice-${Date.now()}`, invoiceNumber, createdAt: new Date().toISOString() });
    setCreating(false);
    showToast({ title: "Invoice generated", message: `${created.invoiceNumber || invoiceNumber} saved.` });
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
    <div className="min-h-full bg-[#f5f6fa] p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">Finance</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111827]">Invoices</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">Legal billing documents, PDF generation, customer mapping, payment mapping, and activity.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={14} /> Generate Invoice</Button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Gross Billing" value={money(totals.gross)} icon={WalletCards} />
        <Metric label="GST / Tax" value={money(totals.tax)} icon={ReceiptText} />
        <Metric label="Paid" value={totals.paid} icon={FileText} />
        <Metric label="Overdue" value={totals.overdue} icon={Send} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#f3f4f6] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {["All", "Draft", "Generated", "Sent", "Paid", "Overdue", "Cancelled"].map((item) => (
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
                    <td className="px-4 py-3 text-sm text-[#374151]">{invoice.issueDate || invoice.date || "Not set"}</td>
                    <td className="px-4 py-3 text-sm text-[#374151]">{invoice.dueDate || "Not set"}</td>
                    <td className="px-4 py-3"><Status value={invoice.status || "Draft"} /></td>
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
  );
}

function Status({ value }) {
  const tone = value === "Paid" ? "bg-emerald-50 text-emerald-700" : value === "Overdue" ? "bg-red-50 text-red-600" : value === "Sent" ? "bg-blue-50 text-blue-700" : "bg-[#f3f4f6] text-[#6b7280]";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}
