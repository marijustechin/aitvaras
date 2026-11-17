import { CompanySettingsPage } from "@/features/manage-company-settings";
import { AppShell } from "@/widgets/app-shell";

export default function Page() {
  return (
    <AppShell roles={["ADMIN"]}>
      <CompanySettingsPage />
    </AppShell>
  );
}
