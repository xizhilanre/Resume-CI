// packages/ui/src/alignment/question-flow.tsx
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../shared/button";
import { Skeleton } from "../shared/skeleton";
import type { AlignmentQuestion } from "@resume-ci/core";

interface QuestionFlowProps {
  question: AlignmentQuestion | null;
  questionIndex: number;
  totalQuestions: number;
  loading?: boolean;
  submitting?: boolean;
  onSubmitAnswer: (questionId: string, answer: string) => void;
  onSkip: () => void;
}

export function QuestionFlow({
  question, questionIndex, totalQuestions,
  loading, submitting,
  onSubmitAnswer, onSkip,
}: QuestionFlowProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    setSelectedOption(null);
    setCustomAnswer("");
    setShowCustom(false);
  }, [question?.id]);

  const handleSubmit = useCallback(() => {
    const answer = selectedOption
      ? question?.options.find((o) => o.id === selectedOption)?.text || ""
      : customAnswer;
    if (answer.trim() && question) {
      onSubmitAnswer(question.id, answer.trim());
    } else if (!answer.trim()) {
      setShowCustom(true);
    }
  }, [selectedOption, customAnswer, question, onSubmitAnswer]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!question) return;
      if (e.key === "1") setSelectedOption(question.options[0]?.id || null);
      if (e.key === "2") setSelectedOption(question.options[1]?.id || null);
      if (e.key === "3") setSelectedOption(question.options[2]?.id || null);
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [question, handleSubmit]);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-center py-12 text-[hsl(var(--muted))]">
        暂无问题数据
      </div>
    );
  }

  return (
    <div data-testid="question-flow" className="py-4">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
          问题 {questionIndex}/{totalQuestions}
        </span>
        <div className="flex-1 h-1 rounded-full bg-[hsl(var(--muted)/0.2)]">
          <motion.div
            className="h-full rounded-full bg-[hsl(var(--accent))]"
            animate={{ width: `${(questionIndex / totalQuestions) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-6 leading-relaxed">
            {question.text}
          </h3>

          <div className="space-y-3 mb-4">
            {question.options.map((opt, i) => (
              <motion.button
                key={opt.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setSelectedOption(opt.id); setShowCustom(false); }}
                className="w-full text-left px-4 py-3 rounded-[var(--radius-md)] border transition-colors"
                style={{
                  backgroundColor: selectedOption === opt.id ? 'hsl(var(--accent-soft))' : 'transparent',
                  borderColor: selectedOption === opt.id ? 'hsl(var(--accent))' : 'hsl(var(--muted)/0.3)',
                }}
              >
                <span className="text-xs font-mono text-[hsl(var(--muted))] mr-3">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm text-[hsl(var(--foreground))]">{opt.text}</span>
              </motion.button>
            ))}
          </div>

          {showCustom && (
            <motion.textarea
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              placeholder="输入你的答案..."
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--muted)/0.3)] bg-[hsl(var(--card))] px-3 py-2 text-sm resize-none min-h-[3rem] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent)/0.3)]"
              rows={3}
            />
          )}

          <div className="flex items-center gap-2 mt-4">
            <Button
              data-testid="submit-answer"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!selectedOption && !showCustom}
            >
              提交 →
            </Button>
            <Button variant="ghost" onClick={onSkip} disabled={submitting}>
              跳过此问题
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
