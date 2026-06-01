// packages/ui/src/wizard/WizardState.ts

export type WizardStep = 'anchor' | 'blueprint' | 'alignment' | 'polish' | 'export';

export interface JDParsed {
  keywords: { word: string; weight: number }[];
  techStack: string[];
  roleType: string;
  matchProfile: { score: number; gaps: string[] };
}

export interface WizardState {
  step: WizardStep;
  jd: JDParsed | null;
  selectedProject: { id: string; title: string } | null;
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
