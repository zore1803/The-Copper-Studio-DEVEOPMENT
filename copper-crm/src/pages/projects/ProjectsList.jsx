import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock3, FolderKanban, AlertTriangle, Plus, Search } from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { today, daysBetween, parseFullDate } from "../../lib/dates";
import { buildProjectPayload } from "../../lib/projectDefaults";
import ProjectCard from "../../components/ProjectCard";
import ProjectFormPanel from "../../components/ProjectFormPanel";
import { useToast } from "../../components/useToast";

const MONTH_COL_WIDTH = 140;

const priorityBar = {
  urgent: "border-red-200 bg-red-100 text-red-700",
  upcoming: "border-amber-200 bg-amber-100 text-amber-700",
  "on-track": "border-[#a8d8d2] bg-[#d7efeb] text-[#026769]",
};

function monthLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function KpiChip({ label, value, icon: Icon, tone = "default" }) {
  const toneStyles = {
    default: "bg-[#F1F1F5] text-[#884c2d]",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
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

function Section({ title, subtitle, action, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#E1E4EA] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#f1f1f5] bg-[#FAFAFA] px-5 py-3.5">
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

function DeadlineTimeline({ items }) {
  const TODAY = today();
  const { rows, months, minDate, totalMs } = useMemo(() => {
    const computed = items.map((project) => {
      const start = parseFullDate(project.startDate);
      const end = parseFullDate(project.dueDate || project.expectedEndDate);
      const daysLeft = daysBetween(TODAY, end);
      const overdue = daysLeft < 0 && project.status !== "Completed";
      return { project, start, end, daysLeft, overdue };
    }).sort((a, b) => a.end - b.end);

    if (!computed.length) return { rows: [], months: [], minDate: TODAY, totalMs: 1 };

    const min = new Date(Math.min(...computed.map((r) => r.start.getTime())));
    const max = new Date(Math.max(...computed.map((r) => r.end.getTime())));
    const monthCols = [];
    const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cursor <= max) {
      monthCols.push({ label: monthLabel(cursor) });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { rows: computed, months: monthCols, minDate: new Date(min.getFullYear(), min.getMonth(), 1), totalMs: Math.max(1, max - min) };
  }, [items, TODAY]);

  if (!rows.length) return null;

  const timelineWidth = months.length * MONTH_COL_WIDTH;
  const toPct = (date) => Math.min(100, Math.max(0, ((date - minDate) / totalMs) * 100));
  const todayVisible = rows.length && TODAY >= rows[0].start && TODAY <= new Date(minDate.getTime() + totalMs);

  return (
    <div className="overflow-hidden rounded-xl border border-[#E1E4EA] bg-white shadow-sm">
      <div className="flex border-b border-[#f1f1f5] px-5 py-3">
        <h3 className="text-sm font-semibold text-[#0E121B]">Deadline Timeline</h3>
        <p className="ml-auto text-xs font-semibold text-[#525866]">{rows.filter((r) => r.overdue).length} overdue</p>
      </div>
      <div className="flex">
        <div className="w-56 shrink-0 border-r border-[#f1f1f5]">
          <div className="flex h-11 items-center border-b border-[#f1f1f5] bg-[#fafafa] px-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Project</span>
          </div>
          {rows.map(({ project }) => (
            <Link
              key={project.id || project._id}
              to={`/admin/companies/${project.companyId}/projects/${project.id || project._id}`}
              className="flex h-12 items-center border-b border-[#f1f1f5] px-4 hover:bg-[#fafafa]"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#0E121B]">{project.name}</p>
                <p className="truncate text-[11px] text-[#525866]">{project.client}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div style={{ minWidth: `${timelineWidth}px` }}>
            <div className="flex h-11 border-b border-[#f1f1f5] bg-white">
              {months.map((month, index) => (
                <div
                  key={index}
                  style={{ width: `${MONTH_COL_WIDTH}px` }}
                  className="flex shrink-0 items-center justify-center border-r border-[#f1f1f5] text-[10px] font-bold uppercase text-[#9ca3af]"
                >
                  {month.label}
                </div>
              ))}
            </div>

            <div className="relative">
              {todayVisible && (
                <div className="absolute top-0 bottom-0 z-10 w-px bg-red-400" style={{ left: `${toPct(TODAY)}%` }}>
                  <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-400" />
                </div>
              )}
              {rows.map(({ project, start, end, daysLeft, overdue }) => {
                const left = toPct(start);
                const width = Math.max(3, toPct(end) - left);
                const tone = overdue ? "border-red-300 bg-red-200 text-red-800" : priorityBar[project.priority] || priorityBar["on-track"];
                return (
                  <Link
                    key={project.id || project._id}
                    to={`/admin/companies/${project.companyId}/projects/${project.id || project._id}`}
                    className="relative block h-12 border-b border-[#f1f1f5]"
                  >
                    <span
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute top-2.5 flex h-7 min-w-[70px] items-center justify-between gap-2 rounded-lg border px-2.5 text-[10px] font-bold shadow-sm transition-all hover:brightness-105 ${tone}`}
                    >
                      <span className="truncate">{project.progress}%</span>
                      <span className="shrink-0 whitespace-nowrap">
                        {project.status === "Completed" ? "Done" : overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function ProjectsList() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { records: projects, loading, save } = useCrmRecords("projects");
  const { records: companies } = useCrmRecords("companies");
  const { records: contacts } = useCrmRecords("contacts");
  const { records: invoices } = useCrmRecords("invoices");
  const { save: saveTask } = useCrmRecords("tasks");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.client} ${project.status}`.toLowerCase().includes(query)
    );
  }, [projects, search]);

  const kpis = useMemo(() => {
    const todayDate = today();
    const completed = projects.filter((p) => String(p.status || p.clientStatus || "").toLowerCase() === "completed").length;
    const overdue = projects.filter((p) => {
      const due = parseFullDate(p.dueDate || p.expectedEndDate || "");
      return !Number.isNaN(due.getTime()) && due < todayDate && String(p.status || "").toLowerCase() !== "completed";
    }).length;
    const inProgress = projects.length - completed;
    return { total: projects.length, inProgress, completed, overdue };
  }, [projects]);

  async function handleCreate(company, form) {
    const { payload, starterTasks } = buildProjectPayload(form, company);
    const created = await save(payload);
    const realProjectId = created._id || created.id;
    await Promise.all(starterTasks.map((task) => saveTask({ ...task, projectId: realProjectId })));
    setCreating(false);
    showToast({ title: "Project workspace created", message: `${created.name} now has timeline, tasks, documents, and activity.` });
    navigate(`/admin/companies/${company.id || company._id}/projects/${created.id || created._id}`);
  }

  return (
    <div className="min-h-full bg-[#F1F1F5] p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#0E121B]">All Projects</h2>
          <p className="mt-1 text-sm text-[#525866]">{filtered.length} of {projects.length} projects across every company</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-[#E1E4EA] bg-white px-3 sm:w-72">
            <Search size={14} className="text-[#9ca3af]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects or clients"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#9ca3af]"
            />
          </div>
          <Button onClick={() => setCreating(true)}><Plus size={14} /> New Project</Button>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiChip label="Total Projects" value={kpis.total} icon={FolderKanban} />
          <KpiChip label="In Progress" value={kpis.inProgress} icon={Clock3} tone="default" />
          <KpiChip label="Completed" value={kpis.completed} icon={CheckCircle2} tone="success" />
          <KpiChip label="Overdue" value={kpis.overdue} icon={AlertTriangle} tone={kpis.overdue ? "danger" : "default"} />
        </div>
      )}

      {!loading && <DeadlineTimeline items={filtered} />}

      <Section title="All Projects" subtitle={`${filtered.length} of ${projects.length} projects across every company`}>
        {filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard key={project.id || project._id} project={project} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-[#FAFAFA] p-10 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff1ec] text-[#884c2d]">
              <FolderKanban size={20} />
            </div>
            <p className="text-sm font-semibold text-[#0E121B]">{search ? "No projects match your search." : "No projects yet."}</p>
            <p className="mt-1 text-sm text-[#525866]">Create a project and link it to a company to get started.</p>
            <Button onClick={() => setCreating(true)} className="mt-4"><Plus size={14} /> New Project</Button>
          </div>
        )}
      </Section>

      {creating && (
        <ProjectFormPanel
          companies={companies}
          contacts={contacts}
          invoices={invoices}
          onClose={() => setCreating(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  );
}
