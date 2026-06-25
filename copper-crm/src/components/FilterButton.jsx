import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Filter, X } from "lucide-react";
import { Button } from "./ui";

/**
 * Shared filter popover for CRM list/workspace pages.
 *
 * Edits are kept as a draft while the panel is open. The page filters only
 * change after Apply is clicked, which keeps dropdown browsing from instantly
 * changing the underlying list.
 */
export default function FilterButton({ fields, onReset, panelWidth = 640, panelClassName = "" }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => fieldsToDraft(fields));
  const [panelStyle, setPanelStyle] = useState({});
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const activeCount = useMemo(() => fields.filter((field) => {
    if (field.type === "text") return Boolean(String(field.value ?? "").trim());
    return String(field.value ?? "") !== String(field.allValue ?? "All");
  }).length, [fields]);

  useEffect(() => {
    if (!open) setDraft(fieldsToDraft(fields));
  }, [fields, open]);

  useEffect(() => {
    if (!open) return;
    setDraft(fieldsToDraft(fields));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function updatePanelPosition() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const width = Math.min(panelWidth, Math.max(280, window.innerWidth - 24));
      const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const preferAbove = below < 260 && above > below;
      const measuredHeight = panelRef.current?.offsetHeight || 360;
      const maxAvailableHeight = Math.max(220, preferAbove ? above - 8 : below - 8);
      const top = preferAbove
        ? Math.max(12, rect.top - 8 - Math.min(measuredHeight, maxAvailableHeight))
        : rect.bottom + 8;

      setPanelStyle({
        left,
        top,
        width,
        maxHeight: maxAvailableHeight,
      });
    }

    function onMouseDown(event) {
      if (buttonRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    updatePanelPosition();
    const frame = window.requestAnimationFrame(updatePanelPosition);
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, panelWidth]);

  function setDraftValue(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyFilters() {
    for (const field of fields) {
      const nextValue = draft[field.key] ?? defaultValueFor(field);
      if (String(nextValue) !== String(field.value ?? "")) field.onChange(nextValue);
    }
    setOpen(false);
  }

  function resetFilters() {
    const resetDraft = fieldsToResetDraft(fields);
    setDraft(resetDraft);
    if (onReset) {
      onReset();
    } else {
      for (const field of fields) field.onChange(resetDraft[field.key]);
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((value) => !value)}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${open ? "border-[#884c2d] bg-[#fff8f6] text-[#884c2d]" : "border-[#E1E4EA] bg-white text-[#1F2937] hover:bg-[#f9fafb]"}`}
      >
        <Filter size={16} />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#884c2d] text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className={`fixed z-[9999] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-2xl shadow-[#111827]/15 ${panelClassName}`}
        >
          <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-[#9ca3af]">Filters</p>
          <div
            style={{ maxHeight: `calc(${panelStyle.maxHeight || 360}px - 88px)` }}
            className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            {fields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs font-semibold text-[#6b7280]">{field.label}</span>
                {field.type === "text" ? (
                  <input
                    value={draft[field.key] ?? ""}
                    onChange={(event) => setDraftValue(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
                  />
                ) : (
                  <select
                    value={draft[field.key] ?? defaultValueFor(field)}
                    onChange={(event) => setDraftValue(field.key, event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm outline-none focus:border-[#884c2d]"
                  >
                    {(field.options || []).map((option) => {
                      const optValue = typeof option === "object" ? option.value : option;
                      const optLabel = typeof option === "object" ? option.label : option;
                      return <option key={optValue} value={optValue}>{optLabel}</option>;
                    })}
                  </select>
                )}
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2 border-t border-[#f3f4f6] pt-3">
            <Button variant="secondary" onClick={resetFilters}><X size={14} /> Reset</Button>
            <Button onClick={applyFilters}>Apply</Button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function defaultValueFor(field) {
  return field.type === "text" ? "" : String(field.allValue ?? "All");
}

function fieldsToDraft(fields) {
  return Object.fromEntries(fields.map((field) => [field.key, field.value ?? defaultValueFor(field)]));
}

function fieldsToResetDraft(fields) {
  return Object.fromEntries(fields.map((field) => [field.key, defaultValueFor(field)]));
}
