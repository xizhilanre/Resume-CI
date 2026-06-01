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

  it('setJD moves to blueprint', () => {
    const jd = { keywords: [], techStack: [], roleType: 'backend', matchProfile: { score: 0.9, gaps: [] } };
    useWizardStore.getState().setJD(jd);
    const state = useWizardStore.getState();
    expect(state.jd).toEqual(jd);
    expect(state.step).toBe('blueprint');
  });

  it('setJD triggers automatic step advance', () => {
    const jd = { keywords: [], techStack: ['Go'], roleType: 'backend', matchProfile: { score: 0.8, gaps: [] } };
    useWizardStore.getState().setJD(jd);
    expect(useWizardStore.getState().step).toBe('blueprint');
    expect(useWizardStore.getState().visitedSteps.has('blueprint')).toBe(true);
  });

  it('selectProject advances to alignment', () => {
    useWizardStore.getState().selectProject({ id: 'p1', title: 'Test' });
    const state = useWizardStore.getState();
    expect(state.selectedProject).toEqual({ id: 'p1', title: 'Test' });
  });

  it('goBack returns to previous step', () => {
    const jd = { keywords: [], techStack: [], roleType: 'frontend', matchProfile: { score: 1, gaps: [] } };
    useWizardStore.getState().setJD(jd);
    expect(useWizardStore.getState().step).toBe('blueprint');
    useWizardStore.getState().goBack();
    expect(useWizardStore.getState().step).toBe('anchor');
  });

  it('goBack from anchor is no-op', () => {
    useWizardStore.getState().goBack();
    expect(useWizardStore.getState().step).toBe('anchor');
  });
});
