// packages/ui/src/wizard/WizardState.ts

import type { JDParsed as JDParsedCore } from '@resume-ci/core';
import type { ProjectCard } from '@resume-ci/core';

export type WizardStep = 'anchor' | 'blueprint' | 'alignment' | 'polish' | 'export';

// Re-export for convenience
export type JDParsed = JDParsedCore;

export interface WizardState {
  step: WizardStep;
  jd: JDParsed | null;
  selectedProject: { id: string; title: string } | null;
  selectedProjectId: string | null;
  projects: ProjectCard[];
  projectsLoading: 'idle' | 'loading' | 'done';
  resumeHTML: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  visitedSteps: Set<WizardStep>;
}

const STEP_ORDER: WizardStep[] = ['anchor', 'blueprint', 'alignment', 'polish', 'export'];

export function createWizardState(): WizardState {
  return {
    step: 'anchor',
    jd: null,
    selectedProject: null,
    selectedProjectId: null,
    projects: [],
    projectsLoading: 'idle',
    resumeHTML: null,
    canGoBack: false,
    canGoForward: false,
    visitedSteps: new Set(['anchor']),
  };
}

export function getStepIndex(step: WizardStep): number {
  return STEP_ORDER.indexOf(step);
}

export function canAdvanceFrom(state: WizardState): boolean {
  switch (state.step) {
    case 'anchor':    return state.jd !== null;
    case 'blueprint': return state.selectedProject !== null;
    case 'alignment': return true;  // 对齐步骤允许跳过
    case 'polish':    return true;
    default:          return false;
  }
}
