import { ledgerLabel, signed, timeAgo } from '@/lib/format';
import { BeanIcon, DiamondIcon } from '@/components/ui';

export type LedgerRow = {
  id: string;
  wallet: 'PURCHASED' | 'EARNED';
  kind: string;
  amount: number;
  balanceAfter: number;
  memo: string | null;
  createdAt: Date;
};

/** The ledger is the truth — every entry here was written by adjustWallet. */
export function LedgerList({ entries }: { entries: LedgerRow[] }) {
  if (entries.length === 0) {
    return (
      <p className="card px-4 py-8 text-center text-sm text-slate-500">
        Nothing yet. Send a gift or play a round and it shows up here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      {entries.map((entry) => {
        const credit = entry.amount > 0;
        const bean = entry.wallet === 'EARNED';
        return (
          <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                bean ? 'bg-bean/15 text-bean' : 'bg-diamond/15 text-diamond'
              }`}
            >
              {bean ? <BeanIcon className="h-4 w-4" /> : <DiamondIcon className="h-4 w-4" />}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{ledgerLabel(entry.kind)}</p>
              <p className="truncate text-xs text-slate-500">
                {entry.memo ?? (bean ? 'Beans' : 'Diamonds')} · {timeAgo(entry.createdAt)}
              </p>
            </div>

            <div className="text-right">
              <p
                className={`text-sm font-bold tabular-nums ${
                  credit ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                {signed(entry.amount)}
              </p>
              <p className="text-[11px] tabular-nums text-slate-600">{entry.balanceAfter}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
