// packages/ui/src/polish/resume-canvas.tsx
import React, { useRef, useEffect, useCallback, useState } from "react";
import DOMPurify from "dompurify";
import { motion } from "framer-motion";
import { Skeleton } from "../shared/skeleton";

interface PageFitStatus {
  currentPages: number;
  status: "fit" | "overflow" | "underflow";
}

interface ResumeCanvasProps {
  html: string;
  onSectionEdit: (sectionId: string, newContent: string) => void;
  pageFit?: PageFitStatus | null;
  error?: string;
}

function PageFitDot({ currentPages, status }: PageFitStatus) {
  const color = status === "fit" ? "#22c55e" : status === "overflow" ? "#eab308" : "#ef4444";
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: "var(--glass-bg)", backdropFilter: `blur(var(--glass-blur))` }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span>{(currentPages * 1).toFixed(2)}/1 页</span>
      <span>{status === "fit" ? "✓" : status === "overflow" ? "⚠" : "✗"}</span>
    </div>
  );
}

export function ResumeCanvas({ html, onSectionEdit, pageFit, error }: ResumeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingElement, setEditingElement] = useState<HTMLElement | null>(null);
  const [editingOriginal, setEditingOriginal] = useState("");

  const sanitized = html ? DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["div", "h1", "h2", "h3", "h4", "p", "section", "span", "ul", "ol", "li", "br", "strong", "em", "a", "table", "thead", "tbody", "tr", "td", "th"],
    ALLOWED_ATTR: ["class", "id", "data-section", "href"],
  }) : "";

  const handleDoubleClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const editable = target.closest("[data-section]") as HTMLElement;
    if (editable && editable !== editingElement) {
      editingElement?.setAttribute("contenteditable", "false");
      setEditingElement(editable);
      setEditingOriginal(editable.textContent || "");
      editable.setAttribute("contenteditable", "true");
      editable.focus();
      const range = document.createRange();
      range.selectNodeContents(editable);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editingElement]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain");
    if (text) {
      document.execCommand("insertText", false, text);
    }
  }, []);

  const commitEdit = useCallback(() => {
    if (editingElement) {
      const sectionId = editingElement.getAttribute("data-section") || "";
      const newContent = editingElement.textContent || "";
      if (newContent !== editingOriginal) {
        onSectionEdit(sectionId, newContent);
      }
      editingElement.setAttribute("contenteditable", "false");
      setEditingElement(null);
    }
  }, [editingElement, editingOriginal, onSectionEdit]);

  const cancelEdit = useCallback(() => {
    if (editingElement) {
      editingElement.textContent = editingOriginal;
      editingElement.setAttribute("contenteditable", "false");
      setEditingElement(null);
    }
  }, [editingElement, editingOriginal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("dblclick", handleDoubleClick);
    container.addEventListener("paste", handlePaste);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && editingElement) {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape" && editingElement) {
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("dblclick", handleDoubleClick);
      container.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDoubleClick, handlePaste, commitEdit, cancelEdit, editingElement]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-center">
        <div>
          <p className="text-red-500 mb-2">简历加载失败</p>
          <p className="text-sm text-[hsl(var(--muted))]">{error}</p>
        </div>
      </div>
    );
  }

  if (!html) {
    return <Skeleton className="w-full h-[600px]" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      data-testid="resume-canvas"
      className="relative"
    >
      <div
        ref={containerRef}
        className="resume-page mx-auto bg-white shadow-lg rounded-[var(--radius-lg)] p-12 overflow-hidden"
        style={{ maxWidth: 794, minHeight: 800, fontSize: "12pt", lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />

      {editingElement && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 z-50">
          <span>Enter 确认 · Esc 取消</span>
        </div>
      )}

      {pageFit && (
        <div className="fixed bottom-6 right-6 z-40">
          <PageFitDot currentPages={pageFit.currentPages} status={pageFit.status} />
        </div>
      )}
    </motion.div>
  );
}
