// packages/ui/src/blueprint/project-card-stack.tsx
import React from "react";
import { AnimatePresence } from "framer-motion";
import { ProjectCard } from "./project-card";
import { Skeleton } from "../shared/skeleton";
import type { ProjectCard as ProjectCardType } from "@resume-ci/core";

interface ProjectCardStackProps {
  projects: ProjectCardType[];
  loading: boolean;
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onViewDetail: (id: string) => void;
}

const GRID_CLASS = "grid grid-cols-3 gap-6";

export function ProjectCardStack({
  projects,
  loading,
  selectedProjectId,
  onSelectProject,
  onViewDetail,
}: ProjectCardStackProps) {
  const slots = Array.from({ length: 3 }, (_, i) => {
    const project = projects[i] || null;
    return { index: i, project };
  });

  return (
    <div data-testid="project-card-stack" className="py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          为你匹配了 {projects.length} 个项目
        </h3>
        {loading && (
          <span className="text-sm text-[hsl(var(--muted))] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
            {projects.length}/3 已就绪
          </span>
        )}
      </div>

      <div className={GRID_CLASS}>
        <AnimatePresence mode="popLayout">
          {slots.map(({ index, project }) => (
            <div key={index} className="min-h-[260px]">
              {project ? (
                <ProjectCard
                  project={project}
                  selected={selectedProjectId === project.id}
                  onSelect={onSelectProject}
                  onViewDetail={onViewDetail}
                  animate
                />
              ) : (
                <Skeleton className="w-full h-[260px]" />
              )}
            </div>
          ))}
        </AnimatePresence>
      </div>

      {!loading && projects.length === 0 && (
        <div className="text-center py-12 text-[hsl(var(--muted))]">
          暂无匹配项目。请先在 Anchor 步骤中解析 JD。
        </div>
      )}
    </div>
  );
}
