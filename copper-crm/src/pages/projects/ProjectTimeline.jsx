import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  CalendarRange, CheckCircle2, Columns3, GripVertical,
  Plus, Save, Trash2, Sparkles, ZoomIn, ZoomOut, AlertTriangle
} from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import ProjectHeader from "./ProjectHeader";
import { today, DAY_MS, parseFullDate, parseShortDate, formatRange } from "../../lib/dates";
import { TASK_STATUSES, normalizeTaskStatus, COLUMN_TO_STAGE_STATUS } from "../../lib/taskStatus";
import { projectRollup } from "../../lib/stageProgress";

function getProgressText(start, end, status, needsDates = false) {
  if (needsDates || status === "Done" || !start || !end) return "";
  const TODAY = today();
  const totalDays = Math.max(1, Math.round((end - start) / DAY_MS));
  if (TODAY < start) {
    return `0/${totalDays}d`;
  } else if (TODAY > end) {
    return `${totalDays}/${totalDays}d (Overdue)`;
  } else {
    const elapsed = Math.max(0, Math.round((TODAY - start) / DAY_MS));
    const left = Math.max(0, totalDays - elapsed);
    return left > 0 ? `${elapsed}/${totalDays}d (${left} left)` : `${elapsed}/${totalDays}d`;
  }
}

const STATUS_DOT = {
  "To Do": "bg-sky-500",
  "In Progress": "bg-amber-500",
  Review: "bg-violet-500",
  Done: "bg-emerald-500",
};

const STATUS_BAR = {
  "To Do": "from-sky-400 to-sky-600 text-white",
  "In Progress": "from-amber-400 to-orange-500 text-white",
  Review: "from-indigo-400 to-violet-600 text-white",
  Done: "from-emerald-400 to-emerald-600 text-white",
};

const priorityConfig = {
  High: "bg-red-50 text-red-600 border-red-100",
  Medium: "bg-amber-50 text-amber-700 border-amber-100",
  Low: "bg-gray-50 text-gray-500 border-gray-200",
};

// Free continuous zoom: pixels per week column. Drag the slider or use +/- to zoom
// the timeline smoothly in and out, like a calendar.
const MIN_COL_WIDTH = 26;    // zoomed out — see many months at once
const MAX_COL_WIDTH = 340;   // zoomed in — day-level detail
const DEFAULT_COL_WIDTH = 150;
const ZOOM_STEP = 28;

function TaskField({ label, value, onChange, placeholder = "", type = "text", className = "", min, max }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-[#E1E4EA] px-3 py-2 text-sm outline-none focus:border-[#C57E5B] focus:ring-2 focus:ring-[#C57E5B]/20"
      />
    </label>
  );
}

export function StageEditorModal({ statuses, initialStatus, stage, mode, projectDates = {}, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(stage);
  const [status, setStatus] = useState(initialStatus);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  function submit(event) {
    event.preventDefault();
    onSave({ ...form, title: (form.title || "").trim() || "Untitled Stage" }, status);
  }

  return (
    <SidePanel
      title={mode === "create" ? "Create Stage" : "Edit Stage"}
      subtitle="Stages appear on both the board and the project roadmap."
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between">
          {mode === "edit" ? (
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit}><Save size={14} /> Save Stage</Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TaskField label="Stage name" value={form.title || ""} onChange={set("title")} className="sm:col-span-2" />
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E1E4EA] px-3 py-2 text-sm outline-none focus:border-[#C57E5B]">
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">Priority</span>
          <select value={form.priority || "Medium"} onChange={(e) => set("priority")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E1E4EA] px-3 py-2 text-sm outline-none focus:border-[#C57E5B]">
            {["High", "Medium", "Low"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <TaskField label="Start date" type="date" value={form.startDate || ""} onChange={set("startDate")} min={projectDates.startDate} max={projectDates.endDate} />
        <TaskField label="Due date" type="date" value={form.dueDate || ""} onChange={set("dueDate")} min={projectDates.startDate} max={projectDates.endDate} />
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-[#374151]">Notes</span>
          <textarea value={form.description || ""} onChange={(e) => set("description")(e.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-lg border border-[#E1E4EA] px-3 py-2 text-sm outline-none focus:border-[#C57E5B]" />
        </label>
      </div>
    </SidePanel>
  );
}

export function KanbanView({ stages, onDragEnd, onOpenNew, onOpenEdit }) {
  const columns = useMemo(() => {
    const grouped = Object.fromEntries(TASK_STATUSES.map((status) => [status, []]));
    stages.forEach((card) => {
      grouped[normalizeTaskStatus(card.status)].push(card);
    });
    return grouped;
  }, [stages]);

  return (
    <DragDropContext onDragEnd={(result) => onDragEnd(columns, result)}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {TASK_STATUSES.map((status) => (
          <section key={status} className="flex w-[260px] shrink-0 flex-col rounded-xl border border-[#E1E4EA] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-[#f1f1f5] px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
                <h3 className="truncate text-sm font-semibold text-[#111827]">{status}</h3>
                <span className="rounded-md bg-[#f9fafb] px-1.5 py-0.5 text-[11px] font-bold text-[#6b7280]">{columns[status].length}</span>
              </div>
              <button onClick={() => onOpenNew(status)} className="grid h-7 w-7 place-items-center rounded-lg text-[#9ca3af] hover:bg-[#f9fafb] hover:text-[#374151]">
                <Plus size={14} />
              </button>
            </div>
            <Droppable droppableId={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 space-y-2 p-2.5 ${snapshot.isDraggingOver ? "bg-[#fff8f6]" : ""}`}
                  style={{ minHeight: 140 }}
                >
                  {columns[status].map((task, index) => (
                    <Draggable key={task.id || task._id} draggableId={String(task.id || task._id)} index={index}>
                      {(prov, snap) => (
                        <article
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          onClick={() => onOpenEdit(status, task)}
                          className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-shadow ${snap.isDragging ? "border-[#C57E5B] shadow-md" : "border-[#E1E4EA] hover:border-[#C57E5B]/40"}`}
                        >
                          <div className="mb-2 flex items-start gap-2">
                            <GripVertical size={12} className="mt-0.5 shrink-0 text-[#d1d5db]" />
                            <h4 className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[#111827]">{task.title || task.taskName || "Untitled task"}</h4>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${priorityConfig[task.priority] || priorityConfig.Medium}`}>{task.priority || "Medium"}</span>
                            <span className="text-[10px] font-semibold text-[#9ca3af]">{task.dueDate || task.deadline || "No due date"}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-[#f1f1f5] pt-2">
                            <span className="inline-flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-[#9ca3af]">
                              <span className="inline-flex items-center gap-1"><CalendarRange size={11} /> {task.startDate || "No start"}</span>
                              {(() => {
                                const st = task.startDate ? parseFullDate(task.startDate) : null;
                                const en = task.dueDate ? parseFullDate(task.dueDate) : task.endDate ? parseFullDate(task.endDate) : task.deadline ? parseShortDate(task.deadline, new Date().getFullYear()) : null;
                                const pText = getProgressText(st, en, status, !st || !en);
                                return pText ? <span className="text-[#C57E5B]">{pText}</span> : null;
                              })()}
                            </span>
                            <div className="flex items-center text-[10px] font-semibold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">
                              <Sparkles size={10} className="mr-1" /> Stage
                            </div>
                          </div>
                        </article>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {columns[status].length === 0 && (
                    <div className="grid h-20 place-items-center rounded-lg border border-dashed border-[#E1E4EA] text-[11px] font-semibold text-[#9ca3af]">
                      Drop stages here
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </section>
        ))}
      </div>
    </DragDropContext>
  );
}

export function GanttView({ stages, onOpenEdit, groupBy = "status", groupCategories }) {
  const [colWidth, setColWidth] = useState(DEFAULT_COL_WIDTH);
  const scrollRef = useRef(null);


  const updateZoom = (updater) => {
    setColWidth((prevWidth) => {
      const nextWidth = typeof updater === "function" ? updater(prevWidth) : updater;
      if (nextWidth === prevWidth) return prevWidth;
      return nextWidth;
    });
  };

  const zoomOut = () => updateZoom((w) => Math.max(MIN_COL_WIDTH, w - ZOOM_STEP));
  const zoomIn = () => updateZoom((w) => Math.min(MAX_COL_WIDTH, w + ZOOM_STEP));
  const [collapsed, setCollapsed] = useState({});

  // Pinch / Ctrl+scroll over the chart zooms the timeline instead of the whole page.
  // Plain two-finger scrolling (no Ctrl) is left alone so the chart still scrolls.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      updateZoom((w) => {
        const next = w * Math.exp(-e.deltaY * 0.002);
        return Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, next));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stages.length]);

  const { groups, minDate, maxDate, weeks, summary } = useMemo(() => {
    const TODAY = today();
    const referenceYear = new Date().getFullYear();
    // First pass: parse whatever dates a stage has, and flag the ones missing them.
    const parsed = stages.map((card) => {
      const start = card.startDate ? parseFullDate(card.startDate) : null;
      const end = card.dueDate ? parseFullDate(card.dueDate) : card.endDate ? parseFullDate(card.endDate) : card.deadline ? parseShortDate(card.deadline, referenceYear) : null;
      const hasDates = !!start && !!end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime());
      return { card, start, end, hasDates };
    });

    // Anchor undated stages to the earliest real start (or today) so EVERY stage still
    // shows up on the chart — just flagged as "needs dates" instead of being hidden.
    const dated = parsed.filter((p) => p.hasDates);
    const anchor = dated.length ? new Date(Math.min(...dated.map((p) => p.start.getTime()))) : new Date(TODAY);

    const mapped = parsed.map(({ card, start, end, hasDates }) => {
      const status = normalizeTaskStatus(card.status);
      let isDanger = false;
      if (hasDates && status !== "Done") {
        const daysToDeadline = Math.round((end - TODAY) / DAY_MS);
        if (daysToDeadline <= 3) {
          isDanger = true;
        }
      }
      
      if (hasDates) {
        return { ...card, start, end: end < start ? start : end, needsDates: false, status, isDanger };
      }
      return { ...card, start: new Date(anchor), end: new Date(anchor.getTime() + 3 * DAY_MS), needsDates: true, status, isDanger: false };
    });
    const unscheduled = parsed.filter((p) => !p.hasDates).length;
    if (!mapped.length && (!groupCategories || !groupCategories.length)) return { groups: [], minDate: TODAY, maxDate: TODAY, weeks: [], summary: { total: 0, completed: 0, blocked: 0, unscheduled } };

    const allDates = mapped.flatMap((t) => [t.start, t.end]);
    const min = allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime())) - 3 * DAY_MS) : new Date(TODAY.getTime() - 3 * DAY_MS);
    const max = allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime())) + 3 * DAY_MS) : new Date(TODAY.getTime() + 14 * DAY_MS);
    min.setHours(0, 0, 0, 0);
    max.setHours(23, 59, 59, 999);
    
    const groupList = groupCategories
      ? groupCategories.map(cat => ({
          id: cat.id,
          title: cat.title,
          tasks: mapped.filter((t) => (groupBy === "project" ? String(t.projectId) === String(cat.id) : t.status === cat.id)),
        }))
      : groupBy === "project"
      ? Array.from(new Set(mapped.map((t) => t.projectName || "Unknown Project"))).map((name) => ({
          id: name,
          title: name,
          tasks: mapped.filter((t) => (t.projectName || "Unknown Project") === name),
        }))
      : TASK_STATUSES
          .map((status) => ({ id: status, title: status, tasks: mapped.filter((t) => t.status === status) }))
          .filter((g) => g.tasks.length > 0);

    const totalDays = Math.max(1, Math.ceil((max - min) / DAY_MS));
    const weekCount = Math.max(1, Math.ceil(totalDays / 7));
    const weekCols = Array.from({ length: weekCount }, (_, index) => {
      const weekStart = new Date(min.getTime() + index * 7 * DAY_MS);
      const weekEnd = new Date(Math.min(weekStart.getTime() + 6 * DAY_MS, max.getTime()));
      return { label: formatRange(weekStart, weekEnd) };
    });
    return {
      groups: groupList,
      minDate: min,
      maxDate: max,
      weeks: weekCols,
      summary: {
        total: mapped.length,
        completed: mapped.filter((task) => task.status === "Done").length,
        blocked: 0,
        unscheduled,
      },
    };
  }, [stages, groupBy, groupCategories]);

  // Auto-scroll the timeline to TODAY (or the nearest date) when it loads, when the date range changes,
  // or when zooming (to keep Today in view per user request).
  useEffect(() => {
    if (scrollRef.current && minDate && maxDate) {
      const TODAY = today();
      const pxPerDay = colWidth / 7;
      let targetDate = TODAY;
      if (targetDate < minDate) targetDate = minDate;
      if (targetDate > maxDate) targetDate = maxDate;
      
      const targetPx = ((targetDate.getTime() - minDate.getTime()) / DAY_MS) * pxPerDay;
      // Scroll so the target date is slightly offset from the left edge (e.g. roughly 1 column)
      scrollRef.current.scrollLeft = Math.max(0, targetPx - colWidth);
    }
  }, [minDate, maxDate, colWidth]);

  if (!groups.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
        <p className="text-sm font-semibold text-[#111827]">No scheduled stages yet.</p>
        <p className="mt-1 text-sm text-[#6b7280]">Add start and due dates to stages to see them on the Gantt chart.</p>
      </div>
    );
  }

  // Position everything in real pixels-per-day so bars line up exactly under their
  // date columns (the columns are colWidth px per 7-day week).
  const pxPerDay = colWidth / 7;
  const showDays = pxPerDay >= 30; // Render daily headers if wide enough

  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / DAY_MS));
  const timeCols = showDays
    ? Array.from({ length: totalDays }, (_, index) => {
        const day = new Date(minDate.getTime() + index * DAY_MS);
        return { label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), width: pxPerDay };
      })
    : weeks.map(w => ({ ...w, width: colWidth }));

  const timelineWidth = timeCols.reduce((sum, col) => sum + col.width, 0);
  const gridBackgroundSize = showDays ? `${pxPerDay}px 100%` : `${colWidth}px 100%`;
  const dateToPx = (date) => ((date - minDate) / DAY_MS) * pxPerDay;
  const TODAY = today();
  const showTodayLine = TODAY >= minDate && TODAY <= maxDate;

  function toggleGroup(id) {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  }

  const completionPct = Math.round((summary.completed / Math.max(summary.total, 1)) * 100);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E1E4EA] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f1f1f5] bg-[#fbfaf9] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff1ec] text-[#884c2d]">
              <CalendarRange size={17} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#111827]">Stage Gantt Timeline</h4>
              <p className="text-xs text-[#6b7280]">{formatRange(minDate, maxDate)} · {summary.total} scheduled stages</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={13} /> {completionPct}% complete
          </span>
          {summary.blocked > 0 && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">{summary.blocked} blocked</span>
          )}
          {summary.unscheduled > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{summary.unscheduled} need dates</span>
          )}
          <div className="flex items-center gap-1.5 rounded-lg bg-[#F1F1F5] p-1">
            <button
              type="button"
              onClick={zoomOut}
              disabled={colWidth <= MIN_COL_WIDTH}
              title="Zoom out"
              className="grid h-7 w-7 place-items-center rounded-md text-[#6b7280] transition-colors hover:bg-white hover:text-[#111827] disabled:opacity-40"
            >
              <ZoomOut size={14} />
            </button>
            <input
              type="range"
              min={MIN_COL_WIDTH}
              max={MAX_COL_WIDTH}
              step="any"
              value={colWidth}
              onChange={(e) => updateZoom(Number(e.target.value))}
              title="Zoom timeline — or pinch / Ctrl+scroll over the chart"
              className="w-24 accent-[#C57E5B]"
            />
            <button
              type="button"
              onClick={zoomIn}
              disabled={colWidth >= MAX_COL_WIDTH}
              title="Zoom in"
              className="grid h-7 w-7 place-items-center rounded-md text-[#6b7280] transition-colors hover:bg-white hover:text-[#111827] disabled:opacity-40"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="sticky left-0 z-30 w-64 shrink-0 border-r border-[#f1f1f5] bg-white shadow-[8px_0_18px_rgba(17,24,39,0.04)]">
          <div className="sticky top-0 z-40 flex h-11 items-center border-b border-[#f1f1f5] bg-[#fafafa] px-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Stage / Task</span>
          </div>
          {groups.map((group) => (
            <div key={group.id} className="border-b border-[#f1f1f5]">
              <button type="button" onClick={() => toggleGroup(group.id)} className="flex h-10 w-full items-center gap-2 bg-[#fafafa] px-3 text-left">
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[group.id] || "bg-[#C57E5B]"}`} />
                <span className="truncate text-sm font-semibold text-[#111827]">{group.title}</span>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-[#9ca3af]">{group.tasks.length}</span>
              </button>
              {!collapsed[group.id] && group.tasks.map((task) => (
                <button key={task.id || task._id} type="button" onClick={() => onOpenEdit(group.id, task)} className="flex h-12 w-full items-center px-6 text-left hover:bg-[#fafafa]">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-[#374151]">
                      <span className="truncate">{task.title || task.taskName}</span>
                      {task.isDanger && <AlertTriangle size={12} className="shrink-0 text-red-500" strokeWidth={2.5} />}
                    </span>
                    <span className={`flex items-center gap-1.5 truncate text-[10px] ${task.needsDates ? "text-amber-600" : task.isDanger ? "text-red-500 font-semibold" : "text-[#9ca3af]"}`}>
                      <span>{task.needsDates ? "No dates · click to set" : formatRange(task.start, task.end)}</span>
                      {(() => {
                        const pText = getProgressText(task.start, task.end, task.status, task.needsDates);
                        return pText ? <span className="text-[#C57E5B]">{pText}</span> : null;
                      })()}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-x-auto">
          <div style={{ minWidth: `${timelineWidth}px` }}>
            <div className="sticky top-0 z-20 flex h-11 border-b border-[#f1f1f5] bg-white">
              {timeCols.map((col, index) => (
                <div key={index} style={{ width: `${col.width}px` }} className="flex shrink-0 items-center justify-center border-r border-[#f1f1f5] text-[10px] font-bold uppercase text-[#9ca3af] even:bg-[#fcfcfd]">
                  {col.label}
                </div>
              ))}
            </div>
            <div className="relative bg-[linear-gradient(to_right,#f3f4f6_1px,transparent_1px)]" style={{ backgroundSize: gridBackgroundSize }}>
              {showTodayLine && (
                <div className="absolute top-0 bottom-0 z-10 w-px bg-red-400" style={{ left: `${dateToPx(TODAY)}px` }}>
                  <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-400" />
                  <span className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">Today</span>
                </div>
              )}
              {groups.map((group) => (
                <div key={group.id}>
                  <div className="h-10 border-b border-[#f1f1f5] bg-[#fafafa]/60" />
                  {!collapsed[group.id] && group.tasks.map((task) => {
                    const left = dateToPx(task.start);
                    // +1 day so the bar covers the end date inclusively; clamp so a single-day stage stays visible.
                    const width = Math.max(pxPerDay, dateToPx(task.end) - left + pxPerDay);
                    const isDone = task.status === "Done";
                    return (
                      <div key={task.id || task._id} className="relative h-12 border-b border-[#f1f1f5] odd:bg-white/65 even:bg-[#fcfcfd]/65">
                        <button
                          type="button"
                          onClick={() => onOpenEdit(group.id, task)}
                          style={{ left: `${left}px`, width: `${width}px` }}
                          title={task.needsDates ? "No dates set — click to add a start and due date" : `${task.title || task.taskName}: ${formatRange(task.start, task.end)}`}
                          className={`absolute top-2 flex h-8 min-w-[12px] items-center overflow-hidden rounded-xl bg-gradient-to-r px-2.5 text-left shadow-sm transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 hover:shadow-md ${STATUS_BAR[task.status] || STATUS_BAR["To Do"]} ${task.needsDates ? "opacity-50 saturate-50 border border-dashed border-white/80" : "ring-1 ring-white/50"}`}
                        >
                          <span className="truncate text-[11px] font-bold">{task.title || task.taskName}</span>
                          {(() => {
                            const pText = getProgressText(task.start, task.end, task.status, task.needsDates);
                            return pText ? <span className="ml-2 truncate text-[9px] opacity-90 font-medium">{pText}</span> : null;
                          })()}
                          {task.isDanger && !isDone && <AlertTriangle size={12} className="ml-auto shrink-0 text-red-500 drop-shadow-sm" strokeWidth={2.5} />}
                          {isDone && <CheckCircle2 size={12} className="ml-auto shrink-0" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectTimeline() {
  const { companyId, projectId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { records: companies } = useCrmRecords("companies");
  const { records: projects, save: saveProject } = useCrmRecords("projects");
  const [view, setView] = useState("kanban");
  const [stageEditor, setStageEditor] = useState(null);

  const company = useMemo(() => companies.find((c) => String(c.id || c._id) === companyId), [companies, companyId]);
  const project = useMemo(
    () => projects.find((p) => String(p.id || p._id) === projectId && (String(p.companyId) === companyId || true)),
    [projects, companyId, projectId]
  );

  // The board is driven entirely by the project's stages — each stage renders as one
  // card on the Kanban / Gantt. There is no separate "task" concept here, so anything
  // added on this board is a stage and shows up on the project roadmap too.
  const stageCards = useMemo(() => {
    if (!project || !Array.isArray(project.stages)) return [];
    const pid = String(project.id || project._id);
    return project.stages.map((stage, idx) => ({
      isStage: true,
      stageIndex: idx,
      id: stage.id || stage._id || `stage-${pid}-${idx}`,
      title: stage.name || "Untitled Stage",
      status: normalizeTaskStatus(stage.status),
      priority: stage.priority || "Medium",
      startDate: stage.startDate ? String(stage.startDate).slice(0, 10) : "",
      dueDate: stage.endDate ? String(stage.endDate).slice(0, 10) : "",
      description: stage.notes || "",
    }));
  }, [project]);

  if (!company || !project) {
    return (
      <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
        <p className="text-sm font-semibold text-[#6b7280]">We couldn't find that project for this company.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate("/admin/companies")}>Back to Companies</Button>
      </div>
    );
  }

  function openNewStage(status = "To Do") {
    // Default to a today → +4 days window so a new stage shows on the Gantt right away;
    // the admin can adjust the dates in the editor.
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const start = today();
    const due = new Date(start.getTime() + 4 * DAY_MS);
    setStageEditor({
      mode: "create",
      status,
      stageIndex: -1,
      card: { title: "", priority: "Medium", startDate: fmt(start), dueDate: fmt(due), description: "" },
    });
  }

  function openEditStage(status, card) {
    setStageEditor({ mode: "edit", status, stageIndex: card.stageIndex, card });
  }

  async function handleSaveStage(form, status) {
    const pStartStr = project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : null;
    const pEndStr = (project.expectedEndDate || project.endDate) ? new Date(project.expectedEndDate || project.endDate).toISOString().slice(0, 10) : null;

    if (form.startDate && pStartStr && form.startDate < pStartStr) {
      return showToast({ type: "error", title: "Invalid Date", message: `Stage start date cannot be before project start (${pStartStr}).` });
    }
    if (form.dueDate && pEndStr && form.dueDate > pEndStr) {
      return showToast({ type: "error", title: "Invalid Date", message: `Stage due date cannot be after project end (${pEndStr}).` });
    }

    try {
      const stageStatus = COLUMN_TO_STAGE_STATUS[status] || "not_started";
      const stages = [...(project.stages || [])];
      const stageData = {
        name: (form.title || "").trim() || "Untitled Stage",
        status: stageStatus,
        priority: form.priority || "Medium",
        startDate: form.startDate || null,
        endDate: form.dueDate || null,
        notes: form.description || "",
        completedAt: stageStatus === "completed" ? new Date().toISOString() : null,
      };
      const isNew = stageEditor.mode !== "edit" || stageEditor.stageIndex < 0;
      if (!isNew && stages[stageEditor.stageIndex]) {
        stages[stageEditor.stageIndex] = { ...stages[stageEditor.stageIndex], ...stageData };
      } else {
        stages.push({ id: `stage-${Date.now()}`, ...stageData });
      }
      await saveProject(projectRollup(project, stages));
      setStageEditor(null);
      showToast({ title: isNew ? "Stage created" : "Stage updated", message: `${stageData.name} saved in ${status}.` });
    } catch (error) {
      showToast({ type: "error", title: "Could not save stage", message: error.message });
    }
  }

  async function handleDeleteStage(card) {
    try {
      const stages = [...(project.stages || [])];
      if (card.stageIndex >= 0 && stages[card.stageIndex]) {
        stages.splice(card.stageIndex, 1);
        await saveProject(projectRollup(project, stages));
      }
      setStageEditor(null);
      showToast({ title: "Stage deleted", message: `${card.title || "Stage"} removed.` });
    } catch (error) {
      showToast({ type: "error", title: "Could not delete stage", message: error.message });
    }
  }

  async function handleDragEnd(columns, result) {
    const { source, destination } = result;
    if (!destination) return;
    // Same column = reorder only; status doesn't change on a status board, so nothing to persist.
    if (source.droppableId === destination.droppableId) return;

    const movedCard = columns[source.droppableId][source.index];
    const newStageStatus = COLUMN_TO_STAGE_STATUS[destination.droppableId] || "not_started";
    try {
      const stages = [...(project.stages || [])];
      if (stages[movedCard.stageIndex]) {
        stages[movedCard.stageIndex] = {
          ...stages[movedCard.stageIndex],
          status: newStageStatus,
          completedAt: newStageStatus === "completed" ? new Date().toISOString() : null,
        };
        await saveProject(projectRollup(project, stages));
        showToast({ title: "Success", message: `Stage "${movedCard.title}" moved to ${destination.droppableId}` });
      }
    } catch (err) {
      console.error(err);
      showToast({ type: "error", title: "Error", message: "Failed to move stage" });
    }
  }

  return (
    <div className="space-y-6">
      <ProjectHeader
        company={company}
        project={project}
        activeTab="Timeline"
        actionLabel="New Stage"
        actionIcon={Plus}
        onAction={() => openNewStage()}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#111827]">Project Timeline</h3>
        <div className="flex items-center gap-1 rounded-lg bg-[#F1F1F5] p-1">
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${view === "kanban" ? "bg-white text-[#C57E5B] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
          >
            <Columns3 size={13} /> Kanban
          </button>
          <button
            onClick={() => setView("gantt")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${view === "gantt" ? "bg-white text-[#C57E5B] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
          >
            <CalendarRange size={13} /> Gantt
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <KanbanView stages={stageCards} onDragEnd={handleDragEnd} onOpenNew={openNewStage} onOpenEdit={openEditStage} />
      ) : (
        <GanttView stages={stageCards} onOpenEdit={openEditStage} />
      )}

      {stageEditor && (
        <StageEditorModal
          statuses={TASK_STATUSES}
          initialStatus={stageEditor.status}
          stage={stageEditor.card}
          mode={stageEditor.mode}
          projectDates={{
            startDate: project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : undefined,
            endDate: (project.expectedEndDate || project.endDate) ? new Date(project.expectedEndDate || project.endDate).toISOString().slice(0, 10) : undefined,
          }}
          onClose={() => setStageEditor(null)}
          onSave={(form, status) => handleSaveStage(form, status)}
          onDelete={() => handleDeleteStage(stageEditor.card)}
        />
      )}
    </div>
  );
}
