// packages/ui/src/wizard/WizardState.test.ts
import { describe, it, expect } from 'vitest';
import { createWizardState, canAdvanceFrom, type WizardStep, type WizardState } from './WizardState';

describe('WizardState', () => {
  it('starts at anchor step', () => {
    const state = createWizardState();
    expect(state.step).toBe('anchor');
    expect(state.jd).toBeNull();
    expect(state.canGoForward).toBe(false);
  });

  it('cannot go back from first step', () => {
    const state = createWizardState();
    expect(state.canGoBack).toBe(false);
  });

  it('setJD enables forward navigation', () => {
    const state = createWizardState();
    const next = { ...state, jd: { keywords: [], techStack: [], roleType: 'frontend' as const, matchProfile: { score: 1, gaps: [] } } };
    expect(canAdvanceFrom(next)).toBe(true);
  });

  it('visited steps are tracked', () => {
    const state = createWizardState();
    expect(state.visitedSteps.has('anchor')).toBe(true);
    expect(state.visitedSteps.has('blueprint')).toBe(false);
  });
});
