// src/app/demo/layout.tsx
import { QueryProvider } from "@/providers/query-provider";
import { DemoProvider } from "@/components/demo";

export const metadata = {
  title: "EduSentrix Demo",
  description: "Experience EduSentrix - School Management System Demo",
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <DemoProvider>
        {children}
      </DemoProvider>
    </QueryProvider>
  );
}
