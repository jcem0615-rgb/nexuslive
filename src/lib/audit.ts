/**
 * Rule 5: every Master Admin mutation writes an admin_audit_logs row inside
 * the same transaction as the change it describes. If the change rolls back,
 * so does its audit row — and there is no path to a change without one.
 */
import type { Prisma } from '@prisma/client';
import type { Tx } from './wallet';

export type AuditArgs = {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
};

export async function writeAudit(tx: Tx, args: AuditArgs): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      actorId: args.actorId,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      metadata: args.metadata ?? {},
      ip: args.ip,
    },
  });
}
