import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, CheckCircle2, Circle, Clock3, FolderKanban, Flag, ListTodo, Search, User } from "lucide-react";
import { useCrmRecords } from "../../hooks/useCrmRecords";

const STAGE_STYLE = {
  completed:   { bar: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700", text: "text-emerald-600", icon: CheckCircle2, label: "Completed" },
  in_progress: { bar: "bg-[#884c2d]",   soft: "bg-[#fff1ec] text-[#884c2d]",   text: "text-[#884c2d]", icon: Clock3,      label: "In Progress" },
  blocked:     { bar: "bg-red-500",     soft: "bg-red-50 text-red-700",        text: "text-red-600",   icon: Flag,        label: "Blocked" },
  not_started: { bar: "bg-[#c2b3a9]",   soft: "bg-[#f1e7e1] text-[#6c6355]",   text: "text-[#9b8c83]", icon: Circle,      label: "Not Started" },
};

const ROW_H = 46;
const MONTH_W = 120;
const DAY_MS = 86400000;

function fmt(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtShort(date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusPillClass(status) {
  const map = {
    not_started: "bg-[#f1e7e1] text-[#6c6355]",
    in_progress: "bg-[#fff1ec] text-[#884c2d]",
    on_hold: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  };
  return map[status] || "bg-[#f1e7e1] text-[#6c6355]";
}

function stageBucket(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "done") return "completed";
  if (s === "blocked") return "blocked";
  if (["in_progress", "in progress", "review", "on track"].includes(s)) return "in_progress";
  return "not_started";
}

/** Milestone (stage) rows resolved from real stored dates. */
function resolveMilestones(project) {
  const source = project.timeline?.length ? project.timeline : project.stages?.length ? project.stages : [];
  return source
    .map((m) => {
      const live = project.stages?.find((s) => s.name === m.name);
      return {
        kind: "Stage",
        name: m.name,
        start: validDate(m.startDate),
        end: validDate(m.dueDate || m.endDate),
        status: stageBucket(live?.status || m.status),
        assignee: m.owner || "",
        priority: "",
      };
    })
    .filter((m) => m.start && m.end);
}

/** Task rows for this project, positioned by their own start/due dates. */
function resolveTasks(project, tasks) {
  const pid = String(project.id || project._id);
  return tasks
    .filter((t) => [t.projectId, t.project, t.projectName].map(String).includes(pid) || String(t.projectName) === String(project.name))
    .map((t) => ({
      kind: "Task",
      name: t.title || t.taskName || "Untitled task",
      start: validDate(t.startDate),
      end: validDate(t.dueDate || t.deadline || t.expectedEndDate),
      status: stageBucket(t.status),
      assignee: t.assignedTo || t.assignee || "",
      priority: t.priority || "",
    }))
    .filter((t) => t.start && t.end);
}

function ProjectGanttChart({ project, tasks }) {
  const rows = useMemo(() => {
    const merged = [...resolveMilestones(project), ...resolveTasks(project, tasks)];
    return merged.sort((a, b) => a.start - b.start || a.end - b.end);
  }, [project, tasks]);

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#ead9d0] bg-[#fbf3ee] py-16 text-center">
        <Calendar size={28} className="mb-3 text-[#b49f96]" />
        <p className="text-sm font-semibold text-[#6c6355]">No dated timeline items for this project yet.</p>
        <p className="mt-1 text-xs text-[#9b8c83]">Add start and due dates to milestones or tasks to see them on the timeline.</p>
      </div>
    );
  }

  const todayDate = new Date();
  const min = new Date(Math.min(...rows.map((r) => r.start.getTime())));
  const max = new Date(Math.max(...rows.map((r) => r.end.getTime())));
  const months = [];
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cursor <= max) {
    months.push({ label: cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const rangeStart = new Date(min.getFullYear(), min.getMonth(), 1).getTime();
  const rangeEnd = cursor.getTime();
  const totalSpan = Math.max(rangeEnd - rangeStart, DAY_MS);
  const toPct = (date) => Math.min(100, Math.max(0, ((date.getTime() - rangeStart) / totalSpan) * 100));
  const todayPct = todayDate.getTime() >= rangeStart && todayDate.getTime() <= rangeEnd ? toPct(todayDate) : null;
  const gridWidth = Math.max(months.length * MONTH_W, 560);

  return (
    <div className="overflow-hidden rounded-xl border border-[#ead9d0] bg-[#ffffff] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3e9e4] bg-[#fbf3ee] px-5 py-3.5">
        <div>
          <h3 className="font-display text-sm font-bold text-[#2b211c]">{project.name} — Timeline</h3>
          <p className="mt-0.5 text-xs text-[#6c6355]">{fmt(min)} → {fmt(max)} · {rows.length} item{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-[#6c6355]">
          {["not_started", "in_progress", "completed", "blocked"].map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STAGE_STYLE[key].bar}`} /> {STAGE_STYLE[key].label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${gridWidth + 240}px` }} className="flex">
          {/* Left: item names + meta */}
          <div className="w-60 shrink-0 border-r border-[#f3e9e4]">
            <div className="flex h-9 items-center bg-[#fbf3ee] px-4 text-[10px] font-bold uppercase tracking-wider text-[#9b8c83]">Item</div>
            {rows.map((r, i) => {
              const style = STAGE_STYLE[r.status];
              const Icon = r.kind === "Task" ? ListTodo : style.icon;
              const days = Math.max(1, Math.round((r.end - r.start) / DAY_MS) + 1);
              return (
                <div key={`${r.kind}-${r.name}-${i}`} style={{ height: ROW_H }} className="flex flex-col justify-center border-t border-[#f3e9e4] px-4">
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} className={style.text} />
                    <span className="truncate text-xs font-bold text-[#2b211c]" title={r.name}>{r.name}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#9b8c83]">
                    <span className="rounded bg-[#f1e7e1] px-1 py-px font-semibold text-[#6c6355]">{r.kind}</span>
                    <span>{days}d</span>
                    {r.assignee && <span className="flex items-center gap-0.5 truncate"><User size={9} />{r.assignee}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: dated bars */}
          <div className="relative min-w-0 flex-1" style={{ minWidth: `${gridWidth}px` }}>
            <div className="flex h-9 bg-[#ffffff]">
              {months.map((m, idx) => (
                <div key={idx} style={{ width: `${100 / months.length}%` }} className="flex items-center border-l border-[#f3e9e4] pl-2 text-[10px] font-bold uppercase tracking-wide text-[#9b8c83] first:border-l-0">
                  {m.label}
                </div>
              ))}
            </div>

            <div className="relative">
              {/* month gridlines */}
              <div className="pointer-events-none absolute inset-0 flex">
                {months.map((m, idx) => <div key={idx} style={{ width: `${100 / months.length}%` }} className="border-l border-[#f6efea] first:border-l-0" />)}
              </div>
              {/* today marker */}
              {todayPct !== null && (
                <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-400" style={{ left: `${todayPct}%` }}>
                  <span className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-red-400 px-1.5 py-0.5 text-[9px] font-bold text-white">Today</span>
                </div>
              )}

              {rows.map((r, i) => {
                const style = STAGE_STYLE[r.status];
                const left = toPct(r.start);
                const width = Math.max(toPct(r.end) - left, 2);
                const days = Math.max(1, Math.round((r.end - r.start) / DAY_MS) + 1);
                const range = `${fmtShort(r.start)} – ${fmtShort(r.end)}`;
                return (
                  <div key={`${r.kind}-${r.name}-${i}`} style={{ height: ROW_H }} className="relative border-t border-[#f3e9e4]">
                    <div
                      className={`absolute top-1/2 flex h-7 -translate-y-1/2 items-center gap-1.5 rounded-md px-2 text-[10px] font-bold text-white shadow-sm ${style.bar}`}
                      style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, minWidth: 64 }}
                      title={`${r.name}\n${style.label}${r.priority ? ` · ${r.priority} priority` : ""}${r.assignee ? ` · ${r.assignee}` : ""}\n${fmt(r.start)} – ${fmt(r.end)} (${days}d)`}
                    >
                      <span className="truncate">{range}</span>
                      <span className="ml-auto shrink-0 rounded bg-[#ffffff]/25 px-1">{days}d</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const navigate = useNavigate();
  const { records: projects, loading } = useCrmRecords("projects");
  const { records: companies } = useCrmRecords("companies");
  const { records: tasks } = useCrmRecords("tasks");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const companyName = useCallback((project) => {
    const cid = project.companyId;
    const found = companies.find((c) => String(c._id) === String(cid) || String(c.id) === String(cid));
    return found?.name || project.companyName || project.client || "Unknown company";
  }, [companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${companyName(p)}`.toLowerCase().includes(q));
  }, [projects, search, companyName]);

  const selected = projects.find((p) => String(p.id || p._id) === selectedId) || filtered[0] || null;

  return (
    <div className="min-h-full space-y-5 bg-[#faf6f3] p-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-[#2b211c]">Project Timelines</h2>
        <p className="mt-1 text-sm text-[#6c6355]">Stages and tasks plotted on a date-accurate Gantt — bars move and resize to the dates you set.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-sm text-[#6c6355]">Loading projects…</div>
      ) : !projects.length ? (
        <div className="rounded-xl border border-dashed border-[#ead9d0] bg-[#ffffff] p-10 text-center">
          <FolderKanban size={28} className="mx-auto mb-3 text-[#884c2d]" />
          <p className="text-sm font-semibold text-[#2b211c]">No projects yet.</p>
          <p className="mt-1 text-sm text-[#6c6355]">Create a project from a company workspace to see its timeline here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-4 xl:col-span-3">
            <div className="overflow-hidden rounded-xl border border-[#ead9d0] bg-[#ffffff]">
              <div className="border-b border-[#f3e9e4] bg-[#fbf3ee] p-3">
                <div className="flex h-9 items-center gap-2 rounded-lg border border-[#ead9d0] bg-[#ffffff] px-3">
                  <Search size={14} className="shrink-0 text-[#9b8c83]" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…" className="w-full bg-transparent text-sm text-[#2b211c] outline-none" />
                </div>
              </div>
              <div className="max-h-[60vh] divide-y divide-[#f3e9e4] overflow-y-auto">
                {filtered.map((p) => {
                  const isSelected = selected && String(selected.id || selected._id) === String(p.id || p._id);
                  return (
                    <button
                      key={p.id || p._id}
                      onClick={() => setSelectedId(String(p.id || p._id))}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${isSelected ? "bg-[#fff1ec]" : "hover:bg-[#fbf3ee]"}`}
                    >
                      <span className="truncate text-sm font-bold text-[#2b211c]">{p.name}</span>
                      <span className="truncate text-xs text-[#6c6355]">{companyName(p)}</span>
                      <span className={`mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusPillClass(p.clientStatus || p.status)}`}>
                        {(p.clientStatus || p.status || "not_started").replace(/_/g, " ")}
                      </span>
                    </button>
                  );
                })}
                {!filtered.length && <p className="px-4 py-6 text-center text-sm text-[#9b8c83]">No projects match your search.</p>}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 xl:col-span-9">
            {selected ? (
              <div className="space-y-3">
                <ProjectGanttChart project={selected} tasks={tasks} />
                <button
                  onClick={() => navigate(`/admin/companies/${selected.companyId}/projects/${selected.id || selected._id}`)}
                  className="text-xs font-bold text-[#884c2d] hover:underline"
                >
                  Open full project workspace →
                </button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#ead9d0] bg-[#ffffff] p-16 text-center text-sm text-[#6c6355]">
                Select a project to view its timeline.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
