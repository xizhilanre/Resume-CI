// packages/ui/src/shared/input.tsx
import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => (
    <input
      ref={ref}
      data-testid="input"
      className={`w-full rounded-[var(--radius-md)] border border-[hsl(var(--muted)/0.3)] bg-[hsl(var(--card))] px-4 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent)/0.3)] ${error ? "border-red-400" : ""} ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";
