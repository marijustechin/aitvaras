import { DiscrepancyDetailsPage } from "@/features/manage-discrepancies";
import { AppShell } from "@/widgets/app-shell";

export default function Page() {
  return (
    <AppShell roles={["ADMIN"]}>
      <DiscrepancyDetailsPage />
    </AppShell>
  );
}
