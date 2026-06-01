// packages/ui/src/anchor/match-radar.tsx
import React from "react";
import { motion } from "framer-motion";
import type { MatchProfile } from "@resume-ci/core";

interface MatchRadarProps {
  profile: MatchProfile;
}

export function MatchRadar({ profile }: MatchRadarProps) {
  const scorePercent = Math.round(profile.score * 100);
  const scoreColor = scorePercent >= 85 ? "text-green-500" : scorePercent >= 70 ? "text-yellow-500" : "text-orange-500";
  const ringColor = scorePercent >= 85 ? "#22c55e" : scorePercent >= 70 ? "#eab308" : "#f97316";
  const gaps = profile.gaps;
  const circumference = 2 * Math.PI * 68;

  return (
    <div data-testid="match-radar" className="py-4">
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">匹配度分析</h3>

      <div className="flex flex-col md:flex-row gap-8 items-center">
        <motion.div className="relative w-44 h-44 flex-shrink-0">
          <svg data-testid="radar-chart" viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            <circle cx="80" cy="80" r="68" fill="none" stroke="hsl(var(--muted) / 0.2)" strokeWidth="12" />
            <motion.circle
              cx="80" cy="80" r="68"
              fill="none"
              stroke={ringColor}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: (1 - profile.score) * circumference }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${scoreColor}`}>{scorePercent}%</span>
            <span className="text-xs text-[hsl(var(--muted))]">匹配度</span>
          </div>
        </motion.div>

        <div className="flex-1 space-y-4">
          {gaps.length === 0 ? (
            <div className="text-green-500 font-medium">✅ 完美匹配！你与这个岗位高度契合</div>
          ) : (
            <>
              <div>
                <h4 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2">待加强</h4>
                {gaps.map((gap) => (
                  <div key={gap} className="flex items-start gap-2 py-1">
                    <span className="text-yellow-500">⚠️</span>
                    <span className="text-sm text-[hsl(var(--foreground))]">{gap}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-1">修复建议</h4>
                {gaps.map((gap) => (
                  <p key={gap} className="text-sm text-[hsl(var(--muted-foreground))] py-0.5">
                    💡 建议：选择一个包含{gap.replace(/经验|理解|能力|技能/g, "").trim()}的项目来弥补
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
