// packages/ui/src/blueprint/architecture-diagram.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "../shared/button";
import { Icon } from "../shared/icon";

interface ArchitectureDiagramProps {
  dsl: string;
  projectId: string;
}

type Status = "loading" | "ready" | "error";

export function ArchitectureDiagram({ dsl, projectId }: ArchitectureDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<any>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setError] = useState<string>("");
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const svgId = `mermaid-${projectId}`;

  const renderDiagram = useCallback(async () => {
    if (!dsl) {
      setStatus("error");
      setError("架构图数据为空");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const mermaid = (await import("mermaid")).default;

      if (containerRef.current) containerRef.current.innerHTML = "";

      const { svg } = await mermaid.render(svgId, dsl);

      if (containerRef.current) {
        containerRef.current.innerHTML = svg;

        try {
          const svgPanZoom = (await import("svg-pan-zoom")).default;
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            panZoomRef.current?.destroy?.();
            panZoomRef.current = svgPanZoom(svgEl, {
              zoomEnabled: true,
              controlIconsEnabled: true,
              minZoom: 0.5,
              maxZoom: 3,
              fit: true,
              center: true,
            });
          }
        } catch {
          // pan-zoom 失败不影响主渲染
        }

        setStatus("ready");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "架构图渲染失败");
    }
  }, [dsl, svgId]);

  useEffect(() => {
    renderDiagram();
    return () => {
      panZoomRef.current?.destroy?.();
    };
  }, [renderDiagram]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const node = target.closest(".node") as HTMLElement | null;
    if (node) {
      const nodeId = node.getAttribute("id") || node.textContent || "";
      setActiveNode(nodeId);
    } else {
      setActiveNode(null);
    }
  };

  return (
    <div data-testid="architecture-diagram" className="py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          📐 系统架构图
        </h3>
        {status === "ready" && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => panZoomRef.current?.zoomIn?.()}>
              <Icon name="zoom-in" size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => panZoomRef.current?.zoomOut?.()}>
              <Icon name="zoom-out" size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => panZoomRef.current?.reset?.()}>
              <Icon name="rotate-ccw" size={16} />
            </Button>
          </div>
        )}
      </div>

      {status === "loading" && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted))]">
          <div className="w-8 h-8 rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent animate-spin mb-3" />
          <p className="text-sm">正在渲染架构图…</p>
        </div>
      )}

      {status === "ready" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          data-testid="mermaid-container"
          ref={containerRef}
          onClick={handleClick}
          className="border border-[hsl(var(--muted)/0.2)] rounded-[var(--radius-lg)] overflow-hidden bg-white"
          style={{ minHeight: 300 }}
        />
      )}

      {status === "error" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-red-500 mb-2">架构图暂不可用</p>
          <p className="text-xs text-[hsl(var(--muted))] mb-4">{errorMsg}</p>
          <Button data-testid="retry-btn" variant="secondary" size="sm" onClick={renderDiagram}>
            重试
          </Button>
        </div>
      )}

      {activeNode && (
        <div className="mt-2 p-3 rounded-[var(--radius-md)] bg-[hsl(var(--accent-soft))] text-sm text-[hsl(var(--foreground))]">
          💡 选中节点：{activeNode}
        </div>
      )}
    </div>
  );
}
