// packages/ui/src/wizard/WizardState.ts

import type { JDParsed as JDParsedCore, ProjectCard, AlignmentQuestion, STARBullet } from '@resume-ci/core';

export type WizardStep = 'anchor' | 'blueprint' | 'alignment' | 'polish' | 'export';

export type JDParsed = JDParsedCore;

export interface AlignmentState {
  questions: AlignmentQuestion[];
  currentQuestionIndex: number;
  evidence: STARBullet[];
  status: 'idle' | 'loading' | 'active' | 'done';
  submittingQuestionId: string | null;
}

export interface PolishState {
  resumeHTML: string;
  editedSections: Record<string, string>;
  pageFit: { currentPages: number; status: 'fit' | 'overflow' | 'underflow' } | null;
  isChatOpen: boolean;
}

export interface WizardState {
  step: WizardStep;
  jd: JDParsed | null;
  selectedProject: { id: string; title: string } | null;
  selectedProjectId: string | null;
  projects: ProjectCard[];
  projectsLoading: 'idle' | 'loading' | 'done';
  alignment: AlignmentState;
  polish: PolishState;
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
    alignment: {
      questions: [],
      currentQuestionIndex: 0,
      evidence: [],
      status: 'idle',
      submittingQuestionId: null,
    },
    polish: {
      resumeHTML: '',
      editedSections: {},
      pageFit: null,
      isChatOpen: true,
    },
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
    case 'alignment': return true;
    case 'polish':    return true;
    default:          return false;
  }
}
