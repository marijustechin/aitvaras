"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/auth-provider";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sveiki, {user?.firstName}.
        </h1>
        <p className="text-muted-foreground">
          Tai Aitvaro identiteto ir prieigos pagrindas. Verslo funkcijos dar
          neįgyvendintos.
        </p>
      </div>
    </AppShell>
  );
}
