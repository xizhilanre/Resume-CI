// packages/ui/src/anchor/jd-input-area.tsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Textarea } from "../shared/textarea";
import { Button } from "../shared/button";
import { Icon } from "../shared/icon";
import type { IResumeCIAdapter, JDParsed } from "@resume-ci/core";

interface JDInputAreaProps {
  adapter: IResumeCIAdapter;
  onParsed?: (jd: JDParsed) => void;
}

type ParseState = "idle" | "pending" | "loading" | "success" | "error";

export function JDInputArea({ adapter, onParsed }: JDInputAreaProps) {
  const [text, setText] = useState("");
  const [state, setState] = useState<ParseState>("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MIN_CHARS = 150;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleParse = useCallback(async () => {
    if (text.length === 0 || state === "loading") return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    setState("loading");
    setError(null);

    try {
      const result = await adapter.parseJD(text);
      setState("success");
      onParsed?.(result as JDParsed);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "解析失败，请重试");
    }
  }, [text, state, adapter, onParsed]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setText(value);
      setState("idle");

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length >= MIN_CHARS) {
        setState("pending");
        debounceRef.current = setTimeout(() => {
          handleParse();
        }, 1500);
      }
    },
    [handleParse]
  );

  const canParse = text.length > 0 && state !== "loading";

  return (
    <div data-testid="jd-input-area" className="relative">
      {state === "loading" && (
        <div
          data-testid="jd-loading-overlay"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[var(--radius-xl)]"
          style={{
            background: "var(--glass-bg)",
            backdropFilter: `blur(var(--glass-blur))`,
            border: `1px solid var(--glass-border)`,
          }}
        >
          <div className="w-10 h-10 rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent animate-spin mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">AI 正在理解 JD…</p>
        </div>
      )}

      <div className={`transition-opacity duration-300 ${state === "loading" ? "opacity-40 blur-[0.5px]" : ""}`}>
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            📋 粘贴职位描述 (Job Description)
          </h3>
        </div>

        <Textarea
          data-testid="jd-textarea"
          value={text}
          onChange={handleTextChange}
          placeholder={`例如：\n我们正在寻找一位后端开发实习生，要求：\n- 熟悉 Go 或 Java，了解微服务架构\n- 有 Redis、消息队列的实际使用经验\n- 了解 Docker 容器化部署...`}
          rows={8}
          showCharCount
          minChars={MIN_CHARS}
          error={error || undefined}
        />

        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" title="语音输入（即将上线）">
              <Icon name="mic" size={16} className="mr-1" /> 语音输入
            </Button>
            <Button variant="ghost" size="sm" title="上传截图 OCR（即将上线）">
              <Icon name="upload" size={16} className="mr-1" /> 截图 OCR
            </Button>
          </div>

          <Button
            data-testid="parse-btn"
            onClick={handleParse}
            disabled={!canParse}
            loading={state === "loading"}
            size="lg"
          >
            <Icon name="sparkles" size={18} className="mr-2" />
            解析 →
          </Button>
        </div>

        {state === "error" && error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}
