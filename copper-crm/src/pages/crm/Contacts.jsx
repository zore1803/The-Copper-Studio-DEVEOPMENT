import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Link2, Mail, MessageCircle, Phone, Plus, Save, Search, Trash2 } from "lucide-react";
import { Avatar, Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import SidePanel from "../../components/SidePanel";
import { useToast } from "../../components/useToast";
import { isEmail, isPhone } from "../../lib/validators";

const PAGE_SIZE = 12;

function EmptyState({ onCreate }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
        <Phone size={20} />
      </div>
      <p className="text-sm font-semibold text-[#111827]">No contacts yet.</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#6b7280]">Contacts are people inside companies. Add them with company links so deals, projects, and communication history stay connected.</p>
      <Button className="mt-4" onClick={onCreate}><Plus size={14} /> New Contact</Button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", error = "" }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
          error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#e5e7eb] focus:border-[#884c2d] focus:ring-[#884c2d]/20"
        }`}
      />
      {error && <span className="mt-1 block text-[11px] font-semibold text-red-500">{error}</span>}
    </label>
  );
}

export default function Contacts() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const { records: contacts, save, remove, loading } = useCrmRecords("contacts");
  const { records: companies } = useCrmRecords("companies");

  const companyMap = useMemo(() => new Map(companies.map((c) => [String(c.id || c._id), c])), [companies]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((contact) =>
      `${contact.salutation || ""} ${contact.firstName || ""} ${contact.lastName || ""} ${contact.name || ""} ${contact.email || ""} ${contact.phone || ""} ${contact.whatsapp || ""} ${contact.designation || ""} ${contact.company || ""}`.toLowerCase().includes(needle)
    );
  }, [contacts, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function fullName(contact) {
    return contact.name || `${contact.salutation || ""} ${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Unnamed contact";
  }

  function companyName(contact) {
    return companyMap.get(String(contact.companyId))?.companyName || companyMap.get(String(contact.companyId))?.name || contact.company || "Not linked";
  }

  async function saveContact(contact) {
    const payload = {
      ...contact,
      id: contact.id || `contact-${Date.now()}`,
      name: contact.name || `${contact.salutation || ""} ${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
    };
    await save(payload);
    setEditing(null);
    showToast({ title: "Contact saved", message: `${payload.name || "Contact"} is linked to ${companyName(payload)}.` });
  }

  async function deleteContact(contact) {
    await remove(contact);
    showToast({ title: "Contact deleted", message: `${fullName(contact)} removed.` });
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F1F1F5]">
      <header className="border-b border-[#E1E4EA] bg-white px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">CRM</p>
            <h1 className="mt-1 text-2xl font-bold text-[#111827]">Contacts</h1>
            <p className="mt-1 text-sm text-[#6b7280]">People inside companies, linked to communication, deals, projects, and activity.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3">
              <Search size={14} className="text-[#9ca3af]" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search contacts" className="w-64 bg-transparent text-sm outline-none" />
            </div>
            <Button onClick={() => setEditing({ salutation: "", firstName: "", lastName: "", email: "", phone: "", whatsapp: "", designation: "", linkedin: "", companyId: "", status: "Active" })}>
              <Plus size={14} /> New Contact
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="overflow-hidden rounded-xl border border-[#E1E4EA] bg-white">
          <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(160px,1fr)_180px_180px_120px_80px] gap-4 border-b border-[#f3f4f6] bg-[#fafafa] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#9ca3af]">
            <span>Contact</span><span>Associated Company</span><span>Email</span><span>WhatsApp</span><span>Status</span><span />
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-[#6b7280]">Loading contacts...</div>
          ) : rows.length ? (
            rows.map((contact) => (
              <div key={contact._id || contact.id} className="grid grid-cols-[minmax(220px,1.2fr)_minmax(160px,1fr)_180px_180px_120px_80px] gap-4 border-b border-[#f3f4f6] px-4 py-3 text-sm hover:bg-[#fafafa]">
                <button onClick={() => navigate(`/admin/contacts/${contact._id || contact.id}`)} className="flex min-w-0 items-center gap-3 text-left">
                  <Avatar name={fullName(contact)} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[#111827]">{fullName(contact)}</span>
                    <span className="block truncate text-xs text-[#6b7280]">{contact.designation || "No designation"}</span>
                  </span>
                </button>
                <span className="flex min-w-0 items-center gap-2 text-[#374151]"><Building2 size={13} className="text-[#9ca3af]" /> <span className="truncate">{companyName(contact)}</span></span>
                <span className="flex min-w-0 items-center gap-2 text-[#374151]"><Mail size={13} className="text-[#9ca3af]" /> <span className="truncate">{contact.email || "Not added"}</span></span>
                <span className="flex min-w-0 items-center gap-2 text-[#374151]"><MessageCircle size={13} className="text-[#9ca3af]" /> <span className="truncate">{contact.whatsapp || contact.phone || "Not added"}</span></span>
                <span className="h-fit rounded-full bg-[#f3f4f6] px-2 py-1 text-center text-xs font-semibold text-[#374151]">{contact.status || "Active"}</span>
                <span className="flex items-center justify-end gap-2">
                  <button onClick={() => setEditing(contact)} className="text-[#6b7280] hover:text-[#884c2d]"><Link2 size={14} /></button>
                  <button onClick={() => deleteContact(contact)} className="text-[#6b7280] hover:text-red-600"><Trash2 size={14} /></button>
                </span>
              </div>
            ))
          ) : <div className="p-5"><EmptyState onCreate={() => setEditing({ status: "Active" })} /></div>}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[#6b7280]">
          <span>Showing {rows.length} of {filtered.length} contacts</span>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1 disabled:opacity-40">Prev</button>
            <span className="px-2 text-xs font-semibold">Page {page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </main>

      {editing && (
        <ContactPanel
          contact={editing}
          companies={companies}
          onClose={() => setEditing(null)}
          onSave={saveContact}
        />
      )}
    </div>
  );
}

function ContactPanel({ contact, companies, onClose, onSave }) {
  const [form, setForm] = useState(contact);
  const [errors, setErrors] = useState({});
  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  function handleSubmit() {
    const next = {};
    const hasName = `${form.firstName || ""}${form.lastName || ""}${form.name || ""}`.trim();
    if (!hasName) next.firstName = "Enter at least a first or last name.";
    if (form.email && !isEmail(form.email)) next.email = "Enter a valid email.";
    if (form.phone && !isPhone(form.phone)) next.phone = "Enter a valid 10-digit mobile.";
    if (form.whatsapp && !isPhone(form.whatsapp)) next.whatsapp = "Enter a valid 10-digit number.";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave(form);
  }

  return (
    <SidePanel
      title={contact._id || contact.id ? "Edit Contact" : "New Contact"}
      subtitle="Contacts are linked people inside a company."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}><Save size={14} /> Save Contact</Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Salutation" value={form.salutation} onChange={set("salutation")} placeholder="Mr / Ms / Dr" />
        <Field label="First Name" value={form.firstName} onChange={set("firstName")} error={errors.firstName} />
        <Field label="Last Name" value={form.lastName} onChange={set("lastName")} />
        <Field label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} />
        <Field label="Phone" value={form.phone} onChange={set("phone")} error={errors.phone} />
        <Field label="WhatsApp" value={form.whatsapp} onChange={set("whatsapp")} error={errors.whatsapp} />
        <Field label="Position" value={form.designation} onChange={set("designation")} />
        <Field label="LinkedIn" value={form.linkedin} onChange={set("linkedin")} />
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-[#374151]">Associated Company</span>
          {companies.length === 0 ? (
            <div className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-sm text-[#9ca3af]">
              Loading companies... or create a company first
            </div>
          ) : (
            <select value={form.companyId || ""} onChange={(e) => set("companyId")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20 cursor-pointer">
              <option value="">-- Select a company --</option>
              {companies.map((company) => (
                <option key={company.id || company._id} value={company.id || company._id}>
                  {company.companyName || company.name}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>
    </SidePanel>
  );
}
