import katex from "katex";

export function validateLessonMathLatex(latex: string): {
  valid: boolean;
  message?: string;
} {
  const trimmed = latex.trim();
  if (!trimmed) {
    return { valid: false, message: "Math expression is empty." };
  }
  try {
    katex.renderToString(trimmed, {
      throwOnError: true,
      displayMode: false,
      strict: "warn",
    });
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : "Invalid math expression.",
    };
  }
}

export function renderLessonMathLatex(
  latex: string,
  options?: { displayMode?: boolean },
): { html: string; error?: string } {
  const trimmed = latex.trim();
  if (!trimmed) {
    return { html: "", error: "Empty math expression." };
  }
  try {
    const html = katex.renderToString(trimmed, {
      throwOnError: true,
      displayMode: options?.displayMode ?? false,
      strict: "warn",
    });
    return { html };
  } catch (error) {
    return {
      html: "",
      error: error instanceof Error ? error.message : "Could not render math.",
    };
  }
}
