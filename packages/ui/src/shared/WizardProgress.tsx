// packages/ui/src/shared/WizardProgress.tsx
import React from 'react';
import type { WizardStep } from '../wizard/WizardState';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'anchor', label: 'JD 锚点' },
  { key: 'blueprint', label: '项目蓝图' },
  { key: 'alignment', label: '证据对齐' },
  { key: 'polish', label: '沉浸精修' },
  { key: 'export', label: '导出 PDF' },
];

export function WizardProgress({
  current,
  visited,
  onStepClick,
}: {
  current: WizardStep;
  visited: Set<WizardStep>;
  onStepClick: (step: WizardStep) => void;
}) {
  return React.createElement(
    'nav',
    { className: 'flex items-center justify-center gap-2 py-4 px-6' },
    ...STEPS.map((s, i) => {
      const isCurrent = s.key === current;
      const isDone = visited.has(s.key) && !isCurrent;
      const clickable = visited.has(s.key);

      return React.createElement(
        'button',
        {
          key: s.key,
          onClick: () => clickable && onStepClick(s.key),
          disabled: !clickable,
          className: `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${isCurrent ? 'bg-blue-600 text-white' : ''}
            ${isDone ? 'bg-green-100 text-green-800' : ''}
            ${!isCurrent && !isDone ? 'bg-slate-100 text-slate-400' : ''}
            ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`,
        },
        React.createElement('span', { className: 'w-6 h-6 rounded-full flex items-center justify-center text-xs border' }, i + 1),
        React.createElement('span', null, s.label),
      );
    }),
  );
}
