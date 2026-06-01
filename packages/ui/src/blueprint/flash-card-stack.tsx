// packages/ui/src/blueprint/flash-card-stack.tsx
import React, { useState, useCallback } from "react";
import { FlashCard } from "./flash-card";
import type { FlashCardData } from "@resume-ci/core";

interface FlashCardStackProps {
  cards: FlashCardData[];
}

export function FlashCardStack({ cards }: FlashCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set());

  const handleFlipped = useCallback((cardId: string) => {
    const idx = cards.findIndex((c) => c.id === cardId);
    if (idx >= 0) {
      setFlippedSet((prev) => new Set(prev).add(idx));
    }
  }, [cards]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, cards.length]);

  if (cards.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--muted))] text-sm">
        暂无技术难点数据
      </div>
    );
  }

  const currentCard = cards[currentIndex]!;

  return (
    <div data-testid="flash-card-stack" className="py-4">
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">
        ⚡ 技术难点 & 亮点 <span className="text-sm font-normal text-[hsl(var(--muted))]">{cards.length} 张闪卡</span>
      </h3>

      <div className="flex justify-center mb-4">
        <FlashCard key={currentCard.id} card={currentCard} onFlipped={handleFlipped} />
      </div>

      <div className="flex justify-center items-center gap-2">
        {cards.map((card, idx) => (
          <button
            key={card.id}
            onClick={() => setCurrentIndex(idx)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              idx === currentIndex
                ? "bg-[hsl(var(--accent))] text-white"
                : flippedSet.has(idx)
                  ? "bg-green-100 text-green-700"
                  : "bg-[hsl(var(--muted)/0.1)] text-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.2)]"
            }`}
            title={card.question}
          >
            {flippedSet.has(idx) ? "✓" : idx + 1}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-[hsl(var(--muted))] mt-2">
        ← → 切换卡片 · 点击翻转
      </p>
    </div>
  );
}
