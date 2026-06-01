// packages/ui/src/shared/button.tsx
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = "primary", size = "md", loading, children, className = "", disabled, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-all duration-[var(--duration-fast)] disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    primary: "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:opacity-90",
    secondary: "bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent))] hover:opacity-80",
    ghost: "bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent-soft))]",
  };

  return (
    <button
      data-testid="button"
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </>
      ) : children}
    </button>
  );
}
