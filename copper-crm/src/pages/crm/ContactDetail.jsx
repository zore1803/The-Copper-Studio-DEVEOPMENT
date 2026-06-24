import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  ArrowUpDown, Building2, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, FolderKanban,
  Globe, GripVertical, Link as LinkIcon, Mail, MessageCircle, Pencil, Phone, Plus, Save, Search, StickyNote, Trash2, Users
} from "lucide-react";
import { Avatar, Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import ContactFormPanel from "../../components/ContactFormPanel";
import ContactExportMenu from "../../components/ContactExportMenu";
import RichTextEditor, { isRichTextEmpty, stripHtml } from "../../components/RichTextEditor";
import { isSameLocalDay } from "../../lib/dates";
import { contactFullName } from "../../lib/contacts";

function ProjectAccessPanel({ contact, contactName, projects, onClose, onSave }) {
  const [draftIds, setDraftIds] = useState(new Set((contact.projectIds || []).map(String)));
  const isLinked = Boolean(contact.userId);

  function toggle(id) {
    setDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <SidePanel
      title="Project Access"
      subtitle={`Choose which project(s) ${contactName} can see in their client portal.`}
      onClose={onClose}
      footer={
        isLinked ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(Array.from(draftIds))}><Save size={14} /> Save</Button>
          </div>
        ) : null
      }
    >
      {!isLinked ? (
        <p className="text-sm text-[#6b7280]">
          {contactName} doesn't have a client portal login yet. Link one from this contact's company page first, then come back here to choose their projects.
        </p>
      ) : projects.length ? (
        <div className="space-y-2">
          {projects.map((project) => {
            const id = String(project._id || project.id);
            const checked = draftIds.has(id);
            return (
              <label
                key={id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors ${checked ? "border-[#884c2d] bg-[#fff1ec]" : "border-[#e5e7eb] hover:bg-[#f9fafb]"}`}
              >
                <span className="font-semibold text-[#111827]">{project.name}</span>
                <input type="checkbox" checked={checked} onChange={() => toggle(id)} className="h-4 w-4 rounded border-[#d1d5db] accent-[#884c2d]" />
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-[#6b7280]">No projects under this contact's company yet.</p>
      )}
    </SidePanel>
  );
}

function NoteInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        value={value || ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
      />
    </label>
  );
}

function NotePanel({ contact, note, onClose, onSave }) {
  const [form, setForm] = useState(note || { title: "", body: "" });
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <SidePanel
      title={note?._id || note?.id ? "Edit Note" : "Add Note"}
      subtitle={`Saved against ${contact.name || "this contact"}.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}><Save size={14} /> Save Note</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <NoteInput label="Title" value={form.title} onChange={set("title")} placeholder="e.g. Pricing discussion" />
        <RichTextEditor label="Note" value={form.body} onChange={set("body")} placeholder="Write a note…" />
      </div>
    </SidePanel>
  );
}

// Mirrors the Company workspace layout — header + social row + info bar + KPI
// chips + tabbed body — so an individual contact (who, in this product, IS a
// client) reads with the same structure as their company.
const TABS = ["Overview", "Projects", "Meetings", "Documents", "Notes", "Activity"];

function LinkedInGlyph(props) {
  return (
    <svg viewBox="0 0 56 56" {...props}>
      <circle cx="28" cy="28" r="28" fill="#1877B5" />
      <g transform="translate(14,14) scale(1.16667)">
        <path
          fill="#fff"
          d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667h-3.554V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM3.558 20.452h3.564V9H3.558v11.452z"
        />
      </g>
    </svg>
  );
}

function InstagramGlyph(props) {
  return (
    <svg viewBox="0 0 56 56" {...props}>
      <defs>
        <linearGradient id="igGradientContact" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FED576" />
          <stop offset="25%" stopColor="#F47133" />
          <stop offset="50%" stopColor="#BC3081" />
          <stop offset="75%" stopColor="#C92F88" />
          <stop offset="100%" stopColor="#8B3AB5" />
        </linearGradient>
      </defs>
      <rect width="56" height="56" rx="14" fill="url(#igGradientContact)" />
      <rect x="14" y="14" width="28" height="28" rx="8" fill="none" stroke="#fff" strokeWidth="2.6" />
      <circle cx="28" cy="28" r="7.2" fill="none" stroke="#fff" strokeWidth="2.6" />
      <circle cx="37.2" cy="18.8" r="1.9" fill="#fff" />
    </svg>
  );
}

function FacebookGlyph(props) {
  return (
    <svg viewBox="0 0 56 56" {...props}>
      <circle cx="28" cy="28" r="28" fill="#1877F2" />
      <g transform="translate(14,14) scale(1.16667)">
        <path
          fill="#fff"
          d="M14.5 21V12.5H17l.4-3H14.5V7.4c0-.87.24-1.4 1.48-1.4H17.5V3.1C17.06 3.04 15.84 2.9 14.4 2.9c-2.86 0-4.82 1.74-4.82 4.94v2.66H7v3h2.58V21z"
        />
      </g>
    </svg>
  );
}

function XGlyph(props) {
  return (
    <svg viewBox="0 0 56 56" {...props}>
      <rect width="56" height="56" rx="12" fill="#000" />
      <g transform="translate(14,14) scale(1.16667)">
        <path
          fill="#fff"
          d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
        />
      </g>
    </svg>
  );
}

function SocialIconLink({ href, icon: Icon, label }) {
  if (!href) return null;
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={label} className="flex h-7 w-7 items-center justify-center transition-transform hover:scale-110">
      <Icon className="h-full w-full" />
    </a>
  );
}

function WebsiteIconLink({ href, icon: Icon, label }) {
  if (!href) return null;
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      style={{ color: "#0EA5E9", backgroundColor: "#E0F2FE" }}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent transition-transform hover:scale-110"
    >
      <Icon size={13} />
    </a>
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

function EmptyTab({ icon: Icon, text }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d8c2b9] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff1ec] text-[#884c2d]">
        <Icon size={20} />
      </div>
      <p className="text-sm text-[#6b7280]">{text}</p>
    </div>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "No date";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ContactDetail() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { records: contacts, loading, save, remove } = useCrmRecords("contacts");
  const { records: companies } = useCrmRecords("companies");
  const { records: projects } = useCrmRecords("projects");
  const { records: meetings } = useCrmRecords("meetings");
  const { records: documents } = useCrmRecords("documents");
  const { records: tasks } = useCrmRecords("tasks");
  const { records: notes, save: saveNote, remove: removeNote } = useCrmRecords("notes");
  const { showToast } = useToast();
  const contact = contacts.find((c) => String(c._id || c.id) === String(contactId));
  const [activeTab, setActiveTab] = useState("Overview");
  const [editing, setEditing] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteDateFilter, setNoteDateFilter] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [noteSortDir, setNoteSortDir] = useState(null); // null = manual order, "asc" | "desc" = by created date
  const [notePage, setNotePage] = useState(1);
  const NOTES_PAGE_SIZE = 5;
  const [managingAccess, setManagingAccess] = useState(false);

  const companyMap = useMemo(() => new Map(companies.map((c) => [String(c.id || c._id), c])), [companies]);

  if (!contact && loading) {
    return (
      <div className="m-6 rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-sm font-semibold text-gray-500">Loading contact…</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="m-6 rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-sm font-semibold text-gray-500">Contact not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate("/admin/contacts")}>Back to Contacts</Button>
      </div>
    );
  }

  const linkedCompany = companyMap.get(String(contact.companyId));
  const companyName = linkedCompany?.companyName || linkedCompany?.name || contact.company || "Not linked";
  const associated = contacts.filter((c) => String(c.companyId) === String(contact.companyId) && String(c._id || c.id) !== String(contactId)).slice(0, 5);
  const hasSocial = contact.website || contact.linkedin || contact.instagram || contact.facebook || contact.twitter;
  const roles = [
    contact.isDecisionMaker && "Decision Maker",
    contact.isPrimary && "Primary Contact",
    contact.isBillingContact && "Billing Contact",
    contact.isTechnicalContact && "Technical Contact",
  ].filter(Boolean);

  // The contact is a client of one company, so their workspace mirrors that
  // company's linked records (matched by companyId, with the human-readable
  // company name as a fallback for older records).
  const companyKeys = new Set([contact.companyId, linkedCompany?._id, linkedCompany?.id].filter(Boolean).map(String));
  const matchesClient = (record) =>
    companyKeys.has(String(record.companyId)) || record.company === companyName || record.companyName === companyName;

  const linkedProjects = projects.filter((p) => matchesClient(p) || p.client === companyName);
  const linkedMeetings = meetings.filter(matchesClient);
  const linkedDocuments = documents.filter(matchesClient);
  const linkedTasks = tasks.filter(matchesClient);
  const linkedNotes = notes.filter(matchesClient).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
  const openTasks = linkedTasks.filter((t) => !["completed", "done"].includes(String(t.status || "").toLowerCase())).length;

  const activity = [
    ...linkedProjects.map((p) => ({ type: "Project", title: `${p.name || "Project"} · ${p.status || p.currentPhase || "updated"}`, date: p.updatedAt || p.createdAt || p.startDate, icon: FolderKanban })),
    ...linkedMeetings.map((m) => ({ type: "Meeting", title: m.title || m.subject || "Meeting scheduled", date: m.scheduled || m.scheduledAt || m.createdAt, icon: Calendar })),
    ...linkedDocuments.map((d) => ({ type: "Document", title: `${d.name || d.fileName || "Document"} added`, date: d.createdAt, icon: FileText })),
    ...(contact.createdAt ? [{ type: "Contact", title: "Contact created", date: contact.createdAt, icon: Users }] : []),
  ]
    .map((item) => ({ ...item, sortDate: new Date(item.date || 0), dateLabel: formatDate(item.date) }))
    .sort((a, b) => b.sortDate - a.sortDate);

  const tabCounts = {
    Projects: linkedProjects.length,
    Meetings: linkedMeetings.length,
    Documents: linkedDocuments.length,
    Notes: linkedNotes.length,
    Activity: activity.length,
  };

  async function handleSave(form) {
    await save(form);
    setEditing(false);
    showToast({ title: "Contact updated", message: `${contactFullName(form)} saved.` });
  }

  async function handleDelete() {
    await remove(contact);
    showToast({ title: "Contact deleted", message: `${contactFullName(contact)} removed.` });
    navigate("/admin/contacts");
  }

  async function handleSaveNote(form) {
    if (!form.title?.trim() && isRichTextEmpty(form.body)) {
      showToast({ type: "error", title: "Note is empty", message: "Add a title or some text before saving." });
      return;
    }
    await saveNote({ ...form, companyId: contact.companyId, company: companyName });
    setEditingNote(null);
    showToast({ title: "Note saved", message: `Saved to ${contactFullName(contact)}.` });
  }

  async function handleDeleteNote(note) {
    await removeNote(note);
    showToast({ title: "Note deleted", message: "The note was removed." });
  }

  async function handleReorderNotes(sourceIndex, destIndex) {
    const ordered = [...linkedNotes];
    const [moved] = ordered.splice(sourceIndex, 1);
    ordered.splice(destIndex, 0, moved);
    await Promise.all(
      ordered.map((n, index) => (n.order === index ? null : saveNote({ ...n, order: index }))).filter(Boolean)
    );
  }

  async function handleSaveProjectAccess(projectIds) {
    await save({ ...contact, projectIds });
    setManagingAccess(false);
    showToast({ title: "Project access updated", message: `${contactFullName(contact)}'s portal now shows ${projectIds.length} project${projectIds.length === 1 ? "" : "s"}.` });
  }

  function openProject(project) {
    const companyId = project.companyId || contact.companyId;
    if (companyId) navigate(`/admin/companies/${companyId}/projects/${project.id || project._id}`);
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f8fafc]">
      <div className="border-b border-[#e5e7eb] bg-white">
        <div className="px-6 py-8">
          <button onClick={() => navigate(-1)} className="mb-5 flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-800">
            <ChevronLeft size={15} /> Back to Contacts
          </button>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#e5e7eb] bg-[#fff8f6]">
                <Avatar name={contactFullName(contact)} size="lg" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold text-[#111827]">{contactFullName(contact)}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#6b7280]">
                  <span>{contact.designation || "No designation"}</span>
                  <span className="inline-flex items-center gap-1"><Building2 size={12} /> {companyName}</span>
                  {(contact.whatsapp || contact.phone) && (
                    <span className="inline-flex items-center gap-1"><Phone size={12} /> {contact.whatsapp || contact.phone}</span>
                  )}
                </div>
                {roles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {roles.map((role) => (
                      <span key={role} className="rounded-full bg-[#fff1ec] px-2 py-0.5 text-[11px] font-semibold text-[#884c2d]">{role}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              {hasSocial && (
                <div className="flex items-center gap-1.5 pr-2">
                  <WebsiteIconLink href={contact.website} icon={Globe} label="Website" />
                  <SocialIconLink href={contact.linkedin} icon={LinkedInGlyph} label="LinkedIn" />
                  <SocialIconLink href={contact.instagram} icon={InstagramGlyph} label="Instagram" />
                  <SocialIconLink href={contact.facebook} icon={FacebookGlyph} label="Facebook" />
                  <SocialIconLink href={contact.twitter} icon={XGlyph} label="X" />
                </div>
              )}
              <ContactExportMenu
                contact={contact}
                companyName={companyName}
                triggerLabel="Share Contact"
                iconSize={14}
                triggerClassName="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#E1E4EA] bg-white px-4 text-sm font-semibold text-[#1F2937] transition-colors hover:bg-[#f9fafb]"
              />
              <button
                onClick={() => setManagingAccess(true)}
                className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${contact.userId ? "border-[#d8c2b9] bg-[#fff1ec] text-[#884c2d] hover:bg-[#ffe7da]" : "border-[#d8c2b9] bg-white text-[#211a17] hover:bg-[#fff1ec]"}`}
              >
                <LinkIcon size={14} /> Project Access
              </button>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#d8c2b9] bg-white px-4 text-sm font-semibold text-[#211a17] transition-colors hover:bg-[#fff1ec]"
              >
                <Pencil size={14} /> Edit Contact
              </button>
              <button onClick={handleDelete} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-[#f1f1f5] bg-[#fafafa] p-4 sm:grid-cols-3 lg:grid-cols-5">
            <InfoLine label="Company" value={companyName} />
            <InfoLine label="Designation" value={contact.designation} />
            <InfoLine label="Email" value={contact.email} />
            <InfoLine label="Status" value={contact.status || "Active"} />
            <InfoLine label="Contact Since" value={formatDate(contact.createdAt)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pb-5 sm:grid-cols-3 lg:grid-cols-5">
          <KpiChip label="Projects" value={linkedProjects.length} icon={FolderKanban} />
          <KpiChip label="Meetings" value={linkedMeetings.length} icon={Calendar} />
          <KpiChip label="Documents" value={linkedDocuments.length} icon={FileText} />
          <KpiChip label="Open Tasks" value={openTasks} icon={CheckCircle2} />
          <KpiChip label="Notes" value={linkedNotes.length} icon={StickyNote} />
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
        {activeTab === "Overview" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
              <div className="bg-[#fff1ec] border-b border-[#f3e5e0] px-5 py-3">
                <p className="text-sm font-bold text-gray-700">Contact Details</p>
              </div>
              <div className="p-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Detail icon={Mail} label="Email" value={contact.email} />
                <Detail icon={Phone} label="Phone" value={contact.phone} />
                <Detail icon={MessageCircle} label="WhatsApp" value={contact.whatsapp} />
                <Detail icon={Building2} label="Company" value={companyName} />
                <Detail label="Department" value={contact.department} />
                <Detail label="Designation" value={contact.designation} />
                <Detail label="Status" value={contact.status || "Active"} />
                <Detail label="Alternative Number" value={contact.alternatePhone} />
              </div>
              {contact.preferences && (
                <div className="mt-5 border-t border-[#f1f1f5] pt-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">Preferences</p>
                  <p className="text-sm text-gray-600">{contact.preferences}</p>
                </div>
              )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
              <div className="bg-[#fff1ec] border-b border-[#f3e5e0] px-5 py-3">
                <p className="text-sm font-bold text-gray-700">Associated Contacts</p>
              </div>
              <div className="p-5">
              {associated.length ? (
                <div className="space-y-3">
                  {associated.map((item) => (
                    <button
                      key={item._id || item.id}
                      onClick={() => navigate(`/admin/contacts/${item._id || item.id}`)}
                      className="flex w-full items-center gap-2.5 text-left hover:bg-gray-50 rounded-lg -mx-1 px-1 py-0.5"
                    >
                      <Avatar name={contactFullName(item)} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{contactFullName(item)}</p>
                        <p className="text-xs text-gray-400">{item.email || "No email"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400">No associated contacts yet.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Projects" && (
          linkedProjects.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {linkedProjects.map((p) => (
                <button
                  key={p._id || p.id}
                  onClick={() => openProject(p)}
                  className="rounded-xl border border-[#e5e7eb] bg-white p-4 text-left transition-all hover:border-[#cda88f] hover:shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban size={15} className="shrink-0 text-[#884c2d]" />
                    <p className="truncate font-semibold text-[#111827]">{p.name || "Untitled project"}</p>
                  </div>
                  <p className="mt-1 text-xs text-[#6b7280]">{p.status || p.currentPhase || "—"}</p>
                </button>
              ))}
            </div>
          ) : <EmptyTab icon={FolderKanban} text="No projects linked to this client yet." />
        )}

        {activeTab === "Meetings" && (
          linkedMeetings.length ? (
            <div className="space-y-2">
              {linkedMeetings.map((m) => (
                <div key={m._id || m.id} className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Calendar size={15} className="text-[#884c2d]" />
                    <p className="text-sm font-semibold text-[#111827]">{m.title || m.subject || "Meeting"}</p>
                  </div>
                  <span className="text-xs text-[#6b7280]">{formatDate(m.scheduled || m.scheduledAt || m.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : <EmptyTab icon={Calendar} text="No meetings linked to this client yet." />
        )}

        {activeTab === "Documents" && (
          linkedDocuments.length ? (
            <div className="space-y-2">
              {linkedDocuments.map((d) => (
                <div key={d._id || d.id} className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText size={15} className="shrink-0 text-[#884c2d]" />
                    <p className="truncate text-sm font-semibold text-[#111827]">{d.name || d.fileName || "Document"}</p>
                  </div>
                  <span className="text-xs text-[#6b7280]">{d.category || d.fileType || "—"}</span>
                </div>
              ))}
            </div>
          ) : <EmptyTab icon={FileText} text="No documents shared with this client yet." />
        )}

        {activeTab === "Notes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">Notes</p>
              <Button size="sm" onClick={() => setEditingNote({})}><Plus size={14} /> Add Note</Button>
            </div>
            {linkedNotes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2.5">
                  <Search size={13} className="text-[#9ca3af]" />
                  <input
                    value={noteSearch}
                    onChange={(event) => { setNoteSearch(event.target.value); setNotePage(1); }}
                    placeholder="Search notes…"
                    className="w-40 bg-transparent text-xs outline-none placeholder:text-[#9ca3af]"
                  />
                </div>
                <input
                  type="date"
                  value={noteDateFilter}
                  onChange={(event) => { setNoteDateFilter(event.target.value); setNotePage(1); }}
                  className="h-9 rounded-lg border border-[#e5e7eb] px-2.5 text-xs outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
                />
                <button
                  type="button"
                  onClick={() => { setNoteSortDir((prev) => (prev === null ? "desc" : prev === "desc" ? "asc" : null)); setNotePage(1); }}
                  className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                    noteSortDir ? "border-[#884c2d] bg-[#fff8f6] text-[#884c2d]" : "border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb]"
                  }`}
                  title="Sort by created date"
                >
                  <ArrowUpDown size={13} />
                  {noteSortDir === "asc" ? "Oldest first" : noteSortDir === "desc" ? "Newest first" : "Manual order"}
                </button>
                {(noteSearch || noteDateFilter || noteSortDir) && (
                  <button
                    type="button"
                    onClick={() => { setNoteSearch(""); setNoteDateFilter(""); setNoteSortDir(null); setNotePage(1); }}
                    className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#884c2d] hover:bg-[#fff1ec]"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            {!linkedNotes.length && (
              <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
                <div className="bg-[#fff1ec] border-b border-[#f3e5e0] px-5 py-3">
                  <p className="text-sm font-bold text-gray-700">Contact Notes</p>
                </div>
                <div className="p-5">
                <p className="text-sm text-gray-600">{contact.notes || "No notes added."}</p>
                </div>
              </div>
            )}
            {linkedNotes.length > 0 && (() => {
              const needle = noteSearch.trim().toLowerCase();
              let visibleNotes = linkedNotes
                .filter((n) => isSameLocalDay(n.createdAt, noteDateFilter))
                .filter((n) => !needle || `${n.title || ""} ${stripHtml(n.body || n.text)}`.toLowerCase().includes(needle));
              if (noteSortDir) {
                visibleNotes = [...visibleNotes].sort((a, b) => {
                  const diff = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                  return noteSortDir === "asc" ? diff : -diff;
                });
              }
              const canDrag = !noteDateFilter && !noteSortDir && !needle;
              const hasFilters = Boolean(noteDateFilter || needle || noteSortDir);
              const totalPages = Math.max(1, Math.ceil(visibleNotes.length / NOTES_PAGE_SIZE));
              const pageStart = (Math.min(notePage, totalPages) - 1) * NOTES_PAGE_SIZE;
              const pagedNotes = visibleNotes.slice(pageStart, pageStart + NOTES_PAGE_SIZE);

              if (!pagedNotes.length) {
                return (
                  <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-white p-6 text-center">
                    <p className="text-sm text-gray-500">No notes match these filters.</p>
                    <Button variant="secondary" className="mt-3" onClick={() => { setNoteSearch(""); setNoteDateFilter(""); setNoteSortDir(null); setNotePage(1); }}>Clear filters</Button>
                  </div>
                );
              }
              return (
                <>
                  <DragDropContext onDragEnd={(result) => {
                    if (!result.destination || result.destination.index === result.source.index) return;
                    handleReorderNotes(pageStart + result.source.index, pageStart + result.destination.index);
                  }}>
                    <Droppable droppableId="contact-notes">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                          {pagedNotes.map((n, index) => (
                            <Draggable key={n._id || n.id} draggableId={String(n._id || n.id)} index={index} isDragDisabled={!canDrag}>
                              {(prov, snap) => (
                                <div
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  className={`group relative overflow-hidden rounded-xl border bg-white transition-shadow ${snap.isDragging ? "border-[#884c2d]/40 shadow-lg" : "border-[#e5e7eb]"}`}
                                  style={prov.draggableProps.style}
                                >
                                  <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
                                    <span {...prov.dragHandleProps} className={`mr-2 ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed"} text-[#d1d5db] hover:text-[#9ca3af]`} title="Drag to reorder">
                                      <GripVertical size={14} />
                                    </span>
                                    <p className="min-w-0 flex-1 text-sm font-bold text-gray-700">{n.title || "Note"}</p>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button type="button" onClick={() => setEditingNote(n)} className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#fff1ec] hover:text-[#884c2d]" title="Edit note">
                                        <Pencil size={14} />
                                      </button>
                                      <button type="button" onClick={() => handleDeleteNote(n)} className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-red-50 hover:text-red-600" title="Delete note">
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="p-5">
                                    <div
                                      className="line-clamp-2 text-sm text-gray-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                                      dangerouslySetInnerHTML={{ __html: n.body || n.text || "" }}
                                    />
                                    <p className="mt-2 text-xs text-gray-400">
                                      Created {formatDate(n.createdAt)}
                                      {n.updatedAt && n.updatedAt !== n.createdAt ? ` · Updated ${formatDate(n.updatedAt)}` : ""}
                                    </p>
                                  </div>

                                  {/* Hover preview — full content, since clicking the note no longer opens the editor */}
                                  <div className="invisible absolute left-0 top-full z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white p-4 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
                                    <p className="font-bold text-gray-700">{n.title || "Note"}</p>
                                    <div
                                      className="mt-1.5 text-sm text-gray-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                                      dangerouslySetInnerHTML={{ __html: n.body || n.text || "No content." }}
                                    />
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                  {totalPages > 1 && (
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-[#9ca3af]">Page {Math.min(notePage, totalPages)} / {totalPages}</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={notePage <= 1}
                          onClick={() => setNotePage((p) => Math.max(1, p - 1))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb] disabled:opacity-40"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={notePage >= totalPages}
                          onClick={() => setNotePage((p) => Math.min(totalPages, p + 1))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb] disabled:opacity-40"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {activeTab === "Activity" && (
          activity.length ? (
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
              <div className="space-y-4">
                {activity.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#6b7280]">
                      <item.icon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
                      <p className="flex items-center gap-1 text-xs text-[#9ca3af]"><Clock3 size={11} /> {item.dateLabel}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyTab icon={Clock3} text="No activity recorded for this client yet." />
        )}
      </div>

      {editing && <ContactFormPanel contact={contact} companies={companies} onClose={() => setEditing(false)} onSave={handleSave} />}
      {editingNote && <NotePanel contact={contact} note={editingNote._id || editingNote.id ? editingNote : null} onClose={() => setEditingNote(null)} onSave={handleSaveNote} />}
      {managingAccess && (
        <ProjectAccessPanel
          contact={contact}
          contactName={contactFullName(contact)}
          projects={linkedProjects}
          onClose={() => setManagingAccess(false)}
          onSave={handleSaveProjectAccess}
        />
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <div className="flex items-center gap-1.5 text-sm text-gray-700">
        {Icon && <Icon size={13} className="text-gray-400" />}
        {value || "Not added"}
      </div>
    </div>
  );
}
