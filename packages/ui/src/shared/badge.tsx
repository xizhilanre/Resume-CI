// packages/ui/src/shared/badge.tsx
import React from "react";

type TagCategory = "language" | "architecture" | "middleware" | "devops" | "concept";

interface BadgeProps {
  children: React.ReactNode;
  category?: TagCategory;
  size?: "sm" | "md" | "lg";
  weight?: "fill" | "outline";
  className?: string;
}

const CATEGORY_STYLES: Record<TagCategory, { bg: string; text: string }> = {
  language:     { bg: "hsl(var(--tag-language-bg))",     text: "hsl(var(--tag-language-text))" },
  architecture: { bg: "hsl(var(--tag-architecture-bg))", text: "hsl(var(--tag-architecture-text))" },
  middleware:   { bg: "hsl(var(--tag-middleware-bg))",   text: "hsl(var(--tag-middleware-text))" },
  devops:       { bg: "hsl(var(--tag-devops-bg))",       text: "hsl(var(--tag-devops-text))" },
  concept:      { bg: "hsl(var(--tag-concept-bg))",      text: "hsl(var(--tag-concept-text))" },
};

const SIZE_CLASSES = { sm: "px-2 py-0.5 text-xs", md: "px-3 py-1 text-sm", lg: "px-4 py-1.5 text-base" };

export function Badge({ children, category = "concept", size = "md", weight = "fill", className = "" }: BadgeProps) {
  const cs = CATEGORY_STYLES[category];
  return (
    <span
      data-testid="badge"
      className={`inline-flex items-center rounded-[var(--radius-sm)] font-medium ${SIZE_CLASSES[size]} ${className}`}
      style={{
        backgroundColor: weight === "fill" ? cs.bg : "transparent",
        color: cs.text,
        border: weight === "outline" ? `1px solid ${cs.text}` : "none",
      }}
    >
      {children}
    </span>
  );
}
