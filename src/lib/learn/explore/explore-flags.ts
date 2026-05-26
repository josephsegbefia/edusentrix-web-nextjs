/** Lazy class-scoped Explore (v2 models). Set to `0` or `false` to use legacy per-student adventures. */
export const USE_LAZY_EXPLORE =
  process.env.EDUSENTRIX_LEARN_LAZY_EXPLORE !== "0" &&
  process.env.EDUSENTRIX_LEARN_LAZY_EXPLORE !== "false";
