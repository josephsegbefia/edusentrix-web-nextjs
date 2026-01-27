// src/constants/poll-templates.ts
/**
 * Default poll templates for the platform.
 * These are seeded when the system initializes and available to all schools.
 */

import type { TemplateCategory, TemplateAudienceType, ITemplateDefaults, ITemplateQuestion } from "@/models/PollTemplate";
import type { AudienceScope, RevealResults, PollQuestionType } from "@/models/CommunityPoll";

interface PollTemplateData {
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  color: string;
  questions: ITemplateQuestion[];
  defaults: ITemplateDefaults;
}

// ============================================================================
// Wellbeing Templates
// ============================================================================

const WELLBEING_TEMPLATES: PollTemplateData[] = [
  {
    name: "Weekly Mood Check-In",
    description: "Quick weekly check-in to understand how students are feeling. Great for identifying students who may need support.",
    category: "wellbeing",
    icon: "heart",
    color: "rose",
    questions: [
      {
        prompt: "How are you feeling today?",
        description: "Choose the emoji that best represents your mood",
        type: "single_choice",
        options: [
          { label: "😊 Great!", order: 0 },
          { label: "🙂 Good", order: 1 },
          { label: "😐 Okay", order: 2 },
          { label: "😔 Not great", order: 3 },
          { label: "😢 Struggling", order: 4 },
        ],
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "Is there anything you'd like to share about how you're feeling?",
        description: "This is optional and confidential",
        type: "comment",
        required: false,
        allowOther: false,
        order: 1,
      },
    ],
    defaults: {
      durationDays: 2,
      anonymity: "admin_only",
      revealResults: "admin_only",
      allowComments: false,
      minResponseRate: 70,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: false,
    },
  },
  {
    name: "Classroom Comfort Survey",
    description: "Assess whether students feel safe, comfortable, and supported in the classroom environment.",
    category: "wellbeing",
    icon: "shield",
    color: "emerald",
    questions: [
      {
        prompt: "Do you feel safe in your classroom?",
        type: "yes_no",
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "Do you feel comfortable asking questions in class?",
        type: "yes_no",
        required: true,
        allowOther: false,
        order: 1,
      },
      {
        prompt: "Do you have friends you can work with in class?",
        type: "yes_no",
        required: true,
        allowOther: false,
        order: 2,
      },
      {
        prompt: "How comfortable are you participating in class discussions?",
        type: "likert",
        required: true,
        allowOther: false,
        order: 3,
      },
      {
        prompt: "Is there anything that would make you feel more comfortable in class?",
        type: "comment",
        required: false,
        allowOther: false,
        order: 4,
      },
    ],
    defaults: {
      durationDays: 5,
      anonymity: "anonymous",
      revealResults: "after_close",
      allowComments: false,
      minResponseRate: 60,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
  {
    name: "Student Stress Check",
    description: "Understand student stress levels, especially useful before exams or major events.",
    category: "wellbeing",
    icon: "activity",
    color: "amber",
    questions: [
      {
        prompt: "How stressed are you feeling about schoolwork right now?",
        type: "likert",
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "Are you getting enough sleep?",
        type: "single_choice",
        options: [
          { label: "Yes, I sleep well", order: 0 },
          { label: "Sometimes", order: 1 },
          { label: "No, I often feel tired", order: 2 },
        ],
        required: true,
        allowOther: false,
        order: 1,
      },
      {
        prompt: "What is causing you the most stress? (Select all that apply)",
        type: "multi_choice",
        options: [
          { label: "Homework and assignments", order: 0 },
          { label: "Upcoming exams", order: 1 },
          { label: "Relationships with classmates", order: 2 },
          { label: "Issues at home", order: 3 },
          { label: "Time management", order: 4 },
          { label: "Nothing specific, I'm fine", order: 5 },
        ],
        required: true,
        allowOther: true,
        order: 2,
      },
    ],
    defaults: {
      durationDays: 3,
      anonymity: "anonymous",
      revealResults: "admin_only",
      allowComments: false,
      minResponseRate: 60,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
];

// ============================================================================
// Academic Feedback Templates
// ============================================================================

const ACADEMIC_TEMPLATES: PollTemplateData[] = [
  {
    name: "Subject Understanding Check",
    description: "Quick check to see if students are following along with the current topic.",
    category: "academic",
    icon: "book-open",
    color: "blue",
    questions: [
      {
        prompt: "How well do you understand what we've been learning this week?",
        type: "likert",
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "Is the pace of the class...",
        type: "single_choice",
        options: [
          { label: "Too fast - I need more time", order: 0 },
          { label: "Just right", order: 1 },
          { label: "Too slow - I could go faster", order: 2 },
        ],
        required: true,
        allowOther: false,
        order: 1,
      },
      {
        prompt: "What topic would you like us to review or explain more?",
        type: "comment",
        required: false,
        allowOther: false,
        order: 2,
      },
    ],
    defaults: {
      durationDays: 3,
      anonymity: "anonymous",
      revealResults: "after_close",
      allowComments: false,
      minResponseRate: 60,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
  {
    name: "Teaching Feedback Survey",
    description: "Anonymous feedback from students about teaching methods and classroom experience.",
    category: "academic",
    icon: "message-square",
    color: "violet",
    questions: [
      {
        prompt: "The teacher explains concepts clearly",
        type: "likert",
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "The teacher is approachable and helpful",
        type: "likert",
        required: true,
        allowOther: false,
        order: 1,
      },
      {
        prompt: "The homework assignments help me learn",
        type: "likert",
        required: true,
        allowOther: false,
        order: 2,
      },
      {
        prompt: "What do you enjoy most about this class?",
        type: "comment",
        required: false,
        allowOther: false,
        order: 3,
      },
      {
        prompt: "What could make this class better?",
        type: "comment",
        required: false,
        allowOther: false,
        order: 4,
      },
    ],
    defaults: {
      durationDays: 7,
      anonymity: "anonymous",
      revealResults: "admin_only",
      allowComments: false,
      minResponseRate: 50,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
  {
    name: "Homework Load Survey",
    description: "Understand if the homework load is appropriate for students.",
    category: "academic",
    icon: "clipboard",
    color: "orange",
    questions: [
      {
        prompt: "How long do you typically spend on homework each day?",
        type: "single_choice",
        options: [
          { label: "Less than 30 minutes", order: 0 },
          { label: "30 minutes to 1 hour", order: 1 },
          { label: "1 to 2 hours", order: 2 },
          { label: "More than 2 hours", order: 3 },
        ],
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "The amount of homework I receive is...",
        type: "single_choice",
        options: [
          { label: "Too little", order: 0 },
          { label: "Just right", order: 1 },
          { label: "A bit too much", order: 2 },
          { label: "Way too much", order: 3 },
        ],
        required: true,
        allowOther: false,
        order: 1,
      },
      {
        prompt: "I usually complete my homework...",
        type: "single_choice",
        options: [
          { label: "Always on time", order: 0 },
          { label: "Usually on time", order: 1 },
          { label: "Sometimes late", order: 2 },
          { label: "Often late or incomplete", order: 3 },
        ],
        required: true,
        allowOther: false,
        order: 2,
      },
    ],
    defaults: {
      durationDays: 5,
      anonymity: "anonymous",
      revealResults: "after_close",
      allowComments: false,
      minResponseRate: 60,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
];

// ============================================================================
// Decision/Voting Templates
// ============================================================================

const DECISION_TEMPLATES: PollTemplateData[] = [
  {
    name: "Activity Vote",
    description: "Let students vote on class activities, field trips, or event options.",
    category: "decision",
    icon: "vote",
    color: "indigo",
    questions: [
      {
        prompt: "Which activity would you prefer?",
        description: "Select your top choice",
        type: "single_choice",
        options: [
          { label: "Option 1", order: 0 },
          { label: "Option 2", order: 1 },
          { label: "Option 3", order: 2 },
        ],
        required: true,
        allowOther: false,
        order: 0,
      },
    ],
    defaults: {
      durationDays: 3,
      anonymity: "anonymous",
      revealResults: "after_close",
      allowComments: false,
      minResponseRate: 70,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
  {
    name: "Field Trip Preference",
    description: "Vote on field trip destinations or dates.",
    category: "decision",
    icon: "map-pin",
    color: "teal",
    questions: [
      {
        prompt: "Rank your preferred field trip destinations",
        description: "Drag to order from most preferred (top) to least preferred (bottom)",
        type: "ranked_choice",
        options: [
          { label: "Destination 1", order: 0 },
          { label: "Destination 2", order: 1 },
          { label: "Destination 3", order: 2 },
        ],
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "Are you able to attend a field trip?",
        type: "yes_no",
        required: true,
        allowOther: false,
        order: 1,
      },
    ],
    defaults: {
      durationDays: 5,
      anonymity: "identified",
      revealResults: "after_close",
      allowComments: false,
      minResponseRate: 80,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
  {
    name: "Event Theme Vote",
    description: "Vote on themes for school or class events.",
    category: "decision",
    icon: "sparkles",
    color: "pink",
    questions: [
      {
        prompt: "Which theme would you like for our event?",
        type: "single_choice",
        options: [
          { label: "Theme 1", order: 0 },
          { label: "Theme 2", order: 1 },
          { label: "Theme 3", order: 2 },
          { label: "Theme 4", order: 3 },
        ],
        required: true,
        allowOther: true,
        order: 0,
      },
    ],
    defaults: {
      durationDays: 3,
      anonymity: "anonymous",
      revealResults: "live",
      allowComments: false,
      minResponseRate: 60,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
];

// ============================================================================
// Parent Templates
// ============================================================================

const PARENT_TEMPLATES: PollTemplateData[] = [
  {
    name: "Parent-Teacher Meeting Availability",
    description: "Find out when parents are available for meetings.",
    category: "parent",
    icon: "calendar",
    color: "cyan",
    questions: [
      {
        prompt: "Which day works best for you?",
        type: "multi_choice",
        options: [
          { label: "Monday", order: 0 },
          { label: "Tuesday", order: 1 },
          { label: "Wednesday", order: 2 },
          { label: "Thursday", order: 3 },
          { label: "Friday", order: 4 },
        ],
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "Which time slot works best for you?",
        type: "multi_choice",
        options: [
          { label: "Morning (8am - 12pm)", order: 0 },
          { label: "Afternoon (12pm - 4pm)", order: 1 },
          { label: "Evening (4pm - 7pm)", order: 2 },
        ],
        required: true,
        allowOther: false,
        order: 1,
      },
      {
        prompt: "Do you prefer in-person or virtual meetings?",
        type: "single_choice",
        options: [
          { label: "In-person", order: 0 },
          { label: "Virtual (video call)", order: 1 },
          { label: "Either is fine", order: 2 },
        ],
        required: true,
        allowOther: false,
        order: 2,
      },
    ],
    defaults: {
      durationDays: 7,
      anonymity: "identified",
      revealResults: "admin_only",
      allowComments: false,
      minResponseRate: 60,
      audienceScope: "class",
      audienceType: "parents",
      requiresApproval: true,
    },
  },
  {
    name: "Parent Satisfaction Survey",
    description: "Gather feedback from parents about their experience with the school.",
    category: "parent",
    icon: "star",
    color: "amber",
    questions: [
      {
        prompt: "Overall, how satisfied are you with your child's education?",
        type: "likert",
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "How well does the school communicate with you?",
        type: "likert",
        required: true,
        allowOther: false,
        order: 1,
      },
      {
        prompt: "How satisfied are you with the school's facilities?",
        type: "likert",
        required: true,
        allowOther: false,
        order: 2,
      },
      {
        prompt: "Would you recommend this school to other parents?",
        type: "yes_no",
        required: true,
        allowOther: false,
        order: 3,
      },
      {
        prompt: "What could the school do better?",
        type: "comment",
        required: false,
        allowOther: false,
        order: 4,
      },
    ],
    defaults: {
      durationDays: 14,
      anonymity: "anonymous",
      revealResults: "admin_only",
      allowComments: false,
      minResponseRate: 40,
      audienceScope: "school",
      audienceType: "parents",
      requiresApproval: false,
    },
  },
  {
    name: "Volunteer Interest Survey",
    description: "Find parents willing to help with school activities and events.",
    category: "parent",
    icon: "hand-helping",
    color: "emerald",
    questions: [
      {
        prompt: "Would you be interested in volunteering for school activities?",
        type: "yes_no",
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "Which activities would you be willing to help with? (Select all that apply)",
        type: "multi_choice",
        options: [
          { label: "Field trips", order: 0 },
          { label: "Sports day / Athletics", order: 1 },
          { label: "Cultural events", order: 2 },
          { label: "Classroom assistance", order: 3 },
          { label: "Fundraising events", order: 4 },
          { label: "PTA meetings", order: 5 },
        ],
        required: false,
        allowOther: true,
        order: 1,
      },
    ],
    defaults: {
      durationDays: 10,
      anonymity: "identified",
      revealResults: "admin_only",
      allowComments: false,
      minResponseRate: 30,
      audienceScope: "school",
      audienceType: "parents",
      requiresApproval: false,
    },
  },
];

// ============================================================================
// Quick Poll Templates
// ============================================================================

const QUICK_TEMPLATES: PollTemplateData[] = [
  {
    name: "Yes/No Quick Poll",
    description: "Simple yes or no question for quick decisions.",
    category: "quick",
    icon: "check-circle",
    color: "green",
    questions: [
      {
        prompt: "Your question here",
        type: "yes_no",
        required: true,
        allowOther: false,
        order: 0,
      },
    ],
    defaults: {
      durationDays: 1,
      anonymity: "anonymous",
      revealResults: "live",
      allowComments: false,
      minResponseRate: 50,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
  {
    name: "Rating Poll",
    description: "Get a quick rating on something (1-5 scale).",
    category: "quick",
    icon: "star",
    color: "yellow",
    questions: [
      {
        prompt: "Rate this on a scale of 1-5",
        type: "likert",
        required: true,
        allowOther: false,
        order: 0,
      },
    ],
    defaults: {
      durationDays: 1,
      anonymity: "anonymous",
      revealResults: "live",
      allowComments: false,
      minResponseRate: 50,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
  {
    name: "Multiple Choice Quick Poll",
    description: "Quick poll with multiple options to choose from.",
    category: "quick",
    icon: "list",
    color: "blue",
    questions: [
      {
        prompt: "Choose one option",
        type: "single_choice",
        options: [
          { label: "Option A", order: 0 },
          { label: "Option B", order: 1 },
          { label: "Option C", order: 2 },
        ],
        required: true,
        allowOther: false,
        order: 0,
      },
    ],
    defaults: {
      durationDays: 1,
      anonymity: "anonymous",
      revealResults: "live",
      allowComments: false,
      minResponseRate: 50,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
];

// ============================================================================
// Election Templates
// ============================================================================

const ELECTION_TEMPLATES: PollTemplateData[] = [
  {
    name: "Class Prefect Election",
    description: "Vote for class prefect or other class leadership positions.",
    category: "election",
    icon: "award",
    color: "purple",
    questions: [
      {
        prompt: "Who would you like as Class Prefect?",
        description: "Vote for one candidate",
        type: "single_choice",
        options: [
          { label: "Candidate 1", order: 0 },
          { label: "Candidate 2", order: 1 },
          { label: "Candidate 3", order: 2 },
        ],
        required: true,
        allowOther: false,
        order: 0,
      },
    ],
    defaults: {
      durationDays: 3,
      anonymity: "anonymous",
      revealResults: "after_close",
      allowComments: false,
      minResponseRate: 75,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
  {
    name: "Ranked Choice Election",
    description: "Election with ranked choice voting for fairer results.",
    category: "election",
    icon: "trophy",
    color: "gold",
    questions: [
      {
        prompt: "Rank the candidates in order of preference",
        description: "Your first choice is most preferred",
        type: "ranked_choice",
        options: [
          { label: "Candidate 1", order: 0 },
          { label: "Candidate 2", order: 1 },
          { label: "Candidate 3", order: 2 },
          { label: "Candidate 4", order: 3 },
        ],
        required: true,
        allowOther: false,
        order: 0,
      },
    ],
    defaults: {
      durationDays: 3,
      anonymity: "anonymous",
      revealResults: "after_close",
      allowComments: false,
      minResponseRate: 80,
      audienceScope: "class",
      audienceType: "students",
      requiresApproval: true,
    },
  },
];

// ============================================================================
// Feedback Templates
// ============================================================================

const FEEDBACK_TEMPLATES: PollTemplateData[] = [
  {
    name: "Event Feedback",
    description: "Collect feedback after a school event.",
    category: "feedback",
    icon: "clipboard-check",
    color: "sky",
    questions: [
      {
        prompt: "Did you attend the event?",
        type: "yes_no",
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "How would you rate the event overall?",
        type: "likert",
        required: true,
        allowOther: false,
        order: 1,
      },
      {
        prompt: "What did you enjoy most about the event?",
        type: "comment",
        required: false,
        allowOther: false,
        order: 2,
      },
      {
        prompt: "What could be improved for next time?",
        type: "comment",
        required: false,
        allowOther: false,
        order: 3,
      },
    ],
    defaults: {
      durationDays: 5,
      anonymity: "anonymous",
      revealResults: "after_close",
      allowComments: false,
      minResponseRate: 40,
      audienceScope: "school",
      audienceType: "all",
      requiresApproval: false,
    },
  },
  {
    name: "Cafeteria Feedback",
    description: "Gather feedback about school cafeteria and meals.",
    category: "feedback",
    icon: "utensils",
    color: "orange",
    questions: [
      {
        prompt: "How satisfied are you with the cafeteria food?",
        type: "likert",
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "Is the food variety sufficient?",
        type: "yes_no",
        required: true,
        allowOther: false,
        order: 1,
      },
      {
        prompt: "Is the cafeteria clean and hygienic?",
        type: "likert",
        required: true,
        allowOther: false,
        order: 2,
      },
      {
        prompt: "What would you like to see on the menu?",
        type: "comment",
        required: false,
        allowOther: false,
        order: 3,
      },
    ],
    defaults: {
      durationDays: 7,
      anonymity: "anonymous",
      revealResults: "after_close",
      allowComments: false,
      minResponseRate: 50,
      audienceScope: "school",
      audienceType: "students",
      requiresApproval: false,
    },
  },
];

// ============================================================================
// Administrative Templates
// ============================================================================

const ADMINISTRATIVE_TEMPLATES: PollTemplateData[] = [
  {
    name: "Communication Preference Survey",
    description: "Understand how parents and staff prefer to receive school communications.",
    category: "administrative",
    icon: "mail",
    color: "slate",
    questions: [
      {
        prompt: "How would you prefer to receive school updates? (Select all that apply)",
        type: "multi_choice",
        options: [
          { label: "School app notifications", order: 0 },
          { label: "Email", order: 1 },
          { label: "SMS/Text message", order: 2 },
          { label: "WhatsApp", order: 3 },
          { label: "Printed letters", order: 4 },
        ],
        required: true,
        allowOther: false,
        order: 0,
      },
      {
        prompt: "How often would you like to receive updates?",
        type: "single_choice",
        options: [
          { label: "Daily", order: 0 },
          { label: "Weekly", order: 1 },
          { label: "Only for important announcements", order: 2 },
        ],
        required: true,
        allowOther: false,
        order: 1,
      },
    ],
    defaults: {
      durationDays: 14,
      anonymity: "identified",
      revealResults: "admin_only",
      allowComments: false,
      minResponseRate: 40,
      audienceScope: "school",
      audienceType: "parents",
      requiresApproval: false,
    },
  },
];

// ============================================================================
// Export All Templates
// ============================================================================

export const POLL_TEMPLATES: PollTemplateData[] = [
  ...WELLBEING_TEMPLATES,
  ...ACADEMIC_TEMPLATES,
  ...DECISION_TEMPLATES,
  ...PARENT_TEMPLATES,
  ...QUICK_TEMPLATES,
  ...ELECTION_TEMPLATES,
  ...FEEDBACK_TEMPLATES,
  ...ADMINISTRATIVE_TEMPLATES,
];

export const POLL_TEMPLATE_CATEGORIES = [
  { id: "wellbeing", name: "Student Wellbeing", icon: "heart", color: "rose", description: "Check-ins for student mental health and comfort" },
  { id: "academic", name: "Academic Feedback", icon: "book-open", color: "blue", description: "Teaching and learning feedback" },
  { id: "decision", name: "Decisions & Voting", icon: "vote", color: "indigo", description: "Polls for class and school decisions" },
  { id: "parent", name: "Parent Engagement", icon: "users", color: "cyan", description: "Surveys for parents" },
  { id: "quick", name: "Quick Polls", icon: "zap", color: "yellow", description: "Fast, simple single-question polls" },
  { id: "election", name: "Elections", icon: "award", color: "purple", description: "Class and school elections" },
  { id: "feedback", name: "Feedback", icon: "message-circle", color: "sky", description: "Event and facility feedback" },
  { id: "administrative", name: "Administrative", icon: "settings", color: "slate", description: "Operational and communication preferences" },
] as const;
