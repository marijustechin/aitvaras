"use client";

import { useAuth } from "@/features/auth";
import { AppShell } from "@/widgets/app-shell";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sveiki, {user?.firstName}.
        </h1>
        <p className="text-muted-foreground">
          Tai Aitvaro pradžia. Kol kas įgyvendinti naudotojų, partnerių ir
          išteklių moduliai.
        </p>
      </div>
    </AppShell>
  );
}
