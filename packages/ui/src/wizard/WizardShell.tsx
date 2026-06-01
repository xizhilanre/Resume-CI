// packages/ui/src/wizard/WizardShell.tsx
import React from 'react';
import { useWizardStore } from './useWizardStore';
import { WizardProgress } from '../shared/WizardProgress';
import type { WizardStep } from './WizardState';

const STEP_ORDER: WizardStep[] = ['anchor', 'blueprint', 'alignment', 'polish', 'export'];

export function WizardShell({
  children,
}: {
  children: Record<WizardStep, React.ReactNode>;
}) {
  const step = useWizardStore((s) => s.step);
  const jd = useWizardStore((s) => s.jd);
  const selectedProject = useWizardStore((s) => s.selectedProject);
  const visitedSteps = useWizardStore((s) => s.visitedSteps);
  const goToStep = useWizardStore((s) => s.goToStep);
  const goBack = useWizardStore((s) => s.goBack);

  const currentIdx = STEP_ORDER.indexOf(step);
  const isLastStep = currentIdx === STEP_ORDER.length - 1;

  const canGoNext = (() => {
    switch (step) {
      case 'anchor': return jd !== null;
      case 'blueprint': return selectedProject !== null;
      case 'alignment': return true;
      case 'polish': return true;
      default: return false;
    }
  })();

  const goNext = () => {
    if (!canGoNext || isLastStep) return;
    const nextStep = STEP_ORDER[currentIdx + 1]!;
    const visited = new Set(visitedSteps);
    visited.add(nextStep);
    useWizardStore.setState({ step: nextStep, visitedSteps: visited, canGoBack: true, canGoForward: !isLastStep });
  };

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
      React.createElement(
        'button',
        {
          'data-testid': 'next-step',
          onClick: goNext,
          disabled: !canGoNext || isLastStep,
          className: 'px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-30 hover:bg-blue-700 transition-colors',
        },
        isLastStep ? '完成' : '下一步 →',
      ),
    ),
  );
}
