// packages/ui/src/shared/card.tsx
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = "", selected, onClick }: CardProps) {
  return (
    <div
      data-testid="card"
      onClick={onClick}
      className={`
        rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-6
        shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]
        transition-all duration-[var(--duration-normal)] var(--ease-spring)
        ${onClick ? "cursor-pointer" : ""}
        ${selected
          ? "ring-2 ring-[hsl(var(--accent))] scale-[1.03] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)]"
          : "hover:shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)]"
        }
        ${className}
      `}
    >
      {children}
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}
