import { useEffect, useState } from "react";
import {
  AlertCircle, Calendar, Check, ChevronRight, Clock3, Edit3, Loader2,
  Plus, Save, Search, Trash2, X, FolderOpen, Info
} from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { adminApi } from "../../lib/clientApi";
import { Avatar } from "../../components/ui";
import SidePanel from "../../components/SidePanel";

/* ─── helpers ─── */

function fmt(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function fmtDisplay(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── tiny design atoms ─── */

function Pill({ label, color = "default" }) {
  const styles = {
    default: "bg-[#F1F1F5] text-[#525866]",
    green:   "bg-emerald-50 text-emerald-700",
    amber:   "bg-amber-50 text-amber-700",
    red:     "bg-red-50 text-red-700",
    copper:  "bg-[#fff1ec] text-[#884c2d]",
    blue:    "bg-blue-50 text-blue-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[color]}`}>
      {label}
    </span>
  );
}

function statusPill(status) {
  const map = {
    not_started: { label: "Not Started", color: "default" },
    in_progress:  { label: "In Progress",  color: "copper" },
    on_hold:      { label: "On Hold",       color: "amber" },
    completed:    { label: "Completed",     color: "green" },
    cancelled:    { label: "Cancelled",     color: "red" },
  };
  return map[status] || { label: status, color: "default" };
}

function stagePill(status) {
  const map = {
    pending:     { label: "Pending",     color: "default" },
    in_progress: { label: "In Progress", color: "copper" },
    completed:   { label: "Done",        color: "green" },
  };
  return map[status] || { label: status, color: "default" };
}

function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="animate-spin text-[#884c2d]" />;
}

function Toast({ message, type = "success", onClose }) {
  if (!message) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl text-sm font-semibold ${
      type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
    }`} style={{ animation: "toast-in .2s ease" }}>
      {type === "error" ? <AlertCircle size={15} /> : <Check size={15} />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

function SectionCard({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-[#E1E4EA] bg-[#FFFFFF] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Section({ title, subtitle, action, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#E1E4EA] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f1f5] bg-[#FAFAFA] px-5 py-3.5">
        <div>
          <h3 className="text-sm font-bold text-[#0E121B]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[#525866]">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function KpiChip({ label, value, icon: Icon, tone = "default" }) {
  const toneStyles = {
    default: "bg-[#F1F1F5] text-[#884c2d]",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="rounded-xl border border-[#E1E4EA] bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneStyles[tone]}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[#525866]">{label}</p>
          <p className="mt-0.5 truncate text-base font-bold text-[#0E121B]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ClientPicker({ clients, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = clients.find((c) => c._id === value);
  const filtered = clients.filter((c) => `${c.name} ${c.company || ""} ${c.email}`.toLowerCase().includes(query.toLowerCase()));

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[#884c2d] bg-[#fff1ec] px-4 py-2.5">
        <Avatar name={selected.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#0E121B]">{selected.name}</p>
          <p className="truncate text-xs text-[#525866]">{selected.company || selected.email}</p>
        </div>
        <button onClick={() => onChange("All")} className="flex-shrink-0 text-xs font-bold text-[#884c2d] hover:underline">Change client</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-2 rounded-lg border border-[#E1E4EA] bg-white px-3.5 focus-within:border-[#884c2d] focus-within:ring-2 focus-within:ring-[#884c2d]/15">
        <Search size={16} className="text-[#9ca3af] shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search and select a client…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#E1E4EA] bg-white shadow-lg">
          {filtered.length ? filtered.map((c) => (
            <button
              key={c._id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(c._id); setQuery(""); setOpen(false); }}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#fff1ec]"
            >
              <Avatar name={c.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0E121B]">{c.name}</p>
                <p className="truncate text-xs text-[#525866]">{c.company || c.email}</p>
              </div>
            </button>
          )) : <p className="px-3.5 py-3 text-sm text-[#525866]">No clients found.</p>}
        </div>
      )}
    </div>
  );
}

/* ─── STAGE EDITOR ─── */

const BLANK_STAGE = { name: "", status: "pending", startDate: "", endDate: "", notes: "" };

function StageEditor({ stages, onChange }) {
  function update(i, patch) {
    onChange(stages.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function remove(i) {
    onChange(stages.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...stages, { ...BLANK_STAGE }]);
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => (
        <div key={i} className="rounded-xl border border-[#E1E4EA] bg-[#FAFAFA]/60 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 rounded-full bg-[#884c2d] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {i + 1}
            </div>
            <input
              value={stage.name}
              onChange={e => update(i, { name: e.target.value })}
              placeholder="Stage name (e.g. Discovery & Research)"
              className="flex-1 rounded-lg border border-[#E1E4EA] bg-white px-3 py-1.5 text-sm font-semibold outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#C57E5B]/60"
            />
            <select
              value={stage.status}
              onChange={e => update(i, { status: e.target.value })}
              className="rounded-lg border border-[#E1E4EA] bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#884c2d]"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <button onClick={() => remove(i)} className="rounded-lg p-1.5 text-[#525866] hover:bg-red-50 hover:text-red-600 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#525866]">Start Date</span>
              <input
                type="date"
                value={fmt(stage.startDate)}
                onChange={e => update(i, { startDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#E1E4EA] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#C57E5B]/60"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#525866]">End Date</span>
              <input
                type="date"
                value={fmt(stage.endDate)}
                onChange={e => update(i, { endDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#E1E4EA] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#C57E5B]/60"
              />
            </label>
          </div>
          <textarea
            value={stage.notes}
            onChange={e => update(i, { notes: e.target.value })}
            placeholder="Stage notes (visible to client)…"
            rows={2}
            className="w-full rounded-lg border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none resize-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#C57E5B]/60"
          />
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 w-full justify-center rounded-xl border-2 border-dashed border-[#E1E4EA] py-3 text-xs font-bold text-[#884c2d] hover:border-[#884c2d] hover:bg-[#fff1ec] transition-all"
      >
        <Plus size={14} /> Add Stage
      </button>
    </div>
  );
}

/* ─── PROJECT FORM ─── */

const BLANK_PROJECT = {
  name: "",
  description: "",
  packageName: "",
  status: "not_started",
  progress: 0,
  currentPhase: "",
  startDate: "",
  expectedEndDate: "",
  adminNotes: "",
  stages: [],
  deliverables: [],
};

function ProjectForm({ initial, clientId, token, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...BLANK_PROJECT,
    ...(initial || {}),
    startDate: fmt(initial?.startDate),
    expectedEndDate: fmt(initial?.expectedEndDate),
    stages: (initial?.stages || []).map(s => ({
      ...s,
      startDate: fmt(s.startDate),
      endDate: fmt(s.endDate),
    })),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function patch(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Project name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, clientId };
      const saved = initial?._id
        ? await adminApi.updateProject(initial._id, payload, token)
        : await adminApi.createProject(payload, token);
      onSaved(saved);
    } catch (err) {
      setError(err.message || "Failed to save project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-5">
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold text-[#525866]">Project Name *</span>
            <input value={form.name} onChange={e => patch("name", e.target.value)} placeholder="e.g. Monolith Architectural Identity"
              className="mt-1.5 w-full rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-4 focus:ring-[#C57E5B]/50" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#525866]">Package / Service</span>
            <input value={form.packageName} onChange={e => patch("packageName", e.target.value)} placeholder="e.g. Growth Studio"
              className="mt-1.5 w-full rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-4 focus:ring-[#C57E5B]/50" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#525866]">Current Phase</span>
            <input value={form.currentPhase} onChange={e => patch("currentPhase", e.target.value)} placeholder="e.g. Logo Development"
              className="mt-1.5 w-full rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-4 focus:ring-[#C57E5B]/50" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#525866]">Status</span>
            <select value={form.status} onChange={e => patch("status", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#884c2d]">
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#525866]">Progress %</span>
            <div className="mt-1.5 flex items-center gap-3">
              <input type="range" min={0} max={100} step={5} value={form.progress}
                onChange={e => patch("progress", Number(e.target.value))}
                className="flex-1 accent-[#884c2d]" />
              <span className="w-10 text-right text-sm font-bold text-[#884c2d]">{form.progress}%</span>
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#525866]">Start Date</span>
            <input type="date" value={form.startDate} onChange={e => patch("startDate", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-4 focus:ring-[#C57E5B]/50" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#525866]">Expected End Date</span>
            <input type="date" value={form.expectedEndDate} onChange={e => patch("expectedEndDate", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-4 focus:ring-[#C57E5B]/50" />
          </label>
        </div>

        {/* Description */}
        <label className="block">
          <span className="text-xs font-bold text-[#525866]">Description (internal)</span>
          <textarea value={form.description} onChange={e => patch("description", e.target.value)}
            rows={2} placeholder="Brief internal description of this project…"
            className="mt-1.5 w-full rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none resize-none focus:border-[#884c2d] focus:ring-4 focus:ring-[#C57E5B]/50" />
        </label>

        {/* Admin Notes (visible to client) */}
        <label className="block">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-[#525866]">Notes for Client</span>
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wide">
              <Info size={9} /> Client visible
            </span>
          </div>
          <textarea value={form.adminNotes} onChange={e => patch("adminNotes", e.target.value)}
            rows={3} placeholder="These notes are visible to the client in their portal timeline…"
            className="w-full rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none resize-none focus:border-[#884c2d] focus:ring-4 focus:ring-[#C57E5B]/50" />
        </label>

        {/* Stages */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#525866]">Project Stages</span>
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wide">
              <Info size={9} /> Client visible
            </span>
          </div>
          <StageEditor
            stages={form.stages}
            onChange={s => patch("stages", s)}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="flex items-center gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel}
            className="h-9 rounded-xl border border-[#E1E4EA] bg-white px-4 text-xs font-bold text-[#525866] hover:bg-[#FAFAFA] transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex h-9 items-center gap-2 rounded-xl bg-[#884c2d] px-4 text-xs font-bold text-white shadow-md shadow-[#884c2d]/20 hover:bg-[#6f381a] disabled:opacity-60 transition-colors">
            {saving ? <><Spinner size={13} /> Saving…</> : <><Save size={13} /> {initial?._id ? "Save Changes" : "Create Project"}</>}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ─── MEETINGS PANEL ─── */

function MeetingsPanel({ meetings, token, onUpdated }) {
  const [updatingId, setUpdatingId] = useState(null);

  async function updateStatus(m, status) {
    setUpdatingId(m._id);
    try {
      const updated = await adminApi.updateMeeting(m._id, { ...m, status }, token);
      onUpdated(updated);
    } catch (err) {
      console.error("Failed to update meeting status:", err);
    } finally { setUpdatingId(null); }
  }

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-[#525866]">
        <Calendar size={32} className="mb-2 opacity-30" />
        <p className="text-sm font-semibold">No meeting requests</p>
      </div>
    );
  }

  const statusColor = { requested: "amber", confirmed: "copper", completed: "green", cancelled: "default" };

  return (
    <div className="divide-y divide-[#E1E4EA]/50">
      {meetings.map(m => (
        <div key={m._id} className="py-4 px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-[#0E121B] truncate">{m.title}</p>
                <Pill label={m.status} color={statusColor[m.status] || "default"} />
              </div>
              <p className="text-xs text-[#525866] mt-0.5">
                {m.type?.replace(/_/g, " ")} ·{" "}
                {m.preferredDate ? `Preferred: ${new Date(m.preferredDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "No date set"}
                {m.preferredTime ? ` at ${m.preferredTime}` : ""}
              </p>
              {m.agenda && <p className="text-xs text-[#525866] mt-1 italic">"{m.agenda}"</p>}
            </div>
            {updatingId === m._id ? (
              <Spinner size={14} />
            ) : (
              <div className="flex gap-1.5 flex-shrink-0">
                {m.status === "requested" && (
                  <button onClick={() => updateStatus(m, "confirmed")}
                    className="rounded-lg bg-[#884c2d] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#6f381a] transition-colors">
                    Confirm
                  </button>
                )}
                {m.status === "confirmed" && (
                  <button onClick={() => updateStatus(m, "completed")}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors">
                    Mark Done
                  </button>
                )}
                {["requested", "confirmed"].includes(m.status) && (
                  <button onClick={() => updateStatus(m, "cancelled")}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── MAIN PAGE ─── */

export default function ClientProjectsPage() {
  const { token } = useAuth();

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedProject, setSelectedProject] = useState(null);
  const [clientMeetings, setClientMeetings] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rightTab, setRightTab] = useState("timeline");

  const [editMode, setEditMode] = useState(false); // false | "create" | "edit"
  const [editingProject, setEditingProject] = useState(null);
  const [createClientId, setCreateClientId] = useState("");

  const [toast, setToast] = useState({ msg: "", type: "success" });
  const [deletingId, setDeletingId] = useState(null);
  const [clientMeetingsCount, setClientMeetingsCount] = useState(0);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4000);
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [clientList, projectList] = await Promise.all([
          adminApi.getClients(token),
          adminApi.getProjects(token),
        ]);
        if (!alive) return;
        setClients(clientList);
        setProjects(projectList);
      } catch {
        if (alive) showToast("Could not load client projects.", "error");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    let alive = true;
    if (clientFilter === "All") return;
    adminApi.getClientDetail(clientFilter, token)
      .then((detail) => { if (alive) setClientMeetingsCount((detail.meetings || []).length); })
      .catch(() => { if (alive) setClientMeetingsCount(0); });
    return () => { alive = false; };
  }, [clientFilter, token]);

  function clientIdOf(project) {
    const cid = project?.clientId;
    return (cid && typeof cid === "object") ? cid._id : cid;
  }

  function clientNameOf(project) {
    const cid = project?.clientId;
    if (cid && typeof cid === "object") return cid.name || cid.company || cid.email || "Unknown client";
    const found = clients.find((c) => c._id === cid);
    return found?.name || found?.company || "Unknown client";
  }

  async function openProject(project) {
    setSelectedProject(project);
    setRightTab("timeline");
    setDetailLoading(true);
    try {
      const detail = await adminApi.getClientDetail(clientIdOf(project), token);
      setClientMeetings(detail.meetings || []);
    } catch {
      setClientMeetings([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleProjectSaved(saved) {
    setProjects((prev) => {
      const exists = prev.some((p) => p._id === saved._id);
      return exists ? prev.map((p) => (p._id === saved._id ? saved : p)) : [saved, ...prev];
    });
    if (selectedProject?._id === saved._id) setSelectedProject(saved);
    setEditMode(false);
    setEditingProject(null);
    showToast(editMode === "edit" ? "Project updated — client portal refreshed." : "Project created — client can see it now.");
  }

  async function handleDeleteProject(project) {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    setDeletingId(project._id);
    try {
      await adminApi.deleteProject(project._id, token);
      setProjects((prev) => prev.filter((p) => p._id !== project._id));
      if (selectedProject?._id === project._id) setSelectedProject(null);
      showToast("Project deleted.");
    } catch (err) {
      showToast(err.message || "Delete failed.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  function handleMeetingUpdated(updated) {
    setClientMeetings((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
    showToast("Meeting status updated.");
  }

  function startEdit(project) {
    setEditingProject(project);
    setEditMode("edit");
  }

  function startCreate() {
    setCreateClientId(clients[0]?._id || "");
    setEditingProject(null);
    setEditMode("create");
  }

  const sp = statusPill;
  const selectedClient = clients.find((c) => c._id === clientFilter);
  const clientProjects = projects.filter((p) => clientFilter === "All" || clientIdOf(p) === clientFilter);
  const filteredProjects = clientProjects.filter((p) => {
    const matchesSearch = `${p.name} ${clientNameOf(p)} ${p.packageName || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const kpis = {
    total: clientProjects.length,
    inProgress: clientProjects.filter((p) => !["completed", "cancelled"].includes(p.status)).length,
    completed: clientProjects.filter((p) => p.status === "completed").length,
    meetings: clientFilter === "All" ? null : clientMeetingsCount,
  };

  /* ── render ── */

  return (
    <div className="flex h-full flex-col bg-[#F1F1F5]">
      <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ msg: "", type: "success" })} />

      {selectedProject ? (
        /* ── Project Detail ── */
        <div className="flex flex-col">
          <div className="border-b border-[#E1E4EA] bg-white px-6 py-5">
            <button onClick={() => setSelectedProject(null)} className="mb-3 flex items-center gap-1 text-xs font-bold text-[#884c2d] hover:underline">
              <ChevronRight size={12} className="rotate-180" /> Back to all projects
            </button>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-lg font-bold text-[#0E121B]">{selectedProject.name}</h2>
                  <Pill {...sp(selectedProject.status)} />
                </div>
                <p className="text-xs text-[#525866]">
                  {clientNameOf(selectedProject)} · {selectedProject.packageName || "No package"}
                  {selectedProject.expectedEndDate && ` · Due ${fmtDisplay(selectedProject.expectedEndDate)}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => startEdit(selectedProject)} className="flex h-8 items-center gap-1.5 rounded-xl border border-[#E1E4EA] bg-white px-3 text-xs font-bold text-[#884c2d] hover:bg-[#fff1ec] transition-colors">
                  <Edit3 size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDeleteProject(selectedProject)}
                  disabled={deletingId === selectedProject._id}
                  className="flex h-8 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deletingId === selectedProject._id ? <Spinner size={12} /> : <Trash2 size={12} />}
                  Delete
                </button>
              </div>
            </div>

            <div className="flex gap-1 mt-4 border-b border-[#E1E4EA]">
              {[
                { key: "timeline", label: "Timeline & Stages" },
                { key: "meetings", label: `Meetings ${clientMeetings.length ? `(${clientMeetings.length})` : ""}` },
              ].map((tab) => (
                <button key={tab.key} onClick={() => setRightTab(tab.key)}
                  className={`pb-2.5 px-1 mr-4 text-xs font-bold border-b-2 transition-all ${
                    rightTab === tab.key ? "border-[#884c2d] text-[#884c2d]" : "border-transparent text-[#525866] hover:text-[#0E121B]"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-5 max-w-4xl">
            {rightTab === "timeline" && (
              <>
                <SectionCard>
                  <div className="px-5 py-4 border-b border-[#E1E4EA] bg-[#FAFAFA] rounded-t-xl">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#525866]">Project Overview</h3>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {[
                        { label: "Progress", value: `${selectedProject.progress || 0}%` },
                        { label: "Current Phase", value: selectedProject.currentPhase || "—" },
                        { label: "Start Date", value: fmtDisplay(selectedProject.startDate) },
                        { label: "Expected End", value: fmtDisplay(selectedProject.expectedEndDate) },
                      ].map((r) => (
                        <div key={r.label} className="rounded-lg border border-[#F1F1F5] bg-[#FAFAFA] px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#525866]">{r.label}</p>
                          <p className="text-sm font-bold text-[#0E121B] mt-0.5 truncate">{r.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-3 rounded-full bg-[#E1E4EA] overflow-hidden">
                        <div className="h-full rounded-full bg-[#884c2d] transition-all duration-700" style={{ width: `${selectedProject.progress || 0}%` }} />
                      </div>
                      <span className="text-sm font-bold text-[#884c2d]">{selectedProject.progress || 0}%</span>
                    </div>
                  </div>
                </SectionCard>

                {selectedProject.adminNotes && (
                  <SectionCard>
                    <div className="px-5 py-4 border-b border-[#E1E4EA] bg-[#FAFAFA] rounded-t-xl flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#525866]">Notes for Client</h3>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 uppercase">Visible</span>
                    </div>
                    <p className="p-5 text-sm text-[#0E121B] leading-relaxed">{selectedProject.adminNotes}</p>
                  </SectionCard>
                )}

                <SectionCard>
                  <div className="px-5 py-4 border-b border-[#E1E4EA] bg-[#FAFAFA] rounded-t-xl flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#525866]">
                      Stages ({selectedProject.stages?.length || 0})
                    </h3>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 uppercase">Client visible</span>
                  </div>
                  {!selectedProject.stages?.length ? (
                    <div className="flex flex-col items-center py-8 text-center px-6">
                      <p className="text-xs text-[#525866]">No stages defined. Click Edit to add stages.</p>
                      <button onClick={() => startEdit(selectedProject)} className="mt-3 flex items-center gap-1 text-xs font-bold text-[#884c2d] hover:underline">
                        <Plus size={12} /> Add Stages
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E1E4EA]/40">
                      {selectedProject.stages.map((stage, i) => {
                        const stp = stagePill(stage.status);
                        return (
                          <div key={i} className="px-5 py-4 flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                              stage.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                              stage.status === "in_progress" ? "bg-[#fff1ec] text-[#884c2d]" :
                              "bg-[#F1F1F5] text-[#525866]"
                            }`}>
                              {stage.status === "completed" ? <Check size={14} /> : i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="text-sm font-bold text-[#0E121B]">{stage.name}</p>
                                <Pill label={stp.label} color={stp.color} />
                              </div>
                              {stage.notes && <p className="text-xs text-[#525866] mt-1">{stage.notes}</p>}
                              {(stage.startDate || stage.endDate) && (
                                <div className="flex items-center gap-3 mt-1.5">
                                  {stage.startDate && (
                                    <span className="flex items-center gap-1 text-[11px] text-[#525866]">
                                      <Calendar size={11} /> {fmtDisplay(stage.startDate)}
                                    </span>
                                  )}
                                  {stage.endDate && (
                                    <span className="flex items-center gap-1 text-[11px] text-[#525866]">
                                      → {fmtDisplay(stage.endDate)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </>
            )}

            {rightTab === "meetings" && (
              <SectionCard>
                <div className="px-5 py-4 border-b border-[#E1E4EA] bg-[#FAFAFA] rounded-t-xl">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#525866]">Meeting Requests</h3>
                  <p className="text-xs text-[#525866]/70 mt-0.5">Approve or cancel client meeting requests from here.</p>
                </div>
                {detailLoading ? (
                  <div className="flex justify-center py-10"><Spinner /></div>
                ) : (
                  <MeetingsPanel meetings={clientMeetings} token={token} onUpdated={handleMeetingUpdated} />
                )}
              </SectionCard>
            )}
          </div>
        </div>
      ) : (
        /* ── 3-section browse view ── */
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="mb-1">
            <h1 className="text-base font-medium text-[#0E121B]">Client Projects</h1>
            <p className="text-xs text-[#525866] mt-0.5">Select a client to see their KPIs, projects, and timelines — synced live to their portal.</p>
          </div>

          {/* Section 1: client picker */}
          <Section title="1. Select Client" subtitle="Choose a client, or leave unselected to browse every project.">
            <div className="max-w-md">
              <ClientPicker clients={clients} value={clientFilter} onChange={setClientFilter} />
            </div>
          </Section>

          {/* Section 2: KPIs */}
          <Section title="2. Overview" subtitle={selectedClient ? `${selectedClient.name}'s project KPIs.` : "KPIs across every client."}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiChip label="Total Projects" value={kpis.total} icon={FolderOpen} />
              <KpiChip label="In Progress" value={kpis.inProgress} icon={Clock3} />
              <KpiChip label="Completed" value={kpis.completed} icon={Check} tone="success" />
              <KpiChip label="Meetings" value={kpis.meetings === null ? "—" : kpis.meetings} icon={Calendar} tone="warning" />
            </div>
          </Section>

          {/* Section 3: projects */}
          <Section
            title="3. Projects"
            subtitle={selectedClient ? `${filteredProjects.length} project${filteredProjects.length === 1 ? "" : "s"} for ${selectedClient.name}.` : `${filteredProjects.length} of ${projects.length} projects across every client.`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 items-center gap-2 rounded-lg border border-[#E1E4EA] bg-white px-3">
                  <Search size={14} className="text-[#9ca3af] shrink-0" />
                  <input className="w-40 bg-transparent text-sm outline-none" placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-lg border border-[#E1E4EA] bg-white px-3 text-sm outline-none">
                  {["All", "not_started", "in_progress", "on_hold", "completed", "cancelled"].map((s) => (
                    <option key={s} value={s}>{s === "All" ? "All Statuses" : sp(s).label}</option>
                  ))}
                </select>
                <button
                  onClick={startCreate}
                  disabled={!clients.length}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[#C57E5B] px-3 text-xs font-bold text-white hover:bg-[#b06a48] transition-colors disabled:opacity-50"
                >
                  <Plus size={14} /> New Project
                </button>
              </div>
            }
          >
            {loading ? (
              <div className="flex justify-center py-20"><Spinner size={24} /></div>
            ) : filteredProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-[#FAFAFA] p-12 text-center">
                <FolderOpen size={32} className="mx-auto mb-3 text-[#525866]/30" />
                <p className="text-sm font-semibold text-[#525866]">{clients.length === 0 ? "No clients yet" : "No projects match your filters"}</p>
                <p className="text-xs text-[#525866]/70 mt-1">{clients.length === 0 ? "Clients appear after paying for a package." : "Try adjusting search, status, or the selected client."}</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#E1E4EA]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA]">
                      <tr>
                        {(selectedClient ? ["Project", "Package", "Status", "Progress", "Actions"] : ["Project", "Client", "Package", "Status", "Progress", "Actions"]).map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#525866]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {filteredProjects.map((p) => {
                        const s = sp(p.status);
                        return (
                          <tr key={p._id} onClick={() => openProject(p)} className="cursor-pointer hover:bg-[#fafafa] transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <Avatar name={p.name} size="sm" />
                                <span className="font-semibold text-[#0E121B]">{p.name}</span>
                              </div>
                            </td>
                            {!selectedClient && <td className="px-4 py-3.5 text-[#374151]">{clientNameOf(p)}</td>}
                            <td className="px-4 py-3.5 text-[#374151]">{p.packageName || "—"}</td>
                            <td className="px-4 py-3.5"><Pill {...s} /></td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2 w-32">
                                <div className="flex-1 h-1.5 rounded-full bg-[#E1E4EA] overflow-hidden">
                                  <div className="h-full rounded-full bg-[#884c2d]" style={{ width: `${p.progress || 0}%` }} />
                                </div>
                                <span className="text-xs font-bold text-[#884c2d]">{p.progress || 0}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <button onClick={() => startEdit(p)} className="rounded-lg p-1.5 text-[#525866] hover:bg-[#fff1ec] hover:text-[#884c2d]"><Edit3 size={14} /></button>
                                <button onClick={() => handleDeleteProject(p)} disabled={deletingId === p._id} className="rounded-lg p-1.5 text-[#525866] hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Section>
        </div>
      )}

      {editMode && (
        <SidePanel
          title={editMode === "edit" ? "Edit Project" : "New Project"}
          subtitle={editMode === "edit" ? `${editingProject?.name} · ${clientNameOf(editingProject)}` : "Create a project for a client."}
          onClose={() => { setEditMode(false); setEditingProject(null); }}
        >
          {editMode === "create" && (
            <label className="block mb-5">
              <span className="text-xs font-bold text-[#525866]">Client *</span>
              <select
                value={createClientId}
                onChange={(e) => setCreateClientId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#884c2d]"
              >
                {clients.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.company || c.email})</option>)}
              </select>
            </label>
          )}
          <ProjectForm
            initial={editMode === "edit" ? editingProject : null}
            clientId={editMode === "edit" ? clientIdOf(editingProject) : createClientId}
            token={token}
            onSaved={handleProjectSaved}
            onCancel={() => { setEditMode(false); setEditingProject(null); }}
          />
        </SidePanel>
      )}
    </div>
  );
}
