// packages/ui/src/alignment/star-bullet.tsx
import React from "react";
import { motion } from "framer-motion";
import type { STARBullet as STARBulletType } from "@resume-ci/core";

interface STARBulletProps {
  bullet: STARBulletType;
  index: number;
}

const LABELS = [
  { key: "S", label: "情境", color: "hsl(var(--tag-language-bg))", textColor: "hsl(var(--tag-language-text))" },
  { key: "T", label: "任务", color: "hsl(var(--tag-architecture-bg))", textColor: "hsl(var(--tag-architecture-text))" },
  { key: "A", label: "行动", color: "hsl(var(--tag-middleware-bg))", textColor: "hsl(var(--tag-middleware-text))" },
  { key: "R", label: "结果", color: "hsl(var(--tag-devops-bg))", textColor: "hsl(var(--tag-devops-text))" },
] as const;

export function STARBullet({ bullet, index }: STARBulletProps) {
  const parts = [
    { key: "S", text: bullet.situation },
    { key: "T", text: bullet.task },
    { key: "A", text: bullet.action },
    { key: "R", text: bullet.result },
  ];

  return (
    <motion.div
      data-testid="star-bullet"
      initial={{ opacity: 0, height: 0, y: -20 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
    >
      <h5 className="text-xs font-medium text-[hsl(var(--muted))] mb-2">证据 #{index}</h5>
      {parts.map((part) => {
        const label = LABELS.find((l) => l.key === part.key)!;
        return (
          <div key={part.key} className="flex items-start gap-2 py-0.5">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: label.color, color: label.textColor }}
            >
              {part.key} {label.label}
            </span>
            <p className="text-sm text-[hsl(var(--foreground))] leading-snug">{part.text}</p>
          </div>
        );
      })}
    </motion.div>
  );
}
