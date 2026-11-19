import { ReceiptManagerPage } from "@/features/manage-batches";
import { AppShell } from "@/widgets/app-shell";

export default function Page() {
  return (
    <AppShell roles={["ADMIN"]}>
      <ReceiptManagerPage />
    </AppShell>
  );
}
