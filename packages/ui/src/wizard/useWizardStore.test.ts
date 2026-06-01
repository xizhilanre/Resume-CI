// packages/ui/src/wizard/useWizardStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useWizardStore } from './useWizardStore';

describe('useWizardStore', () => {
  beforeEach(() => {
    useWizardStore.setState(useWizardStore.getInitialState());
  });

  it('starts at anchor step', () => {
    const { step } = useWizardStore.getState();
    expect(step).toBe('anchor');
  });

  it('setJD stores jd and enables forward', () => {
    const jd = { keywords: [{ word: 'Go', weight: 0.9, category: 'language' as const }], techStack: ['Go'], roleType: 'backend', matchProfile: { score: 0.9, gaps: [] } };
    useWizardStore.getState().setJD(jd);
    const state = useWizardStore.getState();
    expect(state.jd).toEqual(jd);
    expect(state.canGoForward).toBe(true);
    expect(state.step).toBe('anchor'); // step only changes via WizardShell "next"
  });

  it('selectProject stores project and enables forward', () => {
    useWizardStore.getState().selectProject({ id: 'p1', title: 'Test' });
    const state = useWizardStore.getState();
    expect(state.selectedProject).toEqual({ id: 'p1', title: 'Test' });
    expect(state.selectedProjectId).toBe('p1');
    expect(state.canGoForward).toBe(true);
  });

  it('goBack from anchor is no-op', () => {
    useWizardStore.getState().goBack();
    expect(useWizardStore.getState().step).toBe('anchor');
  });

  it('appendProject adds to list', () => {
    const card = { id: 'p1', title: 'Test', description: '', techStack: [], jdMatchScore: 0.9, architecture: '', challenges: [] };
    useWizardStore.getState().appendProject(card);
    expect(useWizardStore.getState().projects).toHaveLength(1);
  });

  it('resetPhase9 clears anchor/blueprint state', () => {
    const jd = { keywords: [{ word: 'Go', weight: 0.9, category: 'language' as const }], techStack: ['Go'], roleType: 'backend', matchProfile: { score: 0.9, gaps: [] } };
    useWizardStore.getState().setJD(jd);
    useWizardStore.getState().selectProject({ id: 'p1', title: 'Test' });
    useWizardStore.getState().appendProject({ id: 'p1', title: 'Test', description: '', techStack: [], jdMatchScore: 0.9, architecture: '', challenges: [] });
    useWizardStore.getState().resetPhase9();
    const s = useWizardStore.getState();
    expect(s.jd).toBeNull();
    expect(s.projects).toHaveLength(0);
    expect(s.projectsLoading).toBe('idle');
  });
});
