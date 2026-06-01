// packages/ui/src/export/interview-tip.tsx
import React from "react";
import { motion } from "framer-motion";

interface InterviewTipProps {
  tip: string;
}

export function InterviewTip({ tip }: InterviewTipProps) {
  return (
    <motion.div
      data-testid="interview-tip"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="max-w-2xl mx-auto mt-6 p-5 rounded-[var(--radius-xl)]"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: `blur(var(--glass-blur))`,
        border: `1px solid var(--glass-border)`,
      }}
    >
      <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">
        💡 面试锦囊
      </h4>
      <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
        {tip}
      </p>
    </motion.div>
  );
}
