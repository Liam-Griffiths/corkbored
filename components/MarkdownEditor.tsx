"use client";

import { useRef, useState, type RefObject } from "react";
import { Markdown } from "./Markdown";

interface Props {
  /** Field name for uncontrolled use inside a <form> (server actions). */
  name?: string;
  /** Controlled value; pair with onChange. */
  value?: string;
  /** Initial value for uncontrolled use. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Optional external ref to the textarea (e.g. to focus it). */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

type Edit = { next: string; selStart: number; selEnd: number };

function wrap(el: HTMLTextAreaElement, before: string, after: string, placeholder: string): Edit {
  const v = el.value;
  const s = el.selectionStart;
  const e = el.selectionEnd;
  const sel = v.slice(s, e) || placeholder;
  const next = v.slice(0, s) + before + sel + after + v.slice(e);
  const selStart = s + before.length;
  return { next, selStart, selEnd: selStart + sel.length };
}

function prefixLines(el: HTMLTextAreaElement, prefix: string): Edit {
  const v = el.value;
  const lineStart = v.lastIndexOf("\n", el.selectionStart - 1) + 1;
  const block = v.slice(lineStart, el.selectionEnd);
  const replaced = block
    .split("\n")
    .map((l) => prefix + l)
    .join("\n");
  const next = v.slice(0, lineStart) + replaced + v.slice(el.selectionEnd);
  return { next, selStart: lineStart, selEnd: lineStart + replaced.length };
}

function link(el: HTMLTextAreaElement): Edit {
  const v = el.value;
  const s = el.selectionStart;
  const e = el.selectionEnd;
  const sel = v.slice(s, e) || "text";
  const snippet = `[${sel}](url)`;
  const next = v.slice(0, s) + snippet + v.slice(e);
  const urlStart = s + sel.length + 3; // after "[sel]("
  return { next, selStart: urlStart, selEnd: urlStart + 3 };
}

const TOOLS: { label: string; title: string; apply: (el: HTMLTextAreaElement) => Edit }[] = [
  { label: "B", title: "Bold (⌘B)", apply: (el) => wrap(el, "**", "**", "bold") },
  { label: "i", title: "Italic (⌘I)", apply: (el) => wrap(el, "*", "*", "italic") },
  { label: "</>", title: "Inline code", apply: (el) => wrap(el, "`", "`", "code") },
  { label: "H", title: "Heading", apply: (el) => prefixLines(el, "## ") },
  { label: "“”", title: "Quote", apply: (el) => prefixLines(el, "> ") },
  { label: "•", title: "Bulleted list", apply: (el) => prefixLines(el, "- ") },
  { label: "1.", title: "Numbered list", apply: (el) => prefixLines(el, "1. ") },
  { label: "🔗", title: "Link (⌘K)", apply: link },
];

export function MarkdownEditor({
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  required,
  onKeyDown,
  textareaRef,
}: Props) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? innerRef;
  const controlled = value !== undefined;
  const [preview, setPreview] = useState(false);
  // Mirror of the text so Preview works in both controlled and uncontrolled modes.
  const [text, setText] = useState(value ?? defaultValue ?? "");
  const current = controlled ? (value ?? "") : text;

  function applyEdit({ next, selStart, selEnd }: Edit) {
    const el = ref.current;
    if (!el) return;
    if (controlled) onChange?.(next);
    else el.value = next;
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  function runTool(tool: (el: HTMLTextAreaElement) => Edit) {
    if (ref.current) applyEdit(tool(ref.current));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase();
      const tool = k === "b" ? TOOLS[0] : k === "i" ? TOOLS[1] : k === "k" ? TOOLS[7] : null;
      if (tool) {
        e.preventDefault();
        runTool(tool.apply);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div className="rounded-md border border-paper-edge bg-paper-bright focus-within:outline-2 focus-within:outline-pin-gold">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-paper-edge px-1.5 py-1">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runTool(t.apply)}
            disabled={preview}
            className="rounded px-1.5 py-0.5 font-mono text-xs text-ink-soft hover:bg-paper-edge hover:text-ink disabled:opacity-40"
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex gap-0.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setPreview(false)}
            className={`rounded px-2 py-0.5 font-mono text-[0.7rem] ${!preview ? "bg-paper-edge text-ink" : "text-ink-soft hover:text-ink"}`}
          >
            Write
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setPreview(true)}
            className={`rounded px-2 py-0.5 font-mono text-[0.7rem] ${preview ? "bg-paper-edge text-ink" : "text-ink-soft hover:text-ink"}`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Preview overlays the textarea but never unmounts it, so an uncontrolled
          textarea keeps the typed value when toggling back to Write. */}
      {preview && (
        <div className="min-h-[5rem] px-3 py-2">
          {current.trim() ? (
            <Markdown>{current}</Markdown>
          ) : (
            <p className="font-mono text-xs text-ink-soft">Nothing to preview.</p>
          )}
        </div>
      )}
      {controlled ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => { onChange?.(e.target.value); setText(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          hidden={preview}
          className="block w-full resize-y bg-transparent px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-none"
        />
      ) : (
        <textarea
          ref={ref}
          name={name}
          required={required && !preview}
          defaultValue={defaultValue}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          hidden={preview}
          className="block w-full resize-y bg-transparent px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-none"
        />
      )}
    </div>
  );
}
