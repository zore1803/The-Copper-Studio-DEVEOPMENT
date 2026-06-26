import { useMemo, useState } from "react";
import {
  BarChart3, CalendarDays, Clock3, Copy, FileDown, FileText,
  Minus, PackageCheck, PieChart, Plus, ReceiptText, Send,
  Tag, TrendingUp, Users, WalletCards, Table2
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart as RePieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { Button } from "../../components/ui";
import { useToast } from "../../components/useToast";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import PhoneInput from "../../components/PhoneInput";
import { isEmail, isPhone, isFutureDate, isGstin, required as isRequired, isPositiveNumber } from "../../lib/validators";

function Card({ children, className = "" }) {
  return <section className={`rounded-xl border border-[#E1E4EA] bg-[#ffffff] shadow-sm shadow-gray-100/60 ${className}`}>{children}</section>;
}

function PageShell({ title, subtitle, action, children }) {
  return (
    <div className="flex flex-col min-h-full bg-[#F1F1F5]">
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">{title}</h1>
          <p className="text-xs text-[#525866] mt-0.5">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="p-5 xl:p-6">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = "", type = "text", error = "", required = false, hint = "", inputMode, maxLength }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[#525866]">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4 ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-50"
            : "border-[#E1E4EA] focus:border-[#cda88f] focus:ring-[#fff1ec]"
        }`}
      />
      {error
        ? <span className="mt-1 block text-[11px] font-semibold text-red-500">{error}</span>
        : hint
          ? <span className="mt-1 block text-[11px] text-[#9CA3AF]">{hint}</span>
          : null}
    </label>
  );
}

function DateTimeField({ label, value, onChange }) {
  const [date = "", time = ""] = String(value || "").split("T");
  const update = (nextDate, nextTime) => onChange(`${nextDate || date}T${nextTime || time || "23:59"}`);

  return (
    <div className="block">
      <span className="text-xs font-bold text-[#525866]">{label}</span>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-[#E1E4EA] px-3 py-2 text-sm outline-none focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
          <CalendarDays size={15} className="shrink-0 text-[#9CA3AF]" />
          <input
            type="date"
            value={date}
            onChange={(event) => update(event.target.value, time)}
            className="w-full bg-transparent outline-none"
          />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-[#E1E4EA] px-3 py-2 text-sm outline-none focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
          <Clock3 size={15} className="shrink-0 text-[#9CA3AF]" />
          <input
            type="time"
            step="900"
            value={time || "23:59"}
            onChange={(event) => update(date, event.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </label>
      </div>
    </div>
  );
}

function toDateTimeLocal(date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
  const zoned = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return zoned.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true
  });
}

function safeFileName(value) {
  return String(value || "proposal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function moneyValue(value) {
  return Number(String(value ?? "").replace(/[^\d.-]/g, "")) || 0;
}

function formatMoney(value) {
  return `Rs ${Math.round(value || 0).toLocaleString("en-IN")}`;
}

function formatMoneyCompact(value) {
  const amount = Math.round(value || 0);
  if (Math.abs(amount) >= 100000) return `Rs ${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `Rs ${(amount / 1000).toFixed(1)}k`;
  return `Rs ${amount}`;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#E1E4EA] bg-[#ffffff] px-3 py-2 text-xs shadow-lg shadow-gray-200/60">
      {label && <p className="mb-1 font-bold text-[#6B7280]">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 font-semibold text-[#1F2937]">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color || entry.payload?.color }} />
          {entry.name}: {typeof entry.value === "number" ? formatMoney(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

const ANALYTICS = {
  copper: "#884c2d",
  copperLight: "#c98a63",
  green: "#10b981",
  amber: "#f59e0b",
  grid: "#f0e6e1",
};

function isPaidStatus(status) {
  return ["paid", "completed", "success", "received"].includes(String(status || "").toLowerCase());
}

function isDoneStatus(status) {
  return ["completed", "delivered"].includes(String(status || "").toLowerCase());
}

function validateProposal(p) {
  const errors = {};
  if (!isRequired(p.client)) errors.client = "Client name is required.";
  if (!isRequired(p.company)) errors.company = "Company is required.";
  if (!isRequired(p.service)) errors.service = "Service is required.";
  if (!isPositiveNumber(p.value)) errors.value = "Enter a valid project value.";
  if (p.gstin && !isGstin(p.gstin)) errors.gstin = "Enter a valid 15-character GSTIN.";
  if (!isRequired(p.timeline)) errors.timeline = "Timeline is required.";
  return errors;
}

function buildProposalSections(proposal) {
  return [
    {
      title: "About The Copper Studio",
      body: "A focused implementation workspace for designing, deploying, and supporting professional client-facing digital systems with a clear onboarding and delivery process."
    },
    {
      title: "Scope and Deliverables",
      body: `${proposal.service || "This engagement"} includes planning, design coordination, implementation, review cycles, and handover documentation aligned to the selected package.`
    },
    {
      title: "Pricing and Commercials",
      body: `Estimated project value is Rs ${Number(proposal.value || 0).toLocaleString("en-IN")}. Taxes, final package inclusions, and payment milestones can be confirmed during checkout or invoice generation.`
    },
    {
      title: "Process and Timeline",
      body: `The expected completion timeline is ${proposal.timeline || "to be confirmed"}. Work moves through discovery, setup, build, review, launch, and support.`
    }
  ];
}

export function ProposalGeneratorPage() {
  const { showToast } = useToast();
  const [proposal, setProposal] = useState({
    client: "",
    company: "",
    gstin: "",
    service: "",
    value: "",
    timeline: "21 days",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [proposalNo] = useState(() => `DCS-${Date.now().toString().slice(-6)}`);
  const [proposalDate] = useState(() => new Date());

  const setField = (key) => (value) => {
    setProposal((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  const proposalValue = Number(proposal.value || 0);
  const sections = useMemo(() => buildProposalSections(proposal), [proposal]);
  const proposalDetails = useMemo(() => ([
    ["Company", proposal.company || "-"],
    ["GSTIN", proposal.gstin || "-"],
    ["Service", proposal.service || "-"],
    ["Project value", `Rs ${proposalValue.toLocaleString("en-IN")}`],
    ["Estimated timeline", proposal.timeline || "-"]
  ]), [proposal, proposalValue]);

  const proposalText = useMemo(() => (
    `PDF Contents\n\nPage 1 - Intro / Cover Page\nClient: ${proposal.client}\nCompany: ${proposal.company}\nGSTIN: ${proposal.gstin}\n\nPage 2 - About The Copper Studio\nPage 3 - Pricing of various packages\nPage 4 - Detailed comparison\nPage 5 - Process / timeline details\nTimeline: ${proposal.timeline}\nService: ${proposal.service}\nValue: Rs ${proposalValue.toLocaleString("en-IN")}\n\nPage 6 - Contact us / outro page`
  ), [proposal, proposalValue]);

  async function copyText(text, title) {
    await navigator.clipboard.writeText(text);
    showToast({ title, message: "Copied to clipboard." });
  }

  function sendProposal() {
    const nextErrors = validateProposal(proposal);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast({ title: "Check the form", message: "Please fix the highlighted fields." });
      return;
    }
    copyText(proposalText, "Proposal copied");
  }

  function adjustZoom(step) {
    setZoom((prev) => Math.min(150, Math.max(50, prev + step)));
  }

  async function createProposalPdf() {
    const nextErrors = validateProposal(proposal);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast({ title: "Check the form", message: "Please fix the highlighted fields." });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = 190;

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 150, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("The Copper Studio", margin, 58);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("The Copper Studio Proposal", margin, 82);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(proposal.service || "Project Proposal", margin, 122);
    doc.setFontSize(10);
    doc.text(`Proposal ${proposalNo}`, pageWidth - 168, 58);
    doc.text(formatDateTime(proposalDate), pageWidth - 168, 78);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(18);
    doc.text(`Prepared for ${proposal.client}`, margin, y);
    y += 30;

    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 118, 10, 10);
    proposalDetails.forEach(([label, detail], index) => {
      const rowY = y + 24 + index * 19;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(label.toUpperCase(), margin + 20, rowY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text(String(detail || "-"), margin + 150, rowY);
    });
    y += 158;

    sections.forEach((section) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 86, 8, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(17, 24, 39);
      doc.text(section.title, margin + 18, y + 24);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      doc.text(doc.splitTextToSize(section.body, pageWidth - margin * 2 - 36), margin + 18, y + 45);
      y += 104;
    });

    doc.setDrawColor(37, 99, 235);
    doc.line(margin, 780, pageWidth - margin, 780);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text("The Copper Studio", margin, 802);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text("Contact us for package confirmation, onboarding, and next steps.", margin, 818);

    doc.save(`${safeFileName(proposal.company)}-${safeFileName(proposal.service)}.pdf`);
    showToast({ title: "Proposal PDF created", message: "Professional proposal downloaded successfully." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Proposal Generator"
      subtitle="Create a ready-to-send, branded proposal draft."
      action={<Button onClick={sendProposal}><Send size={14} /> Send Proposal</Button>}
    >
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="border-b border-[#EAECF0] px-5 py-4">
            <h3 className="text-sm font-bold text-[#1F2937]">Proposal details</h3>
            <p className="text-xs text-[#9CA3AF]">Fields marked * are required.</p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Client" required value={proposal.client} onChange={setField("client")} error={errors.client} />
            <Field label="Company" required value={proposal.company} onChange={setField("company")} error={errors.company} />
            <Field label="GSTIN" value={proposal.gstin} onChange={setField("gstin")} error={errors.gstin} hint="Optional, 15 characters." maxLength={15} />
            <Field label="Service" required value={proposal.service} onChange={setField("service")} error={errors.service} placeholder="e.g. Website Design" />
            <Field label="Value" required type="number" inputMode="decimal" value={proposal.value} onChange={setField("value")} error={errors.value} placeholder="50000" />
            <Field label="Timeline" required value={proposal.timeline} onChange={setField("timeline")} error={errors.timeline} />
          </div>
          <div className="flex justify-end gap-2 border-t border-[#EAECF0] px-5 py-4">
            <Button variant="secondary" onClick={() => copyText(proposalText, "Proposal copied")}><Copy size={14} /> Copy text</Button>
            <Button onClick={createProposalPdf} disabled={busy}>
              <FileDown size={14} /> {busy ? "Generatingâ€¦" : "Save PDF"}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-[#EAECF0] px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-[#1F2937]">Live preview</h3>
              <p className="text-xs text-[#9CA3AF]">Updates as you type. Matches the exported PDF.</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-[#E1E4EA] p-1">
              <button
                type="button"
                onClick={() => adjustZoom(-10)}
                className="grid h-6 w-6 place-items-center rounded-md text-[#6B7280] hover:bg-[#f3f4f6]"
                aria-label="Zoom out"
              >
                <Minus size={13} />
              </button>
              <span className="w-10 text-center text-[11px] font-semibold text-[#525866]">{zoom}%</span>
              <button
                type="button"
                onClick={() => adjustZoom(10)}
                className="grid h-6 w-6 place-items-center rounded-md text-[#6B7280] hover:bg-[#f3f4f6]"
                aria-label="Zoom in"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
          <div className="max-h-[640px] overflow-auto bg-[#F1F1F5] p-6">
            <div
              className="mx-auto origin-top bg-[#ffffff] shadow-lg"
              style={{ width: 480, transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              <div className="bg-[#2563eb] px-7 py-6 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold">The Copper Studio</p>
                    <p className="mt-1 text-[11px] text-blue-100">The Copper Studio Proposal</p>
                  </div>
                  <div className="text-right text-[10px] text-blue-100">
                    <p>Proposal {proposalNo}</p>
                    <p className="mt-1">{formatDateTime(proposalDate)}</p>
                  </div>
                </div>
                <p className="mt-5 text-xl font-bold leading-tight">{proposal.service || "Project Proposal"}</p>
              </div>

              <div className="px-7 py-6">
                <p className="text-base font-bold text-[#1F2937]">Prepared for {proposal.client || "â€”"}</p>

                <div className="mt-4 rounded-xl border border-[#E1E4EA] p-4">
                  <dl className="space-y-2">
                    {proposalDetails.map(([label, detail]) => (
                      <div key={label} className="flex items-baseline justify-between gap-3 text-[11px]">
                        <dt className="font-bold uppercase tracking-wide text-[#6B7280]">{label}</dt>
                        <dd className="truncate text-right font-medium text-[#1F2937]">{detail}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="mt-4 space-y-3">
                  {sections.map((section) => (
                    <div key={section.title} className="rounded-lg bg-[#F5F7FA] p-4">
                      <p className="text-[12px] font-bold text-[#1F2937]">{section.title}</p>
                      <p className="mt-1.5 text-[11px] leading-5 text-[#525866]">{section.body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t-2 border-[#2563eb] pt-3">
                  <p className="text-[11px] font-bold text-[#2563eb]">The Copper Studio</p>
                  <p className="mt-0.5 text-[10px] text-[#6B7280]">Contact us for package confirmation, onboarding, and next steps.</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  );
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
  else if (!/^[A-Za-z0-9-]{2,10}$/.test(prefix)) errors.prefix = "2â€“10 letters, numbers or hyphens.";

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

export function ServicesPage() {
  const { showToast } = useToast();
  const { records: savedCoupons, save: saveCoupon } = useCrmRecords("coupons");
  const [coupon, setCoupon] = useState(COUPON_DEFAULTS);
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const setField = (key) => (value) => {
    setCoupon((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  const previewCode = `${(coupon.prefix || "COP").slice(0, 6).toUpperCase()}-XXX-XXXX`;
  const discountLabel = coupon.amountType === "percentage" ? `${coupon.discount || 0}%` : `Rs ${coupon.discount || 0}`;

  async function copyText(text, title) {
    await navigator.clipboard.writeText(text);
    showToast({ title, message: "Copied to clipboard." });
  }

  function nineDigitCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 9 }, (_, index) => {
      const char = alphabet[Math.floor(Math.random() * alphabet.length)];
      return index === 3 || index === 6 ? `-${char}` : char;
    }).join("");
  }

  async function createCoupon() {
    if (creating) return; // guard against double-submit
    const nextErrors = validateCoupon(coupon);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast({ title: "Check the form", message: "Please fix the highlighted fields." });
      return;
    }

    setCreating(true);
    try {
      const code = `${coupon.prefix.slice(0, 6).toUpperCase()}-${nineDigitCode()}`;
      const validUntil = coupon.validity ? new Date(coupon.validity).toISOString() : null;
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
      showToast({ title: "Coupon created", message: `${created?.code || code} stored successfully.` });
      // Reset the entry fields but keep the prefix + a fresh validity default.
      setCoupon((prev) => ({
        ...COUPON_DEFAULTS,
        prefix: prev.prefix,
        amountType: prev.amountType,
        validity: toDateTimeLocal(),
      }));
      setErrors({});
    } catch (error) {
      showToast({ title: "Could not create coupon", message: error.message || "Please try again." });
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageShell title="Coupon Code Generator" subtitle="Generate package-specific, time-bound discount codes.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.8fr)]">
        <Card>
          <div className="border-b border-[#EAECF0] px-5 py-4">
            <h3 className="text-sm font-bold text-[#1F2937]">Coupon details</h3>
            <p className="text-xs text-[#9CA3AF]">Fields marked * are required.</p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Prefix" required value={coupon.prefix} onChange={setField("prefix")} error={errors.prefix} hint="Shown at the start of the code." maxLength={10} />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Discount" required type="number" inputMode="decimal" value={coupon.discount} onChange={setField("discount")} error={errors.discount} placeholder={coupon.amountType === "percentage" ? "10" : "500"} />
              <label className="block">
                <span className="text-xs font-bold text-[#525866]">Type</span>
                <select value={coupon.amountType} onChange={(event) => setField("amountType")(event.target.value)} className="mt-1.5 h-[38px] w-full rounded-xl border border-[#E1E4EA] px-2 text-sm outline-none focus:border-[#cda88f] focus:ring-4 focus:ring-[#fff1ec]">
                  <option value="percentage">%</option>
                  <option value="fixed">Rs</option>
                </select>
              </label>
            </div>
            <Field label="Package" required value={coupon.packageName} onChange={setField("packageName")} error={errors.packageName} placeholder="e.g. Growth Studio" />
            <div className="sm:col-span-1">
              <DateTimeField label="Valid until" value={coupon.validity} onChange={setField("validity")} />
              {errors.validity && <span className="mt-1 block text-[11px] font-semibold text-red-500">{errors.validity}</span>}
            </div>
            <Field label="Client name" value={coupon.clientName} onChange={setField("clientName")} placeholder="Optional" />
            <Field label="Company name" value={coupon.companyName} onChange={setField("companyName")} placeholder="Optional" />
            <Field label="Email ID" type="email" value={coupon.email} onChange={setField("email")} error={errors.email} placeholder="Optional" />
            <PhoneInput label="Phone no." value={coupon.phone} onChange={setField("phone")} error={errors.phone} />
          </div>
          <div className="flex justify-end gap-2 border-t border-[#EAECF0] px-5 py-4">
            <Button variant="secondary" onClick={() => copyText(previewCode, "Prefix copied")}><Copy size={14} /> Copy prefix</Button>
            <Button onClick={createCoupon} disabled={creating}>
              <Plus size={14} /> {creating ? "Creatingâ€¦" : "Create Coupon"}
            </Button>
          </div>
        </Card>

        <div className="space-y-5">
          <div className="rounded-2xl border border-dashed border-[#e2c4b4] bg-[#fff1ec] p-5 text-center">
            <Tag size={22} className="mx-auto text-[#884c2d]" />
            <p className="mt-3 font-mono text-xl font-bold text-[#1F2937]">{previewCode}</p>
            <p className="mt-1 text-xs font-semibold text-[#6B7280]">{discountLabel} off on {coupon.packageName || "selected package"}</p>
            <p className="mt-1 text-[11px] font-semibold text-[#884c2d]">Valid till {formatDateTime(coupon.validity)}</p>
            <p className="mt-2 text-[10px] text-[#9CA3AF]">A unique code is generated on create.</p>
          </div>

          <Card>
            <div className="border-b border-[#EAECF0] px-4 py-3">
              <h3 className="text-sm font-bold text-[#1F2937]">Recent coupons</h3>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto p-3">
              {savedCoupons.length ? savedCoupons.slice(0, 8).map((item) => (
                <div key={item._id || item.code} className="rounded-xl border border-[#E1E4EA] bg-[#F5F7FA] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#374151]">{item.code}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">{item.status}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#6B7280]">{item.generatedAt} Â· Valid till {item.validity || formatDateTime(item.validUntil)}</p>
                  <p className="text-[11px] text-[#6B7280]">{item.clientName || "No client"} / {item.companyName || "No company"}</p>
                </div>
              )) : (
                <p className="px-2 py-6 text-center text-xs text-[#9CA3AF]">No coupons created yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

const tableColumns = {
  companies: ["name", "gstin", "industry", "contact", "status"],
  leads: ["name", "company", "email", "phone", "stage"],
  contacts: ["name", "company", "email", "phone", "designation"],
  deals: ["name", "account", "owner", "value", "stage"],
  tasks: ["title", "project", "status", "priority", "deadline"],
  coupons: ["code", "validity", "amount", "status", "companyName"],
};

function DataTablePreview({ type, title }) {
  const emptyFallback = useMemo(() => [], []);
  const { records, loading } = useCrmRecords(type, emptyFallback);
  const columns = tableColumns[type];
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-[#EAECF0] px-4 py-3">
        <div className="flex items-center gap-2">
          <Table2 size={16} className="text-[#2563EB]" />
          <h3 className="text-sm font-bold text-[#1F2937]">{title}</h3>
        </div>
        <span className="rounded-full bg-[#F5F7FA] px-2 py-1 text-[11px] font-bold text-[#6B7280]">{loading ? "Loading" : `${records.length} rows`}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px]">
          <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left text-xs font-medium text-[#525866]">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(records.length ? records : [{}]).slice(0, 6).map((row, index) => (
              <tr key={row._id || index} className="border-t border-[#EAECF0]">
                {columns.map((column) => (
                  <td key={column} className="max-w-40 truncate px-4 py-3 text-xs font-semibold text-[#525866]">{row[column] || "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function DatabaseTablesPage() {
  return (
    <PageShell title="Database Tables" subtitle="Separate MongoDB collections for companies, leads, contacts, deals, tasks, and coupons." action={null}>
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          {Object.keys(tableColumns).map((type) => (
            <Card key={type} className="p-4">
              <Table2 size={18} className="text-[#2563EB]" />
              <p className="mt-3 text-lg font-bold capitalize text-[#1F2937]">{type}</p>
              <p className="text-xs font-semibold text-[#6B7280]">Dedicated collection</p>
            </Card>
          ))}
        </div>
        <DataTablePreview type="companies" title="Companies table" />
        <DataTablePreview type="leads" title="Leads table" />
        <DataTablePreview type="contacts" title="Contacts table" />
        <DataTablePreview type="deals" title="Deals table" />
        <DataTablePreview type="tasks" title="Tasks table" />
        <DataTablePreview type="coupons" title="Coupons table" />
      </div>
    </PageShell>
  );
}
