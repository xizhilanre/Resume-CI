'use client';

import React, { useEffect, useState } from 'react';
import { MockAdapter } from '@resume-ci/core';
import {
  AdapterProvider, WizardShell,
  JDInputArea, KeywordCloud, MatchRadar,
  ProjectCardStack, ArchitectureDiagram, FlashCardStack,
  QuestionFlow, EvidenceChain,
  ResumeCanvas, PageIndicator, AIChat,
  PipelineProgress, PDFPreview, DownloadButton, InterviewTip,
  useWizardStore, useAdapter,
} from '@resume-ci/ui';

export default function Home() {
  const [adapter, setAdapter] = useState<any>(null);

  useEffect(() => {
    const isRemote = new URLSearchParams(window.location.search).get('remote') !== null;

    if (isRemote) {
      import('../adapters/remote.adapter').then(({ RemoteAdapter }) => {
        const a = new RemoteAdapter();
        a.connect();
        setAdapter(a);
      });
    } else {
      setAdapter(new MockAdapter());
    }
  }, []);

  if (!adapter) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-slate-400">Loading...</p></div>;
  }

  return (
    <AdapterProvider adapter={adapter}>
      <WizardShell
        children={{
          anchor:     <AnchorStep />,
          blueprint:  <BlueprintStep />,
          alignment:  <AlignmentStep />,
          polish:     <PolishStep />,
          export:     <ExportStep />,
        }}
      />
    </AdapterProvider>
  );
}

function AnchorStep() {
  const adapter = useAdapter();
  const jd = useWizardStore((s) => s.jd);
  const setJD = useWizardStore((s) => s.setJD);

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-8">
      <JDInputArea adapter={adapter} onParsed={(parsed) => setJD(parsed)} />
      {jd && (
        <>
          <KeywordCloud keywords={jd.keywords} />
          <MatchRadar profile={jd.matchProfile} />
        </>
      )}
    </div>
  );
}

function BlueprintStep() {
  const projects = useWizardStore((s) => s.projects);
  const selectedProjectId = useWizardStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useWizardStore((s) => s.setSelectedProjectId);
  const appendProject = useWizardStore((s) => s.appendProject);
  const adapter = useAdapter();

  // Auto-discover on mount if no projects
  useEffect(() => {
    if (projects.length === 0) {
      (async () => {
        for await (const card of adapter.discoverProjects({})) {
          appendProject(card as any);
        }
      })();
    }
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-8">
      <ProjectCardStack
        projects={projects}
        loading={projects.length < 3}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onViewDetail={setSelectedProjectId}
      />
      {selectedProject && (
        <>
          <ArchitectureDiagram dsl={selectedProject.architecture} projectId={selectedProject.id} />
          <FlashCardStack cards={selectedProject.challenges} />
        </>
      )}
    </div>
  );
}

function AlignmentStep() {
  const alignment = useWizardStore((s) => s.alignment);
  const selectedProjectId = useWizardStore((s) => s.selectedProjectId);
  const appendQuestion = useWizardStore((s) => s.appendAlignmentQuestion);
  const nextQuestion = useWizardStore((s) => s.nextAlignmentQuestion);
  const appendBullet = useWizardStore((s) => s.appendSTARBullet);
  const adapter = useAdapter();

  // Auto-generate questions
  useEffect(() => {
    if (alignment.questions.length === 0 && selectedProjectId) {
      (async () => {
        for await (const q of adapter.generateAlignmentQuestions(selectedProjectId)) {
          appendQuestion(q as any);
        }
      })();
    }
  }, [selectedProjectId]);

  const currentQuestion = alignment.questions[alignment.currentQuestionIndex] || null;

  const handleSubmit = async (qId: string, answer: string) => {
    for await (const chunk of adapter.submitAlignmentAnswer(qId, answer)) {
      appendBullet({
        id: `star-${qId}`,
        situation: '基于项目实操经验',
        task: `针对${answer.slice(0, 20)}问题`,
        action: `采取了${answer}方案`,
        result: '取得了显著的性能提升',
      });
    }
    nextQuestion();
  };

  return (
    <div className="grid grid-cols-[1fr_320px] gap-8 max-w-5xl mx-auto p-8">
      <QuestionFlow
        question={currentQuestion}
        questionIndex={alignment.currentQuestionIndex + 1}
        totalQuestions={alignment.questions.length || 3}
        loading={alignment.questions.length === 0}
        onSubmitAnswer={handleSubmit}
        onSkip={() => nextQuestion()}
      />
      <EvidenceChain evidence={alignment.evidence} />
    </div>
  );
}

function PolishStep() {
  const adapter = useAdapter();
  const polish = useWizardStore((s) => s.polish);
  const setResumeHTML = useWizardStore((s) => s.setResumeHTML);
  const updateSection = useWizardStore((s) => s.updateResumeSection);
  const setPageFit = useWizardStore((s) => s.setPageFit);
  const toggleChat = useWizardStore((s) => s.toggleChat);

  // Load resume on mount
  useEffect(() => {
    if (!polish.resumeHTML) {
      adapter.getResumeHTML().then((html) => {
        setResumeHTML(html as string);
        setPageFit({ currentPages: 0.98, status: 'fit' });
      });
    }
  }, []);

  return (
    <div className="flex gap-0 max-w-full mx-auto relative">
      <div className="fixed left-4 top-24 z-30">
        <AIChat
          messages={[]}
          onSend={() => {}}
          onQuickCommand={() => {}}
          isOpen={polish.isChatOpen}
          onToggle={toggleChat}
        />
      </div>
      <div className="flex-1 px-4">
        <ResumeCanvas
          html={polish.resumeHTML}
          onSectionEdit={(section, content) => updateSection(section, content)}
          pageFit={polish.pageFit}
        />
      </div>
      <PageIndicator
        currentPages={polish.pageFit?.currentPages ?? 0.98}
        status={polish.pageFit?.status ?? 'fit'}
        onRefresh={() => adapter.checkPageFit().then((fit: any) => setPageFit(fit))}
      />
    </div>
  );
}

function ExportStep() {
  const [stages, setStages] = useState([
    { name: "排版对齐", status: "done" as const },
    { name: "字体嵌入", status: "active" as const },
    { name: "ATS校验", status: "pending" as const },
    { name: "生成PDF", status: "pending" as const },
  ]);
  const [progress, setProgress] = useState(35);
  const [pdfUrl, setPdfUrl] = useState("");

  // Simulate export pipeline
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => {
      setStages(s => s.map((st, i) => i <= 1 ? { ...st, status: "done" as const } : i === 2 ? { ...st, status: "active" as const } : st));
      setProgress(65);
    }, 1500));
    timers.push(setTimeout(() => {
      setStages(s => s.map((st, i) => i <= 2 ? { ...st, status: "done" as const } : { ...st, status: "active" as const }));
      setProgress(85);
    }, 3000));
    timers.push(setTimeout(() => {
      setStages(s => s.map(st => ({ ...st, status: "done" as const })));
      setProgress(100);
      setPdfUrl("#");
    }, 4500));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-8">
      <PipelineProgress stages={stages} overallProgress={progress} />
      {pdfUrl && (
        <>
          <PDFPreview pdfUrl={pdfUrl} />
          <DownloadButton pdfUrl={pdfUrl} onRegenerate={() => window.location.reload()} />
          <InterviewTip tip="面试官可能会问技术选型理由，准备好回答会让面试更有说服力。" />
        </>
      )}
    </div>
  );
}
