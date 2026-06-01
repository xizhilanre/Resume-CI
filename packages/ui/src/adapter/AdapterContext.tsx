// packages/ui/src/adapter/AdapterContext.tsx
import React, { createContext, useContext } from 'react';
import type { IResumeCIAdapter } from '@resume-ci/core';

const AdapterContext = createContext<IResumeCIAdapter | null>(null);

export function AdapterProvider({
  adapter,
  children,
}: {
  adapter: IResumeCIAdapter;
  children: React.ReactNode;
}) {
  return React.createElement(AdapterContext.Provider, { value: adapter }, children);
}

export function useAdapterContext(): IResumeCIAdapter {
  const ctx = useContext(AdapterContext);
  if (!ctx) throw new Error('useAdapter must be used within AdapterProvider');
  return ctx;
}
