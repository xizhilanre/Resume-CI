// packages/ui/src/export/pipeline-progress.tsx
import React from "react";
import { motion } from "framer-motion";

interface Stage {
  name: string;
  status: "done" | "active" | "pending";
}

interface PipelineProgressProps {
  stages: Stage[];
  overallProgress: number;
}

export function PipelineProgress({ stages, overallProgress }: PipelineProgressProps) {
  const allDone = stages.every((s) => s.status === "done");

  return (
    <div data-testid="pipeline-progress" className="py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        {stages.map((stage, i) => (
          <React.Fragment key={stage.name}>
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={{
                  scale: stage.status === "active" ? [1, 1.1, 1] : 1,
                  backgroundColor:
                    stage.status === "done" ? "hsl(var(--accent))" :
                    stage.status === "active" ? "hsl(var(--accent-soft))" :
                    "hsl(var(--muted)/0.15)",
                }}
                transition={{ repeat: stage.status === "active" ? Infinity : 0, duration: 1.5 }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                style={{
                  color: stage.status === "done" ? "white" :
                         stage.status === "active" ? "hsl(var(--accent))" :
                         "hsl(var(--muted))",
                }}
              >
                {stage.status === "done" ? "✓" :
                 stage.status === "active" ? "⏳" :
                 "○"}
              </motion.div>
              <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                {stage.name}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className="flex-1 mx-2 h-0.5 mt-[-20px]">
                <motion.div
                  className="h-full rounded-full"
                  animate={{
                    backgroundColor: stages[i]!.status === "done" ? "hsl(var(--accent))" : "hsl(var(--muted)/0.2)",
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[hsl(var(--muted))]">总体进度</span>
          <span className="text-xs font-medium text-[hsl(var(--foreground))]">{overallProgress}%</span>
        </div>
        <div className="h-2 rounded-full bg-[hsl(var(--muted)/0.15)] overflow-hidden">
          <motion.div
            data-testid="progress-bar"
            className="h-full rounded-full bg-[hsl(var(--accent))]"
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {allDone && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-green-500 font-medium mt-4"
        >
          🎉 导出完成！
        </motion.p>
      )}
    </div>
  );
}
