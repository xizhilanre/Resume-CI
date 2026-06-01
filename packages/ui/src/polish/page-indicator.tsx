// packages/ui/src/polish/page-indicator.tsx
import React from "react";
import { motion } from "framer-motion";

interface PageIndicatorProps {
  currentPages: number;
  status: "fit" | "overflow" | "underflow";
  onRefresh: () => void;
}

export function PageIndicator({ currentPages, status, onRefresh }: PageIndicatorProps) {
  const color = status === "fit" ? "#22c55e" : status === "overflow" ? "#eab308" : "#ef4444";
  const label = status === "fit" ? "完美" : status === "overflow" ? "轻微溢出" : "需调整";
  const icon = status === "fit" ? "✓" : status === "overflow" ? "⚠" : "✗";
  const circumference = 2 * Math.PI * 15;

  return (
    <motion.button
      data-testid="page-indicator"
      onClick={onRefresh}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-2 rounded-full shadow-md cursor-pointer hover:opacity-90 transition-opacity"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: `blur(var(--glass-blur))`,
        border: `1px solid var(--glass-border)`,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted)/0.2)" strokeWidth="3" />
        <motion.circle
          cx="18" cy="18" r="15"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: (1 - Math.min(currentPages, 1.5) / 1.5) * circumference }}
        />
      </svg>
      <div className="text-left">
        <span className="block text-xs font-bold text-[hsl(var(--foreground))]">
          {currentPages.toFixed(2)}/1 页
        </span>
        <span className="block text-[10px] text-[hsl(var(--muted))]">{icon} {label}</span>
      </div>
    </motion.button>
  );
}
