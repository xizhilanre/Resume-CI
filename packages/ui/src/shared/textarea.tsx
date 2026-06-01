// packages/ui/src/shared/textarea.tsx
import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  showCharCount?: boolean;
  minChars?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, showCharCount, minChars, value, ...props }, ref) => {
    const charCount = typeof value === "string" ? value.length : 0;
    const meetsMin = minChars ? charCount >= minChars : true;

    return (
      <div className="relative">
        <textarea
          ref={ref}
          data-testid="textarea"
          className={`w-full rounded-[var(--radius-lg)] border border-[hsl(var(--muted)/0.3)] bg-[hsl(var(--card))] px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent)/0.3)] resize-none min-h-[8rem] font-mono ${error ? "border-red-400" : ""} ${className}`}
          {...props}
          value={value}
        />
        {showCharCount && (
          <div className="flex items-center gap-1 mt-1 text-xs">
            <span className={meetsMin ? "text-green-500" : "text-[hsl(var(--muted))]"}>
              字数：{charCount}
            </span>
            {minChars && !meetsMin && (
              <span className="text-[hsl(var(--muted))]">建议至少 {minChars} 字以获得更精准的匹配</span>
            )}
            {minChars && meetsMin && <span className="text-green-500">✓</span>}
          </div>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
