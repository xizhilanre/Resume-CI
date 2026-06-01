// packages/ui/src/adapter/useAdapter.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AdapterProvider } from './AdapterContext';
import { useAdapter } from './useAdapter';
import { MockAdapter } from '@resume-ci/core';
import React from 'react';

describe('useAdapter', () => {
  it('returns adapter from context', () => {
    const mock = new MockAdapter();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AdapterProvider, { adapter: mock, children });

    const { result } = renderHook(() => useAdapter(), { wrapper });
    expect(result.current).toBe(mock);
  });

  it('throws if no provider', () => {
    expect(() => renderHook(() => useAdapter())).toThrow();
  });
});
