export const EDUSENTRIX_LOGO_PATH = "/edusentrix-current-logo.png";
export const EDUSENTRIX_LOGO_ALT = "EduSentrix";

/** Logo gradient stops (purple → blue → cyan). */
export const EDUSENTRIX_GRADIENT = {
  start: "#7B16FF",
  mid: "#1E66FF",
  end: "#00E5FF",
} as const;

/** Wordmark gradient — matches the product logo (purple → blue → cyan). */
export const EDUSENTRIX_WORDMARK_GRADIENT = `linear-gradient(90deg, ${EDUSENTRIX_GRADIENT.start} 0%, ${EDUSENTRIX_GRADIENT.mid} 48%, ${EDUSENTRIX_GRADIENT.end} 100%)`;

export const EDUSENTRIX_WORDMARK_GRADIENT_STYLE = {
  background: EDUSENTRIX_WORDMARK_GRADIENT,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
} as const;
