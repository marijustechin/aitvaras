import { redirect } from "next/navigation";

/**
 * There is one receiving list. The former `/receiving` open-receipts queue is
 * superseded by `/receipts`; the exact index redirects there. The new-receipt
 * form (`/receiving/new`) and the receipt/batch routes stay under `/receiving`.
 */
export default function Page() {
  redirect("/receipts");
}
