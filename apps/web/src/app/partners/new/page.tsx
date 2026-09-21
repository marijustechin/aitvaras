import { NewPartnerPage } from "@/features/manage-partners";
import { AppShell } from "@/widgets/app-shell";

export default function Page() {
  return (
    <AppShell roles={["ADMIN"]}>
      <NewPartnerPage />
    </AppShell>
  );
}
