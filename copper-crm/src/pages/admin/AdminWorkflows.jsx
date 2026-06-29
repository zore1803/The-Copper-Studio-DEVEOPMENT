import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Calendar, Edit3, Eye, EyeOff,
  Globe2, LayoutGrid, List, LockKeyhole, Mail, MessageCircle,
  Plus, Save, Search,
  Settings as SettingsIcon, ShieldCheck, SlidersHorizontal,
  Trash2, UploadCloud, UserPlus
} from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import { useAuth } from "../../auth/useAuth";
import { apiGet, apiPost, apiPut } from "../../lib/api";
import SidePanel from "../../components/SidePanel";
import { isEmail, isGstin } from "../../lib/validators";
import { loadCompanyOwners, persistCompanyOwners } from "../../lib/companyOwners";

const URL_RE = /^([a-z]+:\/\/)?[^\s.]+\.[^\s]{2,}$/i;

function Card({ children, className = "" }) {
  return <section className={`rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-100/60 ${className}`}>{children}</section>;
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}

const TASK_STAGES = ["Backlog", "To Do", "In Progress", "Review", "Completed", "Blocked"];
const MEETING_STAGES = ["requested", "confirmed", "completed", "cancelled"];
const MEETING_STAGE_LABEL = { requested: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" };

function TaskStatusPill({ status = "Accepted" }) {
  const map = {
    Accepted: "bg-blue-50 text-blue-600", High: "bg-red-50 text-red-600", Medium: "bg-yellow-50 text-yellow-600", Low: "bg-gray-100 text-gray-500",
    requested: "bg-amber-50 text-amber-700", confirmed: "bg-blue-50 text-blue-600", completed: "bg-emerald-50 text-emerald-700", cancelled: "bg-gray-100 text-gray-500",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

function meetingWhen(meeting) {
  const raw = meeting.scheduledAt || meeting.preferredDate;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MeetingCalendarView({ meetings }) {
  const todayDate = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);

  const withDates = useMemo(
    () => meetings.map((meeting) => ({ meeting, when: meetingWhen(meeting) })).filter((m) => m.when),
    [meetings]
  );

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      list.push({ date, meetings: withDates.filter((m) => sameDay(m.when, date)).map((m) => m.meeting) });
    }
    return list;
  }, [cursor, withDates]);

  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const selectedMeetings = selectedDay ? cells.find((c) => c && sameDay(c.date, selectedDay))?.meetings || [] : [];

  return (
    <div className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">← Prev</button>
        <p className="text-sm font-bold text-gray-900">{monthLabel}</p>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">Next →</button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="grid grid-cols-7 bg-gray-50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
            <div key={label} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, index) => {
            if (!cell) return <div key={`pad-${index}`} className="aspect-square border border-gray-100 bg-gray-50/60" />;
            const isToday = sameDay(cell.date, todayDate);
            return (
              <button
                key={cell.date.toISOString()}
                onClick={() => setSelectedDay(cell.date)}
                className={`aspect-square border border-gray-100 p-1.5 text-left transition-colors hover:bg-blue-50 ${isToday ? "bg-blue-50/60" : "bg-white"}`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${isToday ? "bg-[#2563EB] text-white" : "text-gray-700"}`}>
                  {cell.date.getDate()}
                </span>
                {cell.meetings.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {cell.meetings.slice(0, 3).map((m) => <span key={m.id || m._id} className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />)}
                    {cell.meetings.length > 3 && <span className="text-[9px] font-bold text-[#2563EB]">+{cell.meetings.length - 3}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {selectedDay && (
        <SidePanel
          title={selectedDay.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          subtitle={`${selectedMeetings.length} meeting${selectedMeetings.length === 1 ? "" : "s"} this day.`}
          onClose={() => setSelectedDay(null)}
        >
          {selectedMeetings.length ? (
            <div className="space-y-2">
              {selectedMeetings.map((m) => (
                <div key={m.id || m._id} className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                  <div className="mt-1.5"><TaskStatusPill status={m.status} /></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">No meetings on this day.</p>
          )}
        </SidePanel>
      )}
    </div>
  );
}

export function TasksPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("Tasks");
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const { records: taskRecords, save: saveTask, remove: removeTask } = useCrmRecords("tasks");
  const { records: meetingRecords, save: saveMeeting, remove: removeMeeting } = useCrmRecords("meetings");
  const PAGE_SIZE = 10;

  const taskRows = useMemo(() => taskRecords.map((task) => ({
    ...task,
    id: task.id || task.taskId || task._id,
    title: task.title || task.taskName || "",
    relatedTo: task.relatedTo || task.project || task.projectName || "",
    relatedType: task.relatedType || "Project",
    assigned: task.assigned || task.assignedTo || "",
    due: task.due || task.dueDate || "",
    status: task.status || "Backlog",
    priority: task.priority || "Medium",
  })), [taskRecords]);
  const meetingRows = useMemo(() => meetingRecords.map((meeting) => ({
    ...meeting,
    id: meeting.id || meeting.meetingId || meeting._id,
    title: meeting.title || meeting.subject || "",
    type: meeting.type || meeting.channel || "",
    scheduled: meeting.scheduled || meeting.scheduledAt || meeting.preferredDate || "",
    duration: meeting.duration || "",
    status: meeting.status || "requested",
    contact: meeting.contact || meeting.contactName || meeting.participants?.[0]?.name || "",
    contactType: meeting.contactType || meeting.companyName || "",
  })), [meetingRecords]);
  const filteredTasks = taskRows
    .filter((t) => `${t.title} ${t.relatedTo} ${t.status}`.toLowerCase().includes(query.toLowerCase()))
    .filter((t) => statusFilter === "All" || t.status === statusFilter);
  const filteredMeetings = meetingRows
    .filter((m) => `${m.title} ${m.contact}`.toLowerCase().includes(query.toLowerCase()))
    .filter((m) => statusFilter === "All" || m.status === statusFilter);

  const activeRows = tab === "Tasks" ? filteredTasks : filteredMeetings;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const paginated = activeRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusOptions = tab === "Tasks" ? TASK_STAGES : MEETING_STAGES;
  const paginatedTaskIds = paginated.map((t) => t.id);
  const allTasksSelected = paginatedTaskIds.length > 0 && paginatedTaskIds.every((id) => selectedTaskIds.includes(id));

  function toggleSelectAllTasks() {
    setSelectedTaskIds((prev) => (allTasksSelected ? prev.filter((id) => !paginatedTaskIds.includes(id)) : [...new Set([...prev, ...paginatedTaskIds])]));
  }

  function toggleSelectTask(id) {
    setSelectedTaskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function switchTab(t) {
    setTab(t);
    setPage(1);
    setStatusFilter("All");
    setView((v) => (v === "calendar" && t === "Tasks" ? "list" : v));
  }

  async function updateMeetingStatus(meeting, status) {
    setUpdatingId(meeting.id);
    try {
      await saveMeeting({ ...meeting, status });
      showToast({ title: "Meeting updated", message: `${meeting.title || "Meeting"} is now ${status}.` });
    } catch (err) {
      showToast({ type: "error", title: "Could not update meeting", message: err.message });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeleteTask(task) {
    if (!window.confirm(`Delete "${task.title || "this task"}"?`)) return;
    await removeTask(task);
    showToast({ title: "Task deleted" });
  }

  async function handleDeleteMeeting(meeting) {
    if (!window.confirm(`Delete "${meeting.title || "this meeting"}"?`)) return;
    await removeMeeting(meeting);
    showToast({ title: "Meeting deleted" });
  }

  async function handleSaveSelected() {
    if (!selected) return;
    await saveTask(selected);
    showToast({ title: selected._id ? "Task updated" : "Task created" });
    setSelected(null);
  }

  return (
    <div className="p-5 xl:p-6 bg-[#f9fafb] min-h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks &amp; Meetings</h1>
          <p className="text-sm text-gray-500">Manage your Tasks &amp; reminders</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "Tasks" && (
            <button onClick={() => setSelected({ title: "", relatedTo: "", assigned: "", due: "", status: "Backlog", priority: "Medium" })} className="flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-xs font-semibold text-white hover:bg-blue-600">
              <Plus size={14} /> New Activity
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
          <div className="flex gap-1">
            {["Tasks", "Meetings"].map((t) => (
              <button key={t} onClick={() => switchTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t ? "border-b-2 border-[#2563EB] text-[#2563EB] rounded-none pb-1" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-500">
              <Search size={12} />
              <input className="w-44 bg-transparent outline-none placeholder:text-gray-400 text-xs" placeholder={tab === "Tasks" ? "Search by task by title, description, or status..." : "Search by meeting by title, priority, or contact..."} value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
            </div>
            <div className="relative">
              <button onClick={() => setFiltersOpen((v) => !v)} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${statusFilter !== "All" ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                <SlidersHorizontal size={13} />
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                  <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Filter by status</p>
                  {["All", ...statusOptions].map((status) => (
                    <button
                      key={status}
                      onClick={() => { setStatusFilter(status); setPage(1); setFiltersOpen(false); }}
                      className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-xs font-semibold capitalize ${statusFilter === status ? "bg-blue-50 text-[#2563EB]" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setView("list")} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${view === "list" ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}><List size={13} /></button>
            <button onClick={() => setView("kanban")} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${view === "kanban" ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}><LayoutGrid size={13} /></button>
            {tab === "Meetings" && (
              <button onClick={() => setView("calendar")} className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${view === "calendar" ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                <Calendar size={12} /> View in Calendar
              </button>
            )}
          </div>
        </div>

        {view === "calendar" && tab === "Meetings" ? (
          <MeetingCalendarView meetings={filteredMeetings} />
        ) : view === "list" ? (
          <>
            <div className="overflow-x-auto">
              {tab === "Tasks" ? (
                <table className="w-full min-w-[800px]">
                  <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
                    <tr>
                      <th className="w-10 px-4 py-3"><input type="checkbox" checked={allTasksSelected} onChange={toggleSelectAllTasks} className="rounded border-gray-300" /></th>
                      {["Task", "Related To", "Status", "Assigned", "Due Date", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#525866]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((task) => (
                      <tr key={task.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                        <td className="px-4 py-3"><input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => toggleSelectTask(task.id)} className="rounded border-gray-300" /></td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 max-w-[200px] truncate">{task.title}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">{task.relatedTo}</p>
                          <p className="text-[11px] text-gray-400">{task.relatedType}</p>
                        </td>
                        <td className="px-4 py-3"><TaskStatusPill status={task.status} /></td>
                        <td className="px-4 py-3 text-sm text-gray-600">{task.assigned}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{task.due}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setSelected(task)} className="text-gray-400 hover:text-blue-500" title="Edit"><Edit3 size={14} /></button>
                            <button onClick={() => handleDeleteTask(task)} className="text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginated.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">No tasks found</td></tr>}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[800px]">
                  <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
                    <tr>
                      {["Meeting", "Scheduled", "Status", "With", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#525866]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((mtg) => (
                      <tr key={mtg.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">{mtg.title}</p>
                          <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{mtg.type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">{mtg.scheduled ? new Date(mtg.scheduled).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No date"}</p>
                          <p className="text-[11px] text-gray-400">{mtg.duration ? `${mtg.duration} mins` : ""}</p>
                        </td>
                        <td className="px-4 py-3"><TaskStatusPill status={mtg.status} /></td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">{mtg.contact}</p>
                          <p className="text-[11px] text-gray-400">{mtg.contactType}</p>
                        </td>
                        <td className="px-4 py-3">
                          {updatingId === mtg.id ? (
                            <span className="text-xs text-gray-400">Updating…</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {mtg.status === "requested" && (
                                <>
                                  <button onClick={() => updateMeetingStatus(mtg, "confirmed")} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700">Accept</button>
                                  <button onClick={() => updateMeetingStatus(mtg, "cancelled")} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50">Reject</button>
                                </>
                              )}
                              {mtg.status === "confirmed" && (
                                <button onClick={() => updateMeetingStatus(mtg, "completed")} className="rounded-lg bg-[#2563EB] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-600">Mark Done</button>
                              )}
                              <button onClick={() => handleDeleteMeeting(mtg)} className="text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {paginated.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">No meetings found</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <span className="text-xs text-gray-500">Showing {Math.min((page - 1) * PAGE_SIZE + 1, activeRows.length)}–{Math.min(page * PAGE_SIZE, activeRows.length)} of {activeRows.length} {tab}</span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:bg-gray-50">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold ${p === page ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{p}</button>
                ))}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:bg-gray-50">›</button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-5">
            {tab === "Tasks" ? (
              <div className="grid grid-cols-5 gap-4 min-w-[1000px]">
                {TASK_STAGES.map((stage) => {
                  const stageItems = filteredTasks.filter((task) => task.status === stage);
                  return (
                  <div key={stage} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">{stage} <span className="ml-1 text-gray-400">{stageItems.length}</span></span>
                    </div>
                    <div className="space-y-2">
                      {stageItems.map((task) => (
                        <button key={task.id} onClick={() => setSelected(task)} className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm">
                          <p className="text-xs font-bold text-gray-900">{task.title || "Untitled task"}</p>
                          <p className="mt-1 text-[11px] text-gray-400">{task.relatedTo || "No project linked"}</p>
                        </button>
                      ))}
                      {stageItems.length === 0 && <div className="py-6 text-center text-xs text-gray-300">No items</div>}
                    </div>
                  </div>
                );})}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4 min-w-[800px]">
                {MEETING_STAGES.map((stage) => {
                  const stageItems = filteredMeetings.filter((m) => m.status === stage);
                  return (
                  <div key={stage} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">{MEETING_STAGE_LABEL[stage]} <span className="ml-1 text-gray-400">{stageItems.length}</span></span>
                    </div>
                    <div className="space-y-2">
                      {stageItems.map((mtg) => (
                        <div key={mtg.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                          <p className="text-xs font-bold text-gray-900">{mtg.title || "Untitled meeting"}</p>
                          <p className="mt-1 text-[11px] text-gray-400">{mtg.contact || "No contact linked"}</p>
                          {mtg.status === "requested" && (
                            <div className="mt-2 flex gap-1.5">
                              <button onClick={() => updateMeetingStatus(mtg, "confirmed")} className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">Accept</button>
                              <button onClick={() => updateMeetingStatus(mtg, "cancelled")} className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50">Reject</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {stageItems.length === 0 && <div className="py-6 text-center text-xs text-gray-300">No items</div>}
                    </div>
                  </div>
                );})}
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <SidePanel
          title={selected._id ? "Edit task" : "New Task"}
          subtitle="Update task title, related entity, status, and due date."
          onClose={() => setSelected(null)}
          footer={
            <div className="flex justify-between">
              {selected._id ? (
                <button onClick={() => { handleDeleteTask(selected); setSelected(null); }} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={14} /> Delete</button>
              ) : <span />}
              <div className="flex gap-2"><Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={handleSaveSelected}><Save size={14} /> Save</Button></div>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Task title" value={selected.title} onChange={(v) => setSelected(p => ({ ...p, title: v }))} />
            <Field label="Related To" value={selected.relatedTo} onChange={(v) => setSelected(p => ({ ...p, relatedTo: v }))} />
            <Field label="Assigned" value={selected.assigned} onChange={(v) => setSelected(p => ({ ...p, assigned: v }))} />
            <Field label="Due date" value={selected.due} onChange={(v) => setSelected(p => ({ ...p, due: v }))} />
            <Field label="Status" value={selected.status} onChange={(v) => setSelected(p => ({ ...p, status: v }))} />
            <Field label="Priority" value={selected.priority} onChange={(v) => setSelected(p => ({ ...p, priority: v }))} />
          </div>
        </SidePanel>
      )}
    </div>
  );
}

function SettingsField({ label, value, onChange, type = "text", placeholder, error = "", disabled = false, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b6f63]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className={`mt-2 w-full rounded-2xl border bg-[#fffdfc] px-4 py-3 text-sm text-[#211a17] outline-none transition-all focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
          error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#d8c2b9] focus:border-[#884c2d] focus:ring-[#f3dfd7]"
        }`}
      />
      {hint && !error && <span className="mt-1.5 block text-[11px] text-[#9c8c80]">{hint}</span>}
      {error && <span className="mt-1.5 block text-[11px] font-semibold text-red-500">{error}</span>}
    </label>
  );
}

function SettingsSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b6f63]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#d8c2b9] bg-[#fffdfc] px-4 py-3 text-sm text-[#211a17] outline-none transition-all focus:border-[#884c2d] focus:ring-4 focus:ring-[#f3dfd7]"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function SettingsToggle({ title, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#ead8d1] bg-[#fffdfc] px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-[#211a17]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#6c6355]">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition-colors ${checked ? "bg-[#884c2d]" : "bg-[#d8c2b9]"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}

// Masked-by-default field for values that are credential-shaped (SMTP host,
// gateway API base, etc.) — reveal them deliberately instead of leaving them
// in plain text on screen.
function SettingsSecretField({ label, value, onChange, placeholder, error = "", hint }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b6f63]">{label}</span>
      <div className="relative mt-2">
        <input
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={`w-full rounded-2xl border bg-[#fffdfc] px-4 py-3 pr-11 text-sm text-[#211a17] outline-none transition-all focus:ring-4 ${
            error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#d8c2b9] focus:border-[#884c2d] focus:ring-[#f3dfd7]"
          }`}
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          title={revealed ? "Hide value" : "Reveal value"}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9c8c80] transition-colors hover:text-[#884c2d]"
        >
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && !error && <span className="mt-1.5 block text-[11px] text-[#9c8c80]">{hint}</span>}
      {error && <span className="mt-1.5 block text-[11px] font-semibold text-red-500">{error}</span>}
    </label>
  );
}

// Re-confirms the signed-in admin's password before unlocking the
// credential-bearing tab — doesn't change anything, just gates access.
function SecurityGate({ onUnlock }) {
  const { token } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password) {
      setError("Enter your password to continue.");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      await apiPost("/api/admin/settings/verify-password", { password }, token);
      onUnlock();
    } catch (err) {
      setError(err.message || "Incorrect password.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f3dfd7] text-[#884c2d]"><LockKeyhole size={22} /></div>
      <h3 className="mt-4 text-lg font-semibold text-[#211a17]">Confirm it's you</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-[#6c6355]">
        This area holds account credentials — your password, SMTP access, and the payment gateway endpoint. Re-enter your password to unlock it.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 w-full max-w-xs space-y-3 text-left">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => { setPassword(event.target.value); setError(""); }}
          placeholder="Current password"
          aria-invalid={Boolean(error)}
          className={`w-full rounded-2xl border bg-[#fffdfc] px-4 py-3 text-sm text-[#211a17] outline-none transition-all focus:ring-4 ${
            error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#d8c2b9] focus:border-[#884c2d] focus:ring-[#f3dfd7]"
          }`}
        />
        {error && <p className="text-[11px] font-semibold text-red-500">{error}</p>}
        <Button type="submit" className="w-full justify-center" disabled={verifying}>
          <ShieldCheck size={14} /> {verifying ? "Verifying…" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}

const GENERAL_SECTIONS = [
  { key: "profile", title: "Super Admin", description: "Super admin details and primary identity.", icon: UserPlus },
  { key: "password", title: "Password", description: "Change your account password.", icon: LockKeyhole },
  { key: "activity", title: "Activity", description: "Manage email and WhatsApp message templates.", icon: Mail },
  { key: "companyOwners", title: "Company Owners", description: "Manage the list of company owners shown in the company form.", icon: Building2 },
];

const SECURE_SECTIONS = [];

const ALL_SECTIONS = [...GENERAL_SECTIONS, ...SECURE_SECTIONS];

function SettingsSidebarGroup({ label, icon: GroupIcon, sections, activeSection, locked, onSelect }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9c8c80]">
        {GroupIcon && <GroupIcon size={11} />} {label}
      </p>
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onSelect(section.key)}
          className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-colors ${
            activeSection === section.key ? "bg-[#fff1ec]" : "hover:bg-[#fff8f6]"
          }`}
        >
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
            activeSection === section.key ? "bg-[#f3dfd7] text-[#884c2d]" : "bg-[#f5e6e1] text-[#6c6355]"
          }`}>
            <section.icon size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#211a17]">
              {section.title}
              {locked && <LockKeyhole size={11} className="text-[#9c8c80]" />}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6c6355]">{section.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const { showToast } = useToast();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("profile");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({ fullName: "", email: "", title: "", timezone: "Asia/Kolkata", publicUrl: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [company, setCompany] = useState({ studioName: "The Copper Studio", legalName: "", gstin: "", billingEmail: "", website: "", billingAddress: "" });
  const [billing, setBilling] = useState({ gateway: "Razorpay", apiBase: "", invoicePrefix: "INV", defaultRole: "user", autoInviteAfterPayment: true, allowCouponAtCheckout: true });
  const [email, setEmail] = useState({ senderName: "The Copper Studio", senderEmail: "", onboardingPath: "/client-secure-onboarding/access-setup" });
  const [notifications, setNotifications] = useState({ paymentSuccess: true, failedPayments: true, portalInviteSent: true, overdueInvoices: true });
  const [security, setSecurity] = useState({ inviteExpiry: "48 hours", otpExpiry: "10 minutes" });
  const [errors, setErrors] = useState({});
  const [companyOwners, setCompanyOwners] = useState(loadCompanyOwners);
  const [newOwnerName, setNewOwnerName] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet("/api/admin/settings", token);
        if (!alive) return;
        setProfile((prev) => ({ ...prev, ...data.profile }));
        setCompany((prev) => ({ ...prev, ...data.company }));
        setBilling((prev) => ({ ...prev, ...data.billing }));
        setEmail((prev) => ({ ...prev, ...data.email }));
        setNotifications((prev) => ({ ...prev, ...data.notifications }));
        setSecurity((prev) => ({ ...prev, ...data.security }));
      } catch (err) {
        if (alive) showToast({ type: "error", title: "Settings unavailable", message: err.message || "Could not load workspace settings." });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token, showToast]);

  function validateSection(key) {
    const e = {};
    if (key === "profile") {
      if (profile.publicUrl && !URL_RE.test(profile.publicUrl.trim())) e.publicUrl = "Enter a valid URL.";
    }
    if (key === "password") {
      const touched = passwordForm.currentPassword || passwordForm.newPassword || passwordForm.confirmPassword;
      if (touched) {
        if (!passwordForm.currentPassword) e.currentPassword = "Enter your current password.";
        if (passwordForm.newPassword.length < 8) e.newPassword = "Use at least 8 characters.";
        if (passwordForm.newPassword !== passwordForm.confirmPassword) e.confirmPassword = "Passwords do not match.";
      }
    }
    if (key === "company") {
      if (company.gstin && !isGstin(company.gstin)) e.gstin = "Enter a valid 15-character GSTIN.";
      if (company.billingEmail && !isEmail(company.billingEmail)) e.billingEmail = "Enter a valid email.";
      if (company.website && !URL_RE.test(company.website.trim())) e.website = "Enter a valid website URL.";
    }
    if (key === "email") {
      if (email.senderEmail && !isEmail(email.senderEmail)) e.senderEmail = "Enter a valid email.";
    }
    return e;
  }

  async function saveSection(key, label) {
    const nextErrors = validateSection(key);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast({ type: "error", title: "Check the form", message: "Please fix the highlighted fields." });
      return;
    }

    setSaving(true);
    try {
      if (key === "profile") {
        await Promise.all([
          apiPut("/api/client/profile", { name: profile.fullName, jobTitle: profile.title, preferences: { timezone: profile.timezone } }, token),
          apiPut("/api/admin/settings/workspace", { publicUrl: profile.publicUrl }, token),
        ]);
      } else if (key === "password") {
        const touched = passwordForm.currentPassword || passwordForm.newPassword || passwordForm.confirmPassword;
        if (touched) {
          await apiPut("/api/client/change-password", { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }, token);
          setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        }
        await apiPut("/api/admin/settings/security", security, token);
      } else if (key === "company") {
        await apiPut("/api/admin/settings/company", company, token);
      } else if (key === "billing") {
        await apiPut("/api/admin/settings/billing", billing, token);
      } else if (key === "email") {
        await apiPut("/api/admin/settings/email", email, token);
      } else if (key === "notifications") {
        await apiPut("/api/admin/settings/notifications", notifications, token);
      }
      showToast({ title: `${label} updated`, message: "Your settings have been saved successfully." });
    } catch (err) {
      showToast({ type: "error", title: "Couldn't save", message: err.message || "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  function selectSection(key) {
    setActiveSection(key);
    setErrors({});
  }

  function addCompanyOwner() {
    const trimmed = newOwnerName.trim();
    if (!trimmed) return;
    if (companyOwners.some((owner) => owner.toLowerCase() === trimmed.toLowerCase())) {
      showToast({ type: "error", title: "Already in the list", message: `"${trimmed}" is already a company owner.` });
      return;
    }
    const next = [...companyOwners, trimmed];
    setCompanyOwners(next);
    persistCompanyOwners(next);
    setNewOwnerName("");
  }

  function removeCompanyOwner(name) {
    const next = companyOwners.filter((owner) => owner !== name);
    setCompanyOwners(next);
    persistCompanyOwners(next);
  }

  const activeMeta = ALL_SECTIONS.find((s) => s.key === activeSection);
  const isSecureSection = SECURE_SECTIONS.some((s) => s.key === activeSection);
  const showGate = isSecureSection && !unlocked;

  return (
    <div className="flex min-h-full flex-col bg-[#F1F1F5]">
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:min-h-14 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7b6f63]">Workspace administration</p>
          <h1 className="text-base font-medium text-[#0E121B]">Account Settings</h1>
          <p className="mt-0.5 max-w-3xl text-xs text-[#525866]">
            Manage the super admin identity, change your password, and edit the email and WhatsApp message templates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="lg">
            <Globe2 size={15} />
            Live workspace
          </Button>
          {!showGate && !loading && activeSection !== "activity" && (
            <Button size="lg" disabled={saving} onClick={() => saveSection(activeSection, activeMeta?.title || "Settings")}>
              <Save size={15} />
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </div>
      </div>

      <section className="grid gap-6 p-5 xl:grid-cols-[290px_minmax(0,1fr)] xl:p-6">
        <Card className="p-3 shadow-[0_18px_40px_rgba(79,39,16,0.06)]">
          <SettingsSidebarGroup label="General" sections={GENERAL_SECTIONS} activeSection={activeSection} locked={false} onSelect={selectSection} />
        </Card>

        <Card className="p-6 shadow-[0_18px_40px_rgba(79,39,16,0.06)]">
          {loading ? (
            <div className="py-16 text-center text-sm text-[#6c6355]">Loading settings…</div>
          ) : showGate ? (
            <SecurityGate onUnlock={() => setUnlocked(true)} />
          ) : (
            <>
              {activeSection === "profile" && (
                <div>
                  <div className="mb-6 flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#211a17] text-white"><SettingsIcon size={18} /></div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#211a17]">Personal Profile</h3>
                      <p className="text-sm text-[#6c6355]">Update the primary super admin identity shown across the CRM.</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Full Name" value={profile.fullName} onChange={(value) => setProfile((prev) => ({ ...prev, fullName: value }))} />
                    <SettingsField label="Email Address" type="email" value={profile.email} disabled hint="Contact support to change your login email." />
                    <SettingsField label="Job Title" value={profile.title} onChange={(value) => setProfile((prev) => ({ ...prev, title: value }))} />
                    <SettingsSelect label="Timezone" value={profile.timezone} onChange={(value) => setProfile((prev) => ({ ...prev, timezone: value }))} options={["Asia/Kolkata", "Europe/London", "America/New_York"]} />
                    <div className="sm:col-span-2">
                      <SettingsField label="CRM Public URL" value={profile.publicUrl} error={errors.publicUrl} onChange={(value) => setProfile((prev) => ({ ...prev, publicUrl: value }))} />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => saveSection("profile", "Profile")}><Save size={14} /> Save Profile</Button>
                  </div>
                </div>
              )}

              {activeSection === "password" && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#211a17]">Password</h3>
                    <p className="mt-1 text-sm text-[#6c6355]">Change the password for your super admin account.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Current Password" type="password" value={passwordForm.currentPassword} error={errors.currentPassword} onChange={(value) => setPasswordForm((prev) => ({ ...prev, currentPassword: value }))} />
                    <SettingsField label="New Password" type="password" value={passwordForm.newPassword} error={errors.newPassword} onChange={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))} />
                    <SettingsField label="Confirm Password" type="password" value={passwordForm.confirmPassword} error={errors.confirmPassword} onChange={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))} />
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => saveSection("password", "Password")}><Save size={14} /> Update Password</Button>
                  </div>
                </div>
              )}

              {activeSection === "activity" && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#211a17]">Activity</h3>
                    <p className="mt-1 text-sm text-[#6c6355]">Manage the message templates used across the CRM.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => navigate("/admin/communication/email-templates")}
                      className="flex items-start gap-3 rounded-2xl border border-[#ead8d1] bg-white p-5 text-left transition-colors hover:bg-[#fff8f6]"
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f3dfd7] text-[#884c2d]"><Mail size={18} /></div>
                      <div>
                        <p className="text-sm font-bold text-[#211a17]">Email Templates</p>
                        <p className="mt-1 text-xs leading-5 text-[#6c6355]">Create and edit the email templates sent to clients.</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/admin/communication/whatsapp-templates")}
                      className="flex items-start gap-3 rounded-2xl border border-[#ead8d1] bg-white p-5 text-left transition-colors hover:bg-[#fff8f6]"
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f3dfd7] text-[#884c2d]"><MessageCircle size={18} /></div>
                      <div>
                        <p className="text-sm font-bold text-[#211a17]">WhatsApp Templates</p>
                        <p className="mt-1 text-xs leading-5 text-[#6c6355]">Create and edit the WhatsApp message templates.</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {activeSection === "companyOwners" && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#211a17]">Company Owners</h3>
                    <p className="mt-1 text-sm text-[#6c6355]">Manage the names that show up in the "Company owner" dropdown on the company form.</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <SettingsField
                        label="Add owner"
                        value={newOwnerName}
                        placeholder="e.g. Rohit Zore"
                        onChange={setNewOwnerName}
                      />
                    </div>
                    <Button onClick={addCompanyOwner}><Plus size={14} /> Add</Button>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {companyOwners.length ? companyOwners.map((owner) => (
                      <span key={owner} className="flex items-center gap-2 rounded-full border border-[#ead8d1] bg-[#fffdfc] px-3 py-1.5 text-sm font-semibold text-[#211a17]">
                        {owner}
                        <button type="button" onClick={() => removeCompanyOwner(owner)} className="text-[#9c8c80] hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </span>
                    )) : (
                      <p className="text-sm text-[#6c6355]">No company owners added yet.</p>
                    )}
                  </div>
                </div>
              )}

              {activeSection === "company" && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#211a17]">Company Information</h3>
                    <p className="mt-1 text-sm text-[#6c6355]">Use these values for invoices, proposals, and client-facing mail content.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Studio Name" value={company.studioName} onChange={(value) => setCompany((prev) => ({ ...prev, studioName: value }))} />
                    <SettingsField label="Legal Name" value={company.legalName} onChange={(value) => setCompany((prev) => ({ ...prev, legalName: value }))} />
                    <SettingsField label="GSTIN" value={company.gstin} error={errors.gstin} onChange={(value) => setCompany((prev) => ({ ...prev, gstin: value }))} />
                    <SettingsField label="Billing Email" type="email" value={company.billingEmail} error={errors.billingEmail} onChange={(value) => setCompany((prev) => ({ ...prev, billingEmail: value }))} />
                    <SettingsField label="Website" value={company.website} error={errors.website} onChange={(value) => setCompany((prev) => ({ ...prev, website: value }))} />
                    <div className="sm:col-span-2">
                      <SettingsField label="Billing Address" value={company.billingAddress} onChange={(value) => setCompany((prev) => ({ ...prev, billingAddress: value }))} />
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#d8c2b9] bg-[#fffdfc] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f3dfd7] text-[#884c2d]"><UploadCloud size={18} /></div>
                      <div>
                        <p className="text-sm font-semibold text-[#211a17]">Logo Upload</p>
                        <p className="text-xs text-[#6c6355]">Update the brand logo used in the client portal and proposal PDF exports.</p>
                      </div>
                    </div>
                    <Button variant="secondary">Upload</Button>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => saveSection("company", "Company information")}><Save size={14} /> Save Company</Button>
                  </div>
                </div>
              )}

              {activeSection === "billing" && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#211a17]">Billing & Gateway Settings</h3>
                    <p className="mt-1 text-sm text-[#6c6355]">Configure checkout behavior, invoice defaults, and automatic portal access after payment.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsSelect label="Payment Gateway" value={billing.gateway} onChange={(value) => setBilling((prev) => ({ ...prev, gateway: value }))} options={["Razorpay", "Stripe", "Manual"]} />
                    <SettingsSecretField label="API Base URL" value={billing.apiBase} onChange={(value) => setBilling((prev) => ({ ...prev, apiBase: value }))} hint="Hidden by default — click the eye icon to reveal." />
                    <SettingsField label="Invoice Prefix" value={billing.invoicePrefix} onChange={(value) => setBilling((prev) => ({ ...prev, invoicePrefix: value }))} />
                    <SettingsSelect label="Default Role After Payment" value={billing.defaultRole} onChange={(value) => setBilling((prev) => ({ ...prev, defaultRole: value }))} options={["user", "superadmin"]} />
                  </div>
                  <div className="mt-6 space-y-3">
                    <SettingsToggle
                      title="Auto-send portal invite after payment"
                      description="Once checkout is successful, send the secure password setup link to the client automatically."
                      checked={billing.autoInviteAfterPayment}
                      onChange={(value) => setBilling((prev) => ({ ...prev, autoInviteAfterPayment: value }))}
                    />
                    <SettingsToggle
                      title="Allow coupon codes during package checkout"
                      description="Keep coupon application visible as an optional field inside the pricing and checkout flow."
                      checked={billing.allowCouponAtCheckout}
                      onChange={(value) => setBilling((prev) => ({ ...prev, allowCouponAtCheckout: value }))}
                    />
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => saveSection("billing", "Billing settings")}><Save size={14} /> Save Billing</Button>
                  </div>
                </div>
              )}

              {activeSection === "email" && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#211a17]">Email Delivery Settings</h3>
                    <p className="mt-1 text-sm text-[#6c6355]">Set the mail sender identity and the secure onboarding route used in invite messages. Delivery itself runs through SendGrid (configured via SENDGRID_API_KEY on the server).</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Sender Name" value={email.senderName} onChange={(value) => setEmail((prev) => ({ ...prev, senderName: value }))} />
                    <SettingsField label="Sender Email" type="email" value={email.senderEmail} error={errors.senderEmail} onChange={(value) => setEmail((prev) => ({ ...prev, senderEmail: value }))} hint="Must be a verified sender identity in SendGrid." />
                    <div className="sm:col-span-2">
                      <SettingsField label="Secure Onboarding Path" value={email.onboardingPath} onChange={(value) => setEmail((prev) => ({ ...prev, onboardingPath: value }))} />
                    </div>
                  </div>
                  <div className="mt-6 rounded-2xl border border-[#ead8d1] bg-[#fffdfc] px-4 py-4">
                    <p className="text-sm font-semibold text-[#211a17]">Current flow</p>
                    <p className="mt-2 text-xs leading-6 text-[#6c6355]">
                      Paid checkout, then success confirmation, then secure invite mail, then unique password setup, then redirect to the shared login page.
                    </p>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => saveSection("email", "Email settings")}><Save size={14} /> Save Email</Button>
                  </div>
                </div>
              )}

              {activeSection === "notifications" && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#211a17]">Notification Settings</h3>
                    <p className="mt-1 text-sm text-[#6c6355]">Choose which operational events should surface inside the admin workspace.</p>
                  </div>
                  <div className="space-y-3">
                    <SettingsToggle
                      title="Payment success alerts"
                      description="Show a confirmation toast and admin alert when a package payment is completed."
                      checked={notifications.paymentSuccess}
                      onChange={(value) => setNotifications((prev) => ({ ...prev, paymentSuccess: value }))}
                    />
                    <SettingsToggle
                      title="Failed payment alerts"
                      description="Flag payment failures so the team can follow up quickly."
                      checked={notifications.failedPayments}
                      onChange={(value) => setNotifications((prev) => ({ ...prev, failedPayments: value }))}
                    />
                    <SettingsToggle
                      title="Portal invite sent alerts"
                      description="Notify admins when the onboarding email has been dispatched successfully."
                      checked={notifications.portalInviteSent}
                      onChange={(value) => setNotifications((prev) => ({ ...prev, portalInviteSent: value }))}
                    />
                    <SettingsToggle
                      title="Overdue invoice alerts"
                      description="Surface aged or unpaid invoices in the finance workflow."
                      checked={notifications.overdueInvoices}
                      onChange={(value) => setNotifications((prev) => ({ ...prev, overdueInvoices: value }))}
                    />
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => saveSection("notifications", "Notification settings")}><Save size={14} /> Save Notifications</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
