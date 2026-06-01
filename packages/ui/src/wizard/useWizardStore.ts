// packages/ui/src/wizard/useWizardStore.ts
import { create } from 'zustand';
import type { ProjectCard, AlignmentQuestion, STARBullet } from '@resume-ci/core';
import type { WizardStep, WizardState, AlignmentState, PolishState, JDParsed } from './WizardState';

const STEP_ORDER: WizardStep[] = ['anchor', 'blueprint', 'alignment', 'polish', 'export'];

interface WizardActions {
  setJD: (jd: JDParsed) => void;
  selectProject: (project: WizardState['selectedProject']) => void;
  setSelectedProjectId: (id: string | null) => void;
  appendProject: (project: ProjectCard) => void;
  setProjectsLoading: (status: 'idle' | 'loading' | 'done') => void;

  // Alignment
  setAlignmentStatus: (status: AlignmentState['status']) => void;
  appendAlignmentQuestion: (q: AlignmentQuestion) => void;
  nextAlignmentQuestion: () => void;
  appendSTARBullet: (b: STARBullet) => void;
  setSubmittingQuestionId: (id: string | null) => void;
  resetAlignment: () => void;

  // Polish
  setResumeHTML: (html: string) => void;
  updateResumeSection: (section: string, content: string) => void;
  setPageFit: (fit: PolishState['pageFit']) => void;
  toggleChat: () => void;

  setResumeHTML_legacy: (html: string) => void;
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
  alignment: {
    questions: [],
    currentQuestionIndex: 0,
    evidence: [],
    status: 'idle' as const,
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

  // ─── Actions ───
  setJD: (jd: JDParsed) => {
    set({ jd, canGoForward: true });
  },

  selectProject: (project) => {
    set({ selectedProject: project, selectedProjectId: project?.id ?? null, canGoForward: true });
  },

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  appendProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),

  setProjectsLoading: (status) => set({ projectsLoading: status }),

  // ─── Alignment ───
  setAlignmentStatus: (status) =>
    set((s) => ({ alignment: { ...s.alignment, status } })),

  appendAlignmentQuestion: (q) =>
    set((s) => ({
      alignment: { ...s.alignment, questions: [...s.alignment.questions, q], status: 'active' as const },
    })),

  nextAlignmentQuestion: () =>
    set((s) => ({
      alignment: { ...s.alignment, currentQuestionIndex: s.alignment.currentQuestionIndex + 1 },
    })),

  appendSTARBullet: (b) =>
    set((s) => ({
      alignment: { ...s.alignment, evidence: [...s.alignment.evidence, b] },
    })),

  setSubmittingQuestionId: (id) =>
    set((s) => ({ alignment: { ...s.alignment, submittingQuestionId: id } })),

  resetAlignment: () =>
    set({
      alignment: {
        questions: [],
        currentQuestionIndex: 0,
        evidence: [],
        status: 'idle',
        submittingQuestionId: null,
      },
    }),

  // ─── Polish ───
  setResumeHTML: (html: string) =>
    set((s) => ({ polish: { ...s.polish, resumeHTML: html } })),

  updateResumeSection: (section: string, content: string) =>
    set((s) => ({
      polish: { ...s.polish, editedSections: { ...s.polish.editedSections, [section]: content } },
    })),

  setPageFit: (fit) =>
    set((s) => ({ polish: { ...s.polish, pageFit: fit } })),

  toggleChat: () =>
    set((s) => ({ polish: { ...s.polish, isChatOpen: !s.polish.isChatOpen } })),

  setResumeHTML_legacy: (html: string) => set({ resumeHTML: html }),

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
    step: 'anchor' as const,
    jd: null,
    selectedProject: null,
    selectedProjectId: null,
    projects: [],
    projectsLoading: 'idle' as const,
    alignment: {
      questions: [],
      currentQuestionIndex: 0,
      evidence: [],
      status: 'idle' as const,
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
    setJD: () => {},
    selectProject: () => {},
    setSelectedProjectId: () => {},
    appendProject: () => {},
    setProjectsLoading: () => {},
    setAlignmentStatus: () => {},
    appendAlignmentQuestion: () => {},
    nextAlignmentQuestion: () => {},
    appendSTARBullet: () => {},
    setSubmittingQuestionId: () => {},
    resetAlignment: () => {},
    setResumeHTML: () => {},
    updateResumeSection: () => {},
    setPageFit: () => {},
    toggleChat: () => {},
    setResumeHTML_legacy: () => {},
    goBack: () => {},
    goToStep: () => {},
    resetPhase9: () => {},
    getInitialState: () => ({} as WizardState & WizardActions),
  }),
}));
