import { RECEIVING_ROLES } from "@/entities/batch";
import { ReceivingPage } from "@/features/manage-batches";
import { AppShell } from "@/widgets/app-shell";

export default function Page() {
  return (
    <AppShell roles={RECEIVING_ROLES}>
      <ReceivingPage />
    </AppShell>
  );
}
