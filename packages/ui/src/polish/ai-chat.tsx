// packages/ui/src/polish/ai-chat.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../shared/button";
import { Icon } from "../shared/icon";

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  actions?: { label: string; handler: () => void }[];
}

interface AIChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onQuickCommand: (command: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  streaming?: boolean;
}

const QUICK_COMMANDS = ["优化表达", "量化结果", "强化技术关键词"];

export function AIChat({ messages, onSend, onQuickCommand, isOpen, onToggle, streaming }: AIChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  }, [input, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        data-testid="ai-chat"
        animate={{ width: isOpen ? 320 : 48, height: isOpen ? "auto" : 48 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="rounded-[var(--radius-xl)] shadow-lg overflow-hidden"
        style={{
          background: "var(--glass-bg)",
          backdropFilter: `blur(var(--glass-blur))`,
          border: `1px solid var(--glass-border)`,
        }}
      >
        {!isOpen && (
          <button
            onClick={onToggle}
            className="w-full p-3 flex items-center justify-center hover:bg-[hsl(var(--accent-soft))] transition-colors"
            title="展开 AI Chat"
          >
            <Icon name="sparkles" size={20} />
          </button>
        )}

        {isOpen && (
          <div className="flex flex-col h-[500px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--muted)/0.1)]">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">💬 AI Chat</span>
              <button onClick={onToggle} className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
                <Icon name="chevron-right" size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-[var(--radius-md)] text-sm ${
                      msg.role === "user"
                        ? "bg-[hsl(var(--accent))] text-white"
                        : "bg-[hsl(var(--accent-soft))] text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {msg.role === "assistant" && "🤖 "}
                    {msg.content}
                    {msg.actions && (
                      <div className="flex gap-1 mt-2">
                        {msg.actions.map((action) => (
                          <button
                            key={action.label}
                            onClick={action.handler}
                            className="text-xs px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex justify-start">
                  <span className="px-3 py-2 text-sm text-[hsl(var(--muted))] animate-pulse">🤖 思考中...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex flex-wrap gap-1 px-4 py-2 border-t border-[hsl(var(--muted)/0.1)]">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => onQuickCommand(cmd)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--muted)/0.1)] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent-soft))] transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-[hsl(var(--muted)/0.1)]">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入指令..."
                className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted))] focus:outline-none"
              />
              <Button size="sm" onClick={handleSend} disabled={!input.trim() || streaming}>
                <Icon name="chevron-right" size={16} />
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
