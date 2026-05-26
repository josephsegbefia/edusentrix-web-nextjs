/** Mobile Learn overview v2 — mirrors EduSentrix Learn app contract */

export interface MobileStudentLearnOverview {
  header: {
    greeting: string;
    subtitle: string;
    studentName?: string;
    className?: string;
    dateLabel: string;
  };
  todayStats: {
    dateLabel: string;
    xpEarnedToday: number;
    streakDays: number;
    dailyQuestPercent: number;
    requiredReviewsCompleted: number;
    requiredReviewsTotal: number;
    streakProtected: boolean;
    streakMessage: string;
  };
  nextBestAction: MobileLearnNextBestAction | null;
  todayQuestBoard: MobileLearnQuestBoardSummary | null;
  leoRecommendations: MobileLearnLeoRecommendation[];
  continueLearning: MobileLearnContinueItem[];
  practiceAndRevision: {
    weakTopics: MobileLearnWeakTopic[];
    flashcardDecks: MobileLearnFlashcardDeck[];
    revisionBank: {
      count: number;
      message: string;
      nextRecommendedTopic?: {
        id: string;
        title: string;
        subjectName: string;
        route?: string;
      };
    };
    quickPractice?: MobileLearnQuickPractice[];
  };
  assignments: MobileLearnAssignmentSummary[];
  subjectPaths: MobileLearnSubjectPath[];
  exploreUnlocks: MobileLearnExploreUnlock[];
  examPrep: MobileLearnExamPrep | null;
  moreLearningModes: MobileLearnModeCard[];
  generatedAt: string;
}

export interface MobileLearnNextBestAction {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  reason: string;
  ctaLabel: string;
  route: string;
  routeParams?: Record<string, string>;
  estimatedMinutes?: number;
  xpReward?: number;
  urgency: "low" | "normal" | "high";
  displayPriority: number;
  leoContext?: Record<string, string>;
}

export interface MobileLearnQuestBoardSummary {
  boardId: string;
  date: string;
  title: string;
  completionPercent: number;
  completedRequiredItems: number;
  totalRequiredItems: number;
  xpEarned: number;
  totalXpAvailable: number;
  streakProtected: boolean;
  status: string;
  nextItem?: {
    id: string;
    title: string;
    subjectName: string;
    estimatedMinutes: number;
    route: string;
    routeParams?: Record<string, string>;
  };
  catchUpSummary?: { count: number; message: string };
}

export interface MobileLearnLeoRecommendation {
  id: string;
  type: string;
  title: string;
  message: string;
  reason: string;
  ctaLabel: string;
  action: string;
  targetId?: string;
  context?: Record<string, string>;
  priority: "low" | "normal" | "high";
}

export interface MobileLearnContinueItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  subjectName: string;
  progressPercent: number;
  estimatedMinutes?: number;
  status: string;
  route: string;
  routeParams?: Record<string, string>;
  leoContext?: Record<string, string>;
}

export interface MobileLearnWeakTopic {
  id: string;
  subjectName: string;
  title: string;
  confidenceLevel: "low" | "medium" | "improving";
  reason: string;
  recommendedAction: string;
  route?: string;
  leoContext?: Record<string, string>;
}

export interface MobileLearnFlashcardDeck {
  id: string;
  title: string;
  subjectName: string;
  masteredCards: number;
  totalCards: number;
  route: string;
}

export interface MobileLearnQuickPractice {
  id: string;
  title: string;
  subjectName: string;
  estimatedMinutes: number;
  route: string;
}

export interface MobileLearnAssignmentSummary {
  id: string;
  title: string;
  subjectName: string;
  dueLabel: string;
  urgency: "low" | "normal" | "high";
  status: string;
  route: string;
  leoSupportAllowed: boolean;
  leoContext?: Record<string, string>;
}

export interface MobileLearnSubjectPath {
  id: string;
  subjectId: string;
  subjectName: string;
  masteryPercent: number;
  currentTopic?: { id: string; title: string; status: string };
  nextTopic?: { id: string; title: string; locked: boolean; lockedReason?: string };
  weakTopicCount: number;
  exploreAvailable: boolean;
  route: string;
  leoContext?: Record<string, string>;
}

export interface MobileLearnExploreUnlock {
  id: string;
  lessonId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  description: string;
  status: "available" | "generating" | "locked" | "completed";
  reason: string;
  route: string;
  routeParams?: Record<string, string>;
  adventureId?: string;
}

export interface MobileLearnExamPrep {
  active: boolean;
  title: string;
  subtitle: string;
  upcomingExamLabel?: string;
  readinessPercent?: number;
  recommendedAction?: string;
  route: string;
  displayPriority?: number;
}

export interface MobileLearnModeCard {
  id: string;
  title: string;
  description: string;
  iconName?: string;
  status: "enabled" | "locked" | "coming_soon";
  badge?: string;
  route?: string;
  displayPriority: number;
  featureFlag?: string;
}

export interface MobileLearnOverviewEnvelope {
  overviewVersion: 2;
  data: MobileStudentLearnOverview;
}
