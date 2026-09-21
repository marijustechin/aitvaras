import { NewResourcePage } from "@/features/manage-resources";
import { AppShell } from "@/widgets/app-shell";

export default function Page() {
  return (
    <AppShell roles={["ADMIN"]}>
      <NewResourcePage />
    </AppShell>
  );
}
