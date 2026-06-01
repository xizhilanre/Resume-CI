// packages/ui/src/wizard/useWizardStore.ts
import { create } from 'zustand';
import type { ProjectCard } from '@resume-ci/core';
import type { WizardStep, WizardState, JDParsed } from './WizardState';

const STEP_ORDER: WizardStep[] = ['anchor', 'blueprint', 'alignment', 'polish', 'export'];

interface WizardActions {
  setJD: (jd: JDParsed) => void;
  selectProject: (project: WizardState['selectedProject']) => void;
  setSelectedProjectId: (id: string | null) => void;
  appendProject: (project: ProjectCard) => void;
  setProjectsLoading: (status: 'idle' | 'loading' | 'done') => void;
  setResumeHTML: (html: string) => void;
  goBack: () => void;
  goToStep: (step: WizardStep) => void;
  resetPhase9: () => void;
  getInitialState: () => WizardState & WizardActions;
}

export const useWizardStore = create<WizardState & WizardActions>((set, get) => ({
  // ─── State ───
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

  // ─── Actions ───
  setJD: (jd: JDParsed) => {
    const visited = new Set(get().visitedSteps);
    visited.add('blueprint');
    set({ jd, step: 'blueprint', visitedSteps: visited, canGoBack: true, canGoForward: false });
  },

  selectProject: (project) => {
    const visited = new Set(get().visitedSteps);
    visited.add('alignment');
    set({ selectedProject: project, selectedProjectId: project?.id ?? null, step: 'alignment', visitedSteps: visited, canGoBack: true, canGoForward: true });
  },

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  appendProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
    })),

  setProjectsLoading: (status) => set({ projectsLoading: status }),

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

  resetPhase9: () =>
    set({
      jd: null,
      selectedProjectId: null,
      projects: [],
      projectsLoading: 'idle',
    }),

  getInitialState: () => ({
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
    setJD: () => {},
    selectProject: () => {},
    setSelectedProjectId: () => {},
    appendProject: () => {},
    setProjectsLoading: () => {},
    setResumeHTML: () => {},
    goBack: () => {},
    goToStep: () => {},
    resetPhase9: () => {},
    getInitialState: () => ({} as WizardState & WizardActions),
  }),
}));
