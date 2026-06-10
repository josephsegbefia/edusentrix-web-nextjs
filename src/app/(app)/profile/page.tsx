"use client";

import * as React from "react";
import Image from "next/image";
import { UserProfile, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  Camera,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { useToast } from "@/hooks/useToast";

type ProfileDTO = {
  _id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  avatarPublicId: string;
  role: string | null;
  schoolId: string | null;
  school: {
    _id: string;
    name: string;
    logo: string | null;
  } | null;
  dateOfBirth: string;
  address: string;
  createdAt: string;
  updatedAt: string;
};

type ProfileForm = Pick<
  ProfileDTO,
  "email" | "phone" | "avatarUrl" | "avatarPublicId" | "dateOfBirth" | "address"
>;

function roleLabel(role: string | null) {
  if (!role) return "User";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function avatarUploadRole(role: string | null) {
  switch (role) {
    case "teacher":
      return "teachers" as const;
    case "parent":
      return "parents" as const;
    case "student":
      return "students" as const;
    case "bursar":
      return "bursars" as const;
    case "staff":
      return "staff" as const;
    case "school_admin":
    case "billing_owner":
      return "school_admins" as const;
    default:
      return null;
  }
}

function buildForm(profile: ProfileDTO): ProfileForm {
  return {
    email: profile.email || "",
    phone: profile.phone || "",
    avatarUrl: profile.avatarUrl || "",
    avatarPublicId: profile.avatarPublicId || "",
    dateOfBirth: profile.dateOfBirth || "",
    address: profile.address || "",
  };
}

async function readProfile() {
  const res = await fetch("/api/account/profile", { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to load profile");
  }
  return json.data as ProfileDTO;
}

async function saveProfile(payload: ProfileForm) {
  const res = await fetch("/api/account/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: payload.email,
      phone: payload.phone || null,
      avatarUrl: payload.avatarUrl || null,
      avatarPublicId: payload.avatarPublicId || null,
      dateOfBirth: payload.dateOfBirth || null,
      address: payload.address || null,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update profile");
  }
  return json.data as ProfileDTO;
}

async function deleteAccount() {
  const res = await fetch("/api/account/profile", { method: "DELETE" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || "Failed to delete account");
  }
}

export default function ProfilePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { signOut } = useClerk();
  const [form, setForm] = React.useState<ProfileForm | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const profileQuery = useQuery({
    queryKey: ["account-profile"],
    queryFn: readProfile,
  });

  React.useEffect(() => {
    if (profileQuery.data) {
      setForm(buildForm(profileQuery.data));
    }
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(["account-profile"], profile);
      setForm(buildForm(profile));
      toast.success("Profile saved", {
        description: "Your profile details have been updated.",
      });
      router.refresh();
    },
    onError: (error) => {
      toast.error("Profile update failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      toast.success("Account deleted");
      await signOut();
      window.location.href = "/sign-in";
    },
    onError: (error) => {
      toast.error("Account deletion failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading || !form;
  const uploadRole = avatarUploadRole(profile?.role || null);
  const canUploadAvatar = Boolean(profile?.schoolId && uploadRole);
  const initials =
    (profile?.name || profile?.email || "?")
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const isDirty = Boolean(
    profile &&
      form &&
      JSON.stringify(buildForm(profile)) !== JSON.stringify(form),
  );
  const canSave =
    Boolean(form?.email.trim()) && isDirty && !updateMutation.isPending;

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black p-6 shadow-2xl shadow-black/30">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-white/10 bg-white/5">
                {form?.avatarUrl ? (
                  <AvatarImage src={form.avatarUrl} alt={profile?.name || "Profile"} />
                ) : (
                  <AvatarFallback className="bg-white/10 text-lg font-semibold text-white">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                    Profile
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                  >
                    {roleLabel(profile?.role || null)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-white/55">
                  Manage your account details. Password management is handled by Clerk.
                </p>
              </div>
            </div>
            {profile?.school ? (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                {profile.school.logo ? (
                  <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-white">
                    <Image
                      src={profile.school.logo}
                      alt={profile.school.name}
                      fill
                      sizes="36px"
                      className="object-contain p-1"
                    />
                  </div>
                ) : (
                  <UserCircle2 className="h-8 w-8 text-white/35" />
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/35">
                    Workspace
                  </p>
                  <p className="text-sm font-medium text-white/80">
                    {profile.school.name}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {profileQuery.isError ? (
          <Card className="border border-red-500/20 bg-red-500/10">
            <CardContent className="p-6 text-sm text-red-200">
              {profileQuery.error instanceof Error
                ? profileQuery.error.message
                : "Profile could not be loaded."}
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90">
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-white/5" />
              ))}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
              <CardContent className="space-y-6 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
                    <UserCircle2 className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Account Details
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                      Your name is locked to your verified identity. Other profile details can be updated here.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/70">Name</Label>
                    <Input
                      value={profile?.name || ""}
                      readOnly
                      className="border-white/10 bg-white/5 text-white/60"
                    />
                    <p className="text-xs text-white/40">
                      Contact support if your legal name needs to change.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">
                      <Mail className="h-4 w-4" />
                      Email
                    </Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, email: event.target.value } : current,
                        )
                      }
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">
                      <Phone className="h-4 w-4" />
                      Phone
                    </Label>
                    <Input
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, phone: event.target.value } : current,
                        )
                      }
                      placeholder="Optional phone number"
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">
                      <Calendar className="h-4 w-4" />
                      Date of Birth
                    </Label>
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, dateOfBirth: event.target.value }
                            : current,
                        )
                      }
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/70">Address</Label>
                  <Textarea
                    value={form.address}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, address: event.target.value } : current,
                      )
                    }
                    rows={4}
                    placeholder="Optional address"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
                    <Camera className="h-5 w-5 text-violet-200" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Profile Photo
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                      Upload a photo when your account belongs to a school workspace, or paste an image URL.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                    {form.avatarUrl ? (
                      <Image
                        src={form.avatarUrl}
                        alt={profile?.name || "Profile photo"}
                        width={144}
                        height={144}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle2 className="h-16 w-16 text-white/30" />
                    )}
                  </div>
                  <div className="space-y-4">
                    {canUploadAvatar && profile?.schoolId && uploadRole ? (
                      <ImageUploader
                        schoolId={profile.schoolId}
                        subjectRole={uploadRole}
                        label="Upload profile photo"
                        initialPreviewUrl={form.avatarUrl}
                        onUploaded={(payload) =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  avatarUrl: payload.url,
                                  avatarPublicId: payload.publicId,
                                }
                              : current,
                          )
                        }
                      />
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-white/70">Image URL</Label>
                      <Input
                        value={form.avatarUrl}
                        onChange={(event) =>
                          setForm((current) =>
                            current
                              ? { ...current, avatarUrl: event.target.value }
                              : current,
                          )
                        }
                        placeholder="https://..."
                        className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                    <KeyRound className="h-5 w-5 text-emerald-200" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Password & Security
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                      Update your password through Clerk&apos;s secure account
                      controls. EduSentrix never stores your password.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
                  <UserProfile
                    routing="hash"
                    appearance={{
                      variables: {
                        colorPrimary: "#06b6d4",
                        colorText: "#ffffff",
                        colorTextSecondary: "#9aa3b2",
                        colorBackground: "transparent",
                        colorInputBackground: "#0b0f1a",
                        colorInputText: "#ffffff",
                        borderRadius: "0.75rem",
                        fontFamily: "Inter, ui-sans-serif, system-ui",
                      },
                      elements: {
                        rootBox: "w-full",
                        card: "bg-transparent border-0 p-0 shadow-none",
                        navbar: "hidden",
                        headerTitle: "hidden",
                        headerSubtitle: "hidden",
                        profileSection__accountSecurity: "block",
                        profileSection__activeDevices: "hidden",
                        profileSection__connectedAccounts: "hidden",
                        profileSection__emailAddresses: "hidden",
                        profileSection__phoneNumbers: "hidden",
                        profileSection__mfa: "hidden",
                        formButtonPrimary:
                          "bg-[#06b6d4] hover:bg-[#06b6d4]/90 text-black font-medium rounded-lg transition-all shadow-lg shadow-[#06b6d4]/20 h-11",
                        formFieldInput:
                          "bg-[#0b0f1a] border-white/10 text-white placeholder:text-white/35 focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20 rounded-lg",
                        formFieldLabel: "text-white text-sm font-medium mb-2",
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-white/55">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                Password and session security are managed securely by Clerk.
              </div>
              <Button
                onClick={() => form && updateMutation.mutate(form)}
                disabled={!canSave}
                className="gap-2 bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-600 hover:to-blue-700"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Profile
              </Button>
            </div>

            <Card className="border border-red-500/20 bg-red-500/5">
              <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Delete Account
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-white/55">
                      This permanently deletes your user account and removes your Clerk login. School records created by you may remain for audit and operational history.
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="This will permanently remove your account and Clerk login. You will be signed out immediately after deletion."
        confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete account"}
        cancelLabel="Keep account"
        intent="destructive"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
