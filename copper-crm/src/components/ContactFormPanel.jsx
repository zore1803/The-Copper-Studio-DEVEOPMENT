import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "./ui";
import SidePanel from "./SidePanel";
import PhoneInput from "./PhoneInput";
import { useToast } from "./useToast";
import { useAuth } from "../auth/useAuth";
import { apiPost } from "../lib/api";
import { isEmail, isPhone } from "../lib/validators";

// Single source of truth for the contact form used everywhere a contact is
// created or edited — the Contacts list, a Contact's detail page, and inside a
// Company workspace. Keeping one component means the layout, validation, and
// saved field shape stay identical across all three entry points.

const BLANK_CONTACT = {
  salutation: "",
  firstName: "",
  lastName: "",
  designation: "",
  department: "",
  email: "",
  phone: "",
  whatsapp: "",
  alternatePhone: "",
  companyId: "",
  status: "Active",
  isDecisionMaker: false,
  isPrimary: false,
  isBillingContact: false,
  isTechnicalContact: false,
  linkedin: "",
  website: "",
  instagram: "",
  facebook: "",
  twitter: "",
  notes: "",
  // Transient: a contact is a client — opt in to email them a portal
  // set-password link on save. Never persisted on the contact record.
  sendPortalInvite: false,
};

const STATUS_OPTIONS = ["Active", "Inactive", "Prospect", "Lead", "Archived"];
const SALUTATION_OPTIONS = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Mx."];

function FormSection({ title, children, cols = 3 }) {
  return (
    <div className="space-y-3 border-t border-[#f3f4f6] pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-bold uppercase tracking-wide text-[#884c2d]">{title}</h4>
      <div className={`grid gap-4 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "", disabled = false, span = false, error = "", hint }) {
  return (
    <label className={`block ${span ? "sm:col-span-3" : ""}`}>
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        type={type}
        value={value || ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus:ring-2 ${
          error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#e5e7eb] focus:border-[#884c2d] focus:ring-[#884c2d]/20"
        } ${disabled ? "bg-[#f9fafb] text-[#6b7280]" : ""}`}
      />
      {error
        ? <span className="mt-1 block text-[11px] font-semibold text-red-500">{error}</span>
        : hint ? <span className="mt-1 block text-[11px] text-[#9ca3af]">{hint}</span> : null}
    </label>
  );
}

function Select({ label, value, onChange, options = [], span = false, placeholder = "Select…" }) {
  const normalized = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
  return (
    <label className={`block ${span ? "sm:col-span-3" : ""}`}>
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full cursor-pointer rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
      >
        <option value="">{placeholder}</option>
        {normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange, span = false }) {
  return (
    <label className={`block ${span ? "sm:col-span-3" : ""}`}>
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

function Checkbox({ label, checked, onChange, span = false }) {
  return (
    <label className={`flex items-center gap-2 rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm font-medium text-[#374151] cursor-pointer hover:bg-[#f9fafb] ${span ? "sm:col-span-3" : ""}`}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[#d1d5db] accent-[#884c2d]"
      />
      {label}
    </label>
  );
}

/**
 * @param {object|null} contact   Existing contact to edit, or null/partial for a new one.
 * @param {object|null} company   When launched from a company workspace, locks the
 *                                 associated company to this record. Omit for a free
 *                                 company picker (Contacts list / Contact detail page).
 * @param {Array}       companies Options for the company picker when `company` is absent.
 */
export default function ContactFormPanel({ contact, company = null, companies = [], onClose, onSave }) {
  const lockedCompanyId = company ? String(company.id || company._id) : "";
  const [form, setForm] = useState(() => ({
    ...BLANK_CONTACT,
    ...(contact || {}),
    companyId: company ? lockedCompanyId : (contact?.companyId || ""),
  }));
  const [errors, setErrors] = useState({});
  const { token } = useAuth();
  const { showToast } = useToast();
  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  const isEdit = Boolean(contact && (contact._id || contact.id));
  const pickedCompany = company || companies.find((c) => String(c.id || c._id) === String(form.companyId));
  const companyName = pickedCompany?.name || pickedCompany?.companyName || "";
  // Always keep the current value selectable so an existing status outside the
  // standard list isn't silently dropped on save.
  const statusOptions = Array.from(new Set([form.status, ...STATUS_OPTIONS].filter(Boolean)));
  const salutationOptions = Array.from(new Set([form.salutation, ...SALUTATION_OPTIONS].filter(Boolean)));

  async function invitePortalAccess({ email, name, phone }) {
    try {
      const result = await apiPost(
        "/api/admin/clients/invite",
        { email, name, phone, company: companyName },
        token
      );
      showToast(result?.alreadyActive
        ? { title: "Client already has access", message: `${email} has already set a password — no email sent.` }
        : result?.emailSkipped
          ? { type: "error", title: "Setup email not sent", message: "SendGrid is not configured, so no setup email was sent." }
          : { title: "Portal invite sent", message: `${email} will get a secure link to set their password.` });
    } catch (err) {
      showToast({ type: "error", title: "Invite not sent", message: err.message || "Could not send the portal invite." });
    }
  }

  async function handleSubmit() {
    const next = {};
    const composedName = `${form.salutation || ""} ${form.firstName || ""} ${form.lastName || ""}`.trim();
    if (!composedName && !String(form.name || "").trim()) next.firstName = "Enter at least a first or last name.";
    if (form.email && !isEmail(form.email)) next.email = "Enter a valid email.";
    if (form.sendPortalInvite && !String(form.email || "").trim()) next.email = "Add an email to send the portal invite.";
    if (form.phone && !isPhone(form.phone)) next.phone = "Enter a valid 10-digit mobile.";
    if (form.whatsapp && !isPhone(form.whatsapp)) next.whatsapp = "Enter a valid 10-digit number.";
    if (form.alternatePhone && !isPhone(form.alternatePhone)) next.alternatePhone = "Enter a valid 10-digit number.";
    setErrors(next);
    if (Object.keys(next).length) return;

    // `sendPortalInvite` is a transient action, not a stored contact attribute.
    const { sendPortalInvite, ...rest } = form;
    const payload = {
      ...rest,
      name: composedName || form.name || "",
      // Keep a flat `phone` so list views and exports have a number even when
      // only WhatsApp / alternate was filled in.
      phone: form.phone || form.whatsapp || form.alternatePhone || "",
    };
    try {
      await onSave(payload);
      if (sendPortalInvite && payload.email) await invitePortalAccess(payload);
    } catch (err) {
      showToast({ type: "error", title: "Contact not saved", message: err.message || "Could not save the contact." });
    }
  }

  return (
    <SidePanel
      title={isEdit ? "Edit Contact" : "Add Contact"}
      subtitle={company ? `Link this person to ${company.name}.` : "Contacts are linked people inside a company."}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}><Save size={14} /> Save Contact</Button>
        </div>
      }
    >
      <div className="space-y-6">
        <FormSection title="Personal Information" cols={3}>
          <Select label="Salutation" value={form.salutation} onChange={set("salutation")} options={salutationOptions} placeholder="Select salutation" />
          <Input label="First name *" value={form.firstName} onChange={set("firstName")} error={errors.firstName} hint={!errors.firstName ? "At least a first or last name is required." : undefined} />
          <Input label="Last name" value={form.lastName} onChange={set("lastName")} />
          <Input label="Designation" value={form.designation} onChange={set("designation")} />
          <Input label="Department" value={form.department} onChange={set("department")} />
          <Select label="Status" value={form.status} onChange={set("status")} options={statusOptions} placeholder="Select status" />
        </FormSection>

        <FormSection title="Communication">
          <Input label="Work email" type="email" value={form.email} onChange={set("email")} error={errors.email} />
          <PhoneInput label="Phone" value={form.phone} onChange={set("phone")} error={errors.phone} />
          <PhoneInput
            label="WhatsApp number"
            value={form.whatsapp}
            onChange={set("whatsapp")}
            error={errors.whatsapp}
            hint="Primary WhatsApp number used for project updates."
          />
          <PhoneInput label="Alternative number" value={form.alternatePhone} onChange={set("alternatePhone")} error={errors.alternatePhone} />
        </FormSection>

        <FormSection title="Company Mapping">
          {company ? (
            <Input span label="Associated company" value={company.name} disabled />
          ) : companies.length === 0 ? (
            <label className="block sm:col-span-3">
              <span className="text-xs font-semibold text-[#374151]">Associated company</span>
              <div className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-sm text-[#9ca3af]">
                Loading companies… or create a company first
              </div>
            </label>
          ) : (
            <Select
              span
              label="Associated company"
              value={form.companyId}
              onChange={set("companyId")}
              placeholder="-- Select a company --"
              options={companies.map((c) => ({ value: String(c.id || c._id), label: c.companyName || c.name }))}
            />
          )}
          <Checkbox span label="Decision maker" checked={form.isDecisionMaker} onChange={set("isDecisionMaker")} />
          <Checkbox label="Primary contact" checked={form.isPrimary} onChange={set("isPrimary")} />
          <Checkbox label="Billing contact" checked={form.isBillingContact} onChange={set("isBillingContact")} />
          <Checkbox label="Technical contact" checked={form.isTechnicalContact} onChange={set("isTechnicalContact")} />
        </FormSection>

        <FormSection title="Client Portal Access">
          <Checkbox
            span
            label="Send client portal invite (set-password email)"
            checked={form.sendPortalInvite}
            onChange={set("sendPortalInvite")}
          />
          <p className="-mt-1 text-[11px] leading-5 text-[#9ca3af] sm:col-span-3">
            A contact is a client. When checked, saving emails{" "}
            {form.email ? <span className="font-semibold text-[#6b7280]">{form.email}</span> : "this contact"}{" "}
            a secure link to set a password and access the client portal — needs an email address, and the link expires in 48 hours.
          </p>
        </FormSection>

        <FormSection title="Social">
          <Input label="LinkedIn" value={form.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/…" />
          <Input label="Website" value={form.website} onChange={set("website")} placeholder="https://…" />
          <Input label="Instagram" value={form.instagram} onChange={set("instagram")} />
          <Input label="Facebook" value={form.facebook} onChange={set("facebook")} />
          <Input label="X (Twitter)" value={form.twitter} onChange={set("twitter")} />
        </FormSection>

        <FormSection title="Notes">
          <Textarea span label="Notes" value={form.notes} onChange={set("notes")} />
        </FormSection>
      </div>
    </SidePanel>
  );
}
