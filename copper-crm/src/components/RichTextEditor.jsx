import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered } from "lucide-react";

const COLORS = ["#111827", "#dc2626", "#16a34a", "#2563eb", "#884c2d"];

// Plain-text rendering of a contentEditable body — used both to check for
// emptiness (execCommand often leaves a stray "<br>" behind with no real
// text) and to search note content without matching on markup.
export function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, "").trim();
}

export function isRichTextEmpty(html) {
  return !stripHtml(html);
}

function ToolbarButton({ onClick, title, children, active = false }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        active ? "bg-[#fff1ec] text-[#884c2d]" : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151]"
      }`}
    >
      {children}
    </button>
  );
}

/** Lightweight contentEditable rich-text field with a basic formatting toolbar. */
export default function RichTextEditor({ label, value, onChange, placeholder = "", span = false }) {
  const ref = useRef(null);
  const lastValue = useRef(value);

  // Only push external value changes (e.g. switching notes) into the DOM —
  // never on every keystroke, or the caret jumps to the start.
  useEffect(() => {
    if (ref.current && value !== lastValue.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = value || "";
      lastValue.current = value;
    }
  }, [value]);

  function exec(command, arg) {
    document.execCommand(command, false, arg);
    ref.current?.focus();
    handleInput();
  }

  function handleInput() {
    const html = ref.current?.innerHTML || "";
    lastValue.current = html;
    onChange(html);
  }

  return (
    <label className={`block ${span ? "sm:col-span-3" : ""}`}>
      {label && <span className="text-xs font-semibold text-[#374151]">{label}</span>}
      <div className="mt-1.5 overflow-hidden rounded-lg border border-[#e5e7eb] focus-within:border-[#884c2d] focus-within:ring-2 focus-within:ring-[#884c2d]/20">
        <div className="flex items-center gap-0.5 border-b border-[#f3f4f6] bg-[#fafafa] px-1.5 py-1">
          <ToolbarButton title="Bold" onClick={() => exec("bold")}><Bold size={13} /></ToolbarButton>
          <ToolbarButton title="Italic" onClick={() => exec("italic")}><Italic size={13} /></ToolbarButton>
          <ToolbarButton title="Underline" onClick={() => exec("underline")}><Underline size={13} /></ToolbarButton>
          <ToolbarButton title="Bullet list" onClick={() => exec("insertUnorderedList")}><List size={13} /></ToolbarButton>
          <ToolbarButton title="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered size={13} /></ToolbarButton>
          <span className="mx-1 h-4 w-px bg-[#e5e7eb]" />
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => exec("foreColor", color)}
              className="h-4 w-4 shrink-0 rounded-full border border-white/60 ring-1 ring-[#e5e7eb]"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          data-placeholder={placeholder}
          className="rich-text-body min-h-[140px] px-3 py-2 text-sm text-[#111827] outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        />
      </div>
    </label>
  );
}
