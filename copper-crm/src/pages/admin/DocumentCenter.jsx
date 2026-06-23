import { useMemo, useState } from "react";
import {
  Building2, FileArchive, FileText, Folder, FolderOpen, Grid3X3,
  Link2, List, Lock, Search, Share2, Upload, Users
} from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import SidePanel from "../../components/SidePanel";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const VISIBILITY = {
  private: { label: "Private", icon: Lock, className: "bg-gray-100 text-gray-600" },
  internal: { label: "Internal Team", icon: Users, className: "bg-blue-50 text-blue-700" },
  project: { label: "Project Team", icon: FolderOpen, className: "bg-amber-50 text-amber-700" },
  client: { label: "Client Visible", icon: Share2, className: "bg-emerald-50 text-emerald-700" },
};

const TYPE_ICON = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xlsx: FileText,
  ppt: FileText,
  zip: FileArchive,
  url: Link2,
};

function fileType(name = "") {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext || "url";
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
        <Folder size={20} />
      </div>
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#6b7280]">{text}</p>
    </div>
  );
}

function FolderCard({ icon: Icon, title, meta, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-white p-4 text-left transition hover:bg-[#fafafa] ${active ? "border-[#C57E5B] bg-[#fff8f6]" : "border-[#E1E4EA]"}`}
    >
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg border ${active ? "border-[#C57E5B] text-[#C57E5B]" : "border-[#E1E4EA] text-[#525866]"}`}>
        <Icon size={20} />
      </div>
      <p className="truncate text-sm font-bold text-[#111827]">{title}</p>
      <p className="mt-1 text-xs text-[#6b7280]">{meta}</p>
    </button>
  );
}

function DocumentRow({ doc, selected, onSelect }) {
  const type = fileType(doc.fileName || doc.name || doc.storageUrl);
  const Icon = TYPE_ICON[type] || FileText;
  const visibility = VISIBILITY[doc.visibility] || VISIBILITY.private;
  const VisibilityIcon = visibility.icon;
  return (
    <div
      onClick={() => onSelect(doc)}
      className={`grid w-full grid-cols-[minmax(0,1.5fr)_120px_130px_100px_80px] gap-4 border-b border-[#f3f4f6] px-4 py-3 text-left text-sm hover:bg-[#fafafa] cursor-pointer ${selected ? "bg-[#fff8f6]" : "bg-white"}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#6b7280]">
          <Icon size={16} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-[#111827]">{doc.fileName || doc.name || "Untitled document"}</span>
          <span className="block truncate text-xs text-[#9ca3af]">{doc.tags?.join(", ") || doc.folderPath || "No tags"}</span>
        </span>
      </span>
      <span className="text-[#374151]">{type.toUpperCase()}</span>
      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${visibility.className}`}>
        <VisibilityIcon size={11} /> {visibility.label}
      </span>
      <span className="text-[#6b7280]">{doc.version || "v1"}</span>
      <span onClick={(e) => e.stopPropagation()}>
        {doc.fileUrl ? (
          <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#884c2d] hover:underline">View</a>
        ) : (
          <span className="text-xs text-[#9ca3af]">No file</span>
        )}
      </span>
    </div>
  );
}

function fileExt(filename) {
  return (filename || "").split(".").pop().toLowerCase();
}

function UploadPanel({ folderLabel, onClose, onSave }) {
  const [form, setForm] = useState({ name: "", fileUrl: "", fileType: "pdf", fileSize: "" });
  const [fileReady, setFileReady] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleBrowse(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setForm((prev) => ({
      ...prev,
      name: prev.name || file.name,
      fileType: fileExt(file.name) || prev.fileType,
      fileUrl: dataUrl,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    }));
    setFileReady(true);
  }

  return (
    <SidePanel
      title="Upload Document"
      subtitle={folderLabel ? `Uploading to ${folderLabel}.` : "Select a company or project folder, or upload unfiled."}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name.trim()}><Upload size={14} /> Save Document</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">File *</span>
          <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-dashed border-[#d8c2b9] bg-[#fff8f6] px-3 py-3">
            <input id="center-doc-browse" type="file" className="hidden" onChange={handleBrowse} />
            <label htmlFor="center-doc-browse" className="cursor-pointer rounded-lg bg-[#884c2d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6f381a]">
              Browse…
            </label>
            <span className="truncate text-xs text-[#6b7280]">{fileReady ? `${form.name} (${form.fileSize})` : "No file selected"}</span>
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">File name *</span>
          <input value={form.name} onChange={(e) => set("name")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20" />
        </label>
      </div>
    </SidePanel>
  );
}

export default function DocumentCenter({ mode = "company" }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");
  const [selected, setSelected] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { records: companies } = useCrmRecords("companies");
  const { records: projects } = useCrmRecords("projects");
  const { records: documents, save: saveDocument } = useCrmRecords("documents");

  const projectDocs = useMemo(() => projects.flatMap((project) =>
    (project.documents || []).map((doc) => ({
      ...doc,
      projectId: project.id || project._id,
      companyId: project.companyId,
      projectName: project.name || project.projectName,
      visibility: doc.visibility || (doc.category === "Internal" ? "internal" : "client"),
      folderPath: `${project.name || "Project"} / ${doc.category || "Files"}`,
      fileName: doc.fileName || doc.name,
    }))
  ), [projects]);

  const allDocuments = useMemo(() => [...documents, ...projectDocs], [documents, projectDocs]);
  const visibleDocs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allDocuments.filter((doc) => {
      const haystack = `${doc.fileName || doc.name || ""} ${doc.folderPath || ""} ${doc.tags?.join(" ") || ""}`.toLowerCase();
      const matchesQuery = !normalized || haystack.includes(normalized);
      if (!matchesQuery) return false;
      if (!selectedFolderId) return true;
      if (mode === "company") return String(doc.companyId) === String(selectedFolderId);
      if (mode === "project") return String(doc.projectId) === String(selectedFolderId);
      return true;
    });
  }, [allDocuments, mode, query, selectedFolderId]);

  const page = {
    company: {
      title: "Company Folders",
      subtitle: "A folder-first view of all company documents, proposals, contracts, invoices, projects, and shared files.",
      folders: companies.map((company) => ({
        id: company._id || company.id,
        icon: Building2,
        title: company.companyName || company.name || "Unnamed company",
        meta: `${projects.filter((p) => String(p.companyId) === String(company._id) || String(p.companyId) === String(company.id)).length} projects`,
      })),
      empty: "Create companies first. Each company becomes a document workspace.",
    },
    project: {
      title: "Project Folders",
      subtitle: "Project files, deliverables, versions, shared documents, and activity in one place.",
      folders: projects.map((project) => ({
        id: project._id || project.id,
        icon: FolderOpen,
        title: project.name || project.projectName || "Untitled project",
        meta: `${(project.documents || []).length} documents`,
      })),
      empty: "Create projects first. Each project gets proposals, contracts, invoices, design files, deliverables, and client files.",
    },
  }[mode];

  const selectedFolderLabel = selectedFolderId ? page.folders.find((f) => String(f.id) === String(selectedFolderId))?.title : null;

  function toggleFolder(id) {
    setSelectedFolderId((current) => (String(current) === String(id) ? null : id));
  }

  async function handleUpload(form) {
    const payload = { ...form, name: form.name };
    if (mode === "company" && selectedFolderId) payload.companyId = selectedFolderId;
    if (mode === "project" && selectedFolderId) payload.projectId = selectedFolderId;
    await saveDocument(payload);
    setUploading(false);
  }

  return (
    <div className="flex min-h-full bg-[#F1F1F5]">
      <section className="min-w-0 flex-1 p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">Document Center</p>
            <h1 className="mt-1 text-2xl font-bold text-[#111827]">{page.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">{page.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3">
              <Search size={14} className="text-[#9ca3af]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents" className="w-52 bg-transparent text-sm outline-none" />
            </div>
            <button onClick={() => setView("grid")} className={`flex h-9 w-9 items-center justify-center rounded-lg border ${view === "grid" ? "border-[#884c2d] text-[#884c2d]" : "border-[#e5e7eb] text-[#6b7280]"}`}><Grid3X3 size={15} /></button>
            <button onClick={() => setView("list")} className={`flex h-9 w-9 items-center justify-center rounded-lg border ${view === "list" ? "border-[#884c2d] text-[#884c2d]" : "border-[#e5e7eb] text-[#6b7280]"}`}><List size={15} /></button>
            <Button onClick={() => setUploading(true)}><Upload size={14} /> Upload</Button>
          </div>
        </div>

        {view === "grid" && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {page.folders.map((folder) => (
              <FolderCard key={folder.id} {...folder} active={String(selectedFolderId) === String(folder.id)} onClick={() => toggleFolder(folder.id)} />
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
          <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[#111827]">
                Files{selectedFolderLabel ? ` — ${selectedFolderLabel}` : ""}
              </p>
              <p className="text-xs text-[#6b7280]">{visibleDocs.length} documents visible in this view</p>
            </div>
            {selectedFolderId ? (
              <button onClick={() => setSelectedFolderId(null)} className="text-xs font-bold text-[#884c2d] hover:underline">Clear folder filter</button>
            ) : (
              <p className="text-xs font-semibold text-[#6b7280]">Private / Internal / Project Team / Client Visible</p>
            )}
          </div>
          {visibleDocs.length ? (
            <div>
              <div className="grid grid-cols-[minmax(0,1.5fr)_120px_130px_100px_80px] gap-4 bg-[#fafafa] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#9ca3af]">
                <span>Name</span><span>Type</span><span>Visibility</span><span>Version</span><span>File</span>
              </div>
              {visibleDocs.map((doc, index) => (
                <DocumentRow key={doc._id || `${doc.fileName}-${index}`} doc={doc} selected={selected === doc} onSelect={setSelected} />
              ))}
            </div>
          ) : <EmptyState title="No documents yet." text={page.empty} />}
        </div>
      </section>

      <aside className="hidden w-80 shrink-0 border-l border-[#e5e7eb] bg-white p-5 xl:block">
        <p className="text-sm font-bold text-[#111827]">File Details</p>
        {selected ? (
          <div className="mt-4 space-y-4 text-sm">
            <Detail label="Name" value={selected.fileName || selected.name} />
            <Detail label="Owner" value={selected.uploadedBy || selected.owner} />
            <Detail label="Folder" value={selected.folderPath || selected.category} />
            <Detail label="Version" value={selected.version || "v1"} />
            <Detail label="Shared Status" value={(VISIBILITY[selected.visibility]?.label) || "Private"} />
            <Detail label="Created" value={selected.createdAt || selected.date} />
            {selected.fileUrl && (
              <a href={selected.fileUrl} target="_blank" rel="noreferrer" className="block w-full rounded-lg bg-[#884c2d] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#6f381a]">
                Open File
              </a>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#6b7280]">Select a file to inspect owner, version, created date, size, and sharing status.</p>
        )}
      </aside>

      {uploading && (
        <UploadPanel folderLabel={selectedFolderLabel} onClose={() => setUploading(false)} onSave={handleUpload} />
      )}
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
