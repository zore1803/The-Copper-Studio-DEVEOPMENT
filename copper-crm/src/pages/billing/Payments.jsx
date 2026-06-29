import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, CreditCard, PackageCheck, Plus, ReceiptText, Save, Search, WalletCards } from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import FilterButton from "../../components/FilterButton";

const PAYMENT_STATUSES = ["Success", "Pending", "Failed", "Refunded"];
const PAGE_SIZE = 25;

const SORT_OPTIONS = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Amount (high–low)" },
  { value: "amount_asc", label: "Amount (low–high)" },
  { value: "company_asc", label: "Company (A–Z)" }
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

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function parseMoney(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
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

function EmptyState({ title, text }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff1ec] text-[#884c2d]">
        <PackageCheck size={20} />
      </div>
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#6b7280]">{text}</p>
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

function PaymentModal({ companies, onClose, onSave }) {
  const [form, setForm] = useState({ company: "", amount: "", method: "UPI", gateway: "Razorpay", status: "Success" });
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <SidePanel
      title="New Payment"
      subtitle="Record a payment received from a client."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}><Save size={14} /> Save Payment</Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" value={form.company} onChange={set("company")} options={["", ...companies.map((c) => c.name)]} />
        <Field label="Amount" type="number" value={form.amount} onChange={set("amount")} />
        <Field label="Method" value={form.method} onChange={set("method")} options={["UPI", "Card", "Netbanking", "Wallet", "Bank Transfer"]} />
        <Field label="Gateway" value={form.gateway} onChange={set("gateway")} options={["Razorpay", "Stripe", "Manual"]} />
        <Field label="Status" value={form.status} onChange={set("status")} options={["Success", "Pending", "Failed", "Refunded"]} />
      </div>
    </SidePanel>
  );
}

export default function Payments() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [gatewayFilter, setGatewayFilter] = useState("All");
  const [sortBy, setSortBy] = useState("created_desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { records: companies } = useCrmRecords("companies");
  const { records: payments, save: savePayment } = useCrmRecords("payments");
  const { records: invoices } = useCrmRecords("invoices");
  const { showToast } = useToast();
  const sortRef = useRef(null);
  useClickOutside(sortRef, () => setSortOpen(false), sortOpen);

  const methodNames = useMemo(
    () => ["All", ...Array.from(new Set(payments.map((p) => p.paymentMethod || p.method).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)))],
    [payments]
  );
  const gatewayNames = useMemo(
    () => ["All", ...Array.from(new Set(payments.map((p) => p.gateway).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)))],
    [payments]
  );

  const filtered = useMemo(() => payments.filter((row) => {
    const rowStatus = row.status || "Pending";
    const matchesStatus = status === "All" || rowStatus === status;
    const matchesMethod = methodFilter === "All" || (row.paymentMethod || row.method) === methodFilter;
    const matchesGateway = gatewayFilter === "All" || (row.gateway || "Razorpay") === gatewayFilter;
    const haystack = `${row.paymentId || row.id || ""} ${row.company || ""} ${rowStatus}`.toLowerCase();
    return matchesStatus && matchesMethod && matchesGateway && haystack.includes(query.toLowerCase());
  }), [query, payments, status, methodFilter, gatewayFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const amt = (p) => parseMoney(p.amount);
    const created = (p) => new Date(p.createdAt || p.paidAt || p.date || 0);
    const byStr = (a, b, key) => String(a[key] || "").localeCompare(String(b[key] || ""), undefined, { sensitivity: "base" });
    switch (sortBy) {
      case "created_asc": return arr.sort((a, b) => created(a) - created(b));
      case "amount_desc": return arr.sort((a, b) => amt(b) - amt(a));
      case "amount_asc": return arr.sort((a, b) => amt(a) - amt(b));
      case "company_asc": return arr.sort((a, b) => byStr(a, b, "company"));
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
    setMethodFilter("All");
    setGatewayFilter("All");
    setQuery("");
    setPage(1);
  }

  const successfulPayments = payments.filter((payment) => ["Success", "Paid", "successful"].includes(payment.status));
  const revenue = successfulPayments.reduce((sum, payment) => sum + parseMoney(payment.amount), 0);
  const pending = payments.filter((payment) => /pending/i.test(payment.status || "")).reduce((sum, payment) => sum + parseMoney(payment.amount), 0);

  async function handleCreate(form) {
    const created = await savePayment({ ...form, id: `payment-${Date.now()}`, paymentId: `PAY-${Date.now().toString().slice(-8)}`, createdAt: new Date().toISOString() });
    showToast({ title: "Payment recorded", message: `${created.paymentId} saved.` });
    setCreating(false);
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F1F1F5]">
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">Payments</h1>
          <p className="text-xs text-[#525866] mt-0.5">Actual money received, Razorpay mapping, refund state, and payment audit.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex h-11 w-full items-center gap-2 rounded-full border border-[#1F2937]/10 px-3.5 sm:w-72">
            <Search size={16} className="text-[#1F2937]/50 shrink-0" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#1F2937]/50"
              placeholder="Search by ID, company, or status…"
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
              { key: "status", label: "Status", type: "select", value: status, onChange: (value) => { setStatus(value); setPage(1); }, options: ["All", ...PAYMENT_STATUSES] },
              { key: "method", label: "Method", type: "select", value: methodFilter, onChange: (value) => { setMethodFilter(value); setPage(1); }, options: methodNames },
              { key: "gateway", label: "Gateway", type: "select", value: gatewayFilter, onChange: (value) => { setGatewayFilter(value); setPage(1); }, options: gatewayNames }
            ]}
          />
          <button
            onClick={() => setCreating(true)}
            className="flex h-11 items-center gap-1.5 rounded-full bg-[#C57E5B] px-4 text-sm font-medium text-white hover:bg-[#b06a48] transition-colors shadow-sm"
          >
            <Plus size={16} /> New Payment
          </button>
        </div>
      </div>

      <div className="p-5 xl:p-6">
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total Revenue" value={money(revenue)} icon={WalletCards} />
        <Metric label="Pending Payments" value={money(pending)} icon={CreditCard} />
        <Metric label="Successful Payments" value={successfulPayments.length} icon={PackageCheck} />
        <Metric label="Invoices" value={invoices.length} icon={ReceiptText} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        {sorted.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
                  <tr>
                    {["Payment ID", "Company", "Amount", "Method", "Gateway", "Status"].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-medium text-[#525866]">{head}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {paginated.map((row) => (
                    <tr key={row._id || row.id || row.paymentId} className="hover:bg-[#fafafa]">
                      <td className="px-4 py-3 font-mono text-xs text-[#6b7280]">{row.paymentId || row.id || row._id}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{row.company || "Not linked"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#111827]">{money(parseMoney(row.amount))}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{row.paymentMethod || row.method || "Not added"}</td>
                      <td className="px-4 py-3 text-sm text-[#374151]">{row.gateway || "Razorpay"}</td>
                      <td className="px-4 py-3"><Status value={row.status || "Pending"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#E1E4EA]">
              <p className="text-sm text-[#6b7280]">
                Showing <span className="font-semibold text-[#111827]">{paginated.length}</span> of{" "}
                <span className="font-semibold text-[#111827]">{sorted.length}</span> Payments
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
          <EmptyState title="No payments yet." text="Successful Razorpay payments and refunds will appear here." />
        )}
      </section>

      {creating && <PaymentModal companies={companies} onClose={() => setCreating(false)} onSave={handleCreate} />}
      </div>
    </div>
  );
}

function Status({ value }) {
  const tone = /paid|success/i.test(value)
    ? "bg-emerald-50 text-emerald-700"
    : /fail|cancel|refund/i.test(value)
      ? "bg-red-50 text-red-600"
      : /pending|processing/i.test(value)
        ? "bg-amber-50 text-amber-700"
        : "bg-[#f3f4f6] text-[#6b7280]";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}
