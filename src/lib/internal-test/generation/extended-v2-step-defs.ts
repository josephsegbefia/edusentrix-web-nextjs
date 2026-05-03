/** Optional extended generators after core_v1 (spec §14.1, Chunk 10). Each step may fail independently. */
export const EXTENDED_V2_STEP_DEFS = [
  { key: "curriculum_sow", label: "Curriculum & scheme of work (minimal)" },
  { key: "community_polls", label: "Community poll" },
  { key: "fundraising", label: "Fundraising campaign" },
  { key: "video_meetings", label: "Calendar & meeting (video-ready)" },
  { key: "vendors", label: "Vendor / supplier" },
  { key: "inventory_store", label: "Store inventory (sample product)" },
  { key: "ai_logs", label: "AI usage event (sample)" },
  { key: "analytics_usage", label: "Usage metric (analytics sample)" },
] as const;
