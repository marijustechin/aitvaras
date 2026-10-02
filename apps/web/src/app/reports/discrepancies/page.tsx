import { DiscrepanciesPage } from "@/features/manage-discrepancies";
import { AppShell } from "@/widgets/app-shell";

export default function Page() {
  return (
    <AppShell roles={["ADMIN"]}>
      <DiscrepanciesPage />
    </AppShell>
  );
}
