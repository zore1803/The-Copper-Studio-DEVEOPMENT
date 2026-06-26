import { useMemo, useState } from "react";
import {
  FileArchive, FileText, Folder, Link2, Loader2, Lock,
  Search, Share2, Upload, Users, FolderOpen
} from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";

function readFileAsDataUrl(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => { if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    reader.onload = () => { onProgress?.(100); resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const VISIBILITY = {
  private:  { label: "Private",       icon: Lock,      className: "bg-gray-100 text-gray-600" },
  internal: { label: "Internal Team", icon: Users,     className: "bg-blue-50 text-blue-700" },
  project:  { label: "Project Team",  icon: FolderOpen,className: "bg-amber-50 text-amber-700" },
  client:   { label: "Client Visible",icon: Share2,    className: "bg-emerald-50 text-emerald-700" },
};

const TYPE_ICON = { pdf: FileText, doc: FileText, docx: FileText, xlsx: FileText, ppt: FileText, zip: FileArchive, url: Link2 };

function fileType(name = "") { return (name.split(".").pop()?.toLowerCase()) || "url"; }

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
        <Folder size={20} />
      </div>
      <p className="text-sm font-semibold text-[#111827]">No documents yet.</p>
      <p className="mt-1 text-sm text-[#6b7280]">Upload a document to get started.</p>
    </div>
  );
}

function DocumentRow({ doc, companies, projects }) {
  const type = fileType(doc.fileName || doc.name || "");
  const Icon = TYPE_ICON[type] || FileText;
  const visibility = VISIBILITY[doc.visibility] || VISIBILITY.private;
  const VisibilityIcon = visibility.icon;
  const company = companies.find((c) => String(c._id || c.id) === String(doc.companyId));
  const project = projects.find((p) => String(p._id || p.id) === String(doc.projectId));

  return (
    <div className="grid w-full grid-cols-[minmax(0,2fr)_140px_140px_130px_80px] gap-4 border-b border-[#f3f4f6] px-5 py-3 text-sm hover:bg-[#fafafa]">
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#6b7280]">
          <Icon size={15} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-[#111827]">{doc.fileName || doc.name || "Untitled"}</span>
          <span className="block truncate text-xs text-[#9ca3af]">{doc.category || doc.folderPath || type.toUpperCase()}</span>
        </span>
      </span>
      <span className="flex items-center text-sm text-[#374151]">{company?.companyName || company?.name || "—"}</span>
      <span className="flex items-center text-sm text-[#374151]">{project?.name || project?.projectName || "—"}</span>
      <span className={`flex w-fit items-center gap-1 self-center rounded-full px-2 py-0.5 text-xs font-semibold ${visibility.className}`}>
        <VisibilityIcon size={11} />{visibility.label}
      </span>
      <span className="flex items-center">
        {doc.fileUrl ? (
          <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#884c2d] hover:underline">View</a>
        ) : (
          <span className="text-xs text-[#9ca3af]">No file</span>
        )}
      </span>
    </div>
  );
}

function fileExt(filename) { return (filename || "").split(".").pop().toLowerCase(); }

const DOCUMENT_CATEGORIES = ["Contracts", "Invoices", "Proposals", "Design Files", "Source Code", "Deliverables"];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function UploadPanel({ onClose, onSave, companies, projects }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: "", category: "Contracts", fileType: "pdf", fileUrl: "", fileSize: "", notes: "", companyId: "", projectId: "" });
  const [fileReady, setFileReady] = useState(false);
  const [reading, setReading] = useState(false);
  const [readPct, setReadPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleBrowse(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast({ type: "error", title: "File too large", message: "Files must be 8 MB or smaller." });
      e.target.value = "";
      return;
    }
    setFileReady(false); setReadPct(0); setReading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file, setReadPct);
      setForm((prev) => ({ ...prev, name: prev.name || file.name, fileType: fileExt(file.name) || prev.fileType, fileUrl: dataUrl, fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB` }));
      setFileReady(true);
    } finally { setReading(false); e.target.value = ""; }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try { await onSave(form); } catch (err) {
      showToast({ type: "error", title: "Upload failed", message: err?.message || "Could not upload. Please try again." });
    } finally { setSaving(false); }
  }

  return (
    <SidePanel
      title="Upload Document"
      subtitle="Add a document and link it to a company or project."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || reading || saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Save Document</>}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">File *</span>
          <div className="mt-1.5 rounded-lg border border-dashed border-[#d8c2b9] bg-[#fff8f6] px-3 py-3">
            <div className="flex items-center gap-3">
              <input id="doc-browse" type="file" className="hidden" onChange={handleBrowse} disabled={reading || saving} />
              <label htmlFor="doc-browse" className={`rounded-lg bg-[#884c2d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6f381a] ${reading || saving ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>Browse…</label>
              <span className="truncate text-xs text-[#6b7280]">{fileReady ? `${form.name} (${form.fileSize})` : reading ? "Reading file…" : "No file selected"}</span>
            </div>
            {reading && (
              <div className="mt-2.5">
                <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]"><span>Reading file</span><span>{readPct}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f1d9cd]"><div className="h-full rounded-full bg-[#884c2d] transition-all" style={{ width: `${readPct}%` }} /></div>
              </div>
            )}
            {saving && (
              <div className="mt-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#884c2d]"><Loader2 size={11} className="animate-spin" /> Uploading…</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f1d9cd]"><div className="upload-indeterminate h-full w-1/3 rounded-full bg-[#884c2d]" /></div>
              </div>
            )}
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">File name *</span>
          <input value={form.name} onChange={(e) => set("name")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">Category</span>
          <select value={form.category} onChange={(e) => set("category")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d]">
            {DOCUMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">Company</span>
          <select value={form.companyId} onChange={(e) => set("companyId")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d]">
            <option value="">— None —</option>
            {companies.map((c) => <option key={c._id || c.id} value={c._id || c.id}>{c.companyName || c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">Project</span>
          <select value={form.projectId} onChange={(e) => set("projectId")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d]">
            <option value="">— None —</option>
            {projects.map((p) => <option key={p._id || p.id} value={p._id || p.id}>{p.name || p.projectName}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">…or paste a file URL</span>
          <input value={fileReady ? "" : form.fileUrl} onChange={(e) => set("fileUrl")(e.target.value)} disabled={fileReady} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] disabled:bg-[#f9fafb] disabled:text-[#9ca3af]" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">Notes</span>
          <textarea value={form.notes} rows={3} onChange={(e) => set("notes")(e.target.value)} className="mt-1.5 w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20" />
        </label>
      </div>
    </SidePanel>
  );
}

export default function DocumentCenter() {
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [uploading, setUploading] = useState(false);

  const { records: companies } = useCrmRecords("companies");
  const { records: projects } = useCrmRecords("projects");
  const { records: documents, save: saveDocument } = useCrmRecords("documents");

  const projectDocs = useMemo(() => projects.flatMap((project) =>
    (project.documents || []).map((doc) => ({
      ...doc,
      projectId: project.id || project._id,
      companyId: doc.companyId || project.companyId,
      fileName: doc.fileName || doc.name,
      visibility: doc.visibility || "internal",
    }))
  ), [projects]);

  const allDocuments = useMemo(() => [...documents, ...projectDocs], [documents, projectDocs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allDocuments.filter((doc) => {
      const haystack = `${doc.fileName || doc.name || ""} ${doc.category || ""} ${doc.folderPath || ""}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (companyFilter !== "All" && String(doc.companyId) !== companyFilter) return false;
      if (projectFilter !== "All" && String(doc.projectId) !== projectFilter) return false;
      return true;
    });
  }, [allDocuments, query, companyFilter, projectFilter]);

  async function handleUpload(form) {
    await saveDocument({ ...form, name: form.name });
    setUploading(false);
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F1F1F5]">
      {/* Strip header */}
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">Documents</h1>
          <p className="text-xs text-[#525866] mt-0.5">{filtered.length} of {allDocuments.length} documents</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-lg border border-[#E1E4EA] bg-white px-3">
            <Search size={14} className="text-[#9ca3af]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" className="w-44 bg-transparent text-sm outline-none" />
          </div>
          <Button onClick={() => setUploading(true)}><Upload size={14} /> Upload</Button>
        </div>
      </div>

      <div className="p-5 xl:p-6">
        <div className="overflow-hidden rounded-xl border border-[#E1E4EA] bg-white">
          {/* Table sub-header with filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3f4f6] bg-[#fff1ec] px-5 py-3">
            <p className="text-xs font-semibold text-[#525866]">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="h-8 rounded-lg border border-[#E1E4EA] bg-white px-2 text-xs font-medium text-[#374151] outline-none focus:border-[#884c2d]"
              >
                <option value="All">All Companies</option>
                {companies.map((c) => <option key={c._id || c.id} value={String(c._id || c.id)}>{c.companyName || c.name}</option>)}
              </select>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="h-8 rounded-lg border border-[#E1E4EA] bg-white px-2 text-xs font-medium text-[#374151] outline-none focus:border-[#884c2d]"
              >
                <option value="All">All Projects</option>
                {projects.map((p) => <option key={p._id || p.id} value={String(p._id || p.id)}>{p.name || p.projectName}</option>)}
              </select>
              {(companyFilter !== "All" || projectFilter !== "All") && (
                <button onClick={() => { setCompanyFilter("All"); setProjectFilter("All"); }} className="text-xs font-semibold text-[#884c2d] hover:underline">Clear</button>
              )}
            </div>
          </div>

          {/* Column headers */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-[minmax(0,2fr)_140px_140px_130px_80px] gap-4 bg-[#fafafa] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
              <span>Name</span><span>Company</span><span>Project</span><span>Visibility</span><span>File</span>
            </div>
          )}

          {filtered.length > 0
            ? filtered.map((doc, i) => (
                <DocumentRow key={doc._id || `${doc.fileName}-${i}`} doc={doc} companies={companies} projects={projects} />
              ))
            : <EmptyState />
          }
        </div>
      </div>

      {uploading && (
        <UploadPanel
          companies={companies}
          projects={projects}
          onClose={() => setUploading(false)}
          onSave={handleUpload}
        />
      )}
    </div>
  );
}
