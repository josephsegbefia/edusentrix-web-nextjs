import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type EmailPreferenceDTO = {
  _id: string;
  channels: {
    email?: boolean;
    inApp?: boolean;
    whatsapp?: boolean;
    sms?: boolean;
  };
  email: {
    immediate?: {
      attendance?: boolean;
      academics?: boolean;
      announcements?: boolean;
      billingReminders?: boolean;
      manualMessages?: boolean;
      lessonNoteReview?: boolean;
    };
    digest?: {
      daily?: boolean;
      weekly?: boolean;
    };
    urgentOnly?: boolean;
    quietHours?: {
      enabled?: boolean;
      startTime?: string;
      endTime?: string;
    };
    optOutCategories?: string[];
  };
  updatedAt?: string;
};

export function useEmailPreferences() {
  return useQuery<{ success: boolean; data: EmailPreferenceDTO | null }>({
    queryKey: ["email-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email/preferences", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch email preferences");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useUpdateEmailPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Partial<Pick<EmailPreferenceDTO, "channels" | "email">>,
    ) => {
      const res = await fetch("/api/admin/email/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-preferences"] });
    },
  });
}
