// packages/ui/src/blueprint/flash-card.tsx
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Icon } from "../shared/icon";
import type { FlashCardData } from "@resume-ci/core";

interface FlashCardProps {
  card: FlashCardData;
  onFlipped?: (id: string) => void;
}

export function FlashCard({ card, onFlipped }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [codeHtml, setCodeHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const hasFlipped = useRef(false);

  useEffect(() => {
    if (flipped && card.codeSnippet && card.language && !codeHtml) {
      import("shiki").then((shiki) => {
        shiki.codeToHtml(card.codeSnippet!, {
          lang: card.language!,
          theme: "github-dark",
        }).then(setCodeHtml);
      });
    }
  }, [flipped, card.codeSnippet, card.language, codeHtml]);

  const handleFlip = () => {
    setFlipped((prev) => !prev);
    if (!hasFlipped.current && onFlipped) {
      hasFlipped.current = true;
      onFlipped(card.id);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (card.codeSnippet) {
      await navigator.clipboard.writeText(card.codeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div data-testid="flash-card" onClick={handleFlip} className="w-[400px] h-[260px] cursor-pointer" style={{ perspective: "1000px" }}>
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* 正面 — 问题 */}
        <div
          className="absolute inset-0 rounded-[var(--radius-xl)] bg-[hsl(var(--card))] p-6 flex flex-col items-center justify-center text-center shadow-md"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="text-3xl mb-3">⚡</span>
          <p className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4 leading-snug">
            {card.question}
          </p>
          <span className="text-sm text-[hsl(var(--muted))]">点击翻转 →</span>
        </div>

        {/* 背面 — 答案 + 代码 */}
        <div
          className="absolute inset-0 rounded-[var(--radius-xl)] bg-[hsl(var(--card))] p-6 flex flex-col shadow-md overflow-hidden"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed flex-shrink-0 mb-3">
            {card.answer}
          </p>

          {card.codeSnippet && (
            <div className="flex-1 min-h-0 relative">
              <div className="absolute top-1 right-1 z-10">
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  title="复制代码"
                >
                  <Icon name={copied ? "check" : "copy"} size={14} />
                </button>
              </div>
              {codeHtml ? (
                <div
                  className="rounded-[var(--radius-md)] overflow-y-auto max-h-[120px] text-xs"
                  dangerouslySetInnerHTML={{ __html: codeHtml }}
                />
              ) : (
                <pre className="rounded-[var(--radius-md)] bg-slate-950/90 text-slate-300 p-3 text-xs overflow-y-auto max-h-[120px] font-mono">
                  {card.codeSnippet}
                </pre>
              )}
            </div>
          )}

          <p className="text-xs text-[hsl(var(--muted))] mt-2 text-center flex-shrink-0">
            点击翻回
          </p>
        </div>
      </motion.div>
    </div>
  );
}
