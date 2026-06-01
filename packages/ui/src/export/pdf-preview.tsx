// packages/ui/src/export/pdf-preview.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PDFPreviewProps {
  pdfUrl: string;
}

export function PDFPreview({ pdfUrl }: PDFPreviewProps) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div data-testid="pdf-preview" className="py-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={fullscreen
            ? "fixed inset-4 z-50 bg-black/50 backdrop-blur-sm"
            : "max-w-2xl mx-auto"
          }
          onClick={() => setFullscreen(false)}
        >
          <div
            className={`bg-white rounded-[var(--radius-lg)] shadow-lg overflow-hidden ${
              fullscreen ? "h-full" : "max-h-[500px]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="简历 PDF 预览"
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {!fullscreen && (
        <div className="text-center mt-3">
          <button
            onClick={() => setFullscreen(true)}
            className="text-xs text-[hsl(var(--accent))] hover:underline"
          >
            全屏预览
          </button>
        </div>
      )}
    </div>
  );
}
