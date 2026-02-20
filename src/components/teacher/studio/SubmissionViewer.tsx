"use client";

import { FileText, Link as LinkIcon } from "lucide-react";

export type SubmissionViewerProps = {
  content?: string;
  attachments?: Array<{ name: string; url: string; type: string; size?: number }>;
  questions?: Array<{
    id: string;
    prompt: string;
    points: number;
    choices: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>;
  questionResponses?: Array<{
    questionId: string;
    selectedChoiceId: string | null;
    isCorrect: boolean | null;
    pointsAwarded: number | null;
  }>;
};

export function SubmissionViewer({
  content,
  attachments = [],
  questions = [],
  questionResponses = [],
}: SubmissionViewerProps) {
  const responseMap = new Map(
    questionResponses.map((response) => [response.questionId, response])
  );

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      {questions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white">Auto-graded Answers</h3>
          <div className="mt-3 space-y-3">
            {questions.map((question, index) => {
              const response = responseMap.get(question.id);
              const selected = question.choices.find(
                (choice) => choice.id === response?.selectedChoiceId
              );
              const correct = question.choices.find((choice) => choice.isCorrect);

              return (
                <div
                  key={question.id || index}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <p className="text-sm font-medium text-white">
                    {index + 1}. {question.prompt}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-white/65">
                    <p>
                      Student answer:{" "}
                      <span className="text-white/85">
                        {selected?.text || "No answer selected"}
                      </span>
                    </p>
                    <p>
                      Correct answer:{" "}
                      <span className="text-emerald-300">
                        {correct?.text || "Not configured"}
                      </span>
                    </p>
                    {response?.pointsAwarded !== null && response?.pointsAwarded !== undefined && (
                      <p>
                        Points:{" "}
                        <span className="text-white/85">
                          {response.pointsAwarded} / {question.points}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
