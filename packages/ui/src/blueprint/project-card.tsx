// packages/ui/src/blueprint/project-card.tsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "../shared/card";
import { Badge } from "../shared/badge";
import type { ProjectCard as ProjectCardType } from "@resume-ci/core";

interface ProjectCardProps {
  project: ProjectCardType;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onViewDetail?: (id: string) => void;
  animate?: boolean;
}

export function ProjectCard({ project, selected, onSelect, onViewDetail, animate = true }: ProjectCardProps) {
  const scorePercent = Math.round(project.jdMatchScore * 100);
  const scoreColor = scorePercent >= 85 ? "text-green-500" : scorePercent >= 70 ? "text-yellow-500" : "text-orange-500";
  const ringColor = scorePercent >= 85 ? "#22c55e" : scorePercent >= 70 ? "#eab308" : "#f97316";
  const circumference = 2 * Math.PI * 20;

  const Wrapper = animate ? motion.div : "div";
  const animProps = animate
    ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: "easeOut" as const } }
    : {};

  return (
    <Wrapper {...animProps}>
      <Card
        selected={selected}
        onClick={() => onSelect?.(project.id)}
        className="min-h-[260px] flex flex-col justify-between relative"
      >
        <div>
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-lg font-bold text-[hsl(var(--foreground))] leading-tight">
              {project.title}
            </h4>
            <div className="relative w-12 h-12 flex-shrink-0 ml-2">
              <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted) / 0.2)" strokeWidth="4" />
                <circle
                  cx="24" cy="24" r="20"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={(1 - project.jdMatchScore) * circumference}
                />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor}`}>
                {scorePercent}%
              </span>
            </div>
          </div>

          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
            {project.description}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {project.techStack.map((tech) => (
              <Badge key={tech} size="sm">{tech}</Badge>
            ))}
          </div>
        </div>

        <button
          data-testid="view-detail-btn"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetail?.(project.id);
          }}
          className="mt-4 text-sm font-medium text-[hsl(var(--accent))] hover:underline self-start"
        >
          查看详情 →
        </button>
      </Card>
    </Wrapper>
  );
}
