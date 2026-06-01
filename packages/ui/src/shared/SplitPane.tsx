// packages/ui/src/shared/SplitPane.tsx
import React, { useRef, useState, useCallback } from 'react';

export function SplitPane({
  left,
  right,
  defaultLeftPercent = 40,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPercent?: number;
}) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(Math.max(20, Math.min(80, pct)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return React.createElement(
    'div',
    { ref: containerRef, className: 'flex h-full' },
    React.createElement('div', { style: { width: `${leftPercent}%` }, className: 'overflow-auto p-4' }, left),
    React.createElement('div', {
      onMouseDown,
      className: 'w-1.5 bg-slate-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors',
    }),
    React.createElement('div', { style: { width: `${100 - leftPercent}%` }, className: 'overflow-auto p-4' }, right),
  );
}
