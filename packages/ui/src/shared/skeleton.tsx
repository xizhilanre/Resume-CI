// packages/ui/src/shared/skeleton.tsx
import React from "react";

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export function Skeleton({ className = "", children }: SkeletonProps) {
  if (children) return <>{children}</>;

  return (
    <div
      data-testid="skeleton"
      className={`animate-pulse rounded-md ${className}`}
      style={{
        background: `linear-gradient(
          90deg,
          hsl(var(--skeleton-base)) 0%,
          hsl(var(--skeleton-peak)) 40%,
          hsl(var(--skeleton-base)) 100%
        )`,
        backgroundSize: "200% 100%",
      }}
    />
  );
}
