import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, Download, FileText, Plus, ReceiptText, Save, Search, Send, WalletCards } from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import FilterButton from "../../components/FilterButton";
import { generateInvoiceNumber } from "../../lib/invoiceDefaults";
import { generateDefaultProjectName, generateProjectCode } from "../../lib/projectDefaults";

const INVOICE_STATUSES = ["Draft", "Generated", "Sent", "Paid", "Overdue", "Cancelled"];
const UNPAID_STATUS_ACTIONS = ["Draft", "Generated", "Paid"];
const PAGE_SIZE = 25;

const SORT_OPTIONS = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "number_asc", label: "Invoice # (A–Z)" },
  { value: "number_desc", label: "Invoice # (Z–A)" },
  { value: "amount_desc", label: "Amount (high–low)" },
  { value: "amount_asc", label: "Amount (low–high)" }
];

// Closes the sort dropdown when clicking outside its trigger/menu.
function useClickOutside(ref, onOutside, active) {
  useEffect(() => {
    if (!active) return;
    function onDown(event) {
      if (ref.current && ref.current.contains(event.target)) return;
      onOutside();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [active, onOutside, ref]);
}

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

function normalizedStatus(value, fallback = "Draft") {
  const status = String(value || "").trim();
  if (!status) return fallback;
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function isDraftLikeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return !status || status === "draft" || status === "pending" || status === "generated";
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

function Field({ label, value, onChange, type = "text", options, disabled = false, hint = "" }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      {options ? (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] disabled:bg-[#f3f4f6] disabled:text-[#6b7280]">
          {options.map((opt) => (
            typeof opt === "string"
              ? <option key={opt} value={opt}>{opt}</option>
              : <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20 disabled:bg-[#f3f4f6] disabled:text-[#6b7280]" />
      )}
      {hint && <span className="mt-1 block text-[11px] text-[#9ca3af]">{hint}</span>}
    </label>
  );
}

function InvoiceModal({ companies, projects, onClose, onSave }) {
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
    companyWebsite: "",
    projectName: "",
    packageName: "",
    amount: ""
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const companyOptions = [
    { value: "", label: "Select company" },
    ...companies.map((company) => ({
      value: company._id || company.id,
      label: company.name || company.companyName || "Unnamed company"
    }))
  ];
  const selectedCompany = useMemo(
    () => companies.find((company) => String(company._id || company.id) === String(form.companyId)),
    [companies, form.companyId]
  );
  const normalizedSelectedCompany = useMemo(
    () => selectedCompany ? { ...selectedCompany, name: selectedCompany.name || selectedCompany.companyName || "Company" } : null,
    [selectedCompany]
  );
  const generatedProjectName = useMemo(
    () => normalizedSelectedCompany ? generateDefaultProjectName(normalizedSelectedCompany, projects) : "",
    [normalizedSelectedCompany, projects]
  );
  const generatedProjectCode = useMemo(
    () => normalizedSelectedCompany ? generateProjectCode(normalizedSelectedCompany, projects) : "",
    [normalizedSelectedCompany, projects]
  );

  useEffect(() => {
    if (mode !== "existing") return;
    setForm((prev) => ({ ...prev, projectName: generatedProjectName }));
  }, [mode, generatedProjectName]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = mode === "existing"
        ? { ...form, companyName: "", projectName: generatedProjectName }
        : { ...form, companyId: "" };
      await onSave(payload);
    } catch (error) {
      alert(error.message || "Could not generate invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      title="Generate Invoice"
      subtitle="Create a paid manual invoice and link it to a company and project."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save Invoice"}</Button>
        </div>
      }
    >
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-[#f3f4f6] p-1">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${mode === "existing" ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
        >
          Existing Company
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${mode === "new" ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
        >
          New Company
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "existing" ? (
          <div className="sm:col-span-2">
            <Field label="Select Company" value={form.companyId} onChange={set("companyId")} options={companyOptions} />
          </div>
        ) : (
          <>
            <div className="sm:col-span-2"><Field label="Company Name" value={form.companyName} onChange={set("companyName")} /></div>
            <Field label="Customer Full Name" value={form.customerName} onChange={set("customerName")} />
            <Field label="Customer Email" type="email" value={form.customerEmail} onChange={set("customerEmail")} />
            <Field label="Customer Phone" value={form.customerPhone} onChange={set("customerPhone")} />
            <Field label="GSTIN" value={form.companyGstin} onChange={set("companyGstin")} />
            <Field label="Website" value={form.companyWebsite} onChange={set("companyWebsite")} />
            <div className="sm:col-span-2"><Field label="Address Line 1" value={form.billingAddressLine1} onChange={set("billingAddressLine1")} /></div>
            <div className="sm:col-span-2"><Field label="Address Line 2" value={form.billingAddressLine2} onChange={set("billingAddressLine2")} /></div>
            <Field label="City" value={form.city} onChange={set("city")} />
            <Field label="State" value={form.state} onChange={set("state")} />
            <Field label="Pincode" value={form.pincode} onChange={set("pincode")} />
          </>
        )}

        <div className="sm:col-span-2 mt-2 border-t border-[#f3f4f6] pt-4">
          <p className="text-sm font-bold text-[#111827]">Project & Invoice Details</p>
        </div>
        <div className="sm:col-span-2">
          {mode === "existing" ? (
            <Field
              label="Project Name"
              value={generatedProjectName || "Select a company to generate"}
              onChange={() => {}}
              disabled
              hint={generatedProjectCode ? `Project ID: ${generatedProjectCode}` : "Auto-generated after company selection and locked for manual invoices."}
            />
          ) : (
            <Field label="Project Name" value={form.projectName} onChange={set("projectName")} />
          )}
        </div>
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
  const [companyFilter, setCompanyFilter] = useState("All");
  const [sortBy, setSortBy] = useState("created_desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(() => Boolean(location.state?.openCreate));
  const { records: invoices, save: saveInvoice } = useCrmRecords("invoices");
  const { records: companies } = useCrmRecords("companies");
  const { records: projects } = useCrmRecords("projects");
  const { showToast } = useToast();
  const sortRef = useRef(null);
  useClickOutside(sortRef, () => setSortOpen(false), sortOpen);

  useEffect(() => {
    if (location.state?.openCreate) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyNames = useMemo(
    () => ["All", ...Array.from(new Set(invoices.map((i) => i.company || i.client).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)))],
    [invoices]
  );

  const filtered = useMemo(() => invoices.filter((invoice) => {
    const invoiceStatus = invoice.status || "Draft";
    const matchesStatus = status === "All" || invoiceStatus === status;
    const matchesCompany = companyFilter === "All" || (invoice.company || invoice.client) === companyFilter;
    const haystack = `${invoice.invoiceNumber || invoice.id || ""} ${invoice.company || invoice.client || ""} ${invoice.project || ""} ${invoiceStatus}`.toLowerCase();
    return matchesStatus && matchesCompany && haystack.includes(query.toLowerCase());
  }), [invoices, query, status, companyFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const num = (i) => String(i.invoiceNumber || i.id || "");
    const amt = (i) => parseMoney(i.total || i.amount);
    const created = (i) => new Date(i.createdAt || i.issueDate || i.date || 0);
    switch (sortBy) {
      case "created_asc": return arr.sort((a, b) => created(a) - created(b));
      case "number_asc": return arr.sort((a, b) => num(a).localeCompare(num(b), undefined, { numeric: true }));
      case "number_desc": return arr.sort((a, b) => num(b).localeCompare(num(a), undefined, { numeric: true }));
      case "amount_desc": return arr.sort((a, b) => amt(b) - amt(a));
      case "amount_asc": return arr.sort((a, b) => amt(a) - amt(b));
      case "created_desc":
      default: return arr.sort((a, b) => created(b) - created(a));
    }
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  function resetFilters() {
    setStatus("All");
    setCompanyFilter("All");
    setQuery("");
    setPage(1);
  }

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
    const base = import.meta.env.VITE_API_BASE_URL || "";
    const response = await fetch(`${base}/api/invoices/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not generate invoice.");
    const created = data.invoice
      ? await saveInvoice(data.invoice)
      : await saveInvoice({
          ...form,
          id: `invoice-${Date.now()}`,
          invoiceNumber: generateInvoiceNumber(invoices, new Date()),
          createdAt: new Date().toISOString()
        });
    setCreating(false);
    showToast({ title: "Invoice generated", message: `${created.invoiceNumber || created.id || "Invoice"} saved.` });
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
    window.open(`${base}${path}?download=1`, "_blank", "noopener");
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F1F1F5]">
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">Invoices</h1>
          <p className="text-xs text-[#525866] mt-0.5">Legal billing documents, PDF generation, customer mapping, and payment mapping.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex h-11 w-full items-center gap-2 rounded-full border border-[#1F2937]/10 px-3.5 sm:w-72">
            <Search size={16} className="text-[#1F2937]/50 shrink-0" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#1F2937]/50"
              placeholder="Search by number, company, or project…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          {/* Sort */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen((value) => !value)}
              className={`flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${sortOpen ? "border-[#884c2d] bg-[#fff8f6] text-[#884c2d]" : "border-[#E1E4EA] bg-white text-[#1F2937] hover:bg-[#f9fafb]"}`}
            >
              <ArrowUpDown size={15} />
              <span className="hidden sm:inline">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort"}</span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-[#e5e7eb] bg-white p-1 shadow-lg">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); setPage(1); }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f9fafb] ${sortBy === opt.value ? "font-semibold text-[#884c2d]" : "text-[#374151]"}`}
                  >
                    {opt.label}
                    {sortBy === opt.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <FilterButton
            onReset={resetFilters}
            buttonClassName="h-11 w-11"
            fields={[
              { key: "status", label: "Status", type: "select", value: status, onChange: (value) => { setStatus(value); setPage(1); }, options: ["All", ...INVOICE_STATUSES] },
              { key: "company", label: "Company", type: "select", value: companyFilter, onChange: (value) => { setCompanyFilter(value); setPage(1); }, options: companyNames }
            ]}
          />
          <button
            onClick={() => setCreating(true)}
            className="flex h-11 items-center gap-1.5 rounded-full bg-[#C57E5B] px-4 text-sm font-medium text-white hover:bg-[#b06a48] transition-colors shadow-sm"
          >
            <Plus size={16} /> Generate Invoice
          </button>
        </div>
      </div>

      <div className="p-5 xl:p-6">
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Paid Revenue" value={money(totals.paidRevenue)} icon={WalletCards} />
        <Metric label="Paid GST / Tax" value={money(totals.paidTax)} icon={ReceiptText} />
        <Metric label="Paid" value={totals.paid} icon={FileText} />
        <Metric label="Overdue" value={totals.overdue} icon={Send} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        {sorted.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
                  <tr>
                    {["Invoice Number", "Company", "Project", "Amount", "GST", "Issue Date", "Due Date", "Status", "PDF"].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-medium text-[#525866]">{head}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {paginated.map((invoice) => (
                    <tr key={invoice._id || invoice.id || invoice.invoiceNumber} className="hover:bg-[#fafafa]">
                      <td className="px-4 py-3 font-mono text-xs text-[#6b7280]">{invoice.invoiceNumber || invoice.id || invoice._id}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{invoice.company || invoice.client || "Not linked"}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{invoice.project || "Not linked"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#111827]">{money(parseMoney(invoice.total || invoice.amount))}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{money(parseMoney(invoice.tax || invoice.gst))}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{formatDate(invoice.issueDate || invoice.date)}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{formatDate(invoice.dueDate)}</td>
                      <td className="px-4 py-3"><InvoiceStatus invoice={invoice} onChange={(nextStatus) => handleStatusChange(invoice, nextStatus)} /></td>
                      <td className="px-4 py-3"><button onClick={() => downloadInvoice(invoice)} className="text-[#884c2d] hover:underline"><Download size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#E1E4EA]">
              <p className="text-sm text-[#6b7280]">
                Showing <span className="font-semibold text-[#111827]">{paginated.length}</span> of{" "}
                <span className="font-semibold text-[#111827]">{sorted.length}</span> Invoices
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                      p === page
                        ? "bg-[#884c2d] text-white"
                        : "border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#111827]">No invoices yet.</p>
            <p className="mt-1 text-sm text-[#6b7280]">Invoices should be generated from successful payments and stored as PDFs in Document Center.</p>
          </div>
        )}
      </section>

      {creating && <InvoiceModal companies={companies} projects={projects} onClose={() => setCreating(false)} onSave={handleCreate} />}
      </div>
    </div>
  );
}

function statusTone(value) {
  return value === "Paid"
    ? "bg-emerald-50 text-emerald-700"
    : value === "Overdue"
      ? "bg-red-50 text-red-600"
      : value === "Sent"
        ? "bg-blue-50 text-blue-700"
        : "bg-[#f3f4f6] text-[#6b7280]";
}

function InvoiceStatus({ invoice, onChange }) {
  const rawValue = invoice.status || invoice.paymentStatus || "";
  const value = isDraftLikeStatus(rawValue) ? normalizedStatus(rawValue, "Draft") : normalizedStatus(rawValue);
  if (!isDraftLikeStatus(rawValue)) {
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(value)}`}>{value}</span>;
  }

  return <StatusSelect value={value} onChange={onChange} />;
}

function StatusSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-full border-0 px-2 py-1 text-xs font-semibold outline-none ring-1 ring-transparent transition focus:ring-[#884c2d]/30 ${statusTone(value)}`}
      aria-label="Invoice status"
    >
      {UNPAID_STATUS_ACTIONS.map((status) => (
        <option key={status} value={status}>{status}</option>
      ))}
    </select>
  );
}
