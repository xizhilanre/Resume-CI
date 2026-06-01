// packages/ui/src/polish/selection-floating-bar.tsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../shared/icon";

interface SelectionFloatingBarProps {
  selectedText: string;
  position: { x: number; y: number };
  onAction: (style: string) => void;
  onClose: () => void;
}

const ACTIONS = [
  { label: "润色", icon: "sparkles" as const, style: "polish" },
  { label: "扩写", icon: "zoom-in" as const, style: "expand" },
  { label: "精简", icon: "zoom-out" as const, style: "shorten" },
  { label: "编辑", icon: "check" as const, style: "" },
];

export function SelectionFloatingBar({ selectedText, position, onAction, onClose }: SelectionFloatingBarProps) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const bar = document.getElementById("floating-bar");
      if (bar && !bar.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        id="floating-bar"
        data-testid="floating-bar"
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed z-50 flex items-center gap-0.5 px-1.5 py-1 rounded-[var(--radius-lg)] shadow-lg"
        style={{
          left: position.x,
          top: position.y - 50,
          background: "var(--glass-bg)",
          backdropFilter: `blur(var(--glass-blur))`,
          border: `1px solid var(--glass-border)`,
        }}
      >
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onAction(action.style)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent-soft))] transition-colors"
          >
            <Icon name={action.icon} size={14} />
            {action.label}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
