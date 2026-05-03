import AppTopbar from "@/components/app/AppTopbar";
import { requireUser } from "@/lib/auth/get-current-user";
import { InternalTestImpersonationBanner } from "@/components/internal-test/InternalTestImpersonationBanner";
import { NetworkStatusBanner } from "@/components/system/NetworkStatusBanner";
import ServiceWorkerRegister from "@/components/system/ServiceWorkerRegister";
import { isDemoMode } from "@/lib/demo/runtime";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { DemoBlockedInterceptor } from "@/components/demo/DemoBlockedDialog";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isDemo = isDemoMode();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {isDemo && <DemoBanner />}
      {isDemo && <DemoBlockedInterceptor />}
      {user.internalTestImpersonation ? (
        <InternalTestImpersonationBanner
          displayName={user.internalTestImpersonation.targetDisplayName}
          schoolId={user.internalTestImpersonation.schoolId}
        />
      ) : null}
      <AppTopbar user={user} />
      <NetworkStatusBanner />
      <ServiceWorkerRegister />
      <main className={`flex-1 overflow-x-hidden ${isDemo ? "pt-20" : "pt-14"}`}>
        {children}
      </main>
    </div>
  );
}
