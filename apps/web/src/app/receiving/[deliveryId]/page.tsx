import { RECEIVING_ROLES } from "@/entities/batch";
import { ReceivingDeliveryPage } from "@/features/manage-batches";
import { AppShell } from "@/widgets/app-shell";

export default function Page() {
  return (
    <AppShell roles={RECEIVING_ROLES}>
      <ReceivingDeliveryPage />
    </AppShell>
  );
}
