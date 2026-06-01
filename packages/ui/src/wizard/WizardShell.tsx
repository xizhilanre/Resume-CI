// packages/ui/src/wizard/WizardShell.tsx
import React from 'react';
import { useWizardStore } from './useWizardStore';
import { WizardProgress } from '../shared/WizardProgress';
import type { WizardStep } from './WizardState';

export function WizardShell({
  children,
}: {
  children: Record<WizardStep, React.ReactNode>;
}) {
  const step = useWizardStore((s) => s.step);
  const visitedSteps = useWizardStore((s) => s.visitedSteps);
  const goToStep = useWizardStore((s) => s.goToStep);
  const goBack = useWizardStore((s) => s.goBack);

  return React.createElement(
    'div',
    { className: 'min-h-screen flex flex-col' },
    React.createElement(WizardProgress, { current: step, visited: visitedSteps, onStepClick: goToStep }),
    React.createElement('main', { className: 'flex-1' }, children[step]),
    React.createElement(
      'footer',
      { className: 'flex justify-between px-6 py-3 border-t border-slate-200' },
      React.createElement(
        'button',
        { onClick: goBack, disabled: step === 'anchor', className: 'px-4 py-2 rounded-lg bg-slate-100 disabled:opacity-30' },
        '← 上一步',
      ),
    ),
  );
}
