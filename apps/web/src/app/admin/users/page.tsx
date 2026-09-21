import { UsersPage } from "@/features/manage-users";
import { AppShell } from "@/widgets/app-shell";

export default function Page() {
  return (
    <AppShell roles={["ADMIN"]}>
      <UsersPage />
    </AppShell>
  );
}
