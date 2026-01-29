"use client";

import { FileText, Link as LinkIcon } from "lucide-react";

export type SubmissionViewerProps = {
  content?: string;
  attachments?: Array<{ name: string; url: string; type: string; size?: number }>;
};

export function SubmissionViewer({ content, attachments = [] }: SubmissionViewerProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Student Response</h3>
        <p className="mt-2 text-sm text-white/70 whitespace-pre-wrap">
          {content || "No text submission provided."}
        </p>
      </div>
      <div>
        <h4 className="text-xs uppercase tracking-[0.2em] text-white/40">Attachments</h4>
        {attachments.length === 0 ? (
          <p className="mt-2 text-sm text-white/50">No attachments uploaded.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {attachments.map((attachment, index) => (
              <a
                key={`${attachment.name}-${index}`}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                {attachment.type === "link" ? (
                  <LinkIcon className="h-4 w-4 text-white/40" />
                ) : (
                  <FileText className="h-4 w-4 text-white/40" />
                )}
                <span>{attachment.name}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
