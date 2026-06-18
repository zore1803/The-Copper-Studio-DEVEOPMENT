import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Calendar, CheckCircle2, Circle, Clock3, FolderKanban, Search } from "lucide-react";
import { useCrmRecords } from "../../hooks/useCrmRecords";

const STAGE_STYLE = {
  completed: { bar: "from-emerald-400 to-emerald-600", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  in_progress: { bar: "from-[#C57E5B] to-[#884c2d]", dot: "bg-[#884c2d]", chip: "bg-[#fff1ec] text-[#884c2d]", icon: Clock3 },
  not_started: { bar: "from-gray-300 to-gray-400", dot: "bg-[#d1d5db]", chip: "bg-gray-100 text-gray-500", icon: Circle },
};

function statusPillClass(status) {
  const map = {
    not_started: "bg-gray-100 text-gray-600",
    in_progress: "bg-[#fff1ec] text-[#884c2d]",
    on_hold: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

function fmt(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveMilestones(project) {
  if (project.timeline?.length) {
    return project.timeline
      .map((m) => {
        const start = validDate(m.startDate);
        const end = validDate(m.dueDate || m.endDate);
        const live = project.stages?.find((s) => s.name === m.name);
        return {
          name: m.name,
          start,
          end,
          status: live?.status || (m.status === "On Track" ? "in_progress" : m.status === "Completed" ? "completed" : "not_started"),
        };
      })
      .filter((m) => m.start && m.end)
      .map((m, i, arr) => ({ ...m, index: i, total: arr.length }));
  }
  if (project.stages?.length) {
    return project.stages
      .map((s) => ({
        name: s.name,
        start: validDate(s.startDate),
        end: validDate(s.dueDate || s.endDate),
        status: s.status,
      }))
      .filter((m) => m.start && m.end)
      .map((m, i, arr) => ({ ...m, index: i, total: arr.length }));
  }
  return [];
}

function ProjectGanttChart({ project }) {
  const milestones = useMemo(() => resolveMilestones(project), [project]);

  if (!milestones.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E1E4EA] bg-[#FAFAFA] py-16 text-center">
        <Calendar size={28} className="mb-3 text-[#9ca3af]" />
        <p className="text-sm font-semibold text-[#525866]">No timeline data for this project yet.</p>
        <p className="mt-1 text-xs text-[#9ca3af]">Add real start and due dates to timeline milestones to see the Gantt chart.</p>
      </div>
    );
  }

  const todayDate = new Date();
  const min = new Date(Math.min(...milestones.map((m) => m.start.getTime())));
  const max = new Date(Math.max(...milestones.map((m) => m.end.getTime())));
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  const months = [];
  while (cursor <= max) {
    months.push({ label: cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), date: new Date(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const rangeStart = months[0]?.date.getTime() ?? min.getTime();
  const rangeEnd = new Date(cursor).getTime();
  const totalSpan = Math.max(rangeEnd - rangeStart, 86400000);
  const toPct = (date) => Math.min(100, Math.max(0, ((date.getTime() - rangeStart) / totalSpan) * 100));
  const todayPct = todayDate.getTime() >= rangeStart && todayDate.getTime() <= rangeEnd ? toPct(todayDate) : null;
  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const completionPct = Math.round((completedCount / Math.max(milestones.length, 1)) * 100);
  const activeMilestone = milestones.find((m) => m.status === "in_progress") || milestones.find((m) => m.status !== "completed");

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E1E4EA] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#f1f1f5] bg-[#fbfaf9] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#fff1ec] text-[#884c2d]">
            <BarChart3 size={20} />
          </div>
          <div>
          <h3 className="text-sm font-bold text-[#0E121B]">{project.name} — Timeline</h3>
          <p className="mt-0.5 text-xs text-[#525866]">
            {fmt(min)} → {fmt(max)} · {milestones.length} stage{milestones.length === 1 ? "" : "s"}
          </p>
            {activeMilestone && (
              <p className="mt-1 text-xs font-semibold text-[#884c2d]">Current focus: {activeMilestone.name}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#525866]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={13} /> {completionPct}% complete
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#525866] ring-1 ring-[#E1E4EA]">
            {completedCount}/{milestones.length} stages done
          </span>
          {Object.entries({ not_started: "Not Started", in_progress: "In Progress", completed: "Completed" }).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STAGE_STYLE[key].dot}`} /> {label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto p-5">
        <div style={{ minWidth: `${Math.max(months.length * 110, 600)}px` }}>
          {/* Month scale header */}
          <div className="relative mb-2 ml-[210px] grid" style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
            {months.map((m) => (
              <div key={m.label} className="border-l border-[#f1f1f5] pl-2 text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] first:border-l-0">
                {m.label}
              </div>
            ))}
          </div>

          {/* Gantt rows */}
          <div className="relative rounded-xl border border-[#f1f1f5] bg-[#FAFAFA] p-3">
            {/* month gridlines */}
            <div className="pointer-events-none absolute inset-y-3 left-[222px] right-3 grid" style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
              {months.map((m) => <div key={m.label} className="border-l border-[#ECECEC] first:border-l-0" />)}
            </div>
            {/* today marker */}
            {todayPct !== null && (
              <div className="pointer-events-none absolute top-3 bottom-3 z-10 w-px bg-red-400" style={{ left: `calc(222px + (100% - 234px) * ${todayPct / 100})` }}>
                <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded bg-red-400 px-1.5 py-0.5 text-[9px] font-bold text-white">Today</span>
              </div>
            )}

            {milestones.map((m) => {
              const style = STAGE_STYLE[m.status] || STAGE_STYLE.not_started;
              const Icon = style.icon;
              const left = toPct(m.start);
              const width = Math.max(toPct(m.end) - left, 4);
              const dateLabel = `${fmt(m.start)} – ${fmt(m.end)}`;
              return (
                <div key={m.name} className="relative grid min-h-14 grid-cols-[190px_1fr] items-center gap-5 rounded-lg px-2 py-2 odd:bg-white/70">
                  <div className="flex min-w-0 items-center gap-2 pr-2">
                    <Icon size={14} className={style.chip.includes("emerald") ? "text-emerald-600" : style.chip.includes("884c2d") ? "text-[#884c2d]" : "text-gray-400"} />
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-bold text-[#0E121B]">{m.name}</span>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${style.chip}`}>{m.status.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="relative h-10">
                    <div
                      className={`absolute top-1 flex h-8 min-w-[120px] items-center rounded-xl bg-gradient-to-r px-2.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-white/50 ${style.bar}`}
                      style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                      title={dateLabel}
                    >
                      <span className="truncate">{dateLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
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
    <div className="min-h-full bg-[#F1F1F5] p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#0E121B]">Project Timelines</h2>
        <p className="mt-1 text-sm text-[#525866]">Pick a project to see its accurate, date-based Gantt timeline.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-sm text-[#525866]">Loading projects…</div>
      ) : !projects.length ? (
        <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
          <FolderKanban size={28} className="mx-auto mb-3 text-[#884c2d]" />
          <p className="text-sm font-semibold text-[#0E121B]">No projects yet.</p>
          <p className="mt-1 text-sm text-[#525866]">Create a project from a company workspace to see its timeline here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-4 xl:col-span-3">
            <div className="overflow-hidden rounded-xl border border-[#E1E4EA] bg-white">
              <div className="border-b border-[#f1f1f5] bg-[#FAFAFA] p-3">
                <div className="flex h-9 items-center gap-2 rounded-lg border border-[#E1E4EA] bg-white px-3">
                  <Search size={14} className="text-[#9ca3af] shrink-0" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…" className="w-full bg-transparent text-sm outline-none" />
                </div>
              </div>
              <div className="max-h-[60vh] divide-y divide-[#f3f4f6] overflow-y-auto">
                {filtered.map((p) => {
                  const isSelected = selected && String(selected.id || selected._id) === String(p.id || p._id);
                  return (
                    <button
                      key={p.id || p._id}
                      onClick={() => setSelectedId(String(p.id || p._id))}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${isSelected ? "bg-[#fff1ec]" : "hover:bg-[#fafafa]"}`}
                    >
                      <span className="truncate text-sm font-bold text-[#0E121B]">{p.name}</span>
                      <span className="truncate text-xs text-[#525866]">{companyName(p)}</span>
                      <span className={`mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusPillClass(p.clientStatus || p.status)}`}>
                        {(p.clientStatus || p.status || "not_started").replace(/_/g, " ")}
                      </span>
                    </button>
                  );
                })}
                {!filtered.length && <p className="px-4 py-6 text-center text-sm text-[#9ca3af]">No projects match your search.</p>}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 xl:col-span-9">
            {selected ? (
              <div className="space-y-3">
                <ProjectGanttChart project={selected} />
                <button
                  onClick={() => navigate(`/admin/companies/${selected.companyId}/projects/${selected.id || selected._id}`)}
                  className="text-xs font-bold text-[#884c2d] hover:underline"
                >
                  Open full project workspace →
                </button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#E1E4EA] bg-white p-16 text-center text-sm text-[#525866]">
                Select a project to view its timeline.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
