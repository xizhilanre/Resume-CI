// packages/ui/src/export/download-button.tsx
import React, { useState } from "react";
import { Button } from "../shared/button";
import { Icon } from "../shared/icon";

interface DownloadButtonProps {
  pdfUrl: string;
  onRegenerate: () => void;
}

export function DownloadButton({ pdfUrl, onRegenerate }: DownloadButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(pdfUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div data-testid="download-button" className="flex flex-col items-center gap-3 py-4">
      <a href={pdfUrl} download="resume.pdf">
        <Button size="lg">
          <Icon name="upload" size={18} className="mr-2" />
          下载 PDF
        </Button>
      </a>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={handleCopyLink}>
          <Icon name={copied ? "check" : "copy"} size={14} className="mr-1" />
          {copied ? "已复制" : "复制链接"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerate}>
          <Icon name="rotate-ccw" size={14} className="mr-1" />
          重新生成
        </Button>
      </div>
    </div>
  );
}
