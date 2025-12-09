import AppTopbar from "@/components/app/AppTopbar";
import { requireUser } from "@/lib/auth/get-current-user";

// add bg/text to ensure black base for all signed-in pages
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      <AppTopbar user={user} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
