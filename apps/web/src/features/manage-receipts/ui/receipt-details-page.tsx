"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { GoodsReceipt } from "@aitvaras/contracts";
import { formatMoney, formatReceiptDate, receiptLocationLabel, receiptUnitLabel } from "@/entities/receipt";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";

/** Read-only receipt detail. No edit/delete/cancel yet. */
export function ReceiptDetailsPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { clearSession } = useAuth();

  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setReceipt(await apiFetch<GoodsReceipt>(`/receipts/${id}`));
      setError(null);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (caught instanceof ApiError && caught.status === 404) {
        setError("Pajamavimas nerastas.");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Nepavyko įkelti pajamavimo");
    } finally {
      setLoading(false);
    }
  }, [clearSession, id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Kraunama…</p>;
  }

  if (error || !receipt) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive">
          {error ?? "Pajamavimas nerastas."}
        </p>
        <Link href="/receipts" className="text-sm hover:underline">
          ← Pajamavimas
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pajamavimas</h1>

      <section className="rounded-xl border border-border bg-card p-6">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium">Data</dt>
            <dd className="text-sm text-muted-foreground">
              {formatReceiptDate(receipt.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">Partneris</dt>
            <dd className="text-sm text-muted-foreground">
              {receipt.partnerName}
            </dd>
          </div>
        </dl>

        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Išteklius</th>
                <th className="px-4 py-2 font-medium">Kiekis</th>
                <th className="px-4 py-2 font-medium">Matavimo vnt.</th>
                <th className="px-4 py-2 font-medium">Vieneto kaina</th>
                <th className="px-4 py-2 font-medium">Sandėlis</th>
                <th className="px-4 py-2 font-medium">Vieta</th>
                <th className="px-4 py-2 font-medium">Suma</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="px-4 py-2">{line.resourceName}</td>
                  <td className="px-4 py-2">{line.quantity}</td>
                  <td className="px-4 py-2">{receiptUnitLabel(line.unit)}</td>
                  <td className="px-4 py-2">{formatMoney(line.unitPrice)}</td>
                  <td className="px-4 py-2">{line.warehouseName}</td>
                  <td className="px-4 py-2">
                    {receiptLocationLabel(line.warehouseLocationName)}
                  </td>
                  <td className="px-4 py-2">{formatMoney(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td className="px-4 py-2 font-medium" colSpan={6}>
                  Iš viso
                </td>
                <td className="px-4 py-2 font-medium">{formatMoney(receipt.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <Link href="/receipts" className="text-sm hover:underline">
        ← Pajamavimas
      </Link>
    </div>
  );
}
