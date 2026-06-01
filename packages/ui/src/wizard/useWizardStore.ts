// packages/ui/src/wizard/useWizardStore.ts
import { create } from 'zustand';
import type { WizardStep, WizardState, JDParsed } from './WizardState';

const STEP_ORDER: WizardStep[] = ['anchor', 'blueprint', 'alignment', 'polish', 'export'];

interface WizardActions {
  setJD: (jd: JDParsed) => void;
  selectProject: (project: WizardState['selectedProject']) => void;
  setResumeHTML: (html: string) => void;
  goBack: () => void;
  goToStep: (step: WizardStep) => void;
  getInitialState: () => WizardState & WizardActions;
}

export const useWizardStore = create<WizardState & WizardActions>((set, get) => ({
  // ─── State ───
  step: 'anchor',
  jd: null,
  selectedProject: null,
  resumeHTML: null,
  canGoBack: false,
  canGoForward: false,
  visitedSteps: new Set(['anchor']),

  // ─── Actions ───
  setJD: (jd: JDParsed) => {
    const visited = new Set(get().visitedSteps);
    visited.add('blueprint');
    set({ jd, step: 'blueprint', visitedSteps: visited, canGoBack: true, canGoForward: false });
  },

  selectProject: (project) => {
    const visited = new Set(get().visitedSteps);
    visited.add('alignment');
    set({ selectedProject: project, step: 'alignment', visitedSteps: visited, canGoBack: true, canGoForward: true });
  },

  setResumeHTML: (html: string) => {
    set({ resumeHTML: html });
  },

  goBack: () => {
    const currentIdx = STEP_ORDER.indexOf(get().step);
    if (currentIdx <= 0) return;
    const newIdx = currentIdx - 1;
    set({ step: STEP_ORDER[newIdx], canGoBack: newIdx > 0, canGoForward: true });
  },

  goToStep: (target: WizardStep) => {
    const visited = get().visitedSteps;
    if (!visited.has(target)) return;
    const targetIdx = STEP_ORDER.indexOf(target);
    set({ step: target, canGoBack: targetIdx > 0, canGoForward: true });
  },

  getInitialState: () => ({
    step: 'anchor',
    jd: null,
    selectedProject: null,
    resumeHTML: null,
    canGoBack: false,
    canGoForward: false,
    visitedSteps: new Set(['anchor']),
    setJD: () => {},
    selectProject: () => {},
    setResumeHTML: () => {},
    goBack: () => {},
    goToStep: () => {},
    getInitialState: () => ({} as WizardState & WizardActions),
  }),
}));
