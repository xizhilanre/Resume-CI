// apps/desktop/src/renderer/App.tsx
import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { MockAdapter } from "@resume-ci/core";
import { AdapterProvider, WizardShell } from "@resume-ci/ui";

function App() {
  const adapter = useMemo(() => new MockAdapter(), []);

  const wizardShell = React.createElement(WizardShell, {
    children: {
      anchor: React.createElement(StepPlaceholder, {
        title: "JD 锚点 (Desktop)",
      }),
      blueprint: React.createElement(StepPlaceholder, { title: "项目蓝图" }),
      alignment: React.createElement(StepPlaceholder, { title: "证据对齐" }),
      polish: React.createElement(StepPlaceholder, { title: "沉浸精修" }),
      export: React.createElement(StepPlaceholder, { title: "导出 PDF" }),
    },
  });

  return React.createElement(AdapterProvider, { adapter, children: wizardShell });
}

function StepPlaceholder({ title }: { title: string }) {
  return React.createElement(
    "div",
    { className: "flex items-center justify-center h-96" },
    React.createElement("h2", { className: "text-3xl font-bold" }, title),
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(React.createElement(App));
