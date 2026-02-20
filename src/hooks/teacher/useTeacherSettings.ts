import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type TeacherSettingsDTO = {
  id: string | null;
  locale: string;
  timezone: string;
  notifications: {
    inApp: {
      messages: boolean;
      notices: boolean;
      submissions: boolean;
      escalations: boolean;
      reminders: boolean;
    };
    email: {
      weeklyDigest: boolean;
      urgentOnly: boolean;
    };
  };
  whatsapp: {
    phoneNumber: string | null;
    linked: boolean;
    verified: boolean;
    linkedAt: string | null;
    verifiedAt: string | null;
    consentGiven: boolean;
    consentAt: string | null;
    featureFlags: {
      attendanceAlerts: boolean;
      noticeBroadcasts: boolean;
      assignmentReminders: boolean;
      submissionUpdates: boolean;
      escalationAlerts: boolean;
      weeklyDigest: boolean;
    };
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
    lastTestMessageAt: string | null;
    runtime: {
      backendEnforced: boolean;
      canSend: boolean;
      blockers: string[];
    };
  };
  capabilities: {
    schoolWhatsAppEnabled: boolean;
    whatsappProviderMode: "stub" | "stub_blocked_in_production" | "unsupported_provider";
    whatsappProviderReady: boolean;
    whatsappProviderMessage: string;
  };
  account: {
    displayName: string;
    email: string;
    photoUrl?: string;
    homeroomClassName?: string;
  };
  updatedAt: string | null;
};

export type TeacherSettingsResponse = {
  success: boolean;
  data: TeacherSettingsDTO;
};

export type UpdateTeacherSettingsInput = {
  locale?: string;
  timezone?: string;
  notifications?: {
    inApp?: Partial<TeacherSettingsDTO["notifications"]["inApp"]>;
    email?: Partial<TeacherSettingsDTO["notifications"]["email"]>;
  };
  whatsapp?: {
    phoneNumber?: string | null;
    linked?: boolean;
    consentGiven?: boolean;
    featureFlags?: Partial<TeacherSettingsDTO["whatsapp"]["featureFlags"]>;
    quietHours?: Partial<TeacherSettingsDTO["whatsapp"]["quietHours"]>;
  };
};

export function useTeacherSettings() {
  return useQuery<TeacherSettingsResponse>({
    queryKey: ["teacher-settings"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/settings", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch teacher settings");
      }
      return data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateTeacherSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTeacherSettingsInput) => {
      const res = await fetch("/api/teacher/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update settings");
      }
      return data as TeacherSettingsResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-settings"] });
    },
  });
}

export function useSendTeacherWhatsAppTestMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/teacher/settings/whatsapp/test", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send test message");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-settings"] });
    },
  });
}
