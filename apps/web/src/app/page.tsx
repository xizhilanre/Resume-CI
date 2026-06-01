'use client';

import { MockAdapter } from '@resume-ci/core';
import { AdapterProvider, WizardShell, useWizardStore } from '@resume-ci/ui';
import { useMemo } from 'react';

export default function Home() {
  const adapter = useMemo(() => new MockAdapter(), []);

  return (
    <AdapterProvider adapter={adapter}>
      <WizardShell
        children={{
          anchor:     <StepPlaceholder title="JD 锚点输入" />,
          blueprint:  <StepPlaceholder title="项目蓝图" />,
          alignment:  <StepPlaceholder title="证据对齐" />,
          polish:     <StepPlaceholder title="沉浸精修" />,
          export:     <StepPlaceholder title="导出 PDF" />,
        }}
      />
    </AdapterProvider>
  );
}

function StepPlaceholder({ title }: { title: string }) {
  const step = useWizardStore((s) => s.step);
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-500">当前步骤：{step}</p>
      </div>
    </div>
  );
}
