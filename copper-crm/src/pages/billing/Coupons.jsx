import { useMemo, useState } from "react";
import { BarChart2, Copy, Plus, Save, Search, Tag, TrendingUp } from "lucide-react";
import { Button } from "../../components/ui";
import SidePanel from "../../components/SidePanel";
import PhoneInput from "../../components/PhoneInput";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import { isEmail, isPhone, isFutureDate } from "../../lib/validators";

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function toDateTimeLocal(date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
  const zoned = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return zoned.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", hour12: true });
}

const COUPON_DEFAULTS = {
  prefix: "COP-STU",
  discount: "",
  packageName: "",
  validity: toDateTimeLocal(),
  amountType: "percentage",
  clientName: "",
  companyName: "",
  email: "",
  phone: "",
};

function validateCoupon(coupon) {
  const errors = {};
  const prefix = String(coupon.prefix || "").trim();
  if (!prefix) errors.prefix = "Prefix is required.";
  else if (!/^[A-Za-z0-9-]{2,10}$/.test(prefix)) errors.prefix = "2–10 letters, numbers or hyphens.";

  const amount = Number(coupon.discount);
  if (String(coupon.discount).trim() === "" || Number.isNaN(amount)) errors.discount = "Enter a discount amount.";
  else if (amount <= 0) errors.discount = "Must be greater than 0.";
  else if (coupon.amountType === "percentage" && amount > 100) errors.discount = "Percentage can't exceed 100.";

  if (!String(coupon.packageName || "").trim()) errors.packageName = "Package is required.";
  if (!isFutureDate(coupon.validity)) errors.validity = "Validity must be a future date.";
  if (coupon.email && !isEmail(coupon.email)) errors.email = "Enter a valid email.";
  if (coupon.phone && !isPhone(coupon.phone)) errors.phone = "Enter a valid 10-digit mobile.";
  return errors;
}

function nineDigitCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 9 }, (_, index) => {
    const char = alphabet[Math.floor(Math.random() * alphabet.length)];
    return index === 3 || index === 6 ? `-${char}` : char;
  }).join("");
}

function CouponField({ label, value, onChange, error = "", required = false, type = "text", placeholder = "", maxLength, inputMode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#374151]">{label}{required && <span className="text-red-500"> *</span>}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus:ring-2 ${
          error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#e5e7eb] focus:border-[#884c2d] focus:ring-[#884c2d]/20"
        }`}
      />
      {error && <span className="mt-1 block text-[11px] font-semibold text-red-500">{error}</span>}
    </label>
  );
}

function CouponFormPanel({ onClose, onCreate }) {
  const [coupon, setCoupon] = useState(COUPON_DEFAULTS);
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const setField = (key) => (value) => {
    setCoupon((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  const previewCode = `${(coupon.prefix || "COP").slice(0, 6).toUpperCase()}-XXX-XXXX`;
  const discountLabel = coupon.amountType === "percentage" ? `${coupon.discount || 0}%` : `Rs ${coupon.discount || 0}`;

  async function submit() {
    if (creating) return;
    const next = validateCoupon(coupon);
    setErrors(next);
    if (Object.keys(next).length) return;
    setCreating(true);
    try {
      await onCreate(coupon);
    } finally {
      setCreating(false);
    }
  }

  return (
    <SidePanel
      title="Create Coupon"
      subtitle="Generate a package-specific, time-bound discount code. Fields marked * are required."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={creating}><Save size={14} /> {creating ? "Creating…" : "Create Coupon"}</Button>
        </div>
      }
    >
      <div className="mb-4 rounded-xl border border-dashed border-[#e2c4b4] bg-[#fff1ec] p-4 text-center">
        <Tag size={20} className="mx-auto text-[#884c2d]" />
        <p className="mt-2 font-mono text-lg font-bold text-[#1F2937]">{previewCode}</p>
        <p className="mt-0.5 text-xs font-semibold text-[#6B7280]">{discountLabel} off on {coupon.packageName || "selected package"}</p>
        <p className="mt-1 text-[11px] font-semibold text-[#884c2d]">Valid till {formatDateTime(coupon.validity)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CouponField label="Prefix" required value={coupon.prefix} onChange={setField("prefix")} error={errors.prefix} maxLength={10} placeholder="COP-STU" />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <CouponField label="Discount" required type="number" inputMode="decimal" value={coupon.discount} onChange={setField("discount")} error={errors.discount} placeholder={coupon.amountType === "percentage" ? "10" : "500"} />
          <label className="block">
            <span className="text-xs font-semibold text-[#374151]">Type</span>
            <select value={coupon.amountType} onChange={(e) => setField("amountType")(e.target.value)} className="mt-1.5 h-[38px] w-full rounded-lg border border-[#e5e7eb] px-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20">
              <option value="percentage">%</option>
              <option value="fixed">Rs</option>
            </select>
          </label>
        </div>
        <CouponField label="Package" required value={coupon.packageName} onChange={setField("packageName")} error={errors.packageName} placeholder="e.g. Growth Studio" />
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">Valid until</span>
          <input
            type="datetime-local"
            value={coupon.validity}
            onChange={(e) => setField("validity")(e.target.value)}
            className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus:ring-2 ${errors.validity ? "border-red-300 focus:ring-red-100" : "border-[#e5e7eb] focus:border-[#884c2d] focus:ring-[#884c2d]/20"}`}
          />
          {errors.validity && <span className="mt-1 block text-[11px] font-semibold text-red-500">{errors.validity}</span>}
        </label>
        <CouponField label="Client name" value={coupon.clientName} onChange={setField("clientName")} placeholder="Optional" />
        <CouponField label="Company name" value={coupon.companyName} onChange={setField("companyName")} placeholder="Optional" />
        <CouponField label="Email ID" type="email" value={coupon.email} onChange={setField("email")} error={errors.email} placeholder="Optional" />
        <PhoneInput label="Phone no." value={coupon.phone} onChange={setField("phone")} error={errors.phone} />
      </div>
    </SidePanel>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-[#ffffff] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff1ec] text-[#884c2d]"><Icon size={17} /></div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
          <p className="mt-0.5 text-lg font-bold text-[#111827]">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function Coupons() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [copied, setCopied] = useState("");
  const [creating, setCreating] = useState(false);
  const { records: coupons, save: saveCoupon } = useCrmRecords("coupons");
  const { showToast } = useToast();

  async function createCoupon(coupon) {
    const code = `${coupon.prefix.slice(0, 6).toUpperCase()}-${nineDigitCode()}`;
    const validUntil = coupon.validity ? new Date(coupon.validity).toISOString() : null;
    try {
      const created = await saveCoupon({
        code,
        generatedAt: new Date().toLocaleString("en-IN"),
        validity: formatDateTime(validUntil),
        validUntil,
        amountType: coupon.amountType,
        amount: coupon.amountType === "percentage" ? `${coupon.discount}%` : `Rs ${coupon.discount}`,
        status: "Not used",
        clientName: coupon.clientName.trim(),
        companyName: coupon.companyName.trim(),
        email: coupon.email.trim(),
        phone: coupon.phone.trim(),
        packageName: coupon.packageName.trim(),
      });
      setCreating(false);
      showToast({ title: "Coupon created", message: `${created?.code || code} stored successfully.` });
    } catch (error) {
      showToast({ type: "error", title: "Could not create coupon", message: error.message || "Please try again." });
    }
  }

  const filtered = useMemo(() => coupons.filter((coupon) => {
    const couponStatus = coupon.status || "Draft";
    const matchesStatus = status === "All" || couponStatus === status;
    const haystack = `${coupon.code || ""} ${coupon.assignedCompany || coupon.companyName || ""} ${coupon.assignedContact || coupon.clientName || ""} ${couponStatus}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [coupons, query, status]);

  const metrics = useMemo(() => ({
    active: coupons.filter((coupon) => coupon.status === "Active").length,
    redeemed: coupons.filter((coupon) => coupon.status === "Redeemed").length,
    expired: coupons.filter((coupon) => coupon.status === "Expired").length,
    revenue: coupons.reduce((sum, coupon) => sum + Number(coupon.revenueGenerated || 0), 0),
  }), [coupons]);

  async function copy(code) {
    if (!code) return;
    await navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 1200);
  }

  return (
    <div className="flex flex-col min-h-full bg-[#f5f6fa]">
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">Coupons</h1>
          <p className="text-xs text-[#525866] mt-0.5">Marketing discounts with assignment, validity, usage limits, related orders, and revenue impact.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={14} /> Create Coupon</Button>
      </div>
      <div className="p-6">

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Active Coupons" value={metrics.active} icon={Tag} />
        <Metric label="Redeemed" value={metrics.redeemed} icon={TrendingUp} />
        <Metric label="Expired" value={metrics.expired} icon={Tag} />
        <Metric label="Revenue Influenced" value={money(metrics.revenue)} icon={BarChart2} />
        <Metric label="Conversion Rate" value="0%" icon={TrendingUp} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#ffffff]">
        <div className="flex flex-col gap-3 border-b border-[#f3f4f6] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {["All", "Draft", "Active", "Redeemed", "Expired", "Cancelled", "Revoked"].map((item) => (
              <button key={item} onClick={() => setStatus(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === item ? "bg-[#884c2d] text-white" : "bg-[#f3f4f6] text-[#6b7280]"}`}>{item}</button>
            ))}
          </div>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3">
            <Search size={14} className="text-[#9ca3af]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search coupons" className="w-64 bg-transparent text-sm outline-none" />
          </div>
        </div>

        {filtered.length ? (
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {filtered.map((coupon) => (
              <div key={coupon._id || coupon.id || coupon.code} className="rounded-xl border border-[#e5e7eb] bg-[#ffffff] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-bold text-[#111827]">{coupon.code || "NO-CODE"}</p>
                      <button onClick={() => copy(coupon.code)} className="text-[#9ca3af] hover:text-[#884c2d]"><Copy size={13} /></button>
                      {copied === coupon.code && <span className="text-xs font-semibold text-emerald-600">Copied</span>}
                    </div>
                    <p className="mt-1 text-xs text-[#6b7280]">{coupon.type || coupon.amountType || "Discount"} · {coupon.value || coupon.amount || "Value not set"}</p>
                  </div>
                  <Status value={coupon.status || "Draft"} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Company" value={coupon.assignedCompany || coupon.companyName} />
                  <Detail label="Contact" value={coupon.assignedContact || coupon.clientName} />
                  <Detail label="Validity" value={coupon.validUntil || coupon.validity} />
                  <Detail label="Usage" value={`${coupon.usageCount || 0} / ${coupon.usageLimit || "Unlimited"}`} />
                  <Detail label="Orders Generated" value={coupon.ordersGenerated || 0} />
                  <Detail label="Revenue Generated" value={money(coupon.revenueGenerated)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#111827]">No coupons yet.</p>
            <p className="mt-1 text-sm text-[#6b7280]">Coupons should be assigned to a company, contact, lead, or deal and tracked through order conversion.</p>
          </div>
        )}
      </section>

      {creating && <CouponFormPanel onClose={() => setCreating(false)} onCreate={createCoupon} />}
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-[#374151]">{value || "Not added"}</p>
    </div>
  );
}

function Status({ value }) {
  const tone = value === "Active" ? "bg-emerald-50 text-emerald-700" : value === "Redeemed" ? "bg-blue-50 text-blue-700" : /expired|cancel|revoked/i.test(value) ? "bg-red-50 text-red-600" : "bg-[#f3f4f6] text-[#6b7280]";
  return <span className={`h-fit rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}
