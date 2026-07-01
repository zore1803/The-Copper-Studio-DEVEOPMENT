import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart2, ChevronLeft, ChevronRight, Clock, Copy, Grid2x2, List, Plus, Save, Tag, Trash2, TrendingUp } from "lucide-react";
import { Button } from "../../components/ui";
import SidePanel from "../../components/SidePanel";
import PhoneInput from "../../components/PhoneInput";
import FilterButton from "../../components/FilterButton";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import { isEmail, isPhone, isFutureDate } from "../../lib/validators";

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function hoursFromNow(h) {
  const d = new Date(Date.now() + h * 60 * 60 * 1000);
  const zoned = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return zoned.toISOString().slice(0, 16);
}

function toDateTimeLocal(date = new Date(Date.now() + 24 * 60 * 60 * 1000)) {
  const zoned = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return zoned.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", hour12: true });
}

const PACKAGE_CATEGORIES = ["CopperBrand", "CopperWeb", "CopperFlow"];

const PACKAGES_BY_CATEGORY = {
  CopperBrand: [
    { id: "copperbrand-essential", name: "Essential Package Plan" },
    { id: "copperbrand-advance",   name: "Advance Package Plan" },
    { id: "copperbrand-ultimate",  name: "Ultimate Package Plan" },
  ],
  CopperWeb: [
    { id: "copperweb-essential", name: "Essential Package Plan" },
    { id: "copperweb-advance",   name: "Advance Package Plan" },
    { id: "copperweb-ultimate",  name: "Ultimate Package Plan" },
  ],
  CopperFlow: [
    { id: "copperflow-essential", name: "Essential Package Plan" },
    { id: "copperflow-advance",   name: "Advance Package Plan" },
    { id: "copperflow-ultimate",  name: "Ultimate Package Plan" },
  ],
};

const VALIDITY_OPTIONS = [
  { label: "24 hours", value: 24 },
  { label: "48 hours", value: 48 },
  { label: "72 hours", value: 72 },
  { label: "96 hours", value: 96 },
  { label: "120 hours", value: 120 },
  { label: "144 hours", value: 144 },
  { label: "168 hours (7 days)", value: 168 },
  { label: "Custom", value: "custom" },
];

const COUPON_DEFAULTS = {
  discount: "",
  category: "",
  packageName: "",
  validFrom: toDateTimeLocal(new Date()),
  validityHours: 24,
  customValidity: toDateTimeLocal(),
  amountType: "percentage",
  clientName: "",
  companyName: "",
  email: "",
  phone: "",
  usageLimit: "1",
};

function validateCoupon(coupon) {
  const errors = {};
  const amount = Number(coupon.discount);
  if (String(coupon.discount).trim() === "" || Number.isNaN(amount)) errors.discount = "Enter a discount amount.";
  else if (amount <= 0) errors.discount = "Must be greater than 0.";
  else if (coupon.amountType === "percentage" && amount > 100) errors.discount = "Percentage can't exceed 100.";

  // package is optional — if category set but no package, coupon applies to all packages in that category

  if (!coupon.validFrom) errors.validFrom = "Start date & time is required.";

  if (coupon.validityHours === "custom") {
    if (!isFutureDate(coupon.customValidity)) errors.validity = "Validity must be a future date.";
  }

  if (coupon.email && !isEmail(coupon.email)) errors.email = "Enter a valid email.";
  if (coupon.phone && !isPhone(coupon.phone)) errors.phone = "Enter a valid 10-digit mobile.";

  const limit = Number(coupon.usageLimit);
  if (!coupon.usageLimit || Number.isNaN(limit) || limit < 1 || !Number.isInteger(limit)) errors.usageLimit = "Enter a whole number ≥ 1.";

  return errors;
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
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

const ITEM_H = 32;
const DRUM_H = 96; // shows 3 rows
const DRUM_PAD = (DRUM_H - ITEM_H) / 2;

function DrumColumn({ items, selected, onSelect }) {
  const idx = items.indexOf(selected);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = idx * ITEM_H;
  }, []);

  function onScroll(e) {
    const i = Math.round(e.target.scrollTop / ITEM_H);
    if (items[i] !== undefined) onSelect(items[i]);
  }

  return (
    <div className="relative flex-1">
      {/* selection highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-lg bg-[#884c2d]/10 border border-[#884c2d]/20 z-10" style={{ height: ITEM_H }} />
      {/* fade top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent z-10" />
      {/* fade bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent z-10" />
      <div
        ref={ref}
        onScroll={onScroll}
        className="overflow-y-scroll scrollbar-hide"
        style={{ height: DRUM_H, scrollSnapType: "y mandatory" }}
      >
        {/* padding items */}
        <div style={{ height: DRUM_PAD }} />
        {items.map((item) => (
          <div
            key={item}
            onClick={() => {
              onSelect(item);
              if (ref.current) ref.current.scrollTop = items.indexOf(item) * ITEM_H;
            }}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            className={`flex cursor-pointer items-center justify-center text-sm font-semibold transition-colors select-none ${item === selected ? "text-[#884c2d]" : "text-[#9ca3af]"}`}
          >
            {item}
          </div>
        ))}
        <div style={{ height: DRUM_PAD }} />
      </div>
    </div>
  );
}

function ClockPicker({ value, onChange, onClose }) {
  const parsed = value ? value.split(":") : ["12", "00"];
  const initH = Number(parsed[0]);
  const [hour24, setHour24] = useState(initH);
  const [minute, setMinute] = useState(Number(parsed[1]));
  const isAM = hour24 < 12;

  const hours12 = ["12","01","02","03","04","05","06","07","08","09","10","11"];
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const meridiem = ["AM", "PM"];

  const h12str = String(hour24 % 12 || 12).padStart(2, "0");
  const minStr = String(minute).padStart(2, "0");
  const merStr = isAM ? "AM" : "PM";

  function onHourSelect(v) {
    const base = isAM ? 0 : 12;
    setHour24(base + (Number(v) % 12));
  }
  function onMinuteSelect(v) { setMinute(Number(v)); }
  function onMerSelect(v) {
    if (v === "AM" && !isAM) setHour24((h) => h - 12);
    if (v === "PM" && isAM) setHour24((h) => h + 12);
  }

  function apply() {
    onChange(`${String(hour24).padStart(2, "0")}:${minStr}`);
    onClose();
  }

  return (
    <div className="absolute right-0 bottom-full z-50 mb-1 w-52 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-2xl shadow-black/15">
      {/* Header */}
      <div className="bg-[#884c2d] px-3 py-2 text-center">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#e2c4b4]">Select Time</p>
        <p className="text-2xl font-bold text-white tracking-wide">
          {h12str}<span className="text-[#e2c4b4]">:</span>{minStr}
          <span className="ml-1.5 text-base font-semibold text-[#e2c4b4]">{merStr}</span>
        </p>
      </div>

      {/* Drum scrollers */}
      <div className="flex items-center gap-0 px-2 pt-1">
        <DrumColumn items={hours12} selected={h12str} onSelect={onHourSelect} />
        <span className="text-lg font-bold text-[#884c2d]">:</span>
        <DrumColumn items={minutes} selected={minStr} onSelect={onMinuteSelect} />
        <DrumColumn items={meridiem} selected={merStr} onSelect={onMerSelect} />
      </div>

      <div className="flex gap-2 px-2 pb-2 pt-1">
        <button onClick={onClose} className="flex-1 rounded-lg border border-[#e5e7eb] py-1.5 text-xs font-semibold text-[#6b7280] hover:bg-[#f9fafb] transition-colors">Cancel</button>
        <button onClick={apply} className="flex-1 rounded-lg bg-[#884c2d] py-1.5 text-xs font-semibold text-white hover:bg-[#7a4228] transition-colors">Set</button>
      </div>
    </div>
  );
}

function ValidFromField({ value, onChange, error }) {
  const [clockOpen, setClockOpen] = useState(false);
  const wrapRef = useRef(null);
  const currentTime = value ? value.slice(11, 16) : "12:00";

  useEffect(() => {
    if (!clockOpen) return;
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setClockOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [clockOpen]);

  function handleTimeSet(time) {
    const datePart = value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
    onChange(`${datePart}T${time}`);
  }

  return (
    <div ref={wrapRef} className="relative">
      <span className="text-xs font-semibold text-[#374151]">Active from <span className="text-red-500">*</span></span>
      <div className={`mt-1.5 flex items-center rounded-lg border transition-all focus-within:ring-2 ${error ? "border-red-300 focus-within:ring-red-100" : "border-[#e5e7eb] focus-within:border-[#884c2d] focus-within:ring-[#884c2d]/20"}`}>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent pl-3 pr-0 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => setClockOpen((v) => !v)}
          title="Pick time with clock"
          className={`-ml-1 mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${clockOpen ? "text-[#884c2d]" : "text-[#c4c9d4] hover:text-[#884c2d]"}`}
        >
          <Clock size={14} />
        </button>
      </div>
      {error && <span className="mt-1 block text-[11px] font-semibold text-red-500">{error}</span>}
      {clockOpen && (
        <ClockPicker value={currentTime} onChange={handleTimeSet} onClose={() => setClockOpen(false)} />
      )}
    </div>
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

  const isCustom = coupon.validityHours === "custom";
  const discountLabel = coupon.amountType === "percentage" ? `${coupon.discount || 0}% off` : `Rs ${coupon.discount || 0} off`;
  const validityDisplay = isCustom
    ? formatDateTime(coupon.customValidity) || "—"
    : (() => {
        const base = coupon.validFrom ? new Date(coupon.validFrom) : new Date();
        return formatDateTime(new Date(base.getTime() + Number(coupon.validityHours) * 60 * 60 * 1000).toISOString());
      })();

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
      {/* Preview */}
      <div className="mb-4 rounded-xl border border-dashed border-[#e2c4b4] bg-[#fff1ec] p-4 text-center">
        <Tag size={20} className="mx-auto text-[#884c2d]" />
        <p className="mt-2 font-mono text-lg font-bold text-[#1F2937]">XXX-XXXX-XXX</p>
        <p className="mt-0.5 text-xs font-semibold text-[#6B7280]">
          {discountLabel} · {coupon.category ? `${coupon.category}` : "Any category"}{coupon.packageName ? ` · ${(PACKAGES_BY_CATEGORY[coupon.category] || []).find(p => p.id === coupon.packageName)?.name || coupon.packageName}` : " · Any package"}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-[#6B7280]">Active from {formatDateTime(coupon.validFrom) || "—"}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-[#884c2d]">Valid till {validityDisplay}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Discount + type */}
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

        {/* Usage limit */}
        <CouponField label="Usage limit" required type="number" inputMode="numeric" value={coupon.usageLimit} onChange={setField("usageLimit")} error={errors.usageLimit} placeholder="e.g. 1" />

        {/* Category */}
        <div>
          <label className="block">
            <span className="text-xs font-semibold text-[#374151]">Category <span className="text-[#9ca3af] font-normal">(optional)</span></span>
            <select
              value={coupon.category}
              onChange={(e) => {
                const cat = e.target.value;
                setCoupon((prev) => ({ ...prev, category: cat, packageName: "" }));
                setErrors((prev) => ({ ...prev, packageName: "" }));
              }}
              className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
            >
              <option value="">Any category</option>
              {PACKAGE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
        </div>

        {/* Package — only shown when category selected */}
        <div>
          <label className="block">
            <span className="text-xs font-semibold text-[#374151]">
              Package <span className="text-[#9ca3af] font-normal">(optional)</span>
            </span>
            <select
              value={coupon.packageName}
              onChange={(e) => { setField("packageName")(e.target.value); }}
              disabled={!coupon.category}
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                errors.packageName ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#e5e7eb] focus:border-[#884c2d] focus:ring-[#884c2d]/20"
              } disabled:bg-[#f9fafb] disabled:text-[#9ca3af]`}
            >
              <option value="">{coupon.category ? "Select a package" : "Select a category first"}</option>
              {(PACKAGES_BY_CATEGORY[coupon.category] || []).map((pkg) => (
                <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
              ))}
            </select>
          </label>
          {errors.packageName && <span className="mt-1 block text-[11px] font-semibold text-red-500">{errors.packageName}</span>}
        </div>

        {/* Start date/time */}
        <ValidFromField
          value={coupon.validFrom}
          onChange={(v) => { setField("validFrom")(v); setErrors((prev) => ({ ...prev, validFrom: "" })); }}
          error={errors.validFrom}
        />

        {/* Validity dropdown */}
        <div>
          <label className="block">
            <span className="text-xs font-semibold text-[#374151]">Valid for <span className="text-red-500">*</span></span>
            <select
              value={coupon.validityHours}
              onChange={(e) => {
                const val = e.target.value === "custom" ? "custom" : Number(e.target.value);
                setField("validityHours")(val);
                setErrors((prev) => ({ ...prev, validity: "" }));
              }}
              className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
            >
              {VALIDITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          {isCustom && (
            <div className="mt-2">
              <input
                type="datetime-local"
                value={coupon.customValidity}
                onChange={(e) => setField("customValidity")(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus:ring-2 ${errors.validity ? "border-red-300 focus:ring-red-100" : "border-[#e5e7eb] focus:border-[#884c2d] focus:ring-[#884c2d]/20"}`}
              />
              {errors.validity && <span className="mt-1 block text-[11px] font-semibold text-red-500">{errors.validity}</span>}
            </div>
          )}
        </div>

        {/* Contact info */}
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

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-0.5 text-sm text-[#374151]">{value || <span className="text-[#c4c9d4]">—</span>}</p>
    </div>
  );
}

function Status({ value }) {
  const tone = value === "Active" ? "bg-emerald-50 text-emerald-700" : value === "Redeemed" ? "bg-blue-50 text-blue-700" : /expired|cancel|revoked/i.test(value) ? "bg-red-50 text-red-600" : "bg-[#f3f4f6] text-[#6b7280]";
  return <span className={`h-fit rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}

function CouponCard({ coupon, copied, onCopy, onDelete }) {
  const displayAmount = coupon.amount || (coupon.amountType === "percentage" ? `${coupon.discount}%` : `Rs ${coupon.discount}`);
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-bold text-[#111827] truncate">{coupon.code || "NO-CODE"}</p>
            <button onClick={() => onCopy(coupon.code)} className="shrink-0 text-[#9ca3af] hover:text-[#884c2d]"><Copy size={13} /></button>
            {copied === coupon.code && <span className="text-xs font-semibold text-emerald-600">Copied</span>}
          </div>
          <p className="mt-0.5 text-xs text-[#6b7280]">
            {displayAmount} off · {coupon.category || "Any category"}{coupon.packageName ? ` · ${(PACKAGES_BY_CATEGORY[coupon.category] || []).find(p => p.id === coupon.packageName)?.name || coupon.packageName}` : " · Any package"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Status value={coupon.status || "Draft"} />
          <button
            onClick={() => onDelete(coupon)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9ca3af] hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Delete coupon"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Detail label="Company" value={coupon.assignedCompany || coupon.companyName} />
        <Detail label="Contact" value={coupon.assignedContact || coupon.clientName} />
        <Detail label="Phone" value={coupon.phone} />
        <Detail label="Email" value={coupon.email} />
        <Detail label="Active from" value={coupon.validFrom ? formatDateTime(coupon.validFrom) : "—"} />
        <Detail label="Valid till" value={coupon.validUntil ? formatDateTime(coupon.validUntil) : coupon.validity} />
        <Detail label="Usage" value={`${coupon.usageCount || 0} / ${coupon.usageLimit ?? "—"}`} />
        <Detail label="Revenue Generated" value={money(coupon.revenueGenerated)} />
        <Detail label="Category" value={coupon.category || "Any category"} />
        <Detail label="Package" value={coupon.packageName ? ((PACKAGES_BY_CATEGORY[coupon.category] || []).find(p => p.id === coupon.packageName)?.name || coupon.packageName) : "Any package"} />
      </div>
    </div>
  );
}

function CouponRow({ coupon, copied, onCopy, onDelete }) {
  const displayAmount = coupon.amount || (coupon.amountType === "percentage" ? `${coupon.discount}%` : `Rs ${coupon.discount}`);
  return (
    <div className="flex items-center gap-3 border-b border-[#f3f4f6] px-4 py-3 last:border-0 hover:bg-[#fafafa]">
      <div className="min-w-0 flex-1 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-3 items-center text-sm">
        <div className="flex items-center gap-2">
          <p className="font-mono font-bold text-[#111827] truncate">{coupon.code || "NO-CODE"}</p>
          <button onClick={() => onCopy(coupon.code)} className="shrink-0 text-[#9ca3af] hover:text-[#884c2d]"><Copy size={12} /></button>
          {copied === coupon.code && <span className="text-[11px] font-semibold text-emerald-600">Copied</span>}
        </div>
        <span className="text-[#374151] truncate">{coupon.assignedCompany || coupon.companyName || <span className="text-[#c4c9d4]">—</span>}</span>
        <span className="text-[#374151] truncate">{coupon.assignedContact || coupon.clientName || <span className="text-[#c4c9d4]">—</span>}</span>
        <span className="text-[#374151]">{displayAmount} off</span>
        <span className="text-[#374151] truncate">{coupon.validUntil ? formatDateTime(coupon.validUntil) : (coupon.validity || <span className="text-[#c4c9d4]">—</span>)}</span>
        <Status value={coupon.status || "Draft"} />
      </div>
      <button
        onClick={() => onDelete(coupon)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#9ca3af] hover:bg-red-50 hover:text-red-500 transition-colors"
        title="Delete coupon"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function Coupons() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [copied, setCopied] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState("card");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { records: coupons, save: saveCoupon, remove: removeCoupon } = useCrmRecords("coupons");
  const { showToast } = useToast();

  async function createCoupon(coupon) {
    const code = randomCode();
    const base = coupon.validFrom ? new Date(coupon.validFrom) : new Date();
    const validUntil = coupon.validityHours === "custom"
      ? new Date(coupon.customValidity).toISOString()
      : new Date(base.getTime() + Number(coupon.validityHours) * 60 * 60 * 1000).toISOString();
    try {
      const created = await saveCoupon({
        code,
        generatedAt: new Date().toLocaleString("en-IN"),
        validity: formatDateTime(validUntil),
        validUntil,
        amountType: coupon.amountType,
        amount: coupon.amountType === "percentage" ? `${coupon.discount}%` : `Rs ${coupon.discount}`,
        discount: coupon.discount,
        status: "Not used",
        clientName: coupon.clientName.trim(),
        companyName: coupon.companyName.trim(),
        email: coupon.email.trim(),
        phone: coupon.phone.trim(),
        category: coupon.category.trim(),
        packageName: coupon.packageName.trim(),
        usageLimit: Number(coupon.usageLimit),
        usageCount: 0,
        validFrom: coupon.validFrom ? new Date(coupon.validFrom).toISOString() : null,
      });
      setCreating(false);
      showToast({ title: "Coupon created", message: `${created?.code || code} stored successfully.` });
    } catch (error) {
      showToast({ type: "error", title: "Could not create coupon", message: error.message || "Please try again." });
    }
  }

  async function deleteCoupon(coupon) {
    try {
      await removeCoupon(coupon);
      showToast({ title: "Coupon deleted", message: `${coupon.code} removed.` });
    } catch (err) {
      showToast({ type: "error", title: "Could not delete", message: err.message || "Please try again." });
    } finally {
      setConfirmDelete(null);
    }
  }

  const filtered = useMemo(() => coupons.filter((coupon) => {
    const couponStatus = coupon.status || "Draft";
    const matchesStatus = statusFilter === "All" || couponStatus === statusFilter;
    const haystack = `${coupon.code || ""} ${coupon.assignedCompany || coupon.companyName || ""} ${coupon.assignedContact || coupon.clientName || ""} ${couponStatus}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [coupons, query, statusFilter]);

  useEffect(() => { setPage(1); }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const metrics = useMemo(() => {
    const active = coupons.filter((c) => c.status === "Active").length;
    const redeemed = coupons.filter((c) => c.status === "Redeemed").length;
    const expired = coupons.filter((c) => c.status === "Expired").length;
    const total = coupons.length;
    const conversionRate = total > 0 ? Math.round((redeemed / total) * 100) : 0;

    // Revenue influenced = actual discount amount given on Redeemed coupons.
    // discountAmount is stored by the server when a coupon is redeemed via an order (covers both % and fixed).
    // Fallback: for fixed-amount coupons redeemed before this field was added, derive from the amount string.
    const revenue = coupons
      .filter((c) => c.status === "Redeemed")
      .reduce((sum, c) => {
        if (c.discountAmount != null) return sum + Number(c.discountAmount);
        if (c.amountType === "fixed" || String(c.amount || "").startsWith("Rs")) {
          const raw = c.discount || String(c.amount || "").replace(/[^0-9.]/g, "");
          return sum + (Number(raw) || 0);
        }
        return sum;
      }, 0);

    return { active, redeemed, expired, revenue, conversionRate };
  }, [coupons]);

  async function copy(code) {
    if (!code) return;
    await navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 1200);
  }

  return (
    <div className="flex flex-col min-h-full bg-[#f5f6fa]">
      {/* Strip header */}
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">Coupons</h1>
          <p className="text-xs text-[#525866] mt-0.5">Marketing discounts with assignment, validity, usage limits, related orders, and revenue impact.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={14} /> Create Coupon</Button>
      </div>

      <div className="p-6">
        {/* Metrics */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Active Coupons" value={metrics.active} icon={Tag} />
          <Metric label="Redeemed" value={metrics.redeemed} icon={TrendingUp} />
          <Metric label="Expired" value={metrics.expired} icon={Tag} />
          <Metric label="Revenue Influenced" value={money(metrics.revenue)} icon={BarChart2} />
          <Metric label="Conversion Rate" value={`${metrics.conversionRate}%`} icon={TrendingUp} />
        </div>

        <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#ffffff]">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-[#f3f4f6] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 w-full lg:w-72">
              <svg className="text-[#9ca3af] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search coupons" className="w-full bg-transparent text-sm outline-none" />
            </div>

            <div className="flex items-center gap-2">
              {/* Filter */}
              <FilterButton
                panelWidth={220}
                buttonClassName="h-9 w-9"
                onReset={() => setStatusFilter("All")}
                fields={[
                  {
                    key: "status",
                    label: "Status",
                    type: "select",
                    value: statusFilter,
                    onChange: setStatusFilter,
                    options: ["All", "Draft", "Active", "Redeemed", "Expired", "Cancelled", "Revoked"],
                  },
                ]}
              />

              {/* View switcher */}
              <div className="flex items-center rounded-lg border border-[#e5e7eb] overflow-hidden">
                <button onClick={() => setViewMode("card")} className={`flex h-9 w-9 items-center justify-center transition-colors ${viewMode === "card" ? "bg-[#884c2d] text-white" : "bg-white text-[#6b7280] hover:bg-[#f3f4f6]"}`}><Grid2x2 size={15} /></button>
                <button onClick={() => setViewMode("list")} className={`flex h-9 w-9 items-center justify-center transition-colors ${viewMode === "list" ? "bg-[#884c2d] text-white" : "bg-white text-[#6b7280] hover:bg-[#f3f4f6]"}`}><List size={15} /></button>
              </div>
            </div>
          </div>

          {/* List header */}
          {viewMode === "list" && filtered.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-3 border-b border-[#f3f4f6] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
              <span>Code</span><span>Company</span><span>Contact</span><span>Amount</span><span>Validity</span><span>Status</span>
            </div>
          )}

          {filtered.length ? (
            <>
              {viewMode === "card" ? (
                <div className="grid gap-4 p-4 xl:grid-cols-2">
                  {paginated.map((coupon) => (
                    <CouponCard key={coupon._id || coupon.id || coupon.code} coupon={coupon} copied={copied} onCopy={copy} onDelete={setConfirmDelete} />
                  ))}
                </div>
              ) : (
                <div>
                  {paginated.map((coupon) => (
                    <CouponRow key={coupon._id || coupon.id || coupon.code} coupon={coupon} copied={copied} onCopy={copy} onDelete={setConfirmDelete} />
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#E1E4EA]">
                  <p className="text-sm text-[#6b7280]">
                    Showing <span className="font-semibold text-[#111827]">{Math.min(paginated.length, PAGE_SIZE)}</span> of{" "}
                    <span className="font-semibold text-[#111827]">{filtered.length}</span> Coupons
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
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${p === page ? "bg-[#884c2d] text-white" : "border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"}`}
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
              <p className="text-sm font-semibold text-[#111827]">No coupons yet.</p>
              <p className="mt-1 text-sm text-[#6b7280]">Create a coupon to assign to a company, contact, or deal and track order conversion.</p>
            </div>
          )}
        </section>

        {creating && <CouponFormPanel onClose={() => setCreating(false)} onCreate={createCoupon} />}

        {/* Delete confirm modal */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <p className="font-bold text-[#111827]">Delete coupon?</p>
              <p className="mt-1 text-sm text-[#6b7280]">
                <span className="font-mono font-semibold">{confirmDelete.code}</span> will be permanently removed. This action cannot be undone.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <button
                  onClick={() => deleteCoupon(confirmDelete)}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
