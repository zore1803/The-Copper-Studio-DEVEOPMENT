import { useEffect, useRef, useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "./ui";

/**
 * The single filter-popover used across CRM list pages: a round Filter icon
 * button that opens a labeled grid of selects/inputs, so every "All" actually
 * says what it's filtering instead of being a bare unlabeled dropdown.
 *
 * fields: [{ key, label, type: "select" | "text", value, onChange, options, placeholder, allValue }]
 * `allValue` defaults to "All" — used to detect whether a field is "active" for the badge count.
 */
export default function FilterButton({ fields, onReset, panelWidth = 640, panelClassName = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const activeCount = fields.filter((field) => {
    if (field.type === "text") return Boolean(String(field.value ?? "").trim());
    return String(field.value ?? "") !== String(field.allValue ?? "All");
  }).length;

  return (
    <div className="relative" ref={ref}>
      <button
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
      {open && (
        <div
          style={{ width: `min(${panelWidth}px, 90vw)` }}
          className={`absolute right-0 z-20 mt-2 rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-lg ${panelClassName}`}
        >
          <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-[#9ca3af]">Filters</p>
          <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs font-semibold text-[#6b7280]">{field.label}</span>
                {field.type === "text" ? (
                  <input
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
                  />
                ) : (
                  <select
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
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
          <div className="mt-3 flex justify-end border-t border-[#f3f4f6] pt-3">
            <Button variant="secondary" onClick={onReset}><X size={14} /> Reset</Button>
          </div>
        </div>
      )}
    </div>
  );
}
