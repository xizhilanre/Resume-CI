// packages/ui/src/alignment/evidence-chain.tsx
import React from "react";
import { AnimatePresence } from "framer-motion";
import { STARBullet } from "./star-bullet";
import type { STARBullet as STARBulletType } from "@resume-ci/core";

interface EvidenceChainProps {
  evidence: STARBulletType[];
}

export function EvidenceChain({ evidence }: EvidenceChainProps) {
  return (
    <div data-testid="evidence-chain" className="py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          STAR 证据链
        </h3>
        <span className="text-xs text-[hsl(var(--muted))]">
          已收集 {evidence.length} 条证据
        </span>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {evidence.map((bullet, i) => (
            <STARBullet key={bullet.id} bullet={bullet} index={i + 1} />
          ))}
        </AnimatePresence>

        {evidence.length === 0 && (
          <div className="text-center py-8 text-sm text-[hsl(var(--muted))]">
            <p>回答第一道题后</p>
            <p>STAR 证据将在这里生长 🌱</p>
          </div>
        )}
      </div>
    </div>
  );
}
