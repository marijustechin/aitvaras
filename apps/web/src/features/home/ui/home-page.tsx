'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { StockSummary } from '@aitvaras/contracts';
import { formatPieces, formatWeight, RECEIVE_ACTION } from '@/entities/batch';
import { formatMoney } from '@/shared/lib/format';
import { isUnauthorized, useAuth } from '@/features/auth';
import { ApiError, apiFetch } from '@/shared/api';
import { buttonClass, PlusIcon } from '@/shared/ui';
import { homeShowsReceivingAction } from '../lib/home';

type StockState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: StockSummary };

function StockCard({
  title,
  quantity,
  value,
  valuationIncomplete,
}: {
  readonly title: string;
  readonly quantity: string;
  readonly value: string;
  readonly valuationIncomplete: boolean;
}) {
  return (
    <section className='rounded-xl border border-border bg-card p-5 shadow-sm'>
      <h2 className='text-sm font-medium text-muted-foreground'>{title}</h2>
      <dl className='mt-4 grid gap-3'>
        <div className='flex items-baseline justify-between gap-4'>
          <dt className='text-sm text-muted-foreground'>Kiekis</dt>
          <dd className='text-2xl font-semibold tracking-tight tabular-nums'>
            {quantity}
          </dd>
        </div>
        <div className='flex items-baseline justify-between gap-4 border-t border-border pt-3'>
          <dt className='text-sm text-muted-foreground'>Vertė</dt>
          <dd className='text-lg font-medium tabular-nums'>
            {value}
            {valuationIncomplete ? (
              <span aria-label='Vertinimas nepilnas'>*</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * Home dashboard: two read-only stock summary cards.
 *
 * Quantities/costs are aggregated by the API from confirmed batches only. Loading
 * and error states deliberately show placeholders, never a misleading zero.
 */
export function HomePage() {
  const { user, clearSession } = useAuth();
  const router = useRouter();
  const [stock, setStock] = useState<StockState>({ status: 'loading' });

  const load = useCallback(async (): Promise<void> => {
    setStock({ status: 'loading' });
    try {
      const summary = await apiFetch<StockSummary>('/stock/summary');
      setStock({ status: 'ready', summary });
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace('/login');
        return;
      }
      setStock({
        status: 'error',
        message:
          caught instanceof ApiError
            ? caught.message
            : 'Nepavyko įkelti atsargų suvestinės.',
      });
    }
  }, [clearSession, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const showReceiving = user ? homeShowsReceivingAction(user.roles) : false;
  const ready = stock.status === 'ready' ? stock.summary : null;
  const placeholder = '—';
  const incomplete =
    (ready?.weight.valuationIncomplete ?? false) ||
    (ready?.pieces.valuationIncomplete ?? false);

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Suvestinė</h1>
          <p className='text-sm text-muted-foreground'>
            Sveiki, {user?.firstName}.
          </p>
        </div>
        {showReceiving ? (
          <Link
            href={RECEIVE_ACTION.href}
            className={buttonClass('primary', 'sm')}
          >
            <PlusIcon />
            {RECEIVE_ACTION.label}
          </Link>
        ) : null}
      </div>

      {stock.status === 'error' ? (
        <p role='alert' className='text-sm text-destructive'>
          {stock.message}
        </p>
      ) : null}

      <div className='grid gap-4 md:grid-cols-2'>
        <StockCard
          title='Atsargos kilogramais'
          quantity={ready ? formatWeight(ready.weight.quantityKg) : placeholder}
          value={
            ready
              ? ready.weight.value === null
                ? '—'
                : formatMoney(ready.weight.value)
              : placeholder
          }
          valuationIncomplete={ready?.weight.valuationIncomplete ?? false}
        />
        <StockCard
          title='Atsargos vienetais'
          quantity={ready ? formatPieces(ready.pieces.quantity) : placeholder}
          value={
            ready
              ? ready.pieces.value === null
                ? '—'
                : formatMoney(ready.pieces.value)
              : placeholder
          }
          valuationIncomplete={ready?.pieces.valuationIncomplete ?? false}
        />
      </div>

      {incomplete ? (
        <p className='text-xs text-muted-foreground'>
          * Dalies atsargų vertė nenurodyta.
        </p>
      ) : null}

      {stock.status === 'loading' ? (
        <output className='text-sm text-muted-foreground'>
          Kraunama atsargų suvestinė…
        </output>
      ) : null}
    </div>
  );
}
