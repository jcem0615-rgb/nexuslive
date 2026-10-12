/**
 * In-app notifications. Always written inside the transaction that caused
 * them, so a gift that rolls back cannot leave a "you received a gift" behind.
 */
import type { NotificationKind, Prisma } from '@prisma/client';
import type { Tx } from './wallet';

export type NotifyArgs = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /// Rendered by the client into a link and an effect.
  data?: Prisma.InputJsonValue;
};

export async function notify(tx: Tx, args: NotifyArgs): Promise<void> {
  await tx.notification.create({
    data: {
      userId: args.userId,
      kind: args.kind,
      title: args.title,
      body: args.body,
      data: args.data ?? {},
    },
  });
}

/** Several at once — a seat invite that also pings the host, say. */
export async function notifyMany(tx: Tx, items: readonly NotifyArgs[]): Promise<void> {
  for (const item of items) await notify(tx, item);
}
