"use client";

import { useEffect, useRef, useState } from "react";

type RichTextEditorProps = {
  name: string;
  placeholder?: string;
  defaultValue?: string;
  minHeight?: string;
};

const toolbarButtonClass =
  "rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white";

export function RichTextEditor({
  name,
  placeholder = "Write something…",
  defaultValue = "",
  minHeight = "8rem",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue);

  useEffect(() => {
    if (editorRef.current && defaultValue) {
      editorRef.current.innerHTML = defaultValue;
    }
  }, [defaultValue]);

  const syncHtml = () => {
    const next = editorRef.current?.innerHTML ?? "";
    setHtml(next);
  };

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncHtml();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-zinc-800/50">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.06] px-2 py-1.5">
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => runCommand("bold")}
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => runCommand("italic")}
          aria-label="Italic"
        >
          I
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => runCommand("insertUnorderedList")}
          aria-label="Bullet list"
        >
          • List
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncHtml}
        data-placeholder={placeholder}
        className="min-w-0 px-4 py-3 text-sm leading-relaxed text-white outline-none [&:empty:before]:text-zinc-500 [&:empty:before]:content-[attr(data-placeholder)] [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc"
        style={{ minHeight }}
      />

      <input type="hidden" name={name} value={html} readOnly />
    </div>
  );
}

export function RichTextContent({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  if (!html.trim()) {
    return null;
  }

  return (
    <div
      className={`prose prose-invert max-w-none text-sm leading-relaxed text-zinc-300 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
