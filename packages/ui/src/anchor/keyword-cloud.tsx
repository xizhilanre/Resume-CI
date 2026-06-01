// packages/ui/src/anchor/keyword-cloud.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "../shared/badge";
import type { KeywordItem } from "@resume-ci/core";

interface KeywordCloudProps {
  keywords: KeywordItem[];
}

export function KeywordCloud({ keywords }: KeywordCloudProps) {
  const sorted = [...keywords].sort((a, b) => b.weight - a.weight);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--muted))] text-sm">
        暂无关键词
      </div>
    );
  }

  const getSize = (weight: number): "sm" | "md" | "lg" => {
    if (weight > 0.8) return "lg";
    if (weight > 0.5) return "md";
    return "sm";
  };

  const getWeight = (weight: number): "fill" | "outline" => {
    return weight > 0.5 ? "fill" : "outline";
  };

  return (
    <div data-testid="keyword-cloud" className="py-4">
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">
        关键词提取
      </h3>
      <div className="flex flex-wrap gap-2 justify-center">
        <AnimatePresence>
          {sorted.map((kw, i) => (
            <motion.span
              key={kw.word}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.08,
                duration: 0.3,
                ease: "easeOut",
              }}
            >
              <Badge
                data-testid="kw-tag"
                category={kw.category}
                size={getSize(kw.weight)}
                weight={getWeight(kw.weight)}
              >
                {kw.word}
              </Badge>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
